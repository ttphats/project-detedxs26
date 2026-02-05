package admin

import (
	"database/sql"
	"errors"

	"github.com/ttphats/tedx-backend/internal/db"
	"github.com/ttphats/tedx-backend/internal/models"
	"github.com/ttphats/tedx-backend/internal/services"
	"github.com/ttphats/tedx-backend/internal/utils"
)

type OrderWithItems struct {
	models.Order
	EventName  string             `db:"event_name" json:"eventName"`
	OrderItems []models.OrderItem `json:"orderItems"`
}

type ListOrdersInput struct {
	Page    int    `json:"page"`
	Limit   int    `json:"limit"`
	Status  string `json:"status"`
	EventID string `json:"eventId"`
	Search  string `json:"search"`
}

// ListOrders returns orders with pagination
func ListOrders(input ListOrdersInput) ([]OrderWithItems, *Pagination, error) {
	page := input.Page
	if page < 1 {
		page = 1
	}
	limit := input.Limit
	if limit < 1 {
		limit = 20
	}
	offset := (page - 1) * limit

	query := `SELECT o.*, e.name as event_name FROM orders o LEFT JOIN events e ON o.event_id = e.id WHERE 1=1`
	countQuery := `SELECT COUNT(*) FROM orders o WHERE 1=1`
	var args []interface{}

	if input.Status != "" {
		query += " AND o.status = ?"
		countQuery += " AND o.status = ?"
		args = append(args, input.Status)
	}
	if input.EventID != "" {
		query += " AND o.event_id = ?"
		countQuery += " AND o.event_id = ?"
		args = append(args, input.EventID)
	}
	if input.Search != "" {
		query += " AND (o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_email LIKE ?)"
		countQuery += " AND (o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_email LIKE ?)"
		search := "%" + input.Search + "%"
		args = append(args, search, search, search)
	}

	var total int
	db.DB.Get(&total, countQuery, args...)

	query += " ORDER BY o.created_at DESC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	var orders []OrderWithItems
	err := db.DB.Select(&orders, query, args...)
	if err != nil {
		return nil, nil, err
	}

	// Get order items for each order
	for i := range orders {
		db.DB.Select(&orders[i].OrderItems, "SELECT * FROM order_items WHERE order_id = ?", orders[i].ID)
	}

	return orders, &Pagination{
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: (total + limit - 1) / limit,
	}, nil
}

// ConfirmPayment confirms order payment (admin)
func ConfirmPayment(orderID, adminUserID string) (*models.Order, error) {
	tx, err := db.DB.Beginx()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Get order
	var order models.Order
	err = tx.Get(&order, "SELECT * FROM orders WHERE id = ? AND status = 'PENDING_CONFIRMATION'", orderID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("order not found or not pending confirmation")
		}
		return nil, err
	}

	// Generate new access token for QR code
	accessToken, accessTokenHash := utils.GenerateAccessToken()

	// Update order to PAID
	_, err = tx.Exec(`
		UPDATE orders 
		SET status = 'PAID', paid_at = NOW(), access_token_hash = ?, updated_at = NOW()
		WHERE id = ?
	`, accessTokenHash, orderID)
	if err != nil {
		return nil, err
	}

	// Mark seats as SOLD
	var items []models.OrderItem
	tx.Select(&items, "SELECT * FROM order_items WHERE order_id = ?", orderID)
	for _, item := range items {
		tx.Exec("UPDATE seats SET status = 'SOLD', updated_at = NOW() WHERE id = ?", item.SeatID)
		tx.Exec("DELETE FROM seat_locks WHERE seat_id = ?", item.SeatID)
	}

	// Log audit
	auditID := utils.GenerateUUID()
	tx.Exec(`
		INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, created_at)
		VALUES (?, ?, 'CONFIRM_PAYMENT', 'ORDER', ?, ?, NOW())
	`, auditID, adminUserID, orderID, `{"orderNumber":"`+order.OrderNumber+`"}`)

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	// Send confirmation email
	db.DB.Get(&order, "SELECT * FROM orders WHERE id = ?", orderID)

	var event models.Event
	db.DB.Get(&event, "SELECT * FROM events WHERE id = ?", order.EventID)

	services.SendEmailByPurpose(services.SendEmailByPurposeInput{
		Purpose: "TICKET_CONFIRMATION",
		To:      order.CustomerEmail,
		Variables: map[string]string{
			"customerName": order.CustomerName,
			"orderNumber":  order.OrderNumber,
			"eventName":    event.Name,
			"eventDate":    event.EventDate.Format("02/01/2006"),
			"venue":        event.Venue,
			"ticketUrl":    "/ticket/" + order.OrderNumber + "?token=" + accessToken,
		},
		OrderID: &orderID,
	})

	return &order, nil
}

// RejectPayment rejects order (admin)
func RejectPayment(orderID, reason, adminUserID string) error {
	tx, err := db.DB.Beginx()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Get order
	var order models.Order
	err = tx.Get(&order, "SELECT * FROM orders WHERE id = ? AND status = 'PENDING_CONFIRMATION'", orderID)
	if err != nil {
		return errors.New("order not found or not pending confirmation")
	}

	// Update order to CANCELLED
	tx.Exec(`
		UPDATE orders 
		SET status = 'CANCELLED', cancelled_at = NOW(), cancellation_reason = ?, updated_at = NOW()
		WHERE id = ?
	`, reason, orderID)

	// Release seats back to AVAILABLE
	var items []models.OrderItem
	tx.Select(&items, "SELECT * FROM order_items WHERE order_id = ?", orderID)
	for _, item := range items {
		tx.Exec("UPDATE seats SET status = 'AVAILABLE', updated_at = NOW() WHERE id = ?", item.SeatID)
		tx.Exec("DELETE FROM seat_locks WHERE seat_id = ?", item.SeatID)
	}

	// Log audit
	auditID := utils.GenerateUUID()
	tx.Exec(`
		INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, created_at)
		VALUES (?, ?, 'REJECT_PAYMENT', 'ORDER', ?, ?, NOW())
	`, auditID, adminUserID, orderID, `{"reason":"`+reason+`"}`)

	return tx.Commit()
}


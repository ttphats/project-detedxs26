package services

import (
	"database/sql"
	"errors"
	"time"

	"github.com/ttphats/tedx-backend/internal/db"
	"github.com/ttphats/tedx-backend/internal/models"
	"github.com/ttphats/tedx-backend/internal/utils"
)

type CreatePendingOrderInput struct {
	EventID      string   `json:"eventId"`
	SeatIDs      []string `json:"seatIds"`
	SessionID    string   `json:"sessionId"`
	TicketTypeID *string  `json:"ticketTypeId,omitempty"`
}

type CreatePendingOrderResponse struct {
	OrderID     string `json:"orderId"`
	OrderNumber string `json:"orderNumber"`
	ExpiresAt   string `json:"expiresAt"`
	AccessToken string `json:"accessToken"`
}

// CreatePendingOrder creates a pending order with 15 min expiry
func CreatePendingOrder(input CreatePendingOrderInput) (*CreatePendingOrderResponse, error) {
	if input.EventID == "" || len(input.SeatIDs) == 0 || input.SessionID == "" {
		return nil, errors.New("eventId, seatIds, and sessionId are required")
	}

	tx, err := db.DB.Beginx()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Verify seats are locked by this session
	for _, seatID := range input.SeatIDs {
		var lock models.SeatLock
		err := tx.Get(&lock, `
			SELECT * FROM seat_locks 
			WHERE seat_id = ? AND session_id = ? AND expires_at > NOW()
		`, seatID, input.SessionID)
		if err != nil {
			return nil, errors.New("seat not locked by your session: " + seatID)
		}
	}

	// Calculate total amount
	var totalAmount float64
	for _, seatID := range input.SeatIDs {
		var seat models.Seat
		err := tx.Get(&seat, "SELECT * FROM seats WHERE id = ?", seatID)
		if err != nil {
			return nil, err
		}
		totalAmount += seat.Price
	}

	// Generate order
	orderId := utils.GenerateUUID()
	orderNumber := utils.GenerateOrderNumber()
	accessToken, accessTokenHash := utils.GenerateAccessToken()
	expiresAt := time.Now().Add(15 * time.Minute)

	// Create order with PENDING status
	_, err = tx.Exec(`
		INSERT INTO orders (id, order_number, event_id, total_amount, status, customer_name, customer_email, customer_phone, expires_at, access_token_hash, created_at, updated_at)
		VALUES (?, ?, ?, ?, 'PENDING', '', '', '', ?, ?, NOW(), NOW())
	`, orderId, orderNumber, input.EventID, totalAmount, expiresAt, accessTokenHash)
	if err != nil {
		return nil, err
	}

	// Create order items
	for _, seatID := range input.SeatIDs {
		var seat models.Seat
		tx.Get(&seat, "SELECT * FROM seats WHERE id = ?", seatID)

		itemID := utils.GenerateUUID()
		_, err = tx.Exec(`
			INSERT INTO order_items (id, order_id, seat_id, seat_number, seat_type, price, created_at)
			VALUES (?, ?, ?, ?, ?, ?, NOW())
		`, itemID, orderId, seatID, seat.SeatNumber, seat.SeatType, seat.Price)
		if err != nil {
			return nil, err
		}
	}

	// Extend seat locks to 15 min
	_, err = tx.Exec(`
		UPDATE seat_locks 
		SET expires_at = ? 
		WHERE session_id = ? AND seat_id IN (?)
	`, expiresAt, input.SessionID, input.SeatIDs[0]) // Simplified for first seat

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &CreatePendingOrderResponse{
		OrderID:     orderId,
		OrderNumber: orderNumber,
		ExpiresAt:   expiresAt.Format(time.RFC3339),
		AccessToken: accessToken,
	}, nil
}

type ConfirmPaymentInput struct {
	OrderID       string `json:"orderId"`
	CustomerName  string `json:"customerName"`
	CustomerEmail string `json:"customerEmail"`
	CustomerPhone string `json:"customerPhone"`
	SessionID     string `json:"sessionId"`
}

// ConfirmPayment updates order to PENDING_CONFIRMATION
func ConfirmPayment(input ConfirmPaymentInput) (*models.Order, error) {
	if input.OrderID == "" || input.CustomerName == "" || input.CustomerEmail == "" || input.CustomerPhone == "" {
		return nil, errors.New("orderId, customerName, customerEmail, and customerPhone are required")
	}

	tx, err := db.DB.Beginx()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Get order
	var order models.Order
	err = tx.Get(&order, "SELECT * FROM orders WHERE id = ? AND status = 'PENDING'", input.OrderID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("order not found or already processed")
		}
		return nil, err
	}

	// Update order to PENDING_CONFIRMATION
	_, err = tx.Exec(`
		UPDATE orders 
		SET status = 'PENDING_CONFIRMATION', 
			customer_name = ?, 
			customer_email = ?, 
			customer_phone = ?,
			expires_at = NULL,
			updated_at = NOW()
		WHERE id = ?
	`, input.CustomerName, input.CustomerEmail, input.CustomerPhone, input.OrderID)
	if err != nil {
		return nil, err
	}

	// Get order items and mark seats as RESERVED
	var items []models.OrderItem
	tx.Select(&items, "SELECT * FROM order_items WHERE order_id = ?", input.OrderID)
	for _, item := range items {
		tx.Exec("UPDATE seats SET status = 'RESERVED', updated_at = NOW() WHERE id = ?", item.SeatID)
		// Extend lock to 24 hours
		tx.Exec(`
			UPDATE seat_locks SET expires_at = DATE_ADD(NOW(), INTERVAL 24 HOUR) 
			WHERE seat_id = ?
		`, item.SeatID)
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	// Fetch updated order
	db.DB.Get(&order, "SELECT * FROM orders WHERE id = ?", input.OrderID)
	return &order, nil
}


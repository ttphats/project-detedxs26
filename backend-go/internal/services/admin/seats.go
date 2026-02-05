package admin

import (
	"errors"

	"github.com/ttphats/tedx-backend/internal/db"
	"github.com/ttphats/tedx-backend/internal/models"
	"github.com/ttphats/tedx-backend/internal/utils"
)

type SeatWithTicketType struct {
	models.Seat
	TicketTypeName  *string  `db:"ticket_type_name" json:"ticketTypeName"`
	TicketTypeColor *string  `db:"ticket_type_color" json:"ticketTypeColor"`
	TicketTypePrice *float64 `db:"ticket_type_price" json:"ticketTypePrice"`
}

type ListSeatsInput struct {
	EventID      string `json:"eventId"`
	Status       string `json:"status"`
	Section      string `json:"section"`
	TicketTypeID string `json:"ticketTypeId"`
	Page         int    `json:"page"`
	Limit        int    `json:"limit"`
}

// ListSeats returns seats with filters
func ListSeats(input ListSeatsInput) ([]SeatWithTicketType, *Pagination, error) {
	page := input.Page
	if page < 1 {
		page = 1
	}
	limit := input.Limit
	if limit < 1 {
		limit = 100
	}
	offset := (page - 1) * limit

	query := `
		SELECT s.*, tt.name as ticket_type_name, tt.color as ticket_type_color, tt.price as ticket_type_price
		FROM seats s
		LEFT JOIN ticket_types tt ON s.ticket_type_id = tt.id
		WHERE 1=1
	`
	countQuery := "SELECT COUNT(*) FROM seats WHERE 1=1"
	var args []interface{}

	if input.EventID != "" {
		query += " AND s.event_id = ?"
		countQuery += " AND event_id = ?"
		args = append(args, input.EventID)
	}
	if input.Status != "" {
		query += " AND s.status = ?"
		countQuery += " AND status = ?"
		args = append(args, input.Status)
	}
	if input.Section != "" {
		query += " AND s.section = ?"
		countQuery += " AND section = ?"
		args = append(args, input.Section)
	}
	if input.TicketTypeID != "" {
		query += " AND s.ticket_type_id = ?"
		countQuery += " AND ticket_type_id = ?"
		args = append(args, input.TicketTypeID)
	}

	var total int
	db.DB.Get(&total, countQuery, args...)

	query += " ORDER BY s.section, s.row, s.col LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	var seats []SeatWithTicketType
	err := db.DB.Select(&seats, query, args...)
	if err != nil {
		return nil, nil, err
	}

	return seats, &Pagination{
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: (total + limit - 1) / limit,
	}, nil
}

type CreateSeatInput struct {
	EventID      string   `json:"eventId"`
	SeatNumber   string   `json:"seatNumber"`
	Row          string   `json:"row"`
	Col          string   `json:"col"`
	Section      string   `json:"section"`
	SeatType     string   `json:"seatType"`
	Price        float64  `json:"price"`
	PositionX    *float64 `json:"positionX"`
	PositionY    *float64 `json:"positionY"`
	TicketTypeID *string  `json:"ticketTypeId"`
}

// CreateSeat creates a new seat
func CreateSeat(input CreateSeatInput) (*models.Seat, error) {
	if input.EventID == "" || input.SeatNumber == "" {
		return nil, errors.New("eventId and seatNumber are required")
	}

	id := utils.GenerateUUID()
	_, err := db.DB.Exec(`
		INSERT INTO seats (id, event_id, seat_number, row, col, section, seat_type, price, status, position_x, position_y, ticket_type_id, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', ?, ?, ?, NOW(), NOW())
	`, id, input.EventID, input.SeatNumber, input.Row, input.Col, input.Section, input.SeatType, input.Price, input.PositionX, input.PositionY, input.TicketTypeID)

	if err != nil {
		return nil, err
	}

	var seat models.Seat
	db.DB.Get(&seat, "SELECT * FROM seats WHERE id = ?", id)
	return &seat, nil
}

// BulkCreateSeats creates multiple seats
func BulkCreateSeats(eventID string, seats []CreateSeatInput) (int, error) {
	tx, err := db.DB.Beginx()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	count := 0
	for _, s := range seats {
		id := utils.GenerateUUID()
		_, err := tx.Exec(`
			INSERT INTO seats (id, event_id, seat_number, row, col, section, seat_type, price, status, position_x, position_y, ticket_type_id, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', ?, ?, ?, NOW(), NOW())
		`, id, eventID, s.SeatNumber, s.Row, s.Col, s.Section, s.SeatType, s.Price, s.PositionX, s.PositionY, s.TicketTypeID)
		if err == nil {
			count++
		}
	}

	// Update event available seats
	tx.Exec("UPDATE events SET available_seats = available_seats + ? WHERE id = ?", count, eventID)

	if err := tx.Commit(); err != nil {
		return 0, err
	}

	return count, nil
}

// UpdateSeat updates a seat
func UpdateSeat(id string, data map[string]interface{}) (*models.Seat, error) {
	updates := []string{}
	args := []interface{}{}

	fieldMap := map[string]string{
		"seatNumber": "seat_number", "row": "row", "col": "col",
		"section": "section", "seatType": "seat_type", "price": "price",
		"status": "status", "positionX": "position_x", "positionY": "position_y",
		"ticketTypeId": "ticket_type_id",
	}

	for jsonKey, dbCol := range fieldMap {
		if val, ok := data[jsonKey]; ok {
			updates = append(updates, dbCol+" = ?")
			args = append(args, val)
		}
	}

	if len(updates) == 0 {
		return nil, errors.New("no fields to update")
	}

	query := "UPDATE seats SET " + joinStr(updates, ", ") + ", updated_at = NOW() WHERE id = ?"
	args = append(args, id)

	_, err := db.DB.Exec(query, args...)
	if err != nil {
		return nil, err
	}

	var seat models.Seat
	db.DB.Get(&seat, "SELECT * FROM seats WHERE id = ?", id)
	return &seat, nil
}

// DeleteSeat deletes a seat
func DeleteSeat(id string) error {
	// Check if seat is in any order
	var count int
	db.DB.Get(&count, "SELECT COUNT(*) FROM order_items WHERE seat_id = ?", id)
	if count > 0 {
		return errors.New("cannot delete seat that is part of an order")
	}

	db.DB.Exec("DELETE FROM seat_locks WHERE seat_id = ?", id)
	_, err := db.DB.Exec("DELETE FROM seats WHERE id = ?", id)
	return err
}


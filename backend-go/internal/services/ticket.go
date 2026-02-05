package services

import (
	"database/sql"
	"errors"

	"github.com/ttphats/tedx-backend/internal/db"
	"github.com/ttphats/tedx-backend/internal/models"
	"github.com/ttphats/tedx-backend/internal/utils"
)

type TicketDetails struct {
	Order      models.Order       `json:"order"`
	Event      models.Event       `json:"event"`
	OrderItems []models.OrderItem `json:"orderItems"`
	Seats      []SeatInfo         `json:"seats"`
}

type SeatInfo struct {
	ID         string  `json:"id"`
	SeatNumber string  `json:"seatNumber"`
	Row        string  `json:"row"`
	Section    string  `json:"section"`
	SeatType   string  `json:"seatType"`
	Price      float64 `json:"price"`
}

// GetTicketByToken verifies access token and returns ticket details
func GetTicketByToken(orderNumber, accessToken string) (*TicketDetails, error) {
	if orderNumber == "" || accessToken == "" {
		return nil, errors.New("orderNumber and token are required")
	}

	// Get order by order number
	var order models.Order
	err := db.DB.Get(&order, "SELECT * FROM orders WHERE order_number = ?", orderNumber)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("order not found")
		}
		return nil, err
	}

	// Verify access token using timing-safe comparison
	if !order.AccessTokenHash.Valid {
		return nil, errors.New("access token not set for this order")
	}

	if !utils.VerifyAccessToken(accessToken, order.AccessTokenHash.String) {
		return nil, errors.New("invalid access token")
	}

	// Check order status (must be PAID or PENDING_CONFIRMATION)
	if order.Status != "PAID" && order.Status != "PENDING_CONFIRMATION" {
		return nil, errors.New("order is not confirmed")
	}

	// Get event
	var event models.Event
	err = db.DB.Get(&event, "SELECT * FROM events WHERE id = ?", order.EventID)
	if err != nil {
		return nil, errors.New("event not found")
	}

	// Get order items
	var items []models.OrderItem
	err = db.DB.Select(&items, "SELECT * FROM order_items WHERE order_id = ?", order.ID)
	if err != nil {
		return nil, err
	}

	// Get seat details
	var seats []SeatInfo
	for _, item := range items {
		var seat models.Seat
		err := db.DB.Get(&seat, "SELECT * FROM seats WHERE id = ?", item.SeatID)
		if err == nil {
			seats = append(seats, SeatInfo{
				ID:         seat.ID,
				SeatNumber: seat.SeatNumber,
				Row:        seat.Row,
				Section:    seat.Section,
				SeatType:   seat.SeatType,
				Price:      seat.Price,
			})
		}
	}

	return &TicketDetails{
		Order:      order,
		Event:      event,
		OrderItems: items,
		Seats:      seats,
	}, nil
}


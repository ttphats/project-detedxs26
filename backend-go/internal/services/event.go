package services

import (
	"database/sql"
	"errors"

	"github.com/ttphats/tedx-backend/internal/db"
	"github.com/ttphats/tedx-backend/internal/models"
)

// ListPublishedEvents returns all published events
func ListPublishedEvents() ([]models.Event, error) {
	var events []models.Event
	err := db.DB.Select(&events, `
		SELECT * FROM events 
		WHERE is_published = 1 AND status = 'PUBLISHED'
		ORDER BY event_date DESC
	`)
	if err != nil {
		return nil, err
	}
	return events, nil
}

// GetEventByID returns event by ID
func GetEventByID(id string) (*models.Event, error) {
	var event models.Event
	err := db.DB.Get(&event, "SELECT * FROM events WHERE id = ?", id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("event not found")
		}
		return nil, err
	}
	return &event, nil
}

// GetEventBySlug returns event by slug
func GetEventBySlug(slug string) (*models.Event, error) {
	var event models.Event
	err := db.DB.Get(&event, `
		SELECT * FROM events 
		WHERE slug = ? AND is_published = 1
	`, slug)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("event not found")
		}
		return nil, err
	}
	return &event, nil
}

// EventWithDetails includes related data
type EventWithDetails struct {
	models.Event
	Timelines   []models.EventTimeline `json:"timelines"`
	TicketTypes []TicketTypeInfo       `json:"ticketTypes"`
}

type TicketTypeInfo struct {
	ID          string   `db:"id" json:"id"`
	Name        string   `db:"name" json:"name"`
	Description *string  `db:"description" json:"description"`
	Subtitle    *string  `db:"subtitle" json:"subtitle"`
	Benefits    *string  `db:"benefits" json:"benefits"`
	Price       float64  `db:"price" json:"price"`
	Color       string   `db:"color" json:"color"`
	Icon        string   `db:"icon" json:"icon"`
	MaxQuantity *int     `db:"max_quantity" json:"maxQuantity"`
	SortOrder   int      `db:"sort_order" json:"sortOrder"`
}

// GetEventWithDetails returns event with timelines and ticket types
func GetEventWithDetails(id string) (*EventWithDetails, error) {
	event, err := GetEventByID(id)
	if err != nil {
		return nil, err
	}

	// Get timelines
	var timelines []models.EventTimeline
	err = db.DB.Select(&timelines, `
		SELECT * FROM event_timelines 
		WHERE event_id = ? AND status = 'PUBLISHED'
		ORDER BY order_index, start_time
	`, id)
	if err != nil {
		return nil, err
	}

	// Get ticket types
	var ticketTypes []TicketTypeInfo
	err = db.DB.Select(&ticketTypes, `
		SELECT id, name, description, subtitle, benefits, price, color, icon, max_quantity, sort_order
		FROM ticket_types 
		WHERE event_id = ?
		ORDER BY sort_order, name
	`, id)
	if err != nil {
		return nil, err
	}

	return &EventWithDetails{
		Event:       *event,
		Timelines:   timelines,
		TicketTypes: ticketTypes,
	}, nil
}


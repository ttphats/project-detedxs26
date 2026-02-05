package admin

import (
	"database/sql"
	"errors"

	"github.com/ttphats/tedx-backend/internal/db"
	"github.com/ttphats/tedx-backend/internal/models"
	"github.com/ttphats/tedx-backend/internal/utils"
)

type ListEventsInput struct {
	Page   int    `json:"page"`
	Limit  int    `json:"limit"`
	Status string `json:"status"`
	Search string `json:"search"`
}

type EventsResponse struct {
	Events     []models.Event `json:"events"`
	Pagination Pagination     `json:"pagination"`
}

type Pagination struct {
	Page       int `json:"page"`
	Limit      int `json:"limit"`
	Total      int `json:"total"`
	TotalPages int `json:"totalPages"`
}

// ListEvents returns all events with pagination
func ListEvents(input ListEventsInput) (*EventsResponse, error) {
	page := input.Page
	if page < 1 {
		page = 1
	}
	limit := input.Limit
	if limit < 1 {
		limit = 20
	}
	offset := (page - 1) * limit

	// Build query
	query := "SELECT * FROM events WHERE 1=1"
	countQuery := "SELECT COUNT(*) FROM events WHERE 1=1"
	var args []interface{}

	if input.Status != "" {
		query += " AND status = ?"
		countQuery += " AND status = ?"
		args = append(args, input.Status)
	}

	if input.Search != "" {
		query += " AND (name LIKE ? OR venue LIKE ?)"
		countQuery += " AND (name LIKE ? OR venue LIKE ?)"
		search := "%" + input.Search + "%"
		args = append(args, search, search)
	}

	// Count total
	var total int
	db.DB.Get(&total, countQuery, args...)

	// Get events
	query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	var events []models.Event
	err := db.DB.Select(&events, query, args...)
	if err != nil {
		return nil, err
	}

	return &EventsResponse{
		Events: events,
		Pagination: Pagination{
			Page:       page,
			Limit:      limit,
			Total:      total,
			TotalPages: (total + limit - 1) / limit,
		},
	}, nil
}

type CreateEventInput struct {
	Name           string  `json:"name"`
	Description    string  `json:"description"`
	Venue          string  `json:"venue"`
	EventDate      string  `json:"eventDate"`
	DoorsOpenTime  string  `json:"doorsOpenTime"`
	StartTime      string  `json:"startTime"`
	EndTime        string  `json:"endTime"`
	MaxCapacity    int     `json:"maxCapacity"`
	BannerImageURL *string `json:"bannerImageUrl"`
	ThumbnailURL   *string `json:"thumbnailUrl"`
}

// CreateEvent creates a new event
func CreateEvent(input CreateEventInput) (*models.Event, error) {
	if input.Name == "" || input.Venue == "" {
		return nil, errors.New("name and venue are required")
	}

	id := utils.GenerateUUID()
	slug := utils.GenerateSlug(input.Name)

	// Check if slug exists, append number if needed
	var count int
	db.DB.Get(&count, "SELECT COUNT(*) FROM events WHERE slug = ?", slug)
	if count > 0 {
		slug = slug + "-" + utils.GenerateRandomString(4)
	}

	_, err := db.DB.Exec(`
		INSERT INTO events (id, name, slug, description, venue, event_date, doors_open_time, start_time, end_time, 
		                    status, max_capacity, available_seats, banner_image_url, thumbnail_url, is_published, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, 0, NOW(), NOW())
	`, id, input.Name, slug, input.Description, input.Venue, input.EventDate, input.DoorsOpenTime,
		input.StartTime, input.EndTime, input.MaxCapacity, input.MaxCapacity, input.BannerImageURL, input.ThumbnailURL)

	if err != nil {
		return nil, err
	}

	var event models.Event
	err = db.DB.Get(&event, "SELECT * FROM events WHERE id = ?", id)
	return &event, err
}

// UpdateEvent updates an event
func UpdateEvent(id string, input map[string]interface{}) (*models.Event, error) {
	// Dynamic update query building
	updates := []string{}
	args := []interface{}{}

	fieldMap := map[string]string{
		"name": "name", "description": "description", "venue": "venue",
		"eventDate": "event_date", "doorsOpenTime": "doors_open_time",
		"startTime": "start_time", "endTime": "end_time", "status": "status",
		"maxCapacity": "max_capacity", "bannerImageUrl": "banner_image_url",
		"thumbnailUrl": "thumbnail_url", "isPublished": "is_published",
	}

	for jsonKey, dbCol := range fieldMap {
		if val, ok := input[jsonKey]; ok {
			updates = append(updates, dbCol+" = ?")
			args = append(args, val)
		}
	}

	if len(updates) == 0 {
		return nil, errors.New("no fields to update")
	}

	query := "UPDATE events SET " + joinStr(updates, ", ") + ", updated_at = NOW() WHERE id = ?"
	args = append(args, id)

	_, err := db.DB.Exec(query, args...)
	if err != nil {
		return nil, err
	}

	var event models.Event
	err = db.DB.Get(&event, "SELECT * FROM events WHERE id = ?", id)
	return &event, err
}

// DeleteEvent deletes an event
func DeleteEvent(id string) error {
	// Check if event has orders
	var orderCount int
	db.DB.Get(&orderCount, "SELECT COUNT(*) FROM orders WHERE event_id = ?", id)
	if orderCount > 0 {
		return errors.New("cannot delete event with existing orders")
	}

	// Delete related data
	db.DB.Exec("DELETE FROM seats WHERE event_id = ?", id)
	db.DB.Exec("DELETE FROM seat_locks WHERE event_id = ?", id)
	db.DB.Exec("DELETE FROM event_timelines WHERE event_id = ?", id)
	db.DB.Exec("DELETE FROM ticket_types WHERE event_id = ?", id)

	_, err := db.DB.Exec("DELETE FROM events WHERE id = ?", id)
	return err
}

// GetEventByID gets event by ID
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

func joinStr(arr []string, sep string) string {
	result := ""
	for i, s := range arr {
		if i > 0 {
			result += sep
		}
		result += s
	}
	return result
}


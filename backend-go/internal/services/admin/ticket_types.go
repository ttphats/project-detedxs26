package admin

import (
	"errors"

	"github.com/ttphats/tedx-backend/internal/db"
	"github.com/ttphats/tedx-backend/internal/utils"
)

type TicketType struct {
	ID          string   `db:"id" json:"id"`
	EventID     string   `db:"event_id" json:"eventId"`
	Name        string   `db:"name" json:"name"`
	Description *string  `db:"description" json:"description"`
	Subtitle    *string  `db:"subtitle" json:"subtitle"`
	Benefits    *string  `db:"benefits" json:"benefits"`
	Price       float64  `db:"price" json:"price"`
	Color       string   `db:"color" json:"color"`
	Icon        string   `db:"icon" json:"icon"`
	MaxQuantity *int     `db:"max_quantity" json:"maxQuantity"`
	SortOrder   int      `db:"sort_order" json:"sortOrder"`
	EventName   *string  `db:"event_name" json:"eventName"`
}

type TicketTypesResponse struct {
	TicketTypes []TicketType  `json:"ticketTypes"`
	Events      []EventOption `json:"events"`
}

// ListTicketTypes returns ticket types
func ListTicketTypes(eventID string) (*TicketTypesResponse, error) {
	query := `
		SELECT tt.*, e.name as event_name
		FROM ticket_types tt
		LEFT JOIN events e ON tt.event_id = e.id
		WHERE 1=1
	`
	var args []interface{}

	if eventID != "" {
		query += " AND tt.event_id = ?"
		args = append(args, eventID)
	}

	query += " ORDER BY tt.sort_order, tt.name"

	var ticketTypes []TicketType
	err := db.DB.Select(&ticketTypes, query, args...)
	if err != nil {
		return nil, err
	}

	var events []EventOption
	db.DB.Select(&events, "SELECT id, name FROM events ORDER BY created_at DESC")

	return &TicketTypesResponse{
		TicketTypes: ticketTypes,
		Events:      events,
	}, nil
}

type CreateTicketTypeInput struct {
	EventID     string   `json:"eventId"`
	Name        string   `json:"name"`
	Description *string  `json:"description"`
	Subtitle    *string  `json:"subtitle"`
	Benefits    []string `json:"benefits"`
	Price       float64  `json:"price"`
	Color       string   `json:"color"`
	Icon        string   `json:"icon"`
	MaxQuantity *int     `json:"maxQuantity"`
	SortOrder   int      `json:"sortOrder"`
}

// CreateTicketType creates a new ticket type
func CreateTicketType(input CreateTicketTypeInput) (*TicketType, error) {
	if input.EventID == "" || input.Name == "" {
		return nil, errors.New("eventId and name are required")
	}

	id := utils.GenerateUUID()
	color := input.Color
	if color == "" {
		color = "#10b981"
	}
	icon := input.Icon
	if icon == "" {
		icon = "🎫"
	}

	var benefitsJSON *string
	if len(input.Benefits) > 0 {
		// Simple JSON array
		b := `["` + joinStr(input.Benefits, `","`) + `"]`
		benefitsJSON = &b
	}

	_, err := db.DB.Exec(`
		INSERT INTO ticket_types (id, event_id, name, description, subtitle, benefits, price, color, icon, max_quantity, sort_order, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
	`, id, input.EventID, input.Name, input.Description, input.Subtitle, benefitsJSON, input.Price, color, icon, input.MaxQuantity, input.SortOrder)

	if err != nil {
		return nil, err
	}

	var tt TicketType
	db.DB.Get(&tt, "SELECT * FROM ticket_types WHERE id = ?", id)
	return &tt, nil
}

// AssignTicketTypeToSeats assigns ticket type to seats
func AssignTicketTypeToSeats(ticketTypeID *string, seatIDs []string) (int, error) {
	if len(seatIDs) == 0 {
		return 0, nil
	}

	count := 0
	for _, seatID := range seatIDs {
		result, err := db.DB.Exec(`
			UPDATE seats SET ticket_type_id = ?, updated_at = NOW() WHERE id = ?
		`, ticketTypeID, seatID)
		if err == nil {
			if affected, _ := result.RowsAffected(); affected > 0 {
				count++
			}
		}
	}

	return count, nil
}

// DeleteTicketType deletes a ticket type
func DeleteTicketType(id string) error {
	// Check if any seats use this ticket type
	var count int
	db.DB.Get(&count, "SELECT COUNT(*) FROM seats WHERE ticket_type_id = ?", id)
	if count > 0 {
		return errors.New("cannot delete: seats are using this ticket type")
	}

	_, err := db.DB.Exec("DELETE FROM ticket_types WHERE id = ?", id)
	return err
}


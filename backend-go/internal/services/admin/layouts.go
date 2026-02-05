package admin

import (
	"errors"

	"github.com/ttphats/tedx-backend/internal/db"
	"github.com/ttphats/tedx-backend/internal/utils"
)

type Layout struct {
	ID           string          `db:"id" json:"id"`
	EventID      string          `db:"event_id" json:"eventId"`
	Name         string          `db:"name" json:"name"`
	Status       string          `db:"status" json:"status"`
	CanvasWidth  int             `db:"canvas_width" json:"canvasWidth"`
	CanvasHeight int             `db:"canvas_height" json:"canvasHeight"`
	EventName    *string         `db:"event_name" json:"eventName"`
	CreatedAt    string          `db:"created_at" json:"createdAt"`
	UpdatedAt    string          `db:"updated_at" json:"updatedAt"`
	Sections     []LayoutSection `json:"sections"`
}

type LayoutSection struct {
	ID        string `db:"id" json:"id"`
	LayoutID  string `db:"layout_id" json:"layoutId"`
	Name      string `db:"name" json:"name"`
	SortOrder int    `db:"sort_order" json:"sortOrder"`
}

type LayoutsResponse struct {
	Layouts []Layout      `json:"layouts"`
	Events  []EventOption `json:"events"`
}

// ListLayouts returns layouts with sections
func ListLayouts(eventID string) (*LayoutsResponse, error) {
	query := `
		SELECT l.*, e.name as event_name
		FROM layouts l
		LEFT JOIN events e ON l.event_id = e.id
		WHERE 1=1
	`
	var args []interface{}

	if eventID != "" {
		query += " AND l.event_id = ?"
		args = append(args, eventID)
	}

	query += " ORDER BY l.created_at DESC"

	var layouts []Layout
	err := db.DB.Select(&layouts, query, args...)
	if err != nil {
		return nil, err
	}

	// Get sections for each layout
	for i := range layouts {
		var sections []LayoutSection
		db.DB.Select(&sections, "SELECT * FROM layout_sections WHERE layout_id = ? ORDER BY sort_order", layouts[i].ID)
		layouts[i].Sections = sections
	}

	var events []EventOption
	db.DB.Select(&events, "SELECT id, name FROM events ORDER BY created_at DESC")

	return &LayoutsResponse{
		Layouts: layouts,
		Events:  events,
	}, nil
}

// CreateLayout creates a new layout
func CreateLayout(eventID, name string) (*Layout, error) {
	if eventID == "" {
		return nil, errors.New("eventId is required")
	}

	id := utils.GenerateUUID()
	if name == "" {
		name = "New Layout"
	}

	_, err := db.DB.Exec(`
		INSERT INTO layouts (id, event_id, name, status, canvas_width, canvas_height, created_at, updated_at)
		VALUES (?, ?, ?, 'DRAFT', 1000, 600, NOW(), NOW())
	`, id, eventID, name)

	if err != nil {
		return nil, err
	}

	var layout Layout
	db.DB.Get(&layout, "SELECT * FROM layouts WHERE id = ?", id)
	layout.Sections = []LayoutSection{}
	return &layout, nil
}

// UpdateLayout updates a layout
func UpdateLayout(id string, data map[string]interface{}) error {
	updates := []string{}
	args := []interface{}{}

	if name, ok := data["name"].(string); ok {
		updates = append(updates, "name = ?")
		args = append(args, name)
	}
	if status, ok := data["status"].(string); ok {
		updates = append(updates, "status = ?")
		args = append(args, status)
	}

	if len(updates) == 0 {
		return errors.New("no fields to update")
	}

	query := "UPDATE layouts SET " + joinStr(updates, ", ") + ", updated_at = NOW() WHERE id = ?"
	args = append(args, id)

	_, err := db.DB.Exec(query, args...)
	return err
}

// DeleteLayout deletes a layout and its sections
func DeleteLayout(id string) error {
	db.DB.Exec("DELETE FROM layout_sections WHERE layout_id = ?", id)
	_, err := db.DB.Exec("DELETE FROM layouts WHERE id = ?", id)
	return err
}


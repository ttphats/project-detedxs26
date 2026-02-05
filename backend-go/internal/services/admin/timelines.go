package admin

import (
	"errors"
	"regexp"

	"github.com/ttphats/tedx-backend/internal/db"
	"github.com/ttphats/tedx-backend/internal/models"
	"github.com/ttphats/tedx-backend/internal/utils"
)

// ListTimelines returns timelines with optional filters
func ListTimelines(eventID, status string) ([]models.EventTimeline, error) {
	query := "SELECT * FROM event_timelines WHERE 1=1"
	var args []interface{}

	if eventID != "" {
		query += " AND event_id = ?"
		args = append(args, eventID)
	}
	if status != "" {
		query += " AND status = ?"
		args = append(args, status)
	}

	query += " ORDER BY order_index, start_time"

	var timelines []models.EventTimeline
	err := db.DB.Select(&timelines, query, args...)
	return timelines, err
}

type CreateTimelineInput struct {
	EventID          string  `json:"eventId"`
	StartTime        string  `json:"startTime"`
	EndTime          string  `json:"endTime"`
	Title            string  `json:"title"`
	Description      *string `json:"description"`
	SpeakerName      *string `json:"speakerName"`
	SpeakerAvatarURL *string `json:"speakerAvatarUrl"`
	Type             string  `json:"type"`
	OrderIndex       int     `json:"orderIndex"`
	Status           string  `json:"status"`
}

// CreateTimeline creates a new timeline
func CreateTimeline(input CreateTimelineInput) (*models.EventTimeline, error) {
	if input.EventID == "" || input.StartTime == "" || input.EndTime == "" || input.Title == "" {
		return nil, errors.New("eventId, startTime, endTime, and title are required")
	}

	// Validate time format (HH:mm)
	timeRegex := regexp.MustCompile(`^([01]?[0-9]|2[0-3]):[0-5][0-9]$`)
	if !timeRegex.MatchString(input.StartTime) || !timeRegex.MatchString(input.EndTime) {
		return nil, errors.New("invalid time format. Use HH:mm")
	}

	// Validate type
	validTypes := map[string]bool{"TALK": true, "BREAK": true, "CHECKIN": true, "OTHER": true, "SPEAKER": true}
	typ := input.Type
	if typ == "" {
		typ = "OTHER"
	}
	if !validTypes[typ] {
		return nil, errors.New("invalid type")
	}

	status := input.Status
	if status == "" {
		status = "DRAFT"
	}

	id := utils.GenerateUUID()
	_, err := db.DB.Exec(`
		INSERT INTO event_timelines (id, event_id, start_time, end_time, title, description, speaker_name, speaker_avatar_url, type, order_index, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
	`, id, input.EventID, input.StartTime, input.EndTime, input.Title, input.Description, input.SpeakerName, input.SpeakerAvatarURL, typ, input.OrderIndex, status)

	if err != nil {
		return nil, err
	}

	var timeline models.EventTimeline
	db.DB.Get(&timeline, "SELECT * FROM event_timelines WHERE id = ?", id)
	return &timeline, nil
}

// UpdateTimeline updates a timeline
func UpdateTimeline(id string, data map[string]interface{}) (*models.EventTimeline, error) {
	updates := []string{}
	args := []interface{}{}

	fieldMap := map[string]string{
		"startTime": "start_time", "endTime": "end_time", "title": "title",
		"description": "description", "speakerName": "speaker_name",
		"speakerAvatarUrl": "speaker_avatar_url", "type": "type",
		"orderIndex": "order_index", "status": "status",
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

	query := "UPDATE event_timelines SET " + joinStr(updates, ", ") + ", updated_at = NOW() WHERE id = ?"
	args = append(args, id)

	db.DB.Exec(query, args...)

	var timeline models.EventTimeline
	db.DB.Get(&timeline, "SELECT * FROM event_timelines WHERE id = ?", id)
	return &timeline, nil
}

// DeleteTimeline deletes a timeline
func DeleteTimeline(id string) error {
	_, err := db.DB.Exec("DELETE FROM event_timelines WHERE id = ?", id)
	return err
}


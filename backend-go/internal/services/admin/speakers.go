package admin

import (
	"errors"

	"github.com/ttphats/tedx-backend/internal/db"
	"github.com/ttphats/tedx-backend/internal/models"
	"github.com/ttphats/tedx-backend/internal/utils"
)

type SpeakersResponse struct {
	Speakers []models.EventTimeline `json:"speakers"`
	Events   []EventOption          `json:"events"`
}

type EventOption struct {
	ID   string `db:"id" json:"id"`
	Name string `db:"name" json:"name"`
}

// ListSpeakers returns speakers (timelines with type SPEAKER)
func ListSpeakers(eventID string) (*SpeakersResponse, error) {
	query := `
		SELECT * FROM event_timelines 
		WHERE type = 'SPEAKER'
	`
	var args []interface{}

	if eventID != "" {
		query += " AND event_id = ?"
		args = append(args, eventID)
	}

	query += " ORDER BY order_index, start_time"

	var speakers []models.EventTimeline
	err := db.DB.Select(&speakers, query, args...)
	if err != nil {
		return nil, err
	}

	var events []EventOption
	db.DB.Select(&events, "SELECT id, name FROM events ORDER BY created_at DESC")

	return &SpeakersResponse{
		Speakers: speakers,
		Events:   events,
	}, nil
}

type CreateSpeakerInput struct {
	EventID          string  `json:"eventId"`
	StartTime        string  `json:"startTime"`
	EndTime          string  `json:"endTime"`
	Title            string  `json:"title"`
	Description      *string `json:"description"`
	SpeakerName      *string `json:"speakerName"`
	SpeakerAvatarURL *string `json:"speakerAvatarUrl"`
	OrderIndex       int     `json:"orderIndex"`
	Status           string  `json:"status"`
}

// CreateSpeaker creates a new speaker/timeline
func CreateSpeaker(input CreateSpeakerInput) (*models.EventTimeline, error) {
	if input.EventID == "" || input.Title == "" {
		return nil, errors.New("eventId and title are required")
	}

	id := utils.GenerateUUID()
	status := input.Status
	if status == "" {
		status = "DRAFT"
	}

	_, err := db.DB.Exec(`
		INSERT INTO event_timelines (id, event_id, start_time, end_time, title, description, speaker_name, speaker_avatar_url, type, order_index, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SPEAKER', ?, ?, NOW(), NOW())
	`, id, input.EventID, input.StartTime, input.EndTime, input.Title, input.Description, input.SpeakerName, input.SpeakerAvatarURL, input.OrderIndex, status)

	if err != nil {
		return nil, err
	}

	var speaker models.EventTimeline
	db.DB.Get(&speaker, "SELECT * FROM event_timelines WHERE id = ?", id)
	return &speaker, nil
}

// UpdateSpeaker updates a speaker/timeline
func UpdateSpeaker(id string, data map[string]interface{}) (*models.EventTimeline, error) {
	updates := []string{}
	args := []interface{}{}

	fieldMap := map[string]string{
		"startTime": "start_time", "endTime": "end_time", "title": "title",
		"description": "description", "speakerName": "speaker_name",
		"speakerAvatarUrl": "speaker_avatar_url", "orderIndex": "order_index",
		"status": "status",
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

	_, err := db.DB.Exec(query, args...)
	if err != nil {
		return nil, err
	}

	var speaker models.EventTimeline
	db.DB.Get(&speaker, "SELECT * FROM event_timelines WHERE id = ?", id)
	return &speaker, nil
}

// DeleteSpeaker deletes a speaker/timeline
func DeleteSpeaker(id string) error {
	_, err := db.DB.Exec("DELETE FROM event_timelines WHERE id = ?", id)
	return err
}


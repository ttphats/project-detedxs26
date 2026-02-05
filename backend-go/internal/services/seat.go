package services

import (
	"database/sql"
	"errors"
	"time"

	"github.com/ttphats/tedx-backend/internal/config"
	"github.com/ttphats/tedx-backend/internal/db"
	"github.com/ttphats/tedx-backend/internal/models"
	"github.com/ttphats/tedx-backend/internal/utils"
)

type SeatWithLock struct {
	models.Seat
	IsLocked       bool       `json:"isLocked"`
	LockedByMe     bool       `json:"lockedByMe"`
	LockExpiresAt  *time.Time `json:"lockExpiresAt,omitempty"`
	TicketTypeName *string    `json:"ticketTypeName,omitempty"`
}

// GetEventSeats returns all seats for an event with lock status
func GetEventSeats(eventID, sessionID string) ([]SeatWithLock, error) {
	// Get all seats for event
	var seats []models.Seat
	err := db.DB.Select(&seats, `
		SELECT * FROM seats WHERE event_id = ? ORDER BY section, row, col
	`, eventID)
	if err != nil {
		return nil, err
	}

	// Get active locks (not expired)
	type LockInfo struct {
		SeatID    string    `db:"seat_id"`
		SessionID string    `db:"session_id"`
		ExpiresAt time.Time `db:"expires_at"`
	}
	var locks []LockInfo
	err = db.DB.Select(&locks, `
		SELECT seat_id, session_id, expires_at 
		FROM seat_locks 
		WHERE event_id = ? AND expires_at > NOW()
	`, eventID)
	if err != nil {
		return nil, err
	}

	// Build lock map
	lockMap := make(map[string]LockInfo)
	for _, lock := range locks {
		lockMap[lock.SeatID] = lock
	}

	// Build response
	result := make([]SeatWithLock, len(seats))
	for i, seat := range seats {
		result[i] = SeatWithLock{Seat: seat}
		if lock, ok := lockMap[seat.ID]; ok {
			result[i].IsLocked = true
			result[i].LockedByMe = lock.SessionID == sessionID
			result[i].LockExpiresAt = &lock.ExpiresAt
		}
	}

	return result, nil
}

// LockSeats locks seats for a session
func LockSeats(eventID string, seatIDs []string, sessionID string, ticketTypeID *string) error {
	if len(seatIDs) == 0 {
		return errors.New("no seats to lock")
	}

	cfg := config.AppConfig
	lockDuration := time.Duration(cfg.SeatLockTTL) * time.Second
	expiresAt := time.Now().Add(lockDuration)

	tx, err := db.DB.Beginx()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, seatID := range seatIDs {
		// Check if seat is available
		var seat models.Seat
		err := tx.Get(&seat, "SELECT * FROM seats WHERE id = ? AND event_id = ?", seatID, eventID)
		if err != nil {
			if err == sql.ErrNoRows {
				return errors.New("seat not found: " + seatID)
			}
			return err
		}

		if seat.Status != "AVAILABLE" {
			return errors.New("seat not available: " + seat.SeatNumber)
		}

		// Check existing lock (not by this session)
		var existingLock models.SeatLock
		err = tx.Get(&existingLock, `
			SELECT * FROM seat_locks 
			WHERE seat_id = ? AND session_id != ? AND expires_at > NOW()
		`, seatID, sessionID)

		if err == nil {
			return errors.New("seat already locked by another user: " + seat.SeatNumber)
		} else if err != sql.ErrNoRows {
			return err
		}

		// Upsert lock
		lockID := utils.GenerateUUID()
		_, err = tx.Exec(`
			INSERT INTO seat_locks (id, seat_id, event_id, session_id, ticket_type_id, expires_at, created_at)
			VALUES (?, ?, ?, ?, ?, ?, NOW())
			ON DUPLICATE KEY UPDATE 
				session_id = VALUES(session_id), 
				ticket_type_id = VALUES(ticket_type_id), 
				expires_at = VALUES(expires_at)
		`, lockID, seatID, eventID, sessionID, ticketTypeID, expiresAt)

		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

// UnlockSeats releases seat locks for a session
func UnlockSeats(eventID string, seatIDs []string, sessionID string) error {
	if len(seatIDs) == 0 {
		// Unlock all seats for this session
		_, err := db.DB.Exec(`
			DELETE FROM seat_locks 
			WHERE event_id = ? AND session_id = ?
		`, eventID, sessionID)
		return err
	}

	for _, seatID := range seatIDs {
		_, err := db.DB.Exec(`
			DELETE FROM seat_locks 
			WHERE seat_id = ? AND session_id = ?
		`, seatID, sessionID)
		if err != nil {
			return err
		}
	}

	return nil
}

// GetSessionLocks returns locks for a session
func GetSessionLocks(eventID, sessionID string) ([]models.SeatLock, error) {
	var locks []models.SeatLock
	err := db.DB.Select(&locks, `
		SELECT * FROM seat_locks 
		WHERE event_id = ? AND session_id = ? AND expires_at > NOW()
	`, eventID, sessionID)
	return locks, err
}

// ExtendSeatLock extends lock duration
func ExtendSeatLock(eventID, sessionID string, seatIDs []string, durationMinutes int) error {
	expiresAt := time.Now().Add(time.Duration(durationMinutes) * time.Minute)

	if len(seatIDs) == 0 {
		_, err := db.DB.Exec(`
			UPDATE seat_locks 
			SET expires_at = ? 
			WHERE event_id = ? AND session_id = ?
		`, expiresAt, eventID, sessionID)
		return err
	}

	for _, seatID := range seatIDs {
		_, err := db.DB.Exec(`
			UPDATE seat_locks 
			SET expires_at = ? 
			WHERE seat_id = ? AND session_id = ?
		`, expiresAt, seatID, sessionID)
		if err != nil {
			return err
		}
	}

	return nil
}


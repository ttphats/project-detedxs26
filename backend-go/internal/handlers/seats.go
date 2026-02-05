package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/ttphats/tedx-backend/internal/services"
	"github.com/ttphats/tedx-backend/internal/utils"
)

type LockSeatsRequest struct {
	EventID      string   `json:"eventId"`
	SeatIDs      []string `json:"seatIds"`
	SessionID    string   `json:"sessionId"`
	TicketTypeID *string  `json:"ticketTypeId"`
}

// LockSeats handles POST /api/seats/lock
func LockSeats(c *fiber.Ctx) error {
	var req LockSeatsRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	if req.EventID == "" || len(req.SeatIDs) == 0 || req.SessionID == "" {
		return utils.BadRequest(c, "eventId, seatIds, and sessionId are required")
	}

	err := services.LockSeats(req.EventID, req.SeatIDs, req.SessionID, req.TicketTypeID)
	if err != nil {
		return utils.BadRequest(c, err.Error())
	}

	return utils.SuccessMessage(c, "Seats locked successfully")
}

// GetSessionLocks handles GET /api/seats/lock
func GetSessionLocks(c *fiber.Ctx) error {
	eventID := c.Query("eventId")
	sessionID := c.Query("sessionId")

	if eventID == "" || sessionID == "" {
		return utils.BadRequest(c, "eventId and sessionId are required")
	}

	locks, err := services.GetSessionLocks(eventID, sessionID)
	if err != nil {
		return utils.InternalError(c, err.Error())
	}

	return utils.SuccessResponse(c, fiber.Map{
		"locks": locks,
	})
}

type UnlockSeatsRequest struct {
	EventID   string   `json:"eventId"`
	SeatIDs   []string `json:"seatIds"`
	SessionID string   `json:"sessionId"`
}

// UnlockSeats handles DELETE /api/seats/lock
func UnlockSeats(c *fiber.Ctx) error {
	var req UnlockSeatsRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	if req.EventID == "" || req.SessionID == "" {
		return utils.BadRequest(c, "eventId and sessionId are required")
	}

	err := services.UnlockSeats(req.EventID, req.SeatIDs, req.SessionID)
	if err != nil {
		return utils.InternalError(c, err.Error())
	}

	return utils.SuccessMessage(c, "Seats unlocked successfully")
}

type ExtendLockRequest struct {
	EventID         string   `json:"eventId"`
	SeatIDs         []string `json:"seatIds"`
	SessionID       string   `json:"sessionId"`
	DurationMinutes int      `json:"durationMinutes"`
}

// ExtendSeatLock handles POST /api/seats/extend-lock
func ExtendSeatLock(c *fiber.Ctx) error {
	var req ExtendLockRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.BadRequest(c, "Invalid request body")
	}

	if req.EventID == "" || req.SessionID == "" {
		return utils.BadRequest(c, "eventId and sessionId are required")
	}

	duration := req.DurationMinutes
	if duration <= 0 {
		duration = 15
	}

	err := services.ExtendSeatLock(req.EventID, req.SessionID, req.SeatIDs, duration)
	if err != nil {
		return utils.InternalError(c, err.Error())
	}

	return utils.SuccessMessage(c, "Lock extended successfully")
}


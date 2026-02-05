package services

import (
	"log"

	"github.com/ttphats/tedx-backend/internal/db"
)

type CronResult struct {
	ExpiredOrders int `json:"expiredOrders,omitempty"`
	CleanedLocks  int `json:"cleanedLocks,omitempty"`
	ReleasedSeats int `json:"releasedSeats,omitempty"`
}

// ExpireOrders expires PENDING orders that have passed their expiry time
func ExpireOrders() (*CronResult, error) {
	tx, err := db.DB.Beginx()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Get expired pending orders
	type ExpiredOrder struct {
		ID string `db:"id"`
	}
	var expiredOrders []ExpiredOrder
	err = tx.Select(&expiredOrders, `
		SELECT id FROM orders 
		WHERE status = 'PENDING' AND expires_at IS NOT NULL AND expires_at < NOW()
	`)
	if err != nil {
		return nil, err
	}

	expiredCount := 0
	releasedSeats := 0

	for _, order := range expiredOrders {
		// Get order items to release seats
		type OrderItemSeat struct {
			SeatID string `db:"seat_id"`
		}
		var items []OrderItemSeat
		tx.Select(&items, "SELECT seat_id FROM order_items WHERE order_id = ?", order.ID)

		// Release seats back to AVAILABLE
		for _, item := range items {
			result, err := tx.Exec(`
				UPDATE seats SET status = 'AVAILABLE', updated_at = NOW() 
				WHERE id = ? AND status != 'SOLD'
			`, item.SeatID)
			if err == nil {
				if affected, _ := result.RowsAffected(); affected > 0 {
					releasedSeats++
				}
			}

			// Delete seat lock
			tx.Exec("DELETE FROM seat_locks WHERE seat_id = ?", item.SeatID)
		}

		// Update order status to EXPIRED
		_, err := tx.Exec(`
			UPDATE orders SET status = 'EXPIRED', updated_at = NOW() WHERE id = ?
		`, order.ID)
		if err == nil {
			expiredCount++
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	log.Printf("Expired %d orders, released %d seats", expiredCount, releasedSeats)

	return &CronResult{
		ExpiredOrders: expiredCount,
		ReleasedSeats: releasedSeats,
	}, nil
}

// CleanupLocks removes expired seat locks
func CleanupLocks() (*CronResult, error) {
	result, err := db.DB.Exec("DELETE FROM seat_locks WHERE expires_at < NOW()")
	if err != nil {
		return nil, err
	}

	affected, _ := result.RowsAffected()
	log.Printf("Cleaned up %d expired seat locks", affected)

	return &CronResult{
		CleanedLocks: int(affected),
	}, nil
}


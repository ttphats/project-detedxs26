package admin

import (
	"github.com/ttphats/tedx-backend/internal/db"
)

type AuditLog struct {
	ID         string  `db:"id" json:"id"`
	UserID     *string `db:"user_id" json:"userId"`
	Username   *string `db:"username" json:"username"`
	Action     string  `db:"action" json:"action"`
	EntityType string  `db:"entity_type" json:"entityType"`
	EntityID   string  `db:"entity_id" json:"entityId"`
	Details    *string `db:"details" json:"details"`
	IPAddress  *string `db:"ip_address" json:"ipAddress"`
	CreatedAt  string  `db:"created_at" json:"createdAt"`
}

type ListAuditLogsInput struct {
	Page       int    `json:"page"`
	Limit      int    `json:"limit"`
	UserID     string `json:"userId"`
	Action     string `json:"action"`
	EntityType string `json:"entityType"`
}

// ListAuditLogs returns audit logs with pagination
func ListAuditLogs(input ListAuditLogsInput) ([]AuditLog, *Pagination, error) {
	page := input.Page
	if page < 1 {
		page = 1
	}
	limit := input.Limit
	if limit < 1 {
		limit = 50
	}
	offset := (page - 1) * limit

	query := `
		SELECT a.*, u.username
		FROM audit_logs a
		LEFT JOIN users u ON a.user_id = u.id
		WHERE 1=1
	`
	countQuery := "SELECT COUNT(*) FROM audit_logs WHERE 1=1"
	var args []interface{}

	if input.UserID != "" {
		query += " AND a.user_id = ?"
		countQuery += " AND user_id = ?"
		args = append(args, input.UserID)
	}
	if input.Action != "" {
		query += " AND a.action = ?"
		countQuery += " AND action = ?"
		args = append(args, input.Action)
	}
	if input.EntityType != "" {
		query += " AND a.entity_type = ?"
		countQuery += " AND entity_type = ?"
		args = append(args, input.EntityType)
	}

	var total int
	db.DB.Get(&total, countQuery, args...)

	query += " ORDER BY a.created_at DESC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	var logs []AuditLog
	err := db.DB.Select(&logs, query, args...)
	if err != nil {
		return nil, nil, err
	}

	return logs, &Pagination{
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: (total + limit - 1) / limit,
	}, nil
}


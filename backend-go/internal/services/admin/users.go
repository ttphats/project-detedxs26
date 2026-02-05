package admin

import (
	"database/sql"
	"errors"

	"github.com/ttphats/tedx-backend/internal/db"
	"github.com/ttphats/tedx-backend/internal/models"
	"github.com/ttphats/tedx-backend/internal/utils"
)

type ListUsersInput struct {
	Page   int    `json:"page"`
	Limit  int    `json:"limit"`
	Search string `json:"search"`
	Role   string `json:"role"`
	Status string `json:"status"`
}

// ListUsers returns users with pagination
func ListUsers(input ListUsersInput) ([]models.User, *Pagination, error) {
	page := input.Page
	if page < 1 {
		page = 1
	}
	limit := input.Limit
	if limit < 1 {
		limit = 20
	}
	offset := (page - 1) * limit

	query := `
		SELECT u.*, r.name as role_name 
		FROM users u 
		LEFT JOIN roles r ON u.role_id = r.id
		WHERE 1=1
	`
	countQuery := "SELECT COUNT(*) FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE 1=1"
	var args []interface{}

	if input.Search != "" {
		query += " AND (u.username LIKE ? OR u.email LIKE ? OR u.full_name LIKE ?)"
		countQuery += " AND (u.username LIKE ? OR u.email LIKE ? OR u.full_name LIKE ?)"
		search := "%" + input.Search + "%"
		args = append(args, search, search, search)
	}
	if input.Role != "" {
		query += " AND r.name = ?"
		countQuery += " AND r.name = ?"
		args = append(args, input.Role)
	}
	if input.Status == "active" {
		query += " AND u.is_active = 1"
		countQuery += " AND u.is_active = 1"
	} else if input.Status == "inactive" {
		query += " AND u.is_active = 0"
		countQuery += " AND u.is_active = 0"
	}

	var total int
	db.DB.Get(&total, countQuery, args...)

	query += " ORDER BY u.created_at DESC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	var users []models.User
	err := db.DB.Select(&users, query, args...)
	if err != nil {
		return nil, nil, err
	}

	// Clear password hashes
	for i := range users {
		users[i].PasswordHash = ""
	}

	return users, &Pagination{
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: (total + limit - 1) / limit,
	}, nil
}

type CreateUserInput struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
	FullName string `json:"fullName"`
	Phone    string `json:"phone"`
	Role     string `json:"role"`
}

// CreateUser creates a new user
func CreateUser(input CreateUserInput) (*models.User, error) {
	if input.Username == "" || input.Email == "" || input.Password == "" {
		return nil, errors.New("username, email and password are required")
	}

	// Check username
	var count int
	db.DB.Get(&count, "SELECT COUNT(*) FROM users WHERE username = ?", input.Username)
	if count > 0 {
		return nil, errors.New("username already exists")
	}

	// Get role
	var roleID string
	err := db.DB.Get(&roleID, "SELECT id FROM roles WHERE name = ?", input.Role)
	if err != nil {
		return nil, errors.New("role not found: " + input.Role)
	}

	hash, err := utils.HashPassword(input.Password)
	if err != nil {
		return nil, err
	}

	id := utils.GenerateUUID()
	fullName := input.FullName
	if fullName == "" {
		fullName = input.Username
	}

	_, err = db.DB.Exec(`
		INSERT INTO users (id, username, email, password_hash, full_name, phone_number, role_id, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
	`, id, input.Username, input.Email, hash, fullName, input.Phone, roleID)

	if err != nil {
		return nil, err
	}

	var user models.User
	db.DB.Get(&user, "SELECT u.*, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = ?", id)
	user.PasswordHash = ""
	return &user, nil
}

// UpdateUser updates a user
func UpdateUser(id string, data map[string]interface{}) (*models.User, error) {
	updates := []string{}
	args := []interface{}{}

	if email, ok := data["email"].(string); ok {
		updates = append(updates, "email = ?")
		args = append(args, email)
	}
	if fullName, ok := data["fullName"].(string); ok {
		updates = append(updates, "full_name = ?")
		args = append(args, fullName)
	}
	if phone, ok := data["phone"].(string); ok {
		updates = append(updates, "phone_number = ?")
		args = append(args, phone)
	}
	if isActive, ok := data["isActive"].(bool); ok {
		updates = append(updates, "is_active = ?")
		args = append(args, isActive)
	}
	if role, ok := data["role"].(string); ok {
		var roleID string
		err := db.DB.Get(&roleID, "SELECT id FROM roles WHERE name = ?", role)
		if err == nil {
			updates = append(updates, "role_id = ?")
			args = append(args, roleID)
		}
	}

	if len(updates) == 0 {
		return nil, errors.New("no fields to update")
	}

	query := "UPDATE users SET " + joinStr(updates, ", ") + ", updated_at = NOW() WHERE id = ?"
	args = append(args, id)

	db.DB.Exec(query, args...)

	var user models.User
	db.DB.Get(&user, "SELECT u.*, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = ?", id)
	user.PasswordHash = ""
	return &user, nil
}

// DeleteUser deletes a user
func DeleteUser(id string) error {
	_, err := db.DB.Exec("DELETE FROM users WHERE id = ?", id)
	return err
}

// GetUserByID gets user by ID
func GetUserByID(id string) (*models.User, error) {
	var user models.User
	err := db.DB.Get(&user, "SELECT u.*, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = ?", id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("user not found")
		}
		return nil, err
	}
	user.PasswordHash = ""
	return &user, nil
}

// CanManageRole checks if actor can manage target role
func CanManageRole(actorRole, targetRole string) bool {
	if targetRole == "ADMIN" && actorRole != "SUPER_ADMIN" {
		return false
	}
	return true
}


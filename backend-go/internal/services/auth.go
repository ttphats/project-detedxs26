package services

import (
	"database/sql"
	"errors"

	"github.com/ttphats/tedx-backend/internal/db"
	"github.com/ttphats/tedx-backend/internal/models"
	"github.com/ttphats/tedx-backend/internal/utils"
)

type LoginInput struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token string      `json:"token"`
	User  models.User `json:"user"`
}

type RegisterInput struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
	FullName string `json:"fullName"`
}

// Login authenticates user and returns JWT token
func Login(input LoginInput) (*LoginResponse, error) {
	if input.Username == "" || input.Password == "" {
		return nil, errors.New("username and password are required")
	}

	var user models.User
	err := db.DB.Get(&user, `
		SELECT u.*, r.name as role_name 
		FROM users u 
		LEFT JOIN roles r ON u.role_id = r.id 
		WHERE u.username = ? AND u.is_active = 1
	`, input.Username)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("invalid credentials")
		}
		return nil, err
	}

	// Check password
	if !utils.CheckPassword(input.Password, user.PasswordHash) {
		return nil, errors.New("invalid credentials")
	}

	// Generate token
	token, err := utils.GenerateToken(user.ID, user.Username, user.RoleName)
	if err != nil {
		return nil, err
	}

	// Clear password hash from response
	user.PasswordHash = ""

	return &LoginResponse{
		Token: token,
		User:  user,
	}, nil
}

// Register creates new user account
func Register(input RegisterInput) (*models.User, error) {
	if input.Username == "" || input.Email == "" || input.Password == "" {
		return nil, errors.New("username, email and password are required")
	}

	// Check if username exists
	var count int
	err := db.DB.Get(&count, "SELECT COUNT(*) FROM users WHERE username = ?", input.Username)
	if err != nil {
		return nil, err
	}
	if count > 0 {
		return nil, errors.New("username already exists")
	}

	// Check if email exists
	err = db.DB.Get(&count, "SELECT COUNT(*) FROM users WHERE email = ?", input.Email)
	if err != nil {
		return nil, err
	}
	if count > 0 {
		return nil, errors.New("email already exists")
	}

	// Get default role (USER)
	var roleID string
	err = db.DB.Get(&roleID, "SELECT id FROM roles WHERE name = 'USER' LIMIT 1")
	if err != nil {
		// Create default role if not exists
		roleID = utils.GenerateUUID()
		_, err = db.DB.Exec("INSERT INTO roles (id, name) VALUES (?, 'USER')", roleID)
		if err != nil {
			return nil, err
		}
	}

	// Hash password
	hash, err := utils.HashPassword(input.Password)
	if err != nil {
		return nil, err
	}

	// Create user
	userID := utils.GenerateUUID()
	fullName := input.FullName
	if fullName == "" {
		fullName = input.Username
	}

	_, err = db.DB.Exec(`
		INSERT INTO users (id, username, email, password_hash, full_name, role_id, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
	`, userID, input.Username, input.Email, hash, fullName, roleID)

	if err != nil {
		return nil, err
	}

	// Fetch created user
	var user models.User
	err = db.DB.Get(&user, `
		SELECT u.*, r.name as role_name 
		FROM users u 
		LEFT JOIN roles r ON u.role_id = r.id 
		WHERE u.id = ?
	`, userID)

	if err != nil {
		return nil, err
	}

	user.PasswordHash = ""
	return &user, nil
}

// GetCurrentUser returns user by ID
func GetCurrentUser(userID string) (*models.User, error) {
	var user models.User
	err := db.DB.Get(&user, `
		SELECT u.*, r.name as role_name 
		FROM users u 
		LEFT JOIN roles r ON u.role_id = r.id 
		WHERE u.id = ? AND u.is_active = 1
	`, userID)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("user not found")
		}
		return nil, err
	}

	user.PasswordHash = ""
	return &user, nil
}


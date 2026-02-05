package services

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/ttphats/tedx-backend/internal/config"
	"github.com/ttphats/tedx-backend/internal/db"
	"github.com/ttphats/tedx-backend/internal/models"
	"github.com/ttphats/tedx-backend/internal/utils"
)

type SendEmailInput struct {
	To      string `json:"to"`
	Subject string `json:"subject"`
	HTML    string `json:"html"`
}

type SendEmailResult struct {
	Success bool   `json:"success"`
	ID      string `json:"id,omitempty"`
	Error   string `json:"error,omitempty"`
	Skipped bool   `json:"skipped,omitempty"`
}

// SendEmail sends email via Resend API
func SendEmail(input SendEmailInput) (*SendEmailResult, error) {
	cfg := config.AppConfig

	if cfg.ResendAPIKey == "" {
		return nil, errors.New("resend API key not configured")
	}

	payload := map[string]interface{}{
		"from":    cfg.EmailFrom,
		"to":      []string{input.To},
		"subject": input.Subject,
		"html":    input.HTML,
	}

	jsonData, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewBuffer(jsonData))
	req.Header.Set("Authorization", "Bearer "+cfg.ResendAPIKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	if resp.StatusCode >= 400 {
		errMsg := "email send failed"
		if msg, ok := result["message"].(string); ok {
			errMsg = msg
		}
		return &SendEmailResult{Success: false, Error: errMsg}, nil
	}

	emailID := ""
	if id, ok := result["id"].(string); ok {
		emailID = id
	}

	return &SendEmailResult{Success: true, ID: emailID}, nil
}

type SendEmailByPurposeInput struct {
	Purpose        string            `json:"purpose"`
	To             string            `json:"to"`
	Variables      map[string]string `json:"variables"`
	OrderID        *string           `json:"orderId,omitempty"`
	AllowDuplicate bool              `json:"allowDuplicate,omitempty"`
}

// SendEmailByPurpose sends email using template with anti-spam check
func SendEmailByPurpose(input SendEmailByPurposeInput) (*SendEmailResult, error) {
	// Get active template for purpose
	var template models.EmailTemplate
	err := db.DB.Get(&template, `
		SELECT * FROM email_templates 
		WHERE purpose = ? AND is_active = 1 
		ORDER BY version DESC LIMIT 1
	`, input.Purpose)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("no active template for purpose: " + input.Purpose)
		}
		return nil, err
	}

	// Anti-spam check (unless allowDuplicate)
	if !input.AllowDuplicate && input.OrderID != nil {
		var count int
		err = db.DB.Get(&count, `
			SELECT COUNT(*) FROM email_logs 
			WHERE order_id = ? AND purpose = ? AND status = 'SENT' 
			AND created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
		`, *input.OrderID, input.Purpose)

		if err == nil && count > 0 {
			return &SendEmailResult{Success: false, Skipped: true, Error: "Email already sent recently"}, nil
		}
	}

	// Replace variables in template
	html := replaceVariables(template.HTMLContent, input.Variables)
	subject := replaceVariables(template.Subject, input.Variables)

	// Send email
	result, err := SendEmail(SendEmailInput{
		To:      input.To,
		Subject: subject,
		HTML:    html,
	})

	if err != nil {
		return nil, err
	}

	// Log email
	logID := utils.GenerateUUID()
	status := "FAILED"
	if result.Success {
		status = "SENT"
	}

	db.DB.Exec(`
		INSERT INTO email_logs (id, order_id, template_id, purpose, recipient, subject, status, resend_id, error_message, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
	`, logID, input.OrderID, template.ID, input.Purpose, input.To, subject, status, result.ID, result.Error)

	return result, nil
}

func replaceVariables(content string, variables map[string]string) string {
	result := content
	for key, value := range variables {
		placeholder := "{{" + key + "}}"
		result = strings.ReplaceAll(result, placeholder, value)
	}
	// Remove unused placeholders
	re := regexp.MustCompile(`\{\{[^}]+\}\}`)
	result = re.ReplaceAllString(result, "")
	return result
}


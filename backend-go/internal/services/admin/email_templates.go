package admin

import (
	"errors"

	"github.com/ttphats/tedx-backend/internal/db"
	"github.com/ttphats/tedx-backend/internal/models"
	"github.com/ttphats/tedx-backend/internal/utils"
)

// ListEmailTemplates returns all email templates
func ListEmailTemplates(purpose, category string) ([]models.EmailTemplate, error) {
	query := "SELECT * FROM email_templates WHERE 1=1"
	var args []interface{}

	if purpose != "" {
		query += " AND purpose = ?"
		args = append(args, purpose)
	}
	if category != "" {
		query += " AND category = ?"
		args = append(args, category)
	}

	query += " ORDER BY purpose, version DESC"

	var templates []models.EmailTemplate
	err := db.DB.Select(&templates, query, args...)
	return templates, err
}

type CreateEmailTemplateInput struct {
	Name        string  `json:"name"`
	Purpose     string  `json:"purpose"`
	Category    string  `json:"category"`
	Subject     string  `json:"subject"`
	HTMLContent string  `json:"htmlContent"`
	TextContent *string `json:"textContent"`
	Description *string `json:"description"`
	Variables   *string `json:"variables"`
}

// CreateEmailTemplate creates a new email template
func CreateEmailTemplate(input CreateEmailTemplateInput) (*models.EmailTemplate, error) {
	if input.Name == "" || input.Purpose == "" || input.Subject == "" || input.HTMLContent == "" {
		return nil, errors.New("name, purpose, subject, and htmlContent are required")
	}

	// Get next version for this purpose
	var maxVersion int
	db.DB.Get(&maxVersion, "SELECT COALESCE(MAX(version), 0) FROM email_templates WHERE purpose = ?", input.Purpose)

	id := utils.GenerateUUID()
	category := input.Category
	if category == "" {
		category = "TRANSACTION"
	}

	_, err := db.DB.Exec(`
		INSERT INTO email_templates (id, name, purpose, category, subject, html_content, text_content, description, variables, version, is_active, is_default, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NOW(), NOW())
	`, id, input.Name, input.Purpose, category, input.Subject, input.HTMLContent, input.TextContent, input.Description, input.Variables, maxVersion+1)

	if err != nil {
		return nil, err
	}

	var template models.EmailTemplate
	db.DB.Get(&template, "SELECT * FROM email_templates WHERE id = ?", id)
	return &template, nil
}

// UpdateEmailTemplate updates an email template
func UpdateEmailTemplate(id string, data map[string]interface{}) (*models.EmailTemplate, error) {
	updates := []string{}
	args := []interface{}{}

	fieldMap := map[string]string{
		"name": "name", "subject": "subject", "htmlContent": "html_content",
		"textContent": "text_content", "description": "description",
		"variables": "variables", "category": "category",
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

	query := "UPDATE email_templates SET " + joinStr(updates, ", ") + ", updated_at = NOW() WHERE id = ?"
	args = append(args, id)

	db.DB.Exec(query, args...)

	var template models.EmailTemplate
	db.DB.Get(&template, "SELECT * FROM email_templates WHERE id = ?", id)
	return &template, nil
}

// ActivateEmailTemplate activates a template (deactivates others with same purpose)
func ActivateEmailTemplate(id string) error {
	// Get template
	var template models.EmailTemplate
	err := db.DB.Get(&template, "SELECT * FROM email_templates WHERE id = ?", id)
	if err != nil {
		return errors.New("template not found")
	}

	// Deactivate others with same purpose
	db.DB.Exec("UPDATE email_templates SET is_active = 0 WHERE purpose = ?", template.Purpose)

	// Activate this one
	_, err = db.DB.Exec("UPDATE email_templates SET is_active = 1, updated_at = NOW() WHERE id = ?", id)
	return err
}

// DeleteEmailTemplate deletes an email template
func DeleteEmailTemplate(id string) error {
	_, err := db.DB.Exec("DELETE FROM email_templates WHERE id = ?", id)
	return err
}


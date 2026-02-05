package utils

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
)

// GenerateUUID generates a new UUID
func GenerateUUID() string {
	return uuid.New().String()
}

// GenerateOrderNumber generates order number like TDX-20240101-ABC123
func GenerateOrderNumber() string {
	date := time.Now().Format("20060102")
	random := GenerateRandomString(6)
	return fmt.Sprintf("TDX-%s-%s", date, random)
}

// GenerateRandomString generates random alphanumeric string
func GenerateRandomString(length int) string {
	const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, length)
	rand.Read(b)
	for i := range b {
		b[i] = charset[int(b[i])%len(charset)]
	}
	return string(b)
}

// GenerateAccessToken generates access token and its hash
func GenerateAccessToken() (token string, hash string) {
	b := make([]byte, 32)
	rand.Read(b)
	token = hex.EncodeToString(b)
	hashBytes := sha256.Sum256([]byte(token))
	hash = hex.EncodeToString(hashBytes[:])
	return
}

// VerifyAccessToken verifies access token against hash using timing-safe comparison
func VerifyAccessToken(token, storedHash string) bool {
	hashBytes := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hashBytes[:])
	return subtle.ConstantTimeCompare([]byte(tokenHash), []byte(storedHash)) == 1
}

// GenerateSlug generates URL-friendly slug from text
func GenerateSlug(text string) string {
	slug := strings.ToLower(text)
	reg := regexp.MustCompile(`[^a-z0-9]+`)
	slug = reg.ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")
	return slug
}

// NullString converts string pointer to sql.NullString
func NullString(s *string) sql.NullString {
	if s == nil || *s == "" {
		return sql.NullString{Valid: false}
	}
	return sql.NullString{String: *s, Valid: true}
}

// NullStringVal converts string to sql.NullString
func NullStringVal(s string) sql.NullString {
	if s == "" {
		return sql.NullString{Valid: false}
	}
	return sql.NullString{String: s, Valid: true}
}

// StringFromNull converts sql.NullString to string pointer
func StringFromNull(ns sql.NullString) *string {
	if !ns.Valid {
		return nil
	}
	return &ns.String
}

// FormatPrice formats price for display
func FormatPrice(price float64) string {
	return fmt.Sprintf("%.0f", price)
}


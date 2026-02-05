package config

import (
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	// Server
	Port string
	Host string
	Env  string

	// Database
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string

	// JWT
	JWTSecret       string
	JWTExpiresHours int

	// Email
	ResendAPIKey string
	EmailFrom    string

	// URLs
	ClientURL string

	// CORS
	CORSOrigins []string

	// Cron
	CronSecret string

	// Cloudinary
	CloudinaryURL    string
	CloudinaryFolder string

	// Seat Lock
	SeatLockTTL int // seconds
}

var AppConfig *Config

func Load() *Config {
	// Load .env file (ignore error if not exists)
	_ = godotenv.Load()

	AppConfig = &Config{
		Port: getEnv("PORT", "4000"),
		Host: getEnv("HOST", "0.0.0.0"),
		Env:  getEnv("ENV", "development"),

		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "3306"),
		DBUser:     getEnv("DB_USER", "root"),
		DBPassword: getEnv("DB_PASSWORD", ""),
		DBName:     getEnv("DB_NAME", "tedx"),

		JWTSecret:       getEnv("JWT_SECRET", "your-secret-key"),
		JWTExpiresHours: getEnvInt("JWT_EXPIRES_HOURS", 168),

		ResendAPIKey: getEnv("RESEND_API_KEY", ""),
		EmailFrom:    getEnv("EMAIL_FROM", "TEDx <noreply@example.com>"),

		ClientURL: getEnv("CLIENT_URL", "http://localhost:3000"),

		CORSOrigins: strings.Split(getEnv("CORS_ORIGINS", "http://localhost:3000"), ","),

		CronSecret: getEnv("CRON_SECRET", ""),

		CloudinaryURL:    getEnv("CLOUDINARY_URL", ""),
		CloudinaryFolder: getEnv("CLOUDINARY_FOLDER", "tedx"),

		SeatLockTTL: getEnvInt("SEAT_LOCK_TTL", 600),
	}

	return AppConfig
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if i, err := strconv.Atoi(value); err == nil {
			return i
		}
	}
	return defaultValue
}

// GetDSN returns MySQL connection string
func (c *Config) GetDSN() string {
	return c.DBUser + ":" + c.DBPassword + "@tcp(" + c.DBHost + ":" + c.DBPort + ")/" + c.DBName + "?parseTime=true&loc=Asia%2FHo_Chi_Minh"
}

// IsDevelopment returns true if running in development mode
func (c *Config) IsDevelopment() bool {
	return c.Env == "development"
}


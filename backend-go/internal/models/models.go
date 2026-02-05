package models

import (
	"database/sql"
	"time"
)

// User represents admin user
type User struct {
	ID           string         `db:"id" json:"id"`
	Username     string         `db:"username" json:"username"`
	Email        string         `db:"email" json:"email"`
	PasswordHash string         `db:"password_hash" json:"-"`
	FullName     sql.NullString `db:"full_name" json:"fullName"`
	PhoneNumber  sql.NullString `db:"phone_number" json:"phoneNumber"`
	RoleID       string         `db:"role_id" json:"roleId"`
	RoleName     string         `db:"role_name" json:"roleName,omitempty"`
	IsActive     bool           `db:"is_active" json:"isActive"`
	CreatedAt    time.Time      `db:"created_at" json:"createdAt"`
	UpdatedAt    time.Time      `db:"updated_at" json:"updatedAt"`
}

// Role represents user role
type Role struct {
	ID   string `db:"id" json:"id"`
	Name string `db:"name" json:"name"`
}

// Event represents an event
type Event struct {
	ID             string         `db:"id" json:"id"`
	Name           string         `db:"name" json:"name"`
	Slug           string         `db:"slug" json:"slug"`
	Description    sql.NullString `db:"description" json:"description"`
	Venue          string         `db:"venue" json:"venue"`
	EventDate      time.Time      `db:"event_date" json:"eventDate"`
	DoorsOpenTime  time.Time      `db:"doors_open_time" json:"doorsOpenTime"`
	StartTime      time.Time      `db:"start_time" json:"startTime"`
	EndTime        time.Time      `db:"end_time" json:"endTime"`
	Status         string         `db:"status" json:"status"`
	MaxCapacity    int            `db:"max_capacity" json:"maxCapacity"`
	AvailableSeats int            `db:"available_seats" json:"availableSeats"`
	BannerImageURL sql.NullString `db:"banner_image_url" json:"bannerImageUrl"`
	ThumbnailURL   sql.NullString `db:"thumbnail_url" json:"thumbnailUrl"`
	IsPublished    bool           `db:"is_published" json:"isPublished"`
	PublishedAt    sql.NullTime   `db:"published_at" json:"publishedAt"`
	CreatedAt      time.Time      `db:"created_at" json:"createdAt"`
	UpdatedAt      time.Time      `db:"updated_at" json:"updatedAt"`
}

// Seat represents a seat
type Seat struct {
	ID           string          `db:"id" json:"id"`
	EventID      string          `db:"event_id" json:"eventId"`
	SeatNumber   string          `db:"seat_number" json:"seatNumber"`
	Row          string          `db:"row" json:"row"`
	Col          string          `db:"col" json:"col"`
	Section      string          `db:"section" json:"section"`
	SeatType     string          `db:"seat_type" json:"seatType"`
	Price        float64         `db:"price" json:"price"`
	Status       string          `db:"status" json:"status"`
	PositionX    sql.NullFloat64 `db:"position_x" json:"positionX"`
	PositionY    sql.NullFloat64 `db:"position_y" json:"positionY"`
	TicketTypeID sql.NullString  `db:"ticket_type_id" json:"ticketTypeId"`
	CreatedAt    time.Time       `db:"created_at" json:"createdAt"`
	UpdatedAt    time.Time       `db:"updated_at" json:"updatedAt"`
}

// SeatLock represents a seat lock
type SeatLock struct {
	ID           string         `db:"id" json:"id"`
	SeatID       string         `db:"seat_id" json:"seatId"`
	EventID      string         `db:"event_id" json:"eventId"`
	SessionID    string         `db:"session_id" json:"sessionId"`
	TicketTypeID sql.NullString `db:"ticket_type_id" json:"ticketTypeId"`
	ExpiresAt    time.Time      `db:"expires_at" json:"expiresAt"`
	CreatedAt    time.Time      `db:"created_at" json:"createdAt"`
}

// Order represents an order
type Order struct {
	ID                  string         `db:"id" json:"id"`
	OrderNumber         string         `db:"order_number" json:"orderNumber"`
	EventID             string         `db:"event_id" json:"eventId"`
	CustomerName        string         `db:"customer_name" json:"customerName"`
	CustomerEmail       string         `db:"customer_email" json:"customerEmail"`
	CustomerPhone       string         `db:"customer_phone" json:"customerPhone"`
	TotalAmount         float64        `db:"total_amount" json:"totalAmount"`
	Status              string         `db:"status" json:"status"`
	ExpiresAt           sql.NullTime   `db:"expires_at" json:"expiresAt"`
	PaidAt              sql.NullTime   `db:"paid_at" json:"paidAt"`
	CancelledAt         sql.NullTime   `db:"cancelled_at" json:"cancelledAt"`
	CancellationReason  sql.NullString `db:"cancellation_reason" json:"cancellationReason"`
	AccessTokenHash     sql.NullString `db:"access_token_hash" json:"-"`
	QRCodeURL           sql.NullString `db:"qr_code_url" json:"qrCodeUrl"`
	CheckedInAt         sql.NullTime   `db:"checked_in_at" json:"checkedInAt"`
	CheckedInBy         sql.NullString `db:"checked_in_by" json:"checkedInBy"`
	EmailSentAt         sql.NullTime   `db:"email_sent_at" json:"emailSentAt"`
	CreatedAt           time.Time      `db:"created_at" json:"createdAt"`
	UpdatedAt           time.Time      `db:"updated_at" json:"updatedAt"`
}

// OrderItem represents an order item
type OrderItem struct {
	ID         string    `db:"id" json:"id"`
	OrderID    string    `db:"order_id" json:"orderId"`
	SeatID     string    `db:"seat_id" json:"seatId"`
	SeatNumber string    `db:"seat_number" json:"seatNumber"`
	SeatType   string    `db:"seat_type" json:"seatType"`
	Price      float64   `db:"price" json:"price"`
	CreatedAt  time.Time `db:"created_at" json:"createdAt"`
}

// Payment represents a payment
type Payment struct {
	ID            string         `db:"id" json:"id"`
	OrderID       string         `db:"order_id" json:"orderId"`
	Amount        float64        `db:"amount" json:"amount"`
	PaymentMethod string         `db:"payment_method" json:"paymentMethod"`
	Status        string         `db:"status" json:"status"`
	TransactionID sql.NullString `db:"transaction_id" json:"transactionId"`
	Metadata      sql.NullString `db:"metadata" json:"metadata"`
	PaidAt        sql.NullTime   `db:"paid_at" json:"paidAt"`
	CreatedAt     time.Time      `db:"created_at" json:"createdAt"`
	UpdatedAt     time.Time      `db:"updated_at" json:"updatedAt"`
}

// EmailTemplate represents an email template
type EmailTemplate struct {
	ID          string         `db:"id" json:"id"`
	Name        string         `db:"name" json:"name"`
	Purpose     string         `db:"purpose" json:"purpose"`
	Category    string         `db:"category" json:"category"`
	Subject     string         `db:"subject" json:"subject"`
	HTMLContent string         `db:"html_content" json:"htmlContent"`
	TextContent sql.NullString `db:"text_content" json:"textContent"`
	Description sql.NullString `db:"description" json:"description"`
	Variables   sql.NullString `db:"variables" json:"variables"`
	Version     int            `db:"version" json:"version"`
	IsActive    bool           `db:"is_active" json:"isActive"`
	IsDefault   bool           `db:"is_default" json:"isDefault"`
	CreatedAt   time.Time      `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time      `db:"updated_at" json:"updatedAt"`
}

// EventTimeline represents timeline/speaker
type EventTimeline struct {
	ID               string         `db:"id" json:"id"`
	EventID          string         `db:"event_id" json:"eventId"`
	StartTime        string         `db:"start_time" json:"startTime"`
	EndTime          string         `db:"end_time" json:"endTime"`
	Title            string         `db:"title" json:"title"`
	Description      sql.NullString `db:"description" json:"description"`
	SpeakerName      sql.NullString `db:"speaker_name" json:"speakerName"`
	SpeakerAvatarURL sql.NullString `db:"speaker_avatar_url" json:"speakerAvatarUrl"`
	Type             string         `db:"type" json:"type"`
	OrderIndex       int            `db:"order_index" json:"orderIndex"`
	Status           string         `db:"status" json:"status"`
	CreatedAt        time.Time      `db:"created_at" json:"createdAt"`
	UpdatedAt        time.Time      `db:"updated_at" json:"updatedAt"`
}


package main

import (
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/ttphats/tedx-backend/internal/config"
	"github.com/ttphats/tedx-backend/internal/db"
	"github.com/ttphats/tedx-backend/internal/handlers"
	adminHandlers "github.com/ttphats/tedx-backend/internal/handlers/admin"
	"github.com/ttphats/tedx-backend/internal/middleware"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Connect to database
	if err := db.Connect(cfg); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.DB.Close()

	// Create Fiber app
	app := fiber.New(fiber.Config{
		ErrorHandler: middleware.ErrorHandler,
	})

	// Middleware
	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(middleware.CORSMiddleware(cfg))

	// API routes
	api := app.Group("/api")

	// Health check
	api.Get("/health", handlers.Health)

	// Auth routes
	auth := api.Group("/auth")
	auth.Post("/login", handlers.Login)
	auth.Post("/register", handlers.Register)
	auth.Get("/me", middleware.AuthMiddleware, handlers.Me)

	// Public events routes
	events := api.Group("/events")
	events.Get("/", handlers.ListEvents)
	events.Get("/slug/:slug", handlers.GetEventBySlug)
	events.Get("/:id", handlers.GetEvent)
	events.Get("/:id/seats", handlers.GetEventSeats)

	// Seats routes
	seats := api.Group("/seats")
	seats.Post("/lock", handlers.LockSeats)
	seats.Get("/lock", handlers.GetSessionLocks)
	seats.Delete("/lock", handlers.UnlockSeats)
	seats.Post("/extend-lock", handlers.ExtendSeatLock)

	// Orders routes
	orders := api.Group("/orders")
	orders.Post("/create-pending", handlers.CreatePendingOrder)
	orders.Post("/confirm-payment", handlers.ConfirmPayment)

	// Ticket routes
	api.Get("/ticket/:orderNumber", handlers.GetTicket)

	// Cron routes (protected by cron secret)
	cron := api.Group("/cron", middleware.CronAuthMiddleware)
	cron.Get("/expire-orders", handlers.ExpireOrders)
	cron.Get("/cleanup-locks", handlers.CleanupLocks)

	// Admin routes (protected by auth)
	admin := api.Group("/admin", middleware.AuthMiddleware, middleware.AdminMiddleware)

	// Dashboard
	admin.Get("/dashboard/stats", adminHandlers.GetDashboardStats)
	admin.Get("/dashboard/recent-orders", adminHandlers.GetRecentOrders)

	// Events
	admin.Get("/events", adminHandlers.ListEvents)
	admin.Get("/events/:id", adminHandlers.GetEvent)
	admin.Post("/events", adminHandlers.CreateEvent)
	admin.Put("/events/:id", adminHandlers.UpdateEvent)
	admin.Delete("/events/:id", adminHandlers.DeleteEvent)

	// Orders
	admin.Get("/orders", adminHandlers.ListOrders)
	admin.Post("/orders/:id/confirm", adminHandlers.ConfirmPayment)
	admin.Post("/orders/:id/reject", adminHandlers.RejectPayment)
	admin.Post("/orders/:id/resend-email", adminHandlers.ResendEmail)

	// Seats
	admin.Get("/seats", adminHandlers.ListSeats)
	admin.Post("/seats", adminHandlers.CreateSeat)
	admin.Post("/seats/bulk", adminHandlers.BulkCreateSeats)
	admin.Put("/seats/:id", adminHandlers.UpdateSeat)
	admin.Delete("/seats/:id", adminHandlers.DeleteSeat)

	// Speakers
	admin.Get("/speakers", adminHandlers.ListSpeakers)
	admin.Post("/speakers", adminHandlers.CreateSpeaker)
	admin.Put("/speakers/:id", adminHandlers.UpdateSpeaker)
	admin.Delete("/speakers/:id", adminHandlers.DeleteSpeaker)

	// Users (super admin only for some operations)
	admin.Get("/users", adminHandlers.ListUsers)
	admin.Get("/users/:id", adminHandlers.GetUser)
	admin.Post("/users", middleware.SuperAdminMiddleware, adminHandlers.CreateUser)
	admin.Put("/users/:id", adminHandlers.UpdateUser)
	admin.Delete("/users/:id", middleware.SuperAdminMiddleware, adminHandlers.DeleteUser)

	// Ticket Types
	admin.Get("/ticket-types", adminHandlers.ListTicketTypes)
	admin.Post("/ticket-types", adminHandlers.CreateTicketType)
	admin.Post("/ticket-types/assign", adminHandlers.AssignTicketTypeToSeats)
	admin.Delete("/ticket-types/:id", adminHandlers.DeleteTicketType)

	// Email Templates
	admin.Get("/email-templates", adminHandlers.ListEmailTemplates)
	admin.Post("/email-templates", adminHandlers.CreateEmailTemplate)
	admin.Put("/email-templates/:id", adminHandlers.UpdateEmailTemplate)
	admin.Post("/email-templates/:id/activate", adminHandlers.ActivateEmailTemplate)
	admin.Delete("/email-templates/:id", adminHandlers.DeleteEmailTemplate)

	// Timelines
	admin.Get("/timelines", adminHandlers.ListTimelines)
	admin.Post("/timelines", adminHandlers.CreateTimeline)
	admin.Put("/timelines/:id", adminHandlers.UpdateTimeline)
	admin.Delete("/timelines/:id", adminHandlers.DeleteTimeline)

	// Layouts
	admin.Get("/layouts", adminHandlers.ListLayouts)
	admin.Post("/layouts", adminHandlers.CreateLayout)
	admin.Put("/layouts/:id", adminHandlers.UpdateLayout)
	admin.Delete("/layouts/:id", adminHandlers.DeleteLayout)

	// Audit Logs
	admin.Get("/audit-logs", adminHandlers.ListAuditLogs)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "4000"
	}

	log.Printf("Server starting on port %s", port)
	if err := app.Listen(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}


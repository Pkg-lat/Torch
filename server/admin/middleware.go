package admin

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"torch/pkg.lat/mongo"
	"torch/pkg.lat/types"
)

type contextKey string

const (
	adminContextKey contextKey = "admin_user"
)

// AdminMiddleware checks if user is admin and adds them to context
func AdminMiddleware(store *mongo.Store) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			session, err := getSessionFromRequest(r)
			if err != nil || session == nil {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			// Check if session is blacklisted
			if blacklisted, err := store.IsSessionBlacklisted(r.Context(), session.SessionID); err == nil && blacklisted {
				http.Error(w, "Session invalidated", http.StatusUnauthorized)
				return
			}

			user, err := store.GetUserByUUID(session.UserUUID)
			if err != nil {
				http.Error(w, "User not found", http.StatusUnauthorized)
				return
			}

			// Check if user is banned
			if user.Role == "banned" {
				http.Error(w, "User is banned", http.StatusForbidden)
				return
			}

			if user.Role != "admin" {
				http.Error(w, "Admin access required", http.StatusForbidden)
				return
			}

			// Add admin user to context
			ctx := context.WithValue(r.Context(), adminContextKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func getSessionFromRequest(r *http.Request) (*types.Session, error) {
	cookie, err := r.Cookie("auth_session")
	if err != nil {
		return nil, err
	}

	decoded, err := base64.RawURLEncoding.DecodeString(cookie.Value)
	if err != nil {
		decoded = []byte(cookie.Value)
	}

	var session types.Session
	if err := json.Unmarshal(decoded, &session); err != nil {
		return nil, err
	}

	return &session, nil
}

// GetAdminFromContext retrieves the admin user from context
func GetAdminFromContext(ctx context.Context) *mongo.UserDocument {
	if user, ok := ctx.Value(adminContextKey).(*mongo.UserDocument); ok {
		return user
	}
	return nil
}

// AuditLogger wraps a handler and logs admin actions
type AuditLogger struct {
	store    *mongo.Store
	action   string
	resource string
}

func NewAuditLogger(store *mongo.Store, action, resource string) *AuditLogger {
	return &AuditLogger{
		store:    store,
		action:   action,
		resource: resource,
	}
}

func (al *AuditLogger) Wrap(handler http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		admin := GetAdminFromContext(r.Context())
		if admin == nil {
			http.Error(w, "Admin context not found", http.StatusInternalServerError)
			return
		}

		// Extract resource ID from URL if present
		resourceID := extractResourceID(r)

		// Get IP and User Agent
		ipAddress := getIPAddress(r)
		userAgent := r.UserAgent()

		// Create a response writer wrapper to capture status
		rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

		// Execute the handler
		start := time.Now()
		handler(rw, r)
		duration := time.Since(start)

		// Determine status
		status := "success"
		errorMsg := ""
		if rw.statusCode >= 400 {
			status = "failed"
			errorMsg = http.StatusText(rw.statusCode)
		}

		// Log the action
		details := map[string]interface{}{
			"method":   r.Method,
			"path":     r.URL.Path,
			"duration": duration.String(),
		}

		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			_ = al.store.LogAdminAction(ctx, admin.UUID, admin.Email, al.action, al.resource, resourceID, details, ipAddress, userAgent, status, errorMsg)
		}()
	}
}

// responseWriter wraps http.ResponseWriter to capture status code
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func extractResourceID(r *http.Request) string {
	// Extract UUID from path like /admin/users/{uuid}
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) > 2 {
		return parts[len(parts)-1]
	}
	return ""
}

func getIPAddress(r *http.Request) string {
	// Check X-Forwarded-For header first
	forwarded := r.Header.Get("X-Forwarded-For")
	if forwarded != "" {
		// Take the first IP if multiple
		ips := strings.Split(forwarded, ",")
		return strings.TrimSpace(ips[0])
	}

	// Check X-Real-IP header
	realIP := r.Header.Get("X-Real-IP")
	if realIP != "" {
		return realIP
	}

	// Fall back to RemoteAddr
	return strings.Split(r.RemoteAddr, ":")[0]
}

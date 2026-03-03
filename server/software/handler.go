package software

import (
	"context"
	"encoding/json"
	"net/http"

	"torch/pkg.lat/auth"
	"torch/pkg.lat/mongo"
)



type Handler struct {
	store *mongo.Store
}

func NewHandler(store *mongo.Store) *Handler {
	return &Handler{store: store}
}

type ListSoftwareResponse struct {
	Software []mongo.Software `json:"software"`
}

type SoftwareResponse struct {
	Software *mongo.Software `json:"software"`
}

// AuthMiddleware validates the session and adds user to context
func (h *Handler) AuthMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sessionStore := auth.NewCookieSessionStore()
		session, err := sessionStore.Get(w, r)
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		if blacklisted, err := h.store.IsSessionBlacklisted(r.Context(), session.SessionID); err == nil && blacklisted {
			http.Error(w, "Session invalidated", http.StatusUnauthorized)
			return
		}

		user, err := h.store.GetUserByUUID(session.UserUUID)
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		if user.Role == "banned" {
			http.Error(w, "User is banned", http.StatusForbidden)
			return
		}

		ctx := context.WithValue(r.Context(), "user", user)
		ctx = context.WithValue(ctx, "session", session)
		next.ServeHTTP(w, r.WithContext(ctx))
	}
}

// GetUserFromContext retrieves the user from request context
func GetUserFromContext(ctx context.Context) *mongo.UserDocument {
	user, ok := ctx.Value("user").(*mongo.UserDocument)
	if !ok {
		return nil
	}
	return user
}

// ListSoftware returns all available software (public endpoint for server creation)
func (h *Handler) ListSoftware(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	user := GetUserFromContext(r.Context())
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	software, err := h.store.ListSoftware()
	if err != nil {
		http.Error(w, "Failed to list software", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ListSoftwareResponse{Software: software})
}

// GetSoftware retrieves a single software entry
func (h *Handler) GetSoftware(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	user := GetUserFromContext(r.Context())
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Extract software UUID from path
	// Path format: /api/software/{uuid}
	path := r.URL.Path
	uuid := path[len("/api/software/"):]
	if uuid == "" {
		http.Error(w, "Software UUID required", http.StatusBadRequest)
		return
	}

	software, err := h.store.GetSoftwareByUUID(uuid)
	if err != nil {
		http.Error(w, "Software not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(SoftwareResponse{Software: software})
}

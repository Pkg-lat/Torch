package billing

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"torch/pkg.lat/auth"
	"torch/pkg.lat/mongo"
)

type Handler struct {
	store *mongo.Store
}

func NewHandler(store *mongo.Store) *Handler {
	return &Handler{store: store}
}

type TransactionsResponse struct {
	Transactions []mongo.Transaction `json:"transactions"`
	Meta         struct {
		Total int64 `json:"total"`
		Page  int   `json:"page"`
		Limit int   `json:"limit"`
	} `json:"meta"`
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

// GetTransactions retrieves transactions for a workspace
func (h *Handler) GetTransactions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	user := GetUserFromContext(r.Context())
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Extract workspace ID from URL path: /api/workspaces/{workspaceId}/transactions
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(pathParts) < 3 || pathParts[0] != "api" || pathParts[1] != "workspaces" {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	workspaceID := pathParts[2]

	// Parse pagination parameters
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("pageSize"))
	if limit < 1 || limit > 100 {
		limit = 20
	}

	skip := int64((page - 1) * limit)

	// Get transactions
	transactions, total, err := h.store.GetWorkspaceTransactions(r.Context(), workspaceID, int64(limit), skip)
	if err != nil {
		http.Error(w, "Failed to fetch transactions", http.StatusInternalServerError)
		return
	}

	response := TransactionsResponse{
		Transactions: transactions,
	}
	response.Meta.Total = total
	response.Meta.Page = page
	response.Meta.Limit = limit

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

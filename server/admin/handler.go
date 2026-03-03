package admin

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"

	"torch/pkg.lat/mongo"
)

type Handler struct {
	store *mongo.Store
}

func NewHandler(store *mongo.Store) *Handler {
	return &Handler{store: store}
}

// writeJSON writes a JSON response
func (h *Handler) writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

// logAudit logs an admin action to the audit log
func (h *Handler) logAudit(r *http.Request, action, resource, resourceID string, details map[string]any, status, errorMsg string) {
	admin := GetAdminFromContext(r.Context())
	if admin == nil {
		return
	}

	_ = h.store.LogAdminAction(r.Context(), admin.UUID, admin.Email, action, resource, resourceID, details, clientIP(r), r.UserAgent(), status, errorMsg)
}

// clientIP extracts the client IP from the request
func clientIP(r *http.Request) string {
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		parts := strings.Split(forwarded, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}

	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// GetAuditLogs returns paginated audit logs
func (h *Handler) GetAuditLogs(w http.ResponseWriter, r *http.Request) {
	admin := GetAdminFromContext(r.Context())
	if admin == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse pagination params
	limitStr := r.URL.Query().Get("limit")
	skipStr := r.URL.Query().Get("skip")

	limit := int64(50)
	skip := int64(0)

	if limitStr != "" {
		if l, err := strconv.ParseInt(limitStr, 10, 64); err == nil && l > 0 {
			limit = l
		}
	}

	if skipStr != "" {
		if s, err := strconv.ParseInt(skipStr, 10, 64); err == nil && s >= 0 {
			skip = s
		}
	}

	logs, err := h.store.GetAdminAuditLogs(r.Context(), limit, skip)
	if err != nil {
		http.Error(w, "Failed to fetch audit logs", http.StatusInternalServerError)
		return
	}

	total, err := h.store.CountAdminAuditLogs(r.Context())
	if err != nil {
		http.Error(w, "Failed to count audit logs", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"logs":  logs,
		"total": total,
		"limit": limit,
		"skip":  skip,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetStats returns admin dashboard statistics
func (h *Handler) GetStats(w http.ResponseWriter, r *http.Request) {
	admin := GetAdminFromContext(r.Context())
	if admin == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get total users count
	totalUsers, err := h.store.CountUsers(r.Context())
	if err != nil {
		totalUsers = 0
	}

	// Get total audit logs
	totalLogs, err := h.store.CountAdminAuditLogs(r.Context())
	if err != nil {
		totalLogs = 0
	}

	stats := map[string]interface{}{
		"totalUsers":   totalUsers,
		"totalServers": 0, // TODO: implement when servers collection exists
		"totalNodes":   0, // TODO: implement when nodes collection exists
		"totalLogs":    totalLogs,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// GetUsers returns paginated list of all users
func (h *Handler) GetUsers(w http.ResponseWriter, r *http.Request) {
	admin := GetAdminFromContext(r.Context())
	if admin == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	limitStr := r.URL.Query().Get("limit")
	skipStr := r.URL.Query().Get("skip")

	limit := int64(50)
	skip := int64(0)

	if limitStr != "" {
		if l, err := strconv.ParseInt(limitStr, 10, 64); err == nil && l > 0 {
			limit = l
		}
	}

	if skipStr != "" {
		if s, err := strconv.ParseInt(skipStr, 10, 64); err == nil && s >= 0 {
			skip = s
		}
	}

	users, total, err := h.store.ListAllUsers(r.Context(), limit, skip)
	if err != nil {
		http.Error(w, "Failed to fetch users", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"users": users,
		"total": total,
		"limit": limit,
		"skip":  skip,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// UpdateUserRole updates a user's role
func (h *Handler) UpdateUserRole(w http.ResponseWriter, r *http.Request) {
	admin := GetAdminFromContext(r.Context())
	if admin == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		UserUUID string `json:"userUuid"`
		Role     string `json:"role"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.UserUUID == "" || req.Role == "" {
		http.Error(w, "userUuid and role are required", http.StatusBadRequest)
		return
	}

	if err := h.store.UpdateUserRole(r.Context(), req.UserUUID, req.Role); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "User role updated"})
}

// UpdateUserEmail updates a user's email
func (h *Handler) UpdateUserEmail(w http.ResponseWriter, r *http.Request) {
	admin := GetAdminFromContext(r.Context())
	if admin == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		UserUUID string `json:"userUuid"`
		Email    string `json:"email"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.UserUUID == "" || req.Email == "" {
		http.Error(w, "userUuid and email are required", http.StatusBadRequest)
		return
	}

	if err := h.store.AdminUpdateUserEmail(r.Context(), req.UserUUID, req.Email); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "User email updated"})
}

// ResetUserPassword resets a user's password
func (h *Handler) ResetUserPassword(w http.ResponseWriter, r *http.Request) {
	admin := GetAdminFromContext(r.Context())
	if admin == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		UserUUID    string `json:"userUuid"`
		NewPassword string `json:"newPassword"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.UserUUID == "" || req.NewPassword == "" {
		http.Error(w, "userUuid and newPassword are required", http.StatusBadRequest)
		return
	}

	if err := h.store.AdminResetUserPassword(r.Context(), req.UserUUID, req.NewPassword); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "User password reset"})
}

// ClearUserSessions clears all sessions for a user
func (h *Handler) ClearUserSessions(w http.ResponseWriter, r *http.Request) {
	admin := GetAdminFromContext(r.Context())
	if admin == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		UserUUID string `json:"userUuid"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.UserUUID == "" {
		http.Error(w, "userUuid is required", http.StatusBadRequest)
		return
	}

	// Blacklist all user sessions
	if err := h.store.BlacklistAllUserSessions(r.Context(), req.UserUUID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "User sessions cleared and blacklisted"})
}

// BanUser bans a user
func (h *Handler) BanUser(w http.ResponseWriter, r *http.Request) {
	admin := GetAdminFromContext(r.Context())
	if admin == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		UserUUID string `json:"userUuid"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.UserUUID == "" {
		http.Error(w, "userUuid is required", http.StatusBadRequest)
		return
	}

	// Don't allow banning yourself
	if req.UserUUID == admin.UUID {
		http.Error(w, "Cannot ban yourself", http.StatusBadRequest)
		return
	}

	if err := h.store.BanUser(r.Context(), req.UserUUID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Blacklist all their sessions
	_ = h.store.BlacklistAllUserSessions(r.Context(), req.UserUUID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "User banned and sessions invalidated"})
}

// UnbanUser unbans a user
func (h *Handler) UnbanUser(w http.ResponseWriter, r *http.Request) {
	admin := GetAdminFromContext(r.Context())
	if admin == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		UserUUID string `json:"userUuid"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.UserUUID == "" {
		http.Error(w, "userUuid is required", http.StatusBadRequest)
		return
	}

	if err := h.store.UnbanUser(r.Context(), req.UserUUID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "User unbanned"})
}

// UpdateUserLimits updates a user's resource limits
func (h *Handler) UpdateUserLimits(w http.ResponseWriter, r *http.Request) {
	admin := GetAdminFromContext(r.Context())
	if admin == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		UserUUID string         `json:"userUuid"`
		Limits   map[string]any `json:"limits"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.UserUUID == "" || req.Limits == nil {
		http.Error(w, "userUuid and limits are required", http.StatusBadRequest)
		return
	}

	if err := h.store.UpdateUserLimits(r.Context(), req.UserUUID, req.Limits); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "User limits updated"})
}

// UpdateUserCredits updates a user's credits with a proper operation and note
func (h *Handler) UpdateUserCredits(w http.ResponseWriter, r *http.Request) {
	admin := GetAdminFromContext(r.Context())
	if admin == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		UserUUID  string `json:"userUuid"`
		Operation string `json:"operation"` // "add", "remove", "set"
		Amount    int    `json:"amount"`    // always positive
		Note      string `json:"note"`      // required admin note – shown in wallet
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.UserUUID == "" {
		http.Error(w, "userUuid is required", http.StatusBadRequest)
		return
	}
	if req.Operation != "add" && req.Operation != "remove" && req.Operation != "set" {
		http.Error(w, "operation must be 'add', 'remove', or 'set'", http.StatusBadRequest)
		return
	}
	if req.Amount < 0 {
		http.Error(w, "amount cannot be negative", http.StatusBadRequest)
		return
	}
	if req.Note == "" {
		http.Error(w, "note is required", http.StatusBadRequest)
		return
	}

	// Get the user's current balance
	targetUser, err := h.store.GetUserByUUID(req.UserUUID)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	oldCredits := int(targetUser.Billing.Credits)

	// Compute new balance and determine tx type
	var newCredits int
	var txType string
	var txAmount int

	switch req.Operation {
	case "add":
		newCredits = oldCredits + req.Amount
		txType = "credit"
		txAmount = req.Amount
	case "remove":
		newCredits = oldCredits - req.Amount
		if newCredits < 0 {
			newCredits = 0
			txAmount = oldCredits // can only remove what exists
		} else {
			txAmount = req.Amount
		}
		txType = "debit"
	case "set":
		newCredits = req.Amount
		delta := newCredits - oldCredits
		if delta == 0 {
			// No change — still log but don't create a transaction
			h.logAudit(r, "update_credits", "user", req.UserUUID, map[string]any{
				"operation": req.Operation, "old_credits": oldCredits, "new_credits": newCredits, "note": req.Note,
			}, "success", "")
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{"message": "No change"})
			return
		} else if delta > 0 {
			txType = "credit"
			txAmount = delta
		} else {
			txType = "debit"
			txAmount = -delta
		}
	}

	// Build the transaction description with the admin note
	description := fmt.Sprintf("%s — %s", req.Note, admin.Email)

	// Update user's credits
	if err := h.store.UpdateUserCredits(r.Context(), req.UserUUID, newCredits); err != nil {
		h.logAudit(r, "update_credits", "user", req.UserUUID, map[string]any{
			"operation": req.Operation, "amount": req.Amount, "note": req.Note,
		}, "failed", err.Error())
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Create transaction record in each of the user's workspaces
	metadata := map[string]interface{}{
		"admin_uuid":   admin.UUID,
		"admin_email":  admin.Email,
		"admin_action": true,
		"operation":    req.Operation,
		"note":         req.Note,
		"old_balance":  oldCredits,
		"new_balance":  newCredits,
	}

	orgs, err := h.store.ListOrganizationsForUser(req.UserUUID)
	if err == nil && len(orgs) > 0 {
		for _, org := range orgs {
			_, _ = h.store.CreateAdminTransaction(r.Context(), org.UUID, req.UserUUID, txType, description, txAmount, newCredits, metadata)
		}
	}

	// Log admin audit entry
	h.logAudit(r, "update_credits", "user", req.UserUUID, map[string]any{
		"operation":   req.Operation,
		"amount":      req.Amount,
		"old_credits": oldCredits,
		"new_credits": newCredits,
		"note":        req.Note,
	}, "success", "")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "User credits updated"})
}

// HandleNodes routes node list and create operations
func (h *Handler) HandleNodes(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.ListNodes(w, r)
	case http.MethodPost:
		h.CreateNode(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// HandleNodeRoutes routes individual node operations
func (h *Handler) HandleNodeRoutes(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	// Check if it's a health check request
	if strings.Contains(path, "/health") {
		h.HealthCheckNode(w, r)
		return
	}

	// Check if it's an allocations request
	if strings.Contains(path, "/allocations") {
		if r.Method == http.MethodPost {
			h.AddAllocations(w, r)
		} else if r.Method == http.MethodDelete {
			h.RemoveAllocations(w, r)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
		return
	}

	// Otherwise handle GET/PATCH/DELETE for individual nodes
	switch r.Method {
	case http.MethodGet:
		h.GetNode(w, r)
	case http.MethodPatch:
		h.UpdateNode(w, r)
	case http.MethodDelete:
		h.DeleteNode(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// HandleSoftware routes software list and create operations
func (h *Handler) HandleSoftware(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.ListSoftware(w, r)
	case http.MethodPost:
		h.CreateSoftware(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// HandleSoftwareRoutes routes individual software operations
func (h *Handler) HandleSoftwareRoutes(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.GetSoftware(w, r)
	case http.MethodPatch:
		h.UpdateSoftware(w, r)
	case http.MethodDelete:
		h.DeleteSoftware(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

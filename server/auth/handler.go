package auth

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"strings"

	"torch/pkg.lat/logger"
	"torch/pkg.lat/mongo"
	"torch/pkg.lat/types"

	"github.com/google/uuid"
)

type Handler struct {
	registry     *ProviderRegistry
	config       *Config
	sessionStore types.SessionStore
	store        *mongo.Store
}

func NewHandler(registry *ProviderRegistry, config *Config, sessionStore types.SessionStore, store *mongo.Store) *Handler {
	return &Handler{
		registry:     registry,
		config:       config,
		sessionStore: sessionStore,
		store:        store,
	}
}

// RegisterRoutes registers all auth routes
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	// List available auth providers
	mux.HandleFunc("/authenticate/providers", h.listProviders)

	// OAuth start endpoints
	for _, provider := range h.registry.List() {
		if provider.Name() == "email" {
			continue // Email auth is handled differently
		}
		mux.HandleFunc(fmt.Sprintf("/authenticate/%s", provider.Name()), h.oauthStart(provider.Name()))
	}

	// OAuth callback endpoints
	for _, provider := range h.registry.List() {
		if provider.Name() == "email" {
			continue
		}
		mux.HandleFunc(fmt.Sprintf("/authenticate/%s/callback", provider.Name()), h.oauthCallback(provider.Name()))
	}

	// Session endpoints
	mux.HandleFunc("/authenticate/session", h.getSession)
	mux.HandleFunc("/authenticate/logout", h.logout)
	mux.HandleFunc("/authenticate/change-password", h.changePassword)
	mux.HandleFunc("/authenticate/update-profile", h.updateProfile)

	// Email auth endpoints
	if _, ok := h.config.Providers["email"]; ok {
		mux.HandleFunc("/authenticate/email/login", h.emailLogin)
		mux.HandleFunc("/authenticate/email/register", h.emailRegister)
	}

	// Organization routes
	mux.HandleFunc("/orgs", h.handleOrgs)
	mux.HandleFunc("/orgs/", h.handleOrgRoutes)
	mux.HandleFunc("/org-invites", h.listMyInvites)
	mux.HandleFunc("/org-invites/", h.handleInviteRoutes)
}

func (h *Handler) listProviders(w http.ResponseWriter, r *http.Request) {
	providers := []map[string]interface{}{}
	if _, ok := h.config.Providers["email"]; ok {
		providers = append(providers, map[string]interface{}{
			"name":        "email",
			"type":        "email",
			"displayName": "Email",
		})
	}

	for _, p := range h.registry.List() {
		providers = append(providers, map[string]interface{}{
			"name":        p.Name(),
			"type":        "oauth",
			"displayName": capitalizeFirst(p.Name()),
			"authUrl":     p.GetAuthURL(""),
		})
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"providers": providers,
		"allowed":   h.config.AllowedAuths,
	})
}

func (h *Handler) oauthStart(providerName string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		provider, ok := h.registry.Get(providerName)
		if !ok {
			http.Error(w, "Provider not found", http.StatusNotFound)
			return
		}

		state, err := generateState()
		if err != nil {
			logger.Error("Failed to generate state", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		// Store state in session or cookie for validation
		isDev := os.Getenv("ENV") != "production"
		stateCookie := &http.Cookie{
			Name:     "oauth_state",
			Value:    state,
			Path:     "/",
			HttpOnly: true,
			MaxAge:   600,
			SameSite: http.SameSiteLaxMode,
		}

		if !isDev {
			stateCookie.Secure = true
		}

		http.SetCookie(w, stateCookie)

		authURL := provider.GetAuthURL(state)
		http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
	}
}

func (h *Handler) oauthCallback(providerName string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		provider, ok := h.registry.Get(providerName)
		if !ok {
			http.Error(w, "Provider not found", http.StatusNotFound)
			return
		}

		code := r.URL.Query().Get("code")
		state := r.URL.Query().Get("state")

		if code == "" {
			http.Error(w, "Missing authorization code", http.StatusBadRequest)
			return
		}

		// Validate state
		stateCookie, err := r.Cookie("oauth_state")
		if err != nil || stateCookie.Value != state {
			logger.Warn("Invalid state parameter")
			http.Error(w, "Invalid state", http.StatusBadRequest)
			return
		}

		// Exchange code for token
		token, err := provider.ExchangeCode(code)
		if err != nil {
			logger.Error("Failed to exchange code", err)
			http.Error(w, "Failed to exchange authorization code", http.StatusInternalServerError)
			return
		}
		if strings.TrimSpace(token.AccessToken) == "" {
			logger.Warn("OAuth token exchange returned empty access token")
			http.Error(w, "Failed to exchange authorization code", http.StatusBadGateway)
			return
		}

		// Get user info
		user, err := provider.GetUserInfo(token.AccessToken)
		if err != nil {
			logger.Error("Failed to get user info", err)
			http.Error(w, "Failed to get user information", http.StatusInternalServerError)
			return
		}
		if strings.TrimSpace(user.ID) == "" {
			logger.Warn("OAuth provider returned empty user id")
			http.Error(w, "OAuth provider did not return a valid user id", http.StatusBadGateway)
			return
		}
		if strings.TrimSpace(user.Email) == "" {
			logger.Warn(fmt.Sprintf("%s OAuth did not return email - using fallback", providerName))
		}

		dbUser, err := h.store.UpsertOAuthUser(providerName, user.ID, user.Email, user.Username)
		if err != nil {
			logger.Error("Failed to persist oauth user", err)
			http.Error(w, "Can't log you in right now..", http.StatusInternalServerError)
			return
		}

		sessionID := uuid.NewString()

		// Create session
		session := &types.Session{
			SessionID: sessionID,
			UserUUID:  dbUser.UUID,
			Provider:  providerName,
			Email:     dbUser.Email,
			Username:  dbUser.Username,
			User:      user,
			Token:     token,
		}

		if err := h.sessionStore.Create(w, r, session); err != nil {
			logger.Error("Failed to create session", err)
			http.Error(w, "Failed to create session", http.StatusInternalServerError)
			return
		}

		if err := h.store.AddOrUpdateSession(dbUser.UUID, sessionID, providerName, r.UserAgent(), clientIP(r)); err != nil {
			logger.Warn(fmt.Sprintf("failed to sync user session in db: %v", err))
		}

		// Redirect to frontend
		frontendURL := os.Getenv("FRONTEND_URL")
		if frontendURL == "" {
			frontendURL = "http://frontend-not-found.nadhi.dev"
		}
		http.Redirect(w, r, frontendURL+"/auth/callback?success=true", http.StatusTemporaryRedirect)
	}
}

func (h *Handler) getSession(w http.ResponseWriter, r *http.Request) {
	session, err := h.sessionStore.Get(w, r)
	if err != nil {
		h.writeJSON(w, http.StatusUnauthorized, map[string]interface{}{
			"authenticated": false,
		})
		return
	}

	// Check if session is blacklisted
	if blacklisted, err := h.store.IsSessionBlacklisted(r.Context(), session.SessionID); err == nil && blacklisted {
		h.writeJSON(w, http.StatusUnauthorized, map[string]interface{}{
			"authenticated": false,
			"error":         "Session invalidated",
		})
		return
	}

	var user *mongo.UserDocument
	if session.UserUUID != "" {
		if dbUser, userErr := h.store.GetUserByUUID(session.UserUUID); userErr == nil {
			user = dbUser

			// Check if user is banned
			if user.Role == "banned" {
				h.writeJSON(w, http.StatusForbidden, map[string]interface{}{
					"authenticated": false,
					"error":         "User is banned",
				})
				return
			}
		}
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"authenticated": true,
		"user":          user,
		"provider":      session.Provider,
		"session":       session,
	})
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if session, err := h.sessionStore.Get(w, r); err == nil {
		if session.UserUUID != "" && session.SessionID != "" {
			if removeErr := h.store.RemoveSession(session.UserUUID, session.SessionID); removeErr != nil {
				logger.Warn(fmt.Sprintf("failed to remove session from db: %v", removeErr))
			}
		}
	}

	if err := h.sessionStore.Destroy(w, r); err != nil {
		logger.Error("Failed to destroy session", err)
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
	})
}

func (h *Handler) emailLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	user, err := h.store.VerifyEmailUser(req.Email, req.Password)
	if err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	sessionID := uuid.NewString()
	session := &types.Session{
		SessionID: sessionID,
		UserUUID:  user.UUID,
		Provider:  "email",
		Email:     user.Email,
		Username:  user.Username,
		User: &types.User{
			ID:       user.UUID,
			Email:    user.Email,
			Username: user.Username,
			Provider: "email",
		},
	}

	if err := h.sessionStore.Create(w, r, session); err != nil {
		logger.Error("Failed to create session", err)
		http.Error(w, "Failed to create session", http.StatusInternalServerError)
		return
	}

	if err := h.store.AddOrUpdateSession(user.UUID, sessionID, "email", r.UserAgent(), clientIP(r)); err != nil {
		logger.Warn(fmt.Sprintf("failed to sync user session in db: %v", err))
	}

	h.writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"user":    user,
	})
}

func (h *Handler) emailRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Username string `json:"username"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	user, err := h.store.CreateEmailUser(req.Email, req.Username, req.Password)
	if err != nil {
		http.Error(w, "Failed to create user", http.StatusBadRequest)
		return
	}

	sessionID := uuid.NewString()
	session := &types.Session{
		SessionID: sessionID,
		UserUUID:  user.UUID,
		Provider:  "email",
		Email:     user.Email,
		Username:  user.Username,
		User: &types.User{
			ID:       user.UUID,
			Email:    user.Email,
			Username: user.Username,
			Provider: "email",
		},
	}

	if err := h.sessionStore.Create(w, r, session); err != nil {
		logger.Error("Failed to create session", err)
		http.Error(w, "Failed to create session", http.StatusInternalServerError)
		return
	}

	if err := h.store.AddOrUpdateSession(user.UUID, sessionID, "email", r.UserAgent(), clientIP(r)); err != nil {
		logger.Warn(fmt.Sprintf("failed to sync user session in db: %v", err))
	}

	h.writeJSON(w, http.StatusCreated, map[string]any{
		"success": true,
		"user":    user,
	})
}

func (h *Handler) handleOrgs(w http.ResponseWriter, r *http.Request) {
	session, user, ok := h.requireAuth(w, r)
	if !ok {
		_ = session
		return
	}

	switch r.Method {
	case http.MethodGet:
		orgs, err := h.store.ListOrganizationsForUser(user.UUID)
		if err != nil {
			http.Error(w, "Failed to list orgs", http.StatusInternalServerError)
			return
		}
		h.writeJSON(w, http.StatusOK, map[string]any{"orgs": orgs})
	case http.MethodPost:
		var req struct {
			Name string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}
		org, err := h.store.CreateOrganization(user.UUID, req.Name)
		if err != nil {
			http.Error(w, "Failed to create org", http.StatusBadRequest)
			return
		}
		h.writeJSON(w, http.StatusCreated, map[string]any{"org": org})
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *Handler) handleOrgRoutes(w http.ResponseWriter, r *http.Request) {
	_, user, ok := h.requireAuth(w, r)
	if !ok {
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/orgs/")
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) < 2 {
		http.NotFound(w, r)
		return
	}

	orgUUID := parts[0]

	if len(parts) == 1 && r.Method == http.MethodGet {
		org, err := h.store.GetOrganizationForUser(user.UUID, orgUUID)
		if err != nil {
			http.Error(w, err.Error(), orgErrorStatus(err))
			return
		}

		h.writeJSON(w, http.StatusOK, map[string]any{"org": org})
		return
	}

	if len(parts) == 2 && parts[1] == "invite" {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			Email string `json:"email"`
			Role  string `json:"role"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		invite, err := h.store.CreateInvite(user.UUID, orgUUID, req.Email, req.Role)
		if err != nil {
			http.Error(w, err.Error(), orgErrorStatus(err))
			return
		}

		h.writeJSON(w, http.StatusCreated, map[string]any{"invite": invite})
		return
	}

	if len(parts) == 2 && parts[1] == "members" {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		members, err := h.store.ListOrgMembers(user.UUID, orgUUID)
		if err != nil {
			http.Error(w, err.Error(), orgErrorStatus(err))
			return
		}

		h.writeJSON(w, http.StatusOK, map[string]any{"members": members})
		return
	}

	if len(parts) == 3 && parts[1] == "members" {
		memberUUID := parts[2]

		switch r.Method {
		case http.MethodPatch:
			var req struct {
				Role string `json:"role"`
			}
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, "Invalid request body", http.StatusBadRequest)
				return
			}

			if err := h.store.UpdateMemberRole(user.UUID, orgUUID, memberUUID, req.Role); err != nil {
				http.Error(w, err.Error(), orgErrorStatus(err))
				return
			}

			h.writeJSON(w, http.StatusOK, map[string]any{"success": true})
			return
		case http.MethodDelete:
			if err := h.store.RemoveMember(user.UUID, orgUUID, memberUUID); err != nil {
				http.Error(w, err.Error(), orgErrorStatus(err))
				return
			}

			h.writeJSON(w, http.StatusOK, map[string]any{"success": true})
			return
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
	}

	http.NotFound(w, r)
}

func (h *Handler) listMyInvites(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	_, user, ok := h.requireAuth(w, r)
	if !ok {
		return
	}

	invites, err := h.store.ListPendingInvitesByEmail(user.Email)
	if err != nil {
		http.Error(w, "Failed to list invites", http.StatusInternalServerError)
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]any{"invites": invites})
}

func (h *Handler) handleInviteRoutes(w http.ResponseWriter, r *http.Request) {
	_, user, ok := h.requireAuth(w, r)
	if !ok {
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/org-invites/")
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) != 2 || parts[1] != "accept" {
		http.NotFound(w, r)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := h.store.AcceptInvite(parts[0], user.UUID, user.Email); err != nil {
		http.Error(w, err.Error(), orgErrorStatus(err))
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]any{"success": true})
}

func (h *Handler) requireAuth(w http.ResponseWriter, r *http.Request) (*types.Session, *mongo.UserDocument, bool) {
	session, err := h.sessionStore.Get(w, r)
	if err != nil || session.UserUUID == "" {
		h.writeJSON(w, http.StatusUnauthorized, map[string]any{"authenticated": false})
		return nil, nil, false
	}

	user, err := h.store.GetUserByUUID(session.UserUUID)
	if err != nil {
		h.writeJSON(w, http.StatusUnauthorized, map[string]any{"authenticated": false})
		return nil, nil, false
	}
	return session, user, true
}

func (h *Handler) writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func orgErrorStatus(err error) int {
	if err == nil {
		return http.StatusInternalServerError
	}
	msg := strings.ToLower(err.Error())
	if strings.Contains(msg, "insufficient") || strings.Contains(msg, "cannot") || strings.Contains(msg, "not a member") {
		return http.StatusForbidden
	}
	if strings.Contains(msg, "not found") {
		return http.StatusNotFound
	}
	if strings.Contains(msg, "invalid") || strings.Contains(msg, "required") || strings.Contains(msg, "expired") || strings.Contains(msg, "match") {
		return http.StatusBadRequest
	}
	return http.StatusInternalServerError
}

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

func generateState() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

func capitalizeFirst(s string) string {
	if s == "" {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}

func (h *Handler) changePassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	session, user, ok := h.requireAuth(w, r)
	if !ok {
		return
	}

	// Only allow password change for email auth users
	if session.Provider != "email" {
		http.Error(w, "Password change only available for email authentication", http.StatusBadRequest)
		return
	}

	var req struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.NewPassword == "" || len(req.NewPassword) < 8 {
		http.Error(w, "New password must be at least 8 characters", http.StatusBadRequest)
		return
	}

	// Verify current password
	if _, err := h.store.VerifyEmailUser(user.Email, req.CurrentPassword); err != nil {
		http.Error(w, "Current password is incorrect", http.StatusUnauthorized)
		return
	}

	// Update password
	if err := h.store.UpdateUserPassword(user.UUID, req.NewPassword); err != nil {
		logger.Error("Failed to update password", err)
		http.Error(w, "Failed to update password", http.StatusInternalServerError)
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Password updated successfully",
	})
}

func (h *Handler) updateProfile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost && r.Method != http.MethodPatch {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	_, user, ok := h.requireAuth(w, r)
	if !ok {
		return
	}

	var req struct {
		Username string `json:"username"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	username := strings.TrimSpace(req.Username)
	if username == "" {
		http.Error(w, "Username cannot be empty", http.StatusBadRequest)
		return
	}

	if len(username) < 3 || len(username) > 32 {
		http.Error(w, "Username must be between 3 and 32 characters", http.StatusBadRequest)
		return
	}

	// Update username
	if err := h.store.UpdateUsername(user.UUID, username); err != nil {
		logger.Error("Failed to update username", err)
		http.Error(w, "Failed to update username", http.StatusInternalServerError)
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]any{
		"success":  true,
		"message":  "Username updated successfully",
		"username": username,
	})
}

// GetStore returns the mongo store
func (h *Handler) GetStore() *mongo.Store {
	return h.store
}

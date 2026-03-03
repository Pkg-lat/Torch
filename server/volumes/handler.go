package volumes

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"torch/pkg.lat/auth"
	"torch/pkg.lat/lightd"
	"torch/pkg.lat/logger"
	"torch/pkg.lat/mongo"
)

type Handler struct {
	store *mongo.Store
}

func NewHandler(store *mongo.Store) *Handler {
	return &Handler{store: store}
}

type CreateVolumeRequest struct {
	Name        string `json:"name"`
	SizeMB      int    `json:"sizeMb"`
	NodeUUID    string `json:"nodeUuid"`
	WorkspaceID string `json:"workspaceId"`
}

type CreateVolumeResponse struct {
	Volume *mongo.Volume `json:"volume"`
}

type ListVolumesResponse struct {
	Volumes []mongo.Volume `json:"volumes"`
	Meta    struct {
		Total int64 `json:"total"`
		Page  int   `json:"page"`
		Limit int   `json:"limit"`
	} `json:"meta"`
}

type VolumeResponse struct {
	Volume *mongo.Volume `json:"volume"`
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

// CreateVolume creates a new volume
func (h *Handler) CreateVolume(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	user := GetUserFromContext(r.Context())
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req CreateVolumeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.WorkspaceID == "" {
		http.Error(w, "workspaceId is required", http.StatusBadRequest)
		return
	}

	if req.NodeUUID == "" {
		http.Error(w, "nodeUuid is required", http.StatusBadRequest)
		return
	}

	if req.SizeMB <= 0 {
		req.SizeMB = 1024 // Default 1GB
	}

	if req.Name == "" {
		req.Name = fmt.Sprintf("volume-%d", time.Now().Unix())
	}

	// Check if user is member of workspace
	role, err := h.store.UserRoleInOrg(user.UUID, req.WorkspaceID)
	if err != nil {
		http.Error(w, "Not a member of this workspace", http.StatusForbidden)
		return
	}

	// Check storage limits (uses workspace owner's limits)
	if err := h.store.CheckWorkspaceStorageLimit(r.Context(), req.WorkspaceID, req.SizeMB); err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}

	// Get node details
	node, err := h.store.GetNodeByUUID(req.NodeUUID)
	if err != nil {
		http.Error(w, "Node not found", http.StatusNotFound)
		return
	}

	// Create volume on lightd
	client := lightd.NewClient(node.Scheme, node.Host.Host, node.Host.Port, node.SecretToken)
	lightdVolID, err := h.createLightdVolume(client, req.SizeMB)
	if err != nil {
		logger.Error("Failed to create volume on lightd", err)
		http.Error(w, fmt.Sprintf("Failed to create volume: %v", err), http.StatusInternalServerError)
		return
	}

	// Create volume record in database
	volume, err := h.store.CreateVolume(r.Context(), req.WorkspaceID, user.UUID, req.NodeUUID, lightdVolID, req.SizeMB, req.Name)
	if err != nil {
		// Try to cleanup lightd volume
		_ = h.deleteLightdVolume(client, lightdVolID)
		http.Error(w, "Failed to create volume record", http.StatusInternalServerError)
		return
	}

	// Log to workspace audit
	_ = h.store.LogWorkspaceAction(
		r.Context(),
		req.WorkspaceID,
		user.UUID,
		user.Email,
		"volume:create",
		"volume",
		volume.UUID,
		map[string]interface{}{
			"name":    req.Name,
			"size_mb": req.SizeMB,
			"node":    req.NodeUUID,
			"role":    role,
		},
		getIP(r),
		r.UserAgent(),
	)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(CreateVolumeResponse{Volume: volume})
}

// ListVolumes lists volumes for a workspace
func (h *Handler) ListVolumes(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	user := GetUserFromContext(r.Context())
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	workspaceID := r.URL.Query().Get("workspaceId")
	if workspaceID == "" {
		http.Error(w, "workspaceId is required", http.StatusBadRequest)
		return
	}

	// Check if user is member of workspace
	_, err := h.store.UserRoleInOrg(user.UUID, workspaceID)
	if err != nil {
		http.Error(w, "Not a member of this workspace", http.StatusForbidden)
		return
	}

	// Parse pagination
	page := 1
	if p := r.URL.Query().Get("page"); p != "" {
		if parsed, err := strconv.Atoi(p); err == nil && parsed > 0 {
			page = parsed
		}
	}

	limit := int64(20)
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.ParseInt(l, 10, 64); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	skip := int64((page - 1)) * limit

	volumes, total, err := h.store.ListVolumesByWorkspace(r.Context(), workspaceID, limit, skip)
	if err != nil {
		http.Error(w, "Failed to list volumes", http.StatusInternalServerError)
		return
	}

	response := ListVolumesResponse{
		Volumes: volumes,
	}
	response.Meta.Total = total
	response.Meta.Page = page
	response.Meta.Limit = int(limit)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetVolume retrieves a single volume
func (h *Handler) GetVolume(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	user := GetUserFromContext(r.Context())
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Extract volume UUID from path
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 3 {
		http.Error(w, "Invalid volume ID", http.StatusBadRequest)
		return
	}
	volumeUUID := parts[len(parts)-1]

	volume, err := h.store.GetVolume(r.Context(), volumeUUID)
	if err != nil {
		http.Error(w, "Volume not found", http.StatusNotFound)
		return
	}

	// Check if user is member of workspace
	_, err = h.store.UserRoleInOrg(user.UUID, volume.WorkspaceID)
	if err != nil {
		http.Error(w, "Not a member of this workspace", http.StatusForbidden)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(VolumeResponse{Volume: volume})
}

// DeleteVolume deletes a volume
func (h *Handler) DeleteVolume(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	user := GetUserFromContext(r.Context())
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Extract volume UUID from path
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 3 {
		http.Error(w, "Invalid volume ID", http.StatusBadRequest)
		return
	}
	volumeUUID := parts[len(parts)-1]

	volume, err := h.store.GetVolume(r.Context(), volumeUUID)
	if err != nil {
		http.Error(w, "Volume not found", http.StatusNotFound)
		return
	}

	// Check if user has permission (owner or admin)
	role, err := h.store.UserRoleInOrg(user.UUID, volume.WorkspaceID)
	if err != nil {
		http.Error(w, "Not a member of this workspace", http.StatusForbidden)
		return
	}

	if role != mongo.RoleOwner && role != mongo.RoleAdmin {
		http.Error(w, "Insufficient permissions", http.StatusForbidden)
		return
	}

	// Get node details
	node, err := h.store.GetNodeByUUID(volume.NodeUUID)
	if err != nil {
		http.Error(w, "Node not found", http.StatusNotFound)
		return
	}

	// Delete volume from lightd
	client := lightd.NewClient(node.Scheme, node.Host.Host, node.Host.Port, node.SecretToken)
	if err := h.deleteLightdVolume(client, volume.LightdVolID); err != nil {
		logger.Error("Failed to delete volume from lightd", err)
		// Continue anyway to clean up database
	}

	// Delete volume record
	if err := h.store.DeleteVolume(r.Context(), volumeUUID); err != nil {
		http.Error(w, "Failed to delete volume", http.StatusInternalServerError)
		return
	}

	// Log to workspace audit
	_ = h.store.LogWorkspaceAction(
		r.Context(),
		volume.WorkspaceID,
		user.UUID,
		user.Email,
		"volume:delete",
		"volume",
		volume.UUID,
		map[string]interface{}{
			"name":    volume.Name,
			"size_mb": volume.SizeMB,
			"role":    role,
		},
		getIP(r),
		r.UserAgent(),
	)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Volume deleted successfully"})
}

// Helper functions for lightd API calls

func (h *Handler) createLightdVolume(client *lightd.Client, sizeMB int) (string, error) {
	url := client.BaseURL + "/volumes"

	body := map[string]interface{}{
		"size": sizeMB,
	}
	jsonBody, _ := json.Marshal(body)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", err
	}

	req.Header.Set("Authorization", "Bearer "+client.Token)
	req.Header.Set("Accept", "Application/vnd.pkglatv1+json")
	req.Header.Set("Content-Type", "application/json")

	httpClient := &http.Client{Timeout: 30 * time.Second}
	resp, err := httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("lightd returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	// Extract volume ID from response
	volumeID, ok := result["volume_id"].(string)
	if !ok {
		volumeID, ok = result["id"].(string)
		if !ok {
			return "", fmt.Errorf("no volume_id in response")
		}
	}

	return volumeID, nil
}

func (h *Handler) deleteLightdVolume(client *lightd.Client, volumeID string) error {
	url := fmt.Sprintf("%s/volumes/%s", client.BaseURL, volumeID)

	req, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "Bearer "+client.Token)
	req.Header.Set("Accept", "Application/vnd.pkglatv1+json")

	httpClient := &http.Client{Timeout: 30 * time.Second}
	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("lightd returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	return nil
}

// ListNodes returns all online nodes (public endpoint for volume creation)
func (h *Handler) ListNodes(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	user := GetUserFromContext(r.Context())
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	nodes, err := h.store.ListNodes()
	if err != nil {
		http.Error(w, "Failed to list nodes", http.StatusInternalServerError)
		return
	}

	// Filter to only return online nodes and remove sensitive data
	type PublicNode struct {
		UUID   string `json:"uuid"`
		Name   string `json:"name"`
		FQDN   string `json:"fqdn"`
		Status string `json:"status"`
	}

	publicNodes := make([]PublicNode, 0)
	for _, node := range nodes {
		if node.Status == "online" {
			publicNodes = append(publicNodes, PublicNode{
				UUID:   node.UUID,
				Name:   node.Name,
				FQDN:   node.FQDN,
				Status: node.Status,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"nodes": publicNodes,
	})
}

func getIP(r *http.Request) string {
	forwarded := r.Header.Get("X-Forwarded-For")
	if forwarded != "" {
		return strings.Split(forwarded, ",")[0]
	}
	return r.RemoteAddr
}

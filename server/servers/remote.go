package servers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"torch/pkg.lat/logger"
	"torch/pkg.lat/mongo"
)

// RemoteHandler handles callbacks from LightD remote sync
type RemoteHandler struct {
	store *mongo.Store
}

func NewRemoteHandler(store *mongo.Store) *RemoteHandler {
	return &RemoteHandler{store: store}
}

// Health handles GET /health - LightD checks this every 30 seconds
func (h *RemoteHandler) Health(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	logger.Info("LightD health check received")

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]any{
		"status":   200,
		"endpoint": "active",
	})
}

// Update handles POST /update - LightD sends container status updates here
type UpdatePayload struct {
	Event  string                 `json:"event"`  // "update"
	Server string                 `json:"server"` // internal_id of the container
	Status string                 `json:"status"` // "installing", "ready", "failed", "running", "stopped", etc.
	Error  string                 `json:"error,omitempty"`
	Data   map[string]interface{} `json:"data,omitempty"`
}

func (h *RemoteHandler) Update(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// TODO: Verify Authorization header matches node's secret token

	var payload UpdatePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		logger.Error("Invalid callback payload", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Log the full callback for debugging
	logger.Info(fmt.Sprintf("LightD callback received: event=%s, server=%s, status=%s, error=%s",
		payload.Event, payload.Server, payload.Status, payload.Error))

	// Validate that we have a server ID
	if payload.Server == "" {
		logger.Error("Empty server ID in callback", fmt.Errorf("payload: %+v", payload))
		http.Error(w, "Server ID is required", http.StatusBadRequest)
		return
	}

	// Get server by internal ID (which is the server UUID)
	server, err := h.store.GetServerByInternalID(payload.Server)
	if err != nil {
		logger.Error(fmt.Sprintf("Server not found for callback: internal_id=%s", payload.Server), err)
		http.Error(w, "Server not found", http.StatusNotFound)
		return
	}

	// Handle error callbacks
	if payload.Error != "" {
		logger.Error(fmt.Sprintf("LightD error for server %s: %s", server.UUID, payload.Error), nil)

		// Update server status to error and store error message
		updates := map[string]any{
			"status": "error",
		}

		if payload.Data != nil {
			if errMsg, ok := payload.Data["message"].(string); ok {
				updates["error_message"] = errMsg
			}
		} else {
			updates["error_message"] = payload.Error
		}

		err = h.store.UpdateServer(server.UUID, updates)
		if err != nil {
			logger.Error(fmt.Sprintf("Failed to update server error status: server_id=%s", server.UUID), err)
			http.Error(w, "Failed to update status", http.StatusInternalServerError)
			return
		}

		logger.Info(fmt.Sprintf("Server error recorded: server_id=%s, internal_id=%s, error=%s",
			server.UUID, payload.Server, payload.Error))

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]any{
			"success": true,
		})
		return
	}

	// Validate status is not empty
	if payload.Status == "" {
		logger.Error(fmt.Sprintf("Empty status in callback for server %s", server.UUID), fmt.Errorf("payload: %+v", payload))
		http.Error(w, "Status is required", http.StatusBadRequest)
		return
	}

	// Map LightD status to our status
	newStatus := mapLightDStatus(payload.Status)
	oldStatus := server.Status

	// Don't update if mapped status is empty (shouldn't happen but safety check)
	if newStatus == "" {
		logger.Error(fmt.Sprintf("Mapped status is empty for server %s, lightd_status=%s", server.UUID, payload.Status), nil)
		http.Error(w, "Invalid status mapping", http.StatusBadRequest)
		return
	}

	// Update server status
	err = h.store.UpdateServer(server.UUID, map[string]any{
		"status":        newStatus,
		"error_message": "", // Clear any previous error
	})
	if err != nil {
		logger.Error(fmt.Sprintf("Failed to update server status: server_id=%s", server.UUID), err)
		http.Error(w, "Failed to update status", http.StatusInternalServerError)
		return
	}

	logger.Info(fmt.Sprintf("Server status updated: server_id=%s, internal_id=%s, old_status=%s, new_status=%s",
		server.UUID, payload.Server, oldStatus, newStatus))

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]any{
		"success": true,
	})
}

// mapLightDStatus maps LightD lifecycle events to our server statuses
func mapLightDStatus(lightdStatus string) string {
	// Return empty string for empty input (caller should validate)
	if lightdStatus == "" {
		return ""
	}

	switch lightdStatus {
	case "installing", "CreatingContainer":
		return "installing"
	case "ready":
		return "stopped" // Container is ready but not started
	case "failed":
		return "error"
	case "running":
		return "running"
	case "stopped":
		return "stopped"
	case "starting":
		return "starting"
	case "stopping":
		return "stopping"
	default:
		// Log unknown status but pass it through
		logger.Info(fmt.Sprintf("Unknown LightD status encountered: %s", lightdStatus))
		return lightdStatus
	}
}

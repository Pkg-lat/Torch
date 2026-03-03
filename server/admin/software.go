package admin

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"torch/pkg.lat/logger"
	"torch/pkg.lat/mongo"
)

type softwareCreateEnvelope struct {
	Software *mongo.Software `json:"software"`
}

func normalizeSoftwareForCreate(software *mongo.Software) {
	software.Name = strings.TrimSpace(software.Name)
	software.IconURL = strings.TrimSpace(software.IconURL)
	software.StartupCmd = strings.TrimSpace(software.StartupCmd)
	software.InstallContent = strings.TrimSpace(software.InstallContent)
	software.UpdateContent = strings.TrimSpace(software.UpdateContent)

	if software.DockerImages == nil {
		software.DockerImages = map[string]string{}
	}

	if software.Runtime.FileInit == "" {
		software.Runtime.FileInit = ""
	}

	if software.Runtime.StartUp == "" {
		software.Runtime.StartUp = ""
	}

	if software.Runtime.Stop == "" {
		software.Runtime.Stop = ""
	}

	if software.Networking.PortBinds == nil {
		software.Networking.PortBinds = map[string]string{}
	}

	if software.Variables == nil {
		software.Variables = []mongo.SoftwareVariable{}
	}
}

func decodeCreateSoftwarePayload(r *http.Request) (*mongo.Software, error) {
	defer r.Body.Close()
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, err
	}

	var software mongo.Software
	if err := json.Unmarshal(body, &software); err == nil {
		return &software, nil
	}

	// fallback for payloads wrapped as {"software": {...}}
	var envelope softwareCreateEnvelope
	if err := json.Unmarshal(body, &envelope); err != nil {
		return nil, err
	}

	if envelope.Software == nil {
		return nil, io.ErrUnexpectedEOF
	}

	return envelope.Software, nil
}

// CreateSoftware handles POST /api/admin/software
func (h *Handler) CreateSoftware(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	software, err := decodeCreateSoftwarePayload(r)
	if err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	normalizeSoftwareForCreate(software)

	// Validate required fields
	if software.Name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}

	created, err := h.store.CreateSoftware(software)
	if err != nil {
		logger.Error("Failed to create software", err)
		http.Error(w, "Failed to create software", http.StatusInternalServerError)
		return
	}

	h.writeJSON(w, http.StatusCreated, map[string]any{
		"software": created,
	})

	h.logAudit(r, "create", "software", created.UUID, map[string]any{
		"name": software.Name,
	}, "success", "")
}

// ListSoftware handles GET /api/admin/software
func (h *Handler) ListSoftware(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	software, err := h.store.ListSoftware()
	if err != nil {
		logger.Error("Failed to list software", err)
		http.Error(w, "Failed to list software", http.StatusInternalServerError)
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]any{
		"software": software,
	})
}

// GetSoftware handles GET /api/admin/software/:uuid
func (h *Handler) GetSoftware(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	softwareUUID := strings.TrimPrefix(r.URL.Path, "/api/admin/software/")
	if softwareUUID == "" {
		http.Error(w, "Software UUID required", http.StatusBadRequest)
		return
	}

	software, err := h.store.GetSoftwareByUUID(softwareUUID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]any{
		"software": software,
	})
}

// UpdateSoftware handles PATCH /api/admin/software/:uuid
func (h *Handler) UpdateSoftware(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	softwareUUID := strings.TrimPrefix(r.URL.Path, "/api/admin/software/")
	if softwareUUID == "" {
		http.Error(w, "Software UUID required", http.StatusBadRequest)
		return
	}

	var updates map[string]any
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if len(updates) == 0 {
		http.Error(w, "No updates provided", http.StatusBadRequest)
		return
	}

	if err := h.store.UpdateSoftware(softwareUUID, updates); err != nil {
		logger.Error("Failed to update software", err)
		http.Error(w, "Failed to update software", http.StatusInternalServerError)
		return
	}

	// Get updated software
	software, err := h.store.GetSoftwareByUUID(softwareUUID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]any{
		"software": software,
	})

	h.logAudit(r, "update", "software", softwareUUID, updates, "success", "")
}

// DeleteSoftware handles DELETE /api/admin/software/:uuid
func (h *Handler) DeleteSoftware(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	softwareUUID := strings.TrimPrefix(r.URL.Path, "/api/admin/software/")
	if softwareUUID == "" {
		http.Error(w, "Software UUID required", http.StatusBadRequest)
		return
	}

	// Get software before deletion for audit log
	software, err := h.store.GetSoftwareByUUID(softwareUUID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	if err := h.store.DeleteSoftware(softwareUUID); err != nil {
		logger.Error("Failed to delete software", err)
		http.Error(w, "Failed to delete software", http.StatusInternalServerError)
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
	})

	h.logAudit(r, "delete", "software", softwareUUID, map[string]any{
		"name": software.Name,
	}, "success", "")
}

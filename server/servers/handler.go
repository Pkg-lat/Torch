package servers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"torch/pkg.lat/auth"
	"torch/pkg.lat/lightd"
	"torch/pkg.lat/logger"
	"torch/pkg.lat/mongo"
)

// ReplaceVariables replaces {{ENV_VARIABLE}} placeholders in a template string
// with values from the provided variables map, falling back to defaults if not provided
func ReplaceVariables(template string, software *mongo.Software, userVariables map[string]string) string {
	result := template
	for _, variable := range software.Variables {
		placeholder := "{{" + variable.EnvVariable + "}}"
		if value, ok := userVariables[variable.EnvVariable]; ok {
			result = strings.ReplaceAll(result, placeholder, value)
		} else if variable.DefaultValue != "" {
			result = strings.ReplaceAll(result, placeholder, variable.DefaultValue)
		}
	}
	return result
}

type Handler struct {
	store *mongo.Store
}

func NewHandler(store *mongo.Store) *Handler {
	return &Handler{store: store}
}

func (h *Handler) writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// ListSoftware handles GET /api/software (public route)
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

// GetSoftware handles GET /api/software/:uuid (public route)
func (h *Handler) GetSoftware(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	softwareUUID := strings.TrimPrefix(r.URL.Path, "/api/software/")
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

type CreateServerRequest struct {
	Name         string            `json:"name"`
	SoftwareUUID string            `json:"softwareUuid"`
	NodeUUID     string            `json:"nodeUuid"`
	VolumeUUID   string            `json:"volumeUuid,omitempty"`
	ImageKey     string            `json:"imageKey,omitempty"` // Which docker image variant to use
	Variables    map[string]string `json:"variables,omitempty"`
}

// CreateServer handles POST /api/servers/create
func (h *Handler) CreateServer(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user from session
	sessionStore := auth.NewCookieSessionStore()
	session, err := sessionStore.Get(w, r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	user, err := h.store.GetUserByUUID(session.UserUUID)
	if err != nil {
		http.Error(w, "User not found", http.StatusUnauthorized)
		return
	}

	// Get workspace from query
	workspaceID := r.URL.Query().Get("workspaceId")
	if workspaceID == "" {
		http.Error(w, "workspaceId is required", http.StatusBadRequest)
		return
	}

	// Verify user has access to workspace and get their role
	org, err := h.store.GetOrganizationForUser(user.UUID, workspaceID)
	if err != nil {
		http.Error(w, "Access denied to workspace", http.StatusForbidden)
		return
	}

	// Guests cannot create servers
	if org.Role == "guest" {
		http.Error(w, "Guests do not have permission to create servers", http.StatusForbidden)
		return
	}

	// Parse request
	var req CreateServerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.Name == "" || req.SoftwareUUID == "" || req.NodeUUID == "" {
		http.Error(w, "name, softwareUuid, and nodeUuid are required", http.StatusBadRequest)
		return
	}

	// Volume is required - no ephemeral storage allowed
	if req.VolumeUUID == "" {
		http.Error(w, "volumeUuid is required - ephemeral storage is not allowed", http.StatusBadRequest)
		return
	}

	// Get software
	software, err := h.store.GetSoftwareByUUID(req.SoftwareUUID)
	if err != nil {
		http.Error(w, "Software not found", http.StatusNotFound)
		return
	}

	// Get node
	node, err := h.store.GetNodeByUUID(req.NodeUUID)
	if err != nil {
		http.Error(w, "Node not found", http.StatusNotFound)
		return
	}

	// Check user limits
	limits, ok := user.Limits["memory_mb"].(int)
	if !ok {
		limits = 2048 // default
	}
	memoryBytes := int64(limits) * 1024 * 1024

	cpuLimit, ok := user.Limits["vcpu"].(int)
	if !ok {
		cpuLimit = 100 // default
	}
	cpuCores := float64(cpuLimit) / 100.0

	// Get volume if specified
	var lightdVolumeID string
	if req.VolumeUUID != "" {
		volume, err := h.store.GetVolume(r.Context(), req.VolumeUUID)
		if err != nil {
			http.Error(w, "Volume not found", http.StatusNotFound)
			return
		}
		if volume.WorkspaceID != workspaceID {
			http.Error(w, "Volume does not belong to workspace", http.StatusForbidden)
			return
		}
		lightdVolumeID = volume.LightdVolID
	}

	// Select docker image
	imageKey := req.ImageKey
	if imageKey == "" {
		// Default to first available if not specified
		for key := range software.DockerImages {
			imageKey = key
			break
		}
	}

	dockerImage, ok := software.DockerImages[imageKey]
	if !ok {
		http.Error(w, "Invalid image key", http.StatusBadRequest)
		return
	}

	// Parse ports from software networking and allocate them
	ports := []mongo.ServerPort{}
	for containerPortStr, hostPortStr := range software.Networking.PortBinds {
		containerPort, _ := strconv.Atoi(containerPortStr)
		if containerPort <= 0 {
			continue
		}

		var hostPort int
		if hostPortStr == "auto" {
			// Allocate a free port from node
			allocated, err := h.store.AllocatePort(node.UUID, containerPort, "tcp", "")
			if err != nil {
				http.Error(w, fmt.Sprintf("Failed to allocate port: %s", err.Error()), http.StatusInternalServerError)
				return
			}
			hostPort = allocated
		} else {
			hostPort, _ = strconv.Atoi(hostPortStr)
			if hostPort <= 0 {
				continue
			}
			// Mark specific port as in use
			err := h.store.MarkPortInUse(node.UUID, hostPort, "tcp", "")
			if err != nil {
				http.Error(w, fmt.Sprintf("Port %d not available: %s", hostPort, err.Error()), http.StatusBadRequest)
				return
			}
		}

		ports = append(ports, mongo.ServerPort{
			ContainerPort: containerPort,
			HostPort:      hostPort,
			Protocol:      "tcp",
		})
	}

	// Build startup command and install script with variables
	startupCmd := ReplaceVariables(software.StartupCmd, software, req.Variables)
	installScript := ReplaceVariables(software.InstallContent, software, req.Variables)

	// Create server in database with UUID as internal_id (source of truth)
	server := &mongo.Server{
		Name:           req.Name,
		WorkspaceID:    workspaceID,
		CreatedBy:      user.UUID,
		NodeUUID:       node.UUID,
		SoftwareUUID:   software.UUID,
		VolumeUUID:     req.VolumeUUID,
		LightdVolumeID: lightdVolumeID,
		ImageKey:       imageKey,
		Image:          dockerImage,
		StartupCommand: startupCmd,
		StartPattern:   software.Runtime.StartUp,
		InstallScript:  installScript,
		Ports:          ports,
		Limits: mongo.ServerLimits{
			Memory: memoryBytes,
			CPU:    cpuCores,
		},
		Variables: req.Variables,
	}

	created, err := h.store.CreateServer(server)
	if err != nil {
		logger.Error("Failed to create server", err)
		// Free allocated ports on failure
		for _, port := range ports {
			h.store.MarkPortInUse(node.UUID, port.HostPort, port.Protocol, "")
		}
		http.Error(w, "Failed to create server", http.StatusInternalServerError)
		return
	}

	// Set LightdInternalID to the server UUID (source of truth)
	created.LightdInternalID = created.UUID
	h.store.UpdateServer(created.UUID, map[string]any{"lightd_internal_id": created.UUID})

	// Update port allocations with server ID
	for _, port := range ports {
		h.store.MarkPortInUse(node.UUID, port.HostPort, port.Protocol, created.UUID)
	}

	// Create container in LightD
	go h.createLightdContainer(created, node)

	h.writeJSON(w, http.StatusCreated, map[string]any{
		"server": created,
	})
}

func (h *Handler) createLightdContainer(server *mongo.Server, node *mongo.Node) {
	client := lightd.NewClient(node.Scheme, node.Host.Host, node.Host.Port, node.SecretToken)

	logger.Info(fmt.Sprintf("Creating container in LightD: server_id=%s, internal_id=%s, node=%s",
		server.UUID, server.LightdInternalID, node.Name))

	// First, add ports to LightD's network pool
	for _, port := range server.Ports {
		portPayload := map[string]any{
			"ip":       "0.0.0.0",
			"port":     port.HostPort,
			"protocol": port.Protocol,
		}
		portBody, _ := json.Marshal(portPayload)
		portReq, err := http.NewRequest("POST", client.BaseURL+"/network/ports", bytes.NewBuffer(portBody))
		if err != nil {
			logger.Error(fmt.Sprintf("Failed to create port request: server_id=%s, port=%d", server.UUID, port.HostPort), err)
			continue
		}
		portReq.Header.Set("Authorization", "Bearer "+client.Token)
		portReq.Header.Set("Accept", "Application/vnd.pkglatv1+json")
		portReq.Header.Set("Content-Type", "application/json")

		portResp, err := http.DefaultClient.Do(portReq)
		if err != nil {
			logger.Error(fmt.Sprintf("Failed to add port to LightD network pool: server_id=%s, port=%d", server.UUID, port.HostPort), err)
			// Continue anyway - port might already exist
		} else {
			logger.Info(fmt.Sprintf("Port added to LightD network pool: server_id=%s, port=%d", server.UUID, port.HostPort))
			portResp.Body.Close()
		}
	}

	// Build LightD container request - ports should only reference host ports from the network pool
	lightdPorts := []map[string]any{}
	for _, port := range server.Ports {
		lightdPorts = append(lightdPorts, map[string]any{
			"ip":             "0.0.0.0",
			"port":           port.HostPort,
			"container_port": port.ContainerPort,
			"protocol":       port.Protocol,
		})
	}

	payload := map[string]any{
		"internal_id":     server.LightdInternalID,
		"image":           server.Image,
		"startup_command": server.StartupCommand,
		"start_pattern":   server.StartPattern,
		"ports":           lightdPorts,
		"limits": map[string]any{
			"memory": server.Limits.Memory,
			"cpu":    server.Limits.CPU,
		},
	}

	if server.LightdVolumeID != "" {
		payload["volume_id"] = server.LightdVolumeID
	}

	if server.InstallScript != "" {
		payload["install_script"] = server.InstallScript
	}

	body, _ := json.Marshal(payload)
	logger.Info(fmt.Sprintf("LightD container payload: server_id=%s, payload=%s", server.UUID, string(body)))

	req, err := http.NewRequest("POST", client.BaseURL+"/containers", bytes.NewBuffer(body))
	if err != nil {
		logger.Error(fmt.Sprintf("Failed to create LightD request: server_id=%s", server.UUID), err)
		h.store.UpdateServer(server.UUID, map[string]any{"status": "error", "error_message": "Failed to create request"})
		return
	}

	req.Header.Set("Authorization", "Bearer "+client.Token)
	req.Header.Set("Accept", "Application/vnd.pkglatv1+json")
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		logger.Error(fmt.Sprintf("Failed to create container in LightD: server_id=%s", server.UUID), err)
		h.store.UpdateServer(server.UUID, map[string]any{"status": "error", "error_message": err.Error()})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		errMsg := fmt.Sprintf("status %d: %s", resp.StatusCode, string(body))
		logger.Error(fmt.Sprintf("LightD returned error: server_id=%s", server.UUID), fmt.Errorf("%s", errMsg))
		h.store.UpdateServer(server.UUID, map[string]any{"status": "error", "error_message": errMsg})
		return
	}

	logger.Info(fmt.Sprintf("Container created in LightD successfully: server_id=%s, internal_id=%s",
		server.UUID, server.LightdInternalID))

	// Update server status
	h.store.UpdateServer(server.UUID, map[string]any{"status": "stopped"})
}

// ListServers handles GET /api/servers
// Supports query parameter ?query=lightd to fetch fresh status from LightD
// ?query=database or no query param returns cached data from database
func (h *Handler) ListServers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user from session
	sessionStore := auth.NewCookieSessionStore()
	session, err := sessionStore.Get(w, r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get workspace from query
	workspaceID := r.URL.Query().Get("workspaceId")
	if workspaceID == "" {
		http.Error(w, "workspaceId is required", http.StatusBadRequest)
		return
	}

	// Verify user has access to workspace
	_, err = h.store.GetOrganizationForUser(session.UserUUID, workspaceID)
	if err != nil {
		http.Error(w, "Access denied to workspace", http.StatusForbidden)
		return
	}

	// Get pagination params
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("pageSize"))
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	servers, total, err := h.store.ListServers(workspaceID, page, pageSize)
	if err != nil {
		logger.Error("Failed to list servers", err)
		http.Error(w, "Failed to list servers", http.StatusInternalServerError)
		return
	}

	// If query=lightd, fetch live stats from LightD (don't update DB)
	queryMode := r.URL.Query().Get("query")
	if queryMode == "lightd" {
		h.enrichServersWithLightDStats(servers)
	}

	h.writeJSON(w, http.StatusOK, map[string]any{
		"servers": servers,
		"meta": map[string]any{
			"total": total,
			"page":  page,
			"limit": pageSize,
		},
	})
}

// enrichServersWithLightDStats fetches live data from LightD and attaches raw response
// Does NOT update the database - just enriches the response
func (h *Handler) enrichServersWithLightDStats(servers []mongo.Server) {
	for i := range servers {
		server := &servers[i]

		node, err := h.store.GetNodeByUUID(server.NodeUUID)
		if err != nil {
			continue
		}

		client := lightd.NewClient(node.Scheme, node.Host.Host, node.Host.Port, node.SecretToken)

		req, err := http.NewRequest("GET", client.BaseURL+"/containers/"+server.LightdInternalID, nil)
		if err != nil {
			continue
		}

		req.Header.Set("Authorization", "Bearer "+client.Token)
		req.Header.Set("Accept", "Application/vnd.pkglatv1+json")

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			continue
		}

		if resp.StatusCode == http.StatusOK {
			// Get raw response from LightD and attach it directly
			var lightdData map[string]any
			if err := json.NewDecoder(resp.Body).Decode(&lightdData); err == nil {
				server.LightdData = lightdData
			}
		}
		resp.Body.Close()
	}
}

// GetServer handles GET /api/servers/:uuid
func (h *Handler) GetServer(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user from session
	sessionStore := auth.NewCookieSessionStore()
	session, err := sessionStore.Get(w, r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	serverUUID := strings.TrimPrefix(r.URL.Path, "/api/servers/")
	if serverUUID == "" {
		http.Error(w, "Server UUID required", http.StatusBadRequest)
		return
	}

	server, err := h.store.GetServerByUUID(serverUUID)
	if err != nil {
		http.Error(w, "Server not found", http.StatusNotFound)
		return
	}

	// Verify user has access to workspace
	_, err = h.store.GetOrganizationForUser(session.UserUUID, server.WorkspaceID)
	if err != nil {
		http.Error(w, "Access denied", http.StatusForbidden)
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]any{
		"server": server,
	})
}

// DeleteServer handles DELETE /api/servers/:uuid
func (h *Handler) DeleteServer(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user from session
	sessionStore := auth.NewCookieSessionStore()
	session, err := sessionStore.Get(w, r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	serverUUID := strings.TrimPrefix(r.URL.Path, "/api/servers/")
	if serverUUID == "" {
		http.Error(w, "Server UUID required", http.StatusBadRequest)
		return
	}

	server, err := h.store.GetServerByUUID(serverUUID)
	if err != nil {
		http.Error(w, "Server not found", http.StatusNotFound)
		return
	}

	// Verify user has access to workspace and get their role
	org, err := h.store.GetOrganizationForUser(session.UserUUID, server.WorkspaceID)
	if err != nil {
		http.Error(w, "Access denied", http.StatusForbidden)
		return
	}

	// Guests cannot delete servers
	if org.Role == "guest" {
		http.Error(w, "Guests do not have permission to delete servers", http.StatusForbidden)
		return
	}

	// Delete from LightD
	node, err := h.store.GetNodeByUUID(server.NodeUUID)
	if err == nil {
		go h.deleteLightdContainer(server, node)
	}

	// Free allocated ports
	h.store.FreeServerPorts(server.NodeUUID, serverUUID)

	// Delete from database
	if err := h.store.DeleteServer(serverUUID); err != nil {
		logger.Error("Failed to delete server", err)
		http.Error(w, "Failed to delete server", http.StatusInternalServerError)
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
	})
}

// UpdateServerLimits handles PATCH /api/servers/:uuid/limits
func (h *Handler) UpdateServerLimits(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user from session
	sessionStore := auth.NewCookieSessionStore()
	session, err := sessionStore.Get(w, r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	user, err := h.store.GetUserByUUID(session.UserUUID)
	if err != nil {
		http.Error(w, "User not found", http.StatusUnauthorized)
		return
	}

	serverUUID := strings.TrimPrefix(r.URL.Path, "/api/servers/")
	serverUUID = strings.TrimSuffix(serverUUID, "/limits")
	if serverUUID == "" {
		http.Error(w, "Server UUID required", http.StatusBadRequest)
		return
	}

	server, err := h.store.GetServerByUUID(serverUUID)
	if err != nil {
		http.Error(w, "Server not found", http.StatusNotFound)
		return
	}

	// Verify user has access to workspace and get their role
	org, err := h.store.GetOrganizationForUser(session.UserUUID, server.WorkspaceID)
	if err != nil {
		http.Error(w, "Access denied", http.StatusForbidden)
		return
	}

	// Guests cannot edit servers
	if org.Role == "guest" {
		http.Error(w, "Guests do not have permission to edit servers", http.StatusForbidden)
		return
	}

	// Parse request
	var req struct {
		MemoryMB int     `json:"memoryMb"`
		CPU      float64 `json:"cpu"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate against user limits
	maxMemoryMB, ok := user.Limits["memory_mb"].(int)
	if !ok {
		maxMemoryMB = 2048 // default
	}

	maxCPU, ok := user.Limits["vcpu"].(int)
	if !ok {
		maxCPU = 100 // default
	}
	maxCPUCores := float64(maxCPU) / 100.0

	if req.MemoryMB <= 0 || req.MemoryMB > maxMemoryMB {
		http.Error(w, fmt.Sprintf("Memory must be between 1 and %d MB", maxMemoryMB), http.StatusBadRequest)
		return
	}

	if req.CPU <= 0 || req.CPU > maxCPUCores {
		http.Error(w, fmt.Sprintf("CPU must be between 0.1 and %.1f cores", maxCPUCores), http.StatusBadRequest)
		return
	}

	// Update in database
	memoryBytes := int64(req.MemoryMB) * 1024 * 1024
	err = h.store.UpdateServer(serverUUID, map[string]any{
		"limits": mongo.ServerLimits{
			Memory: memoryBytes,
			CPU:    req.CPU,
		},
	})
	if err != nil {
		logger.Error("Failed to update server limits", err)
		http.Error(w, "Failed to update limits", http.StatusInternalServerError)
		return
	}

	// Update in LightD (async operation)
	node, err := h.store.GetNodeByUUID(server.NodeUUID)
	if err == nil {
		go h.updateLightdResources(server, node, memoryBytes, req.CPU)
	}

	// Get updated server
	updatedServer, err := h.store.GetServerByUUID(serverUUID)
	if err != nil {
		http.Error(w, "Failed to fetch updated server", http.StatusInternalServerError)
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]any{
		"server": updatedServer,
	})
}

func (h *Handler) updateLightdResources(server *mongo.Server, node *mongo.Node, memoryBytes int64, cpu float64) {
	client := lightd.NewClient(node.Scheme, node.Host.Host, node.Host.Port, node.SecretToken)

	// Convert CPU cores to Docker CPU parameters
	// cpu_quota = cpu_cores * 100000 (cpu_period is 100000 by default)
	cpuQuota := int64(cpu * 100000)

	// Docker requires memory_swap to be set when updating memory
	// Set memory_swap to 2x memory (allows container to use swap)
	memorySwap := memoryBytes * 2

	payload := map[string]any{
		"memory":      memoryBytes,
		"memory_swap": memorySwap,
		"cpu_quota":   cpuQuota,
		"cpu_period":  100000,
	}

	body, _ := json.Marshal(payload)
	logger.Info(fmt.Sprintf("Updating LightD resources: server_id=%s, memory=%d, memory_swap=%d, cpu_quota=%d",
		server.UUID, memoryBytes, memorySwap, cpuQuota))

	req, err := http.NewRequest("POST", client.BaseURL+"/containers/"+server.LightdInternalID+"/resources", bytes.NewBuffer(body))
	if err != nil {
		logger.Error(fmt.Sprintf("Failed to create LightD resources request: server_id=%s", server.UUID), err)
		return
	}

	req.Header.Set("Authorization", "Bearer "+client.Token)
	req.Header.Set("Accept", "Application/vnd.pkglatv1+json")
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		logger.Error(fmt.Sprintf("Failed to update resources in LightD: server_id=%s", server.UUID), err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
		body, _ := io.ReadAll(resp.Body)
		logger.Error(fmt.Sprintf("LightD resources update failed: server_id=%s", server.UUID),
			fmt.Errorf("status %d: %s", resp.StatusCode, string(body)))
		return
	}

	logger.Info(fmt.Sprintf("Container resources update queued in LightD: server_id=%s, memory=%d, cpu=%.2f",
		server.UUID, memoryBytes, cpu))
}

func (h *Handler) deleteLightdContainer(server *mongo.Server, node *mongo.Node) {
	client := lightd.NewClient(node.Scheme, node.Host.Host, node.Host.Port, node.SecretToken)

	logger.Info(fmt.Sprintf("Deleting container from LightD: server_id=%s, internal_id=%s, node=%s",
		server.UUID, server.LightdInternalID, node.Name))

	req, err := http.NewRequest("DELETE", client.BaseURL+"/containers/"+server.LightdInternalID, nil)
	if err != nil {
		logger.Error("Failed to create LightD delete request", err)
		return
	}

	req.Header.Set("Authorization", "Bearer "+client.Token)
	req.Header.Set("Accept", "Application/vnd.pkglatv1+json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		logger.Error(fmt.Sprintf("Failed to delete container in LightD: server_id=%s", server.UUID), err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		logger.Error(fmt.Sprintf("LightD delete returned error: server_id=%s", server.UUID),
			fmt.Errorf("status %d: %s", resp.StatusCode, string(body)))
		return
	}

	logger.Info(fmt.Sprintf("Container deleted from LightD successfully: server_id=%s, internal_id=%s",
		server.UUID, server.LightdInternalID))
}

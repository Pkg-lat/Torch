package admin

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"torch/pkg.lat/lightd"
	"torch/pkg.lat/logger"
	"torch/pkg.lat/mongo"
)

// CreateNode handles POST /api/admin/nodes
func (h *Handler) CreateNode(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Name        string `json:"name"`
		FQDN        string `json:"fqdn"`
		IP          string `json:"ip"`
		Host        string `json:"host"`
		Port        int    `json:"port"`
		SFTPPort    int    `json:"sftpPort"`
		Image       string `json:"image"`
		SecretToken string `json:"secretToken"`
		Scheme      string `json:"scheme"`
		MaxServers  int    `json:"maxServers"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.Name == "" || req.FQDN == "" || req.SecretToken == "" {
		http.Error(w, "name, fqdn, and secretToken are required", http.StatusBadRequest)
		return
	}

	if req.Scheme == "" {
		req.Scheme = "http"
	}

	if req.Port == 0 {
		req.Port = 8070 // Default lightd port
	}

	if req.SFTPPort == 0 {
		req.SFTPPort = 2022 // Default lightd SFTP port
	}

	if req.MaxServers == 0 {
		req.MaxServers = 100 // Default max servers
	}

	// Create node in database
	node, err := h.store.CreateNode(
		req.Name,
		req.FQDN,
		req.IP,
		req.Host,
		req.Port,
		req.SFTPPort,
		req.Image,
		req.SecretToken,
		req.Scheme,
		req.MaxServers,
	)
	if err != nil {
		logger.Error("Failed to create node", err)
		http.Error(w, "Failed to create node", http.StatusInternalServerError)
		return
	}

	// Perform initial health check
	go h.performHealthCheck(node.UUID)

	h.writeJSON(w, http.StatusCreated, map[string]any{
		"node": node,
	})

	h.logAudit(r, "create", "node", node.UUID, map[string]any{
		"name": req.Name,
		"fqdn": req.FQDN,
	}, "success", "")
}

// ListNodes handles GET /api/admin/nodes
func (h *Handler) ListNodes(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	nodes, err := h.store.ListNodes()
	if err != nil {
		logger.Error("Failed to list nodes", err)
		http.Error(w, "Failed to list nodes", http.StatusInternalServerError)
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]any{
		"nodes": nodes,
	})
}

// GetNode handles GET /api/admin/nodes/:uuid
func (h *Handler) GetNode(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	nodeUUID := strings.TrimPrefix(r.URL.Path, "/api/admin/nodes/")
	if nodeUUID == "" {
		http.Error(w, "Node UUID required", http.StatusBadRequest)
		return
	}

	node, err := h.store.GetNodeByUUID(nodeUUID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]any{
		"node": node,
	})
}

// DeleteNode handles DELETE /api/admin/nodes/:uuid
func (h *Handler) DeleteNode(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	nodeUUID := strings.TrimPrefix(r.URL.Path, "/api/admin/nodes/")
	if nodeUUID == "" {
		http.Error(w, "Node UUID required", http.StatusBadRequest)
		return
	}

	// Get node before deletion for audit log
	node, err := h.store.GetNodeByUUID(nodeUUID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	if err := h.store.DeleteNode(nodeUUID); err != nil {
		logger.Error("Failed to delete node", err)
		http.Error(w, "Failed to delete node", http.StatusInternalServerError)
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
	})

	h.logAudit(r, "delete", "node", nodeUUID, map[string]any{
		"name": node.Name,
	}, "success", "")
}

// HealthCheckNode handles POST /api/admin/nodes/:uuid/health
func (h *Handler) HealthCheckNode(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/admin/nodes/"), "/")
	if len(parts) < 2 || parts[1] != "health" {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	nodeUUID := parts[0]
	node, err := h.store.GetNodeByUUID(nodeUUID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	// Log the node configuration being checked
	logger.Info(fmt.Sprintf("Health checking node %s: %s://%s:%d", node.Name, node.Scheme, node.Host.Host, node.Host.Port))

	// Perform health check
	client := lightd.NewClient(node.Scheme, node.Host.Host, node.Host.Port, node.SecretToken)

	// Try ping first (public endpoint)
	ping, err := client.Ping()
	if err != nil {
		logger.Error(fmt.Sprintf("Node %s ping failed", node.Name), err)
		_ = h.store.UpdateNodeStatus(nodeUUID, "offline")
		h.writeJSON(w, http.StatusOK, map[string]any{
			"status":  "offline",
			"error":   err.Error(),
			"healthy": false,
		})
		return
	}

	logger.Info(fmt.Sprintf("Node %s ping successful: %s v%s", node.Name, ping.Status, ping.Version))

	// Try authenticated health check
	health, err := client.HealthCheck()
	if err != nil {
		logger.Error(fmt.Sprintf("Node %s health check failed", node.Name), err)
		_ = h.store.UpdateNodeStatus(nodeUUID, "error")
		h.writeJSON(w, http.StatusOK, map[string]any{
			"status":  "error",
			"error":   err.Error(),
			"healthy": false,
			"ping":    ping,
		})
		return
	}

	logger.Info(fmt.Sprintf("Node %s health check successful: %s", node.Name, health.Status))

	// Get container count
	containers, err := client.ListContainers()
	if err != nil {
		logger.Warn(fmt.Sprintf("Failed to get container count for node %s", node.Name))
	} else {
		_ = h.store.UpdateNodeServerCount(nodeUUID, len(containers))
	}

	_ = h.store.UpdateNodeStatus(nodeUUID, "online")

	h.writeJSON(w, http.StatusOK, map[string]any{
		"status":         "online",
		"healthy":        true,
		"health":         health,
		"containerCount": len(containers),
	})
}

// performHealthCheck performs a health check in the background
func (h *Handler) performHealthCheck(nodeUUID string) {
	node, err := h.store.GetNodeByUUID(nodeUUID)
	if err != nil {
		logger.Error("Failed to get node for health check", err)
		return
	}

	logger.Info(fmt.Sprintf("Background health check for node %s: %s://%s:%d", node.Name, node.Scheme, node.Host.Host, node.Host.Port))

	client := lightd.NewClient(node.Scheme, node.Host.Host, node.Host.Port, node.SecretToken)

	// Try ping first
	ping, err := client.Ping()
	if err != nil {
		logger.Error(fmt.Sprintf("Node %s ping failed", node.Name), err)
		_ = h.store.UpdateNodeStatus(nodeUUID, "offline")
		return
	}

	logger.Info(fmt.Sprintf("Node %s ping successful: %s v%s", node.Name, ping.Status, ping.Version))

	// Try authenticated health check
	health, err := client.HealthCheck()
	if err != nil {
		logger.Error(fmt.Sprintf("Node %s health check failed", node.Name), err)
		_ = h.store.UpdateNodeStatus(nodeUUID, "error")
		return
	}

	logger.Info(fmt.Sprintf("Node %s health check successful: %s", node.Name, health.Status))

	// Get container count
	containers, err := client.ListContainers()
	if err != nil {
		logger.Warn(fmt.Sprintf("Failed to get container count for node %s", node.Name))
	} else {
		_ = h.store.UpdateNodeServerCount(nodeUUID, len(containers))
	}

	_ = h.store.UpdateNodeStatus(nodeUUID, "online")
	logger.Info(fmt.Sprintf("Node %s health check: OK", node.Name))
}

// UpdateNode handles PATCH /api/admin/nodes/:uuid
func (h *Handler) UpdateNode(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	nodeUUID := strings.TrimPrefix(r.URL.Path, "/api/admin/nodes/")
	if nodeUUID == "" {
		http.Error(w, "Node UUID required", http.StatusBadRequest)
		return
	}

	var req struct {
		Name        *string `json:"name"`
		FQDN        *string `json:"fqdn"`
		IP          *string `json:"ip"`
		Host        *string `json:"host"`
		Port        *int    `json:"port"`
		SFTPPort    *int    `json:"sftpPort"`
		Image       *string `json:"image"`
		SecretToken *string `json:"secretToken"`
		Scheme      *string `json:"scheme"`
		MaxServers  *int    `json:"maxServers"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Get existing node
	node, err := h.store.GetNodeByUUID(nodeUUID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	// Build updates map
	updates := make(map[string]any)
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.FQDN != nil {
		updates["fqdn"] = *req.FQDN
	}
	if req.IP != nil {
		updates["ip"] = *req.IP
	}
	if req.Image != nil {
		updates["image"] = *req.Image
	}
	if req.SecretToken != nil {
		updates["secret_token"] = *req.SecretToken
	}
	if req.Scheme != nil {
		if *req.Scheme != "http" && *req.Scheme != "https" {
			http.Error(w, "scheme must be 'http' or 'https'", http.StatusBadRequest)
			return
		}
		updates["scheme"] = *req.Scheme
	}
	if req.MaxServers != nil {
		updates["max_servers"] = *req.MaxServers
	}

	// Update host if any host fields changed
	if req.Host != nil || req.Port != nil || req.SFTPPort != nil {
		hostUpdate := node.Host
		if req.Host != nil {
			hostUpdate.Host = *req.Host
		}
		if req.Port != nil {
			hostUpdate.Port = *req.Port
		}
		if req.SFTPPort != nil {
			hostUpdate.SFTPPort = *req.SFTPPort
		}
		updates["host"] = hostUpdate
	}

	if len(updates) == 0 {
		http.Error(w, "No updates provided", http.StatusBadRequest)
		return
	}

	if err := h.store.UpdateNode(nodeUUID, updates); err != nil {
		logger.Error("Failed to update node", err)
		http.Error(w, "Failed to update node", http.StatusInternalServerError)
		return
	}

	// Get updated node
	updatedNode, err := h.store.GetNodeByUUID(nodeUUID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]any{
		"node": updatedNode,
	})

	h.logAudit(r, "update", "node", nodeUUID, updates, "success", "")
}

// AddAllocations handles POST /api/admin/nodes/:uuid/allocations
func (h *Handler) AddAllocations(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/admin/nodes/"), "/")
	if len(parts) < 2 || parts[1] != "allocations" {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	nodeUUID := parts[0]

	var req struct {
		Ports    []int  `json:"ports"`
		Protocol string `json:"protocol"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if len(req.Ports) == 0 {
		http.Error(w, "ports array is required", http.StatusBadRequest)
		return
	}

	if req.Protocol == "" {
		req.Protocol = "tcp"
	}

	if req.Protocol != "tcp" && req.Protocol != "udp" {
		http.Error(w, "protocol must be 'tcp' or 'udp'", http.StatusBadRequest)
		return
	}

	// Build allocations using the mongo.PortAllocation type
	allocations := []mongo.PortAllocation{}
	for _, port := range req.Ports {
		allocations = append(allocations, mongo.PortAllocation{
			Port:     port,
			Protocol: req.Protocol,
			InUse:    false,
			ServerID: "",
		})
	}

	// Add allocations
	if err := h.store.AddAllocations(nodeUUID, allocations); err != nil {
		logger.Error("Failed to add allocations", err)
		http.Error(w, "Failed to add allocations", http.StatusInternalServerError)
		return
	}

	// Get updated node
	node, err := h.store.GetNodeByUUID(nodeUUID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]any{
		"node": node,
	})

	h.logAudit(r, "add_allocations", "node", nodeUUID, map[string]any{
		"ports":    req.Ports,
		"protocol": req.Protocol,
	}, "success", "")
}

// RemoveAllocations handles DELETE /api/admin/nodes/:uuid/allocations
func (h *Handler) RemoveAllocations(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/admin/nodes/"), "/")
	if len(parts) < 2 || parts[1] != "allocations" {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	nodeUUID := parts[0]

	var req struct {
		Ports    []int  `json:"ports"`
		Protocol string `json:"protocol"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if len(req.Ports) == 0 {
		http.Error(w, "ports array is required", http.StatusBadRequest)
		return
	}

	if req.Protocol == "" {
		req.Protocol = "tcp"
	}

	// Remove allocations
	if err := h.store.RemoveAllocations(nodeUUID, req.Ports, req.Protocol); err != nil {
		logger.Error("Failed to remove allocations", err)
		http.Error(w, "Failed to remove allocations", http.StatusInternalServerError)
		return
	}

	// Get updated node
	node, err := h.store.GetNodeByUUID(nodeUUID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]any{
		"node": node,
	})

	h.logAudit(r, "remove_allocations", "node", nodeUUID, map[string]any{
		"ports":    req.Ports,
		"protocol": req.Protocol,
	}, "success", "")
}

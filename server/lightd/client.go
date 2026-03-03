package lightd

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Client struct {
	BaseURL string
	Token   string
	Scheme  string
	client  *http.Client
}

type HealthResponse struct {
	Status        string  `json:"status"`
	Version       string  `json:"version"`
	UptimeSeconds int     `json:"uptime_seconds"`
	System        *System `json:"system,omitempty"`
	Docker        *Docker `json:"docker,omitempty"`
}

type System struct {
	Hostname             string  `json:"hostname"`
	OS                   string  `json:"os"`
	KernelVersion        string  `json:"kernel_version"`
	CPUCount             int     `json:"cpu_count"`
	CPUUsagePercent      float64 `json:"cpu_usage_percent"`
	MemoryTotalBytes     int64   `json:"memory_total_bytes"`
	MemoryUsedBytes      int64   `json:"memory_used_bytes"`
	MemoryAvailableBytes int64   `json:"memory_available_bytes"`
	MemoryUsagePercent   float64 `json:"memory_usage_percent"`
	DiskTotalBytes       int64   `json:"disk_total_bytes"`
	DiskUsedBytes        int64   `json:"disk_used_bytes"`
	DiskAvailableBytes   int64   `json:"disk_available_bytes"`
	DiskUsagePercent     float64 `json:"disk_usage_percent"`
}

type Docker struct {
	Available bool   `json:"available"`
	Version   string `json:"version"`
}

type PingResponse struct {
	Status  string `json:"status"`
	Version string `json:"version"`
}

type ContainerListResponse struct {
	Containers []Container `json:"containers"`
}

type Container struct {
	InternalID string `json:"internal_id"`
	Name       string `json:"name"`
	State      string `json:"state"`
	Image      string `json:"image"`
}

// NewClient creates a new lightd API client
func NewClient(scheme, host string, port int, token string) *Client {
	baseURL := fmt.Sprintf("%s://%s:%d", scheme, host, port)
	return &Client{
		BaseURL: baseURL,
		Token:   token,
		Scheme:  scheme,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// HealthCheck performs a health check on the lightd daemon
func (c *Client) HealthCheck() (*HealthResponse, error) {
	url := c.BaseURL + "/api/v1/public/health"
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("health check failed (URL: %s): %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("health check returned status %d (URL: %s): %s", resp.StatusCode, url, string(body))
	}

	var health HealthResponse
	if err := json.NewDecoder(resp.Body).Decode(&health); err != nil {
		return nil, fmt.Errorf("failed to decode health response (URL: %s): %w", url, err)
	}

	return &health, nil
}

// Ping performs a public ping check (no auth required)
func (c *Client) Ping() (*PingResponse, error) {
	url := c.BaseURL + "/api/v1/public/ping"
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ping failed (URL: %s): %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ping returned status %d (URL: %s): %s", resp.StatusCode, url, string(body))
	}

	var ping PingResponse
	if err := json.NewDecoder(resp.Body).Decode(&ping); err != nil {
		return nil, fmt.Errorf("failed to decode ping response (URL: %s): %w", url, err)
	}

	return &ping, nil
}

// ListContainers retrieves all containers from the lightd daemon
func (c *Client) ListContainers() ([]Container, error) {
	req, err := http.NewRequest("GET", c.BaseURL+"/containers", nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+c.Token)
	req.Header.Set("Accept", "Application/vnd.pkglatv1+json")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("list containers failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("list containers returned status %d: %s", resp.StatusCode, string(body))
	}

	var containers []Container
	if err := json.NewDecoder(resp.Body).Decode(&containers); err != nil {
		return nil, fmt.Errorf("failed to decode containers response: %w", err)
	}

	return containers, nil
}

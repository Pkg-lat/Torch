package mongo

import "time"

type Billing struct {
	Credits float64 `bson:"credits" json:"credits"`
	Used    float64 `bson:"used" json:"used"`
}

type UserSession struct {
	SessionID  string    `bson:"session_id" json:"session_id"`
	Provider   string    `bson:"provider" json:"provider"`
	UserAgent  string    `bson:"user_agent,omitempty" json:"user_agent,omitempty"`
	IPAddress  string    `bson:"ip_address,omitempty" json:"ip_address,omitempty"`
	LastSeenAt time.Time `bson:"last_seen_at" json:"last_seen_at"`
}

type APIConfig struct {
	Enabled bool `bson:"enabled" json:"enabled"`
}

type UserDocument struct {
	UUID         string            `bson:"uuid" json:"uuid"`
	Email        string            `bson:"email" json:"email"`
	Username     string            `bson:"usrname" json:"username"`
	PasswordHash string            `bson:"password_hash,omitempty" json:"-"`
	ProviderIDs  map[string]string `bson:"provider_ids,omitempty" json:"provider_ids,omitempty"`
	CreatedAt    time.Time         `bson:"created_at" json:"created_at"`
	LastUpdated  time.Time         `bson:"last_updated" json:"last_updated"`
	Billing      Billing           `bson:"billing" json:"billing"`
	Instances    []map[string]any  `bson:"instances" json:"instances"`
	Workspace    map[string]any    `bson:"workspace" json:"workspace"`
	Audit        map[string]any    `bson:"audit" json:"audit"`
	Sessions     []UserSession     `bson:"sessions" json:"sessions"`
	API          APIConfig         `bson:"api" json:"api"`
	Role         string            `bson:"role" json:"role"`
	Limits       map[string]any    `bson:"limits" json:"limits"`
}

type Organization struct {
	UUID        string    `bson:"uuid" json:"uuid"`
	Name        string    `bson:"name" json:"name"`
	CreatedBy   string    `bson:"created_by" json:"created_by"`
	CreatedAt   time.Time `bson:"created_at" json:"created_at"`
	LastUpdated time.Time `bson:"last_updated" json:"last_updated"`
	Role        string    `bson:"-" json:"role,omitempty"`
	TenantID    string    `bson:"-" json:"tenantId,omitempty"`
}

type OrgMembership struct {
	OrgUUID     string    `bson:"org_uuid" json:"org_uuid"`
	UserUUID    string    `bson:"user_uuid" json:"user_uuid"`
	Role        string    `bson:"role" json:"role"`
	JoinedAt    time.Time `bson:"joined_at" json:"joined_at"`
	LastUpdated time.Time `bson:"last_updated" json:"last_updated"`
}

type OrgMemberView struct {
	UUID     string    `json:"uuid"`
	Email    string    `json:"email"`
	Username string    `json:"username"`
	Role     string    `json:"role"`
	JoinedAt time.Time `json:"joinedAt"`
}

type OrgInvite struct {
	UUID       string     `bson:"uuid" json:"uuid"`
	OrgUUID    string     `bson:"org_uuid" json:"orgUuid"`
	OrgName    string     `bson:"-" json:"orgName"` // Not stored in DB, populated on read
	Email      string     `bson:"email" json:"email"`
	Role       string     `bson:"role" json:"role"`
	InvitedBy  string     `bson:"invited_by" json:"invited_by"`
	Status     string     `bson:"status" json:"status"`
	CreatedAt  time.Time  `bson:"created_at" json:"createdAt"`
	ExpiresAt  time.Time  `bson:"expires_at" json:"expires_at"`
	AcceptedAt *time.Time `bson:"accepted_at,omitempty" json:"accepted_at,omitempty"`
}

type AdminAuditLog struct {
	UUID       string                 `bson:"uuid" json:"uuid"`
	AdminUUID  string                 `bson:"admin_uuid" json:"adminUuid"`
	AdminEmail string                 `bson:"admin_email" json:"adminEmail"`
	Action     string                 `bson:"action" json:"action"`
	Resource   string                 `bson:"resource" json:"resource"`
	ResourceID string                 `bson:"resource_id,omitempty" json:"resourceId,omitempty"`
	Details    map[string]interface{} `bson:"details,omitempty" json:"details,omitempty"`
	IPAddress  string                 `bson:"ip_address,omitempty" json:"ipAddress,omitempty"`
	UserAgent  string                 `bson:"user_agent,omitempty" json:"userAgent,omitempty"`
	Status     string                 `bson:"status" json:"status"` // success, failed
	ErrorMsg   string                 `bson:"error_msg,omitempty" json:"errorMsg,omitempty"`
	Timestamp  time.Time              `bson:"timestamp" json:"timestamp"`
}

type NodeHost struct {
	Host     string `bson:"host" json:"host"`
	Port     int    `bson:"port" json:"port"`
	SFTPPort int    `bson:"sftp_port" json:"sftpPort"`
}

type PortAllocation struct {
	Port     int    `bson:"port" json:"port"`
	Protocol string `bson:"protocol" json:"protocol"` // "tcp" or "udp"
	InUse    bool   `bson:"in_use" json:"inUse"`
	ServerID string `bson:"server_id,omitempty" json:"serverId,omitempty"` // UUID of server using this port
}

type Node struct {
	UUID            string           `bson:"uuid" json:"uuid"`
	Name            string           `bson:"name" json:"name"`
	FQDN            string           `bson:"fqdn" json:"fqdn"`
	IP              string           `bson:"ip" json:"ip"`
	Host            NodeHost         `bson:"host" json:"host"`
	Image           string           `bson:"image" json:"image"`
	SecretToken     string           `bson:"secret_token" json:"-"` // Never expose in JSON
	Scheme          string           `bson:"scheme" json:"scheme"`  // "http" or "https"
	Allocations     []PortAllocation `bson:"allocations" json:"allocations"`
	CreatedAt       time.Time        `bson:"created_at" json:"createdAt"`
	UpdatedAt       time.Time        `bson:"updated_at" json:"updatedAt"`
	Data            any              `bson:"data,omitempty" json:"data,omitempty"`
	MaxServers      int              `bson:"max_servers" json:"maxServers"`
	CurrentServers  int              `bson:"current_servers" json:"currentServers"`
	Status          string           `bson:"status" json:"status"` // "online", "offline", "error"
	LastHealthCheck *time.Time       `bson:"last_health_check,omitempty" json:"lastHealthCheck,omitempty"`
}

type SoftwareVariable struct {
	Name         string `bson:"name" json:"name"`
	Description  string `bson:"description" json:"description"`
	EnvVariable  string `bson:"env_variable" json:"env_variable"`
	DefaultValue string `bson:"default_value" json:"default_value"`
	UserViewable bool   `bson:"user_viewable" json:"user_viewable"`
	UserEditable bool   `bson:"user_editable" json:"user_editable"`
	Rules        string `bson:"rules" json:"rules"`
	FieldType    string `bson:"field_type" json:"field_type"`
}

type SoftwareRuntime struct {
	FileInit string `bson:"file-init" json:"file-init"`
	StartUp  string `bson:"start-up" json:"start-up"`
	Stop     string `bson:"stop" json:"stop"`
	Note     string `bson:"_note,omitempty" json:"_note,omitempty"`
}

type SoftwareNetworking struct {
	PortBinds map[string]string `bson:"port_binds" json:"port_binds"`
}

type Software struct {
	UUID           string             `bson:"uuid" json:"uuid"`
	Name           string             `bson:"name" json:"name"`
	IconURL        string             `bson:"icon_url" json:"icon_url"`
	DockerImages   map[string]string  `bson:"docker_images" json:"docker_images"`
	StartupCmd     string             `bson:"startup_cmd" json:"startup_cmd"`
	InstallContent string             `bson:"install_content" json:"install_content"`
	UpdateContent  string             `bson:"update_content" json:"update_content"`
	Runtime        SoftwareRuntime    `bson:"runtime" json:"runtime"`
	Networking     SoftwareNetworking `bson:"networking" json:"networking"`
	Variables      []SoftwareVariable `bson:"variables" json:"variables"`
	CreatedAt      time.Time          `bson:"created_at" json:"createdAt"`
	UpdatedAt      time.Time          `bson:"updated_at" json:"updatedAt"`
	ExportedAt     string             `bson:"exported_at,omitempty" json:"exported_at,omitempty"`
	Note           string             `bson:"_note,omitempty" json:"_note,omitempty"`
}

type ServerPort struct {
	ContainerPort int    `bson:"container_port" json:"containerPort"`
	HostPort      int    `bson:"host_port" json:"hostPort"`
	Protocol      string `bson:"protocol" json:"protocol"` // "tcp" or "udp"
}

type ServerLimits struct {
	Memory int64   `bson:"memory" json:"memory"` // in bytes
	CPU    float64 `bson:"cpu" json:"cpu"`       // CPU cores
}

type ServerStats struct {
	CPUUsage    float64 `json:"cpuUsage"`
	MemoryUsage int64   `json:"memoryUsage"`
	MemoryLimit int64   `json:"memoryLimit"`
	NetworkRx   int64   `json:"networkRx"`
	NetworkTx   int64   `json:"networkTx"`
	BlockRead   int64   `json:"blockRead"`
	BlockWrite  int64   `json:"blockWrite"`
}

type Server struct {
	UUID             string            `bson:"uuid" json:"uuid"`
	Name             string            `bson:"name" json:"name"`
	WorkspaceID      string            `bson:"workspace_id" json:"workspaceId"`
	CreatedBy        string            `bson:"created_by" json:"createdBy"`
	NodeUUID         string            `bson:"node_uuid" json:"nodeUuid"`
	SoftwareUUID     string            `bson:"software_uuid" json:"softwareUuid"`
	VolumeUUID       string            `bson:"volume_uuid,omitempty" json:"volumeUuid,omitempty"`
	LightdInternalID string            `bson:"lightd_internal_id" json:"lightdInternalId"`
	LightdVolumeID   string            `bson:"lightd_volume_id,omitempty" json:"lightdVolumeId,omitempty"`
	ImageKey         string            `bson:"image_key" json:"imageKey"` // e.g., "node_18", "linux/amd64"
	Image            string            `bson:"image" json:"image"`        // Full docker image path
	StartupCommand   string            `bson:"startup_command" json:"startupCommand"`
	StartPattern     string            `bson:"start_pattern" json:"startPattern"`
	InstallScript    string            `bson:"install_script,omitempty" json:"installScript,omitempty"`
	Ports            []ServerPort      `bson:"ports" json:"ports"`
	Limits           ServerLimits      `bson:"limits" json:"limits"`
	Variables        map[string]string `bson:"variables,omitempty" json:"variables,omitempty"`
	Status           string            `bson:"status" json:"status"`                                  // "installing", "stopped", "starting", "running", "error"
	ErrorMessage     string            `bson:"error_message,omitempty" json:"errorMessage,omitempty"` // Error details from LightD
	LightdData       map[string]any    `bson:"-" json:"lightdData,omitempty"`                         // Raw response from LightD (not stored in DB)
	CreatedAt        time.Time         `bson:"created_at" json:"createdAt"`
	UpdatedAt        time.Time         `bson:"updated_at" json:"updatedAt"`
}

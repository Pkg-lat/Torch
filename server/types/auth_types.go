package types

import "net/http"

// TokenResponse represents an OAuth token response
type TokenResponse struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token"`
}

// User represents a user from an OAuth provider
type User struct {
	ID        string
	Email     string
	Username  string
	AvatarURL string
	Provider  string
}

// ProviderConfig holds configuration for an OAuth provider
type ProviderConfig struct {
	Enabled      bool
	ClientID     string
	ClientSecret string
	CallbackURL  string
}

// Session represents a user session
type Session struct {
	SessionID string
	UserUUID  string
	Provider  string
	Email     string
	Username  string
	User      *User
	Token     *TokenResponse
}

// SessionStore interface for session storage
type SessionStore interface {
	Create(w http.ResponseWriter, r *http.Request, session *Session) error
	Get(w http.ResponseWriter, r *http.Request) (*Session, error)
	Destroy(w http.ResponseWriter, r *http.Request) error
}

package auth

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"os"

	"torch/pkg.lat/types"
)

type CookieSessionStore struct {
	cookieName string
	secret     []byte
}

func NewCookieSessionStore() *CookieSessionStore {
	secret := os.Getenv("SESSION_SECRET")
	if secret == "" {
		secret = "default-secret-change-in-production"
	}
	return &CookieSessionStore{
		cookieName: "auth_session",
		secret:     []byte(secret),
	}
}

func (s *CookieSessionStore) Create(w http.ResponseWriter, r *http.Request, session *types.Session) error {
	data, err := json.Marshal(session)
	if err != nil {
		return err
	}
	encoded := base64.RawURLEncoding.EncodeToString(data)

	isDev := os.Getenv("ENV") != "production"

	cookie := &http.Cookie{
		Name:     s.cookieName,
		Value:    encoded,
		Path:     "/",
		HttpOnly: true,
		MaxAge:   86400 * 7, // 7 days
		SameSite: http.SameSiteLaxMode,
	}

	if !isDev {
		// Production: Enable secure flag for HTTPS
		cookie.Secure = true
	}

	http.SetCookie(w, cookie)
	return nil
}

func (s *CookieSessionStore) Get(w http.ResponseWriter, r *http.Request) (*types.Session, error) {
	cookie, err := r.Cookie(s.cookieName)
	if err != nil {
		return nil, err
	}

	decoded, err := base64.RawURLEncoding.DecodeString(cookie.Value)
	if err != nil {
		decoded = []byte(cookie.Value)
	}

	var session types.Session
	if err := json.Unmarshal(decoded, &session); err != nil {
		return nil, err
	}

	return &session, nil
}

func (s *CookieSessionStore) Destroy(w http.ResponseWriter, r *http.Request) error {
	isDev := os.Getenv("ENV") != "production"

	cookie := &http.Cookie{
		Name:     s.cookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
		SameSite: http.SameSiteLaxMode,
	}

	if !isDev {
		cookie.Secure = true
	}

	http.SetCookie(w, cookie)
	return nil
}

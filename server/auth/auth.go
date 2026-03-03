package auth

import (
	"fmt"
	"net/http"

	"torch/pkg.lat/mongo"
)

func New() (*ProviderRegistry, *Config, *Handler, error) {
	config := LoadConfig()
	registry := NewProviderRegistry()
	sessionStore := NewCookieSessionStore()
	store, err := mongo.NewStoreFromEnv()
	if err != nil {
		return nil, nil, nil, fmt.Errorf("failed to initialize mongo store: %w", err)
	}

	handler := NewHandler(registry, config, sessionStore, store)
	return registry, config, handler, nil
}

func SetupRouter() (*http.ServeMux, *Config, error) {
	_, config, handler, err := New()
	if err != nil {
		return nil, nil, err
	}

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	return mux, config, nil
}

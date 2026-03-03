package auth

import (
	"os"
	"strings"

	"torch/pkg.lat/types"
)

type Config struct {
	AllowedAuths []string
	Providers    map[string]types.ProviderConfig
}

func LoadConfig() *Config {
	authEnv := os.Getenv("AUTH")
	allowedAuths := []string{}
	if authEnv != "" {
		for _, auth := range strings.Split(authEnv, ",") {
			auth = strings.TrimSpace(auth)
			if auth != "" {
				allowedAuths = append(allowedAuths, auth)
			}
		}
	}

	config := &Config{
		AllowedAuths: allowedAuths,
		Providers:    make(map[string]types.ProviderConfig),
	}

	// Discord configuration
	if hasAuth("discord") {
		config.Providers["discord"] = types.ProviderConfig{
			Enabled:      true,
			ClientID:     os.Getenv("DC_CLIENT_ID"),
			ClientSecret: os.Getenv("DC_CLIENT_SECRET"),
			CallbackURL:  os.Getenv("DC_CALLBACK"),
		}
	}

	// GitHub configuration
	if hasAuth("github") {
		config.Providers["github"] = types.ProviderConfig{
			Enabled:      true,
			ClientID:     os.Getenv("GH_CLIENT_ID"),
			ClientSecret: os.Getenv("GH_CLIENT_SECRET"),
			CallbackURL:  os.Getenv("GH_CALLBACK"),
		}
	}

	// Email/Password configuration
	if hasAuth("email") {
		config.Providers["email"] = types.ProviderConfig{
			Enabled: true,
		}
	}

	return config
}

func hasAuth(name string) bool {
	authEnv := os.Getenv("AUTH")
	if authEnv == "" {
		return false
	}
	for _, auth := range strings.Split(authEnv, ",") {
		if strings.TrimSpace(auth) == name {
			return true
		}
	}
	return false
}

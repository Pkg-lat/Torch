package auth

import (
	"os"
	"strings"
)

// LoadEnv loads environment variables from a .env file
func LoadEnv(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])

		// Remove quotes if present
		if len(value) >= 2 {
			if (value[0] == '"' && value[len(value)-1] == '"') ||
				(value[0] == '\'' && value[len(value)-1] == '\'') {
				value = value[1 : len(value)-1]
			}
		}

		os.Setenv(key, value)
	}

	return nil
}

// LoadEnvDefault loads .env file from default locations
func LoadEnvDefault() error {
	// Try common .env locations
	locations := []string{
		".env",
		"../.env",
		"./.env",
	}

	for _, path := range locations {
		if err := LoadEnv(path); err == nil {
			return nil
		}
	}

	return nil // No .env file found, that's okay
}

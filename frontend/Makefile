.PHONY: serve admin admin-add admin-remove admin-list run build build-arm64 build-arm clean help


serve:
	@go run main.go serve

# Run the server (alias for serve)
run:
	@go run main.go serve

# Make a user admin by email
# Usage: make admin-add EMAIL=user@example.com
admin-add:
	@if [ -z "$(EMAIL)" ]; then \
		echo "Usage: make admin-add EMAIL=user@example.com"; \
		exit 1; \
	fi
	@go run cmd/cli/main.go admin add $(EMAIL)

# Alias for admin-add
admin:
	@if [ -z "$(EMAIL)" ]; then \
		echo "Usage: make admin EMAIL=user@example.com"; \
		exit 1; \
	fi
	@go run cmd/cli/main.go admin add $(EMAIL)

# Remove admin role from a user
# Usage: make admin-remove EMAIL=user@example.com
admin-remove:
	@if [ -z "$(EMAIL)" ]; then \
		echo "Usage: make admin-remove EMAIL=user@example.com"; \
		exit 1; \
	fi
	@go run cmd/cli/main.go admin remove $(EMAIL)

# List all admins
admin-list:
	@go run cmd/cli/main.go admin list

# Alias for admin-list
list-admins:
	@go run cmd/cli/main.go admin list

# Build for current platform
build:
	@go build -o builds/server main.go
	@go build -o builds/cli cmd/cli/main.go
	@echo "Built: builds/server and builds/cli"

# Build for ARM64 Linux (64-bit ARM)
build-arm64:
	@GOOS=linux GOARCH=arm64 go build -o builds/server-arm64 main.go
	@GOOS=linux GOARCH=arm64 go build -o builds/cli-arm64 cmd/cli/main.go
	@echo "Built: builds/server-arm64 and builds/cli-arm64"

# Build for ARM Linux (32-bit ARM)
build-arm:
	@GOOS=linux GOARCH=arm GOARM=7 go build -o builds/server-arm main.go
	@GOOS=linux GOARCH=arm GOARM=7 go build -o builds/cli-arm cmd/cli/main.go
	@echo "Built: builds/server-arm and builds/cli-arm"

# Clean build artifacts
clean:
	@rm -rf builds/
	@rm -rf tmp/
	@echo "Cleaned build artifacts"

# Help
help:
	@echo "Available commands:"
	@echo ""
	@echo "Server:"
	@echo "  make serve                         - Start the HTTP server"
	@echo "  make run                           - Start the HTTP server (alias)"
	@echo ""
	@echo "Admin Management:"
	@echo "  make admin-add EMAIL=user@ex...    - Make a user admin"
	@echo "  make admin-remove EMAIL=user@ex... - Remove admin role"
	@echo "  make admin-list                    - List all admins"
	@echo ""
	@echo "Build:"
	@echo "  make build                         - Build for current platform"
	@echo "  make build-arm64                   - Build for ARM64 Linux"
	@echo "  make build-arm                     - Build for 32-bit ARM Linux"
	@echo "  make clean                         - Clean build artifacts"
	@echo ""
	@echo "Direct CLI usage:"
	@echo "  go run . serve"
	@echo "  go run cmd/cli/main.go admin add user@example.com"
	@echo "  go run cmd/cli/main.go admin remove user@example.com"
	@echo "  go run cmd/cli/main.go admin list"

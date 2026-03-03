package main

/*
    ------------------------------
    |[]|---------------------|[]||
    |;;|                     |;;||
    |;;|                     |;;||
    |;;| Made by nadhi.dev   |;;||
    |;;| Designed for pkg.lat|;;||
    |;;| :)                  |;;||
    |;;|                     |;;||
    |;;|                     |;;||
    |;;|_____________________|;;||
    |;;;;;;;;;;;;;;;;;;;;;;;;;;;||
    |;;;;;| |;;;|         |;;;;;||
	|;;;;;;_______________ ;;;;;||
    |;;;;;|  ___          |;;;;;||
    |;;;;;| |;;;|         |;;;;;||
    |;;;;;| |;;;|         |;;;;;||
    |;;;;;| |;;;|         |;;;;;||
    |;;;;;| |___|         |;;;;;||
    \_____|_______________|_____||	Delta Tofee.

	Torch is a part of pkg.lat, it
	was developed to allow server
	owners and server hosting
	owners can manage servers in
	the more traditional sense
	with elegant UI out of the box.

	(c) 2026 Nadhi.dev, Pkg.lat and
	 	contributors.
*/



import (
	"fmt"
	"net/http"
	"os"
	"strings"

	"torch/pkg.lat/admin"
	"torch/pkg.lat/auth"
	"torch/pkg.lat/billing"
	brand "torch/pkg.lat/branding"
	"torch/pkg.lat/cli"
	"torch/pkg.lat/logger"
	"torch/pkg.lat/providers"
	"torch/pkg.lat/servers"
	"torch/pkg.lat/software"
	"torch/pkg.lat/volumes"
	"torch/pkg.lat/workspace"
)

func main() {
	brand.Catlogo()

	// Load .env file
	auth.LoadEnvDefault()

	if len(os.Args) > 1 {
		cli.UseCLI()
	} else {
		logger.Info("Starting Torch server...")

		// Setup auth
		registry, config, handler, err := auth.New()
		if err != nil {
			logger.Error("Failed to initialize auth", err)
			return
		}

		// Register providers based on config
		for name, providerConfig := range config.Providers {
			if !providerConfig.Enabled {
				continue
			}

			switch name {
			case "discord":
				registry.Register(providers.NewDiscordProvider(providerConfig))
			case "github":
				registry.Register(providers.NewGitHubProvider(providerConfig))
			}
		}

		// Setup router
		mux := http.NewServeMux()
		handler.RegisterRoutes(mux)

		// Setup admin routes
		store := handler.GetStore()
		adminHandler := admin.NewHandler(store)
		adminMiddleware := admin.AdminMiddleware(store)

		mux.Handle("/api/admin/audit-logs", adminMiddleware(http.HandlerFunc(adminHandler.GetAuditLogs)))
		mux.Handle("/api/admin/stats", adminMiddleware(http.HandlerFunc(adminHandler.GetStats)))
		mux.Handle("/api/admin/users", adminMiddleware(http.HandlerFunc(adminHandler.GetUsers)))
		mux.Handle("/api/admin/users/role", adminMiddleware(http.HandlerFunc(adminHandler.UpdateUserRole)))
		mux.Handle("/api/admin/users/email", adminMiddleware(http.HandlerFunc(adminHandler.UpdateUserEmail)))
		mux.Handle("/api/admin/users/password", adminMiddleware(http.HandlerFunc(adminHandler.ResetUserPassword)))
		mux.Handle("/api/admin/users/sessions", adminMiddleware(http.HandlerFunc(adminHandler.ClearUserSessions)))
		mux.Handle("/api/admin/users/ban", adminMiddleware(http.HandlerFunc(adminHandler.BanUser)))
		mux.Handle("/api/admin/users/unban", adminMiddleware(http.HandlerFunc(adminHandler.UnbanUser)))
		mux.Handle("/api/admin/users/limits", adminMiddleware(http.HandlerFunc(adminHandler.UpdateUserLimits)))
		mux.Handle("/api/admin/users/credits", adminMiddleware(http.HandlerFunc(adminHandler.UpdateUserCredits)))

		// Node management routes
		mux.Handle("/api/admin/nodes", adminMiddleware(http.HandlerFunc(adminHandler.HandleNodes)))
		mux.Handle("/api/admin/nodes/", adminMiddleware(http.HandlerFunc(adminHandler.HandleNodeRoutes)))

		// Software management routes (admin)
		mux.Handle("/api/admin/software", adminMiddleware(http.HandlerFunc(adminHandler.HandleSoftware)))
		mux.Handle("/api/admin/software/", adminMiddleware(http.HandlerFunc(adminHandler.HandleSoftwareRoutes)))

		// Software routes (public - for users creating servers)
		softwareHandler := software.NewHandler(store)
		mux.Handle("/api/software", softwareHandler.AuthMiddleware(softwareHandler.ListSoftware))
		mux.Handle("/api/software/", softwareHandler.AuthMiddleware(softwareHandler.GetSoftware))

		// Server management routes
		serverHandler := servers.NewHandler(store)
		mux.HandleFunc("/api/servers", serverHandler.ListServers)
		mux.HandleFunc("/api/servers/create", serverHandler.CreateServer)
		mux.HandleFunc("/api/servers/", func(w http.ResponseWriter, r *http.Request) {
			// Check if it's a limits update
			if strings.HasSuffix(r.URL.Path, "/limits") && r.Method == http.MethodPatch {
				serverHandler.UpdateServerLimits(w, r)
				return
			}

			if r.Method == http.MethodGet {
				serverHandler.GetServer(w, r)
			} else if r.Method == http.MethodDelete {
				serverHandler.DeleteServer(w, r)
			} else {
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
		})

		// LightD remote sync routes (no auth - verified by token in handler)
		lightdRemoteHandler := servers.NewRemoteHandler(store)
		mux.HandleFunc("/health", lightdRemoteHandler.Health)
		mux.HandleFunc("/update", lightdRemoteHandler.Update)

		// Volume management routes
		volumeHandler := volumes.NewHandler(store)
		mux.Handle("/api/volumes", volumeHandler.AuthMiddleware(volumeHandler.ListVolumes))
		mux.Handle("/api/volumes/create", volumeHandler.AuthMiddleware(volumeHandler.CreateVolume))
		mux.Handle("/api/volumes/nodes", volumeHandler.AuthMiddleware(volumeHandler.ListNodes))
		mux.Handle("/api/volumes/", volumeHandler.AuthMiddleware(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodGet {
				volumeHandler.GetVolume(w, r)
			} else if r.Method == http.MethodDelete {
				volumeHandler.DeleteVolume(w, r)
			} else {
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
		}))

		// Workspace and Billing routes (combined to avoid conflicts)
		workspaceHandler := workspace.NewHandler(store)
		billingHandler := billing.NewHandler(store)

		mux.Handle("/api/workspaces/", workspaceHandler.AuthMiddleware(func(w http.ResponseWriter, r *http.Request) {
			// Route based on path
			if strings.Contains(r.URL.Path, "/transactions") {
				billingHandler.GetTransactions(w, r)
			} else if strings.Contains(r.URL.Path, "/audit") {
				workspaceHandler.GetAuditLogs(w, r)
			} else {
				http.Error(w, "Not found", http.StatusNotFound)
			}
		}))

		// Ensure transaction indexes
		if err := store.EnsureTransactionIndexes(); err != nil {
			logger.Error("Failed to ensure transaction indexes", err)
		}

		// Ensure volume indexes
		if err := store.EnsureVolumeIndexes(); err != nil {
			logger.Error("Failed to ensure volume indexes", err)
		}

		// Start server
		// sometimes ppl hate the black race, soooo yuh idk why this matters this commet
		addr := os.Getenv("SERVER_ADDR")
		if addr == "" {
			addr = ":808"
		}

		logger.Info(fmt.Sprintf("Auth providers enabled: %v", config.AllowedAuths))
		logger.Info(fmt.Sprintf("Server starting on %s", addr))
		if err := http.ListenAndServe(addr, withCORS(mux)); err != nil {
			logger.Error("Server failed", err)
		}
	}
}

func withCORS(next http.Handler) http.Handler {
	frontendURL := strings.TrimSpace(os.Getenv("FRONTEND_URL"))
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && origin == frontendURL {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

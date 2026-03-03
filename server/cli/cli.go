package cli

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"torch/pkg.lat/logger"
	"torch/pkg.lat/mongo"
	"torch/pkg.lat/queue"

	"github.com/spf13/cobra"
)

var (
	redisAddr string
	redisPass string
	redisDB   int
)

var rootCmd = &cobra.Command{
	Use:          "torch",
	Short:        "Torch server CLI",
	SilenceUsage: true,
}

var queueCmd = &cobra.Command{
	Use:          "queue",
	Short:        "Queue management",
	SilenceUsage: true,
}

var queueStatusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show queue stats",
	Run: func(cmd *cobra.Command, args []string) {
		q := queue.New(&queue.Config{RedisAddr: redisAddr, RedisPassword: redisPass, RedisDB: redisDB})
		defer q.Stop()

		stats, err := q.Stats()
		if err != nil {
			log.Fatal(err)
		}

		fmt.Printf("Pending: %d | Active: %d | Scheduled: %d\n\n", stats.TotalPending, stats.TotalActive, stats.TotalScheduled)
		for name, s := range stats.Queues {
			fmt.Printf("%s: pending=%d active=%d scheduled=%d retry=%d archived=%d\n",
				name, s.Pending, s.Active, s.Scheduled, s.Retry, s.Archived)
		}
	},
}

var queueTestCmd = &cobra.Command{
	Use:   "test",
	Short: "Enqueue test job (shortcut)",
	Run: func(cmd *cobra.Command, args []string) {
		q := queue.New(&queue.Config{RedisAddr: redisAddr, RedisPassword: redisPass, RedisDB: redisDB})
		defer q.Stop()

		jobID, err := q.Enqueue(queue.JobTypeTest, map[string]interface{}{
			"message": "test",
			"ts":      time.Now().Unix(),
		}, &queue.JobOptions{MaxRetry: 3, Timeout: 30 * time.Second})

		if err != nil {
			log.Fatal(err)
		}
		logger.Info(fmt.Sprintf("Job enqueued: %s\n", jobID))
	},
}

var queueWorkerCmd = &cobra.Command{
	Use:   "worker",
	Short: "Start worker",
	Run: func(cmd *cobra.Command, args []string) {
		q := queue.New(&queue.Config{
			RedisAddr:     redisAddr,
			RedisPassword: redisPass,
			RedisDB:       redisDB,
			Concurrency:   10,
		})

		queue.RegisterExampleHandlers(q)
		logger.Init("Queue worker started")

		if err := q.Start(); err != nil {
			logger.Error("Failed to start worker", err)
			os.Exit(1)
		}
	},
}

var queueEnqueueCmd = &cobra.Command{
	Use:   "enqueue [type] [json]",
	Short: "Enqueue custom job with type and JSON payload",
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		var payload map[string]interface{}
		if err := json.Unmarshal([]byte(args[1]), &payload); err != nil {
			log.Fatal(err)
		}

		q := queue.New(&queue.Config{RedisAddr: redisAddr, RedisPassword: redisPass, RedisDB: redisDB})
		defer q.Stop()

		jobID, err := q.Enqueue(args[0], payload, &queue.JobOptions{MaxRetry: 3, Timeout: 60 * time.Second})
		if err != nil {
			log.Fatal(err)
		}
		logger.Info(fmt.Sprintf("Job enqueued: %s\n", jobID))
	},
}

var queueExamplesCmd = &cobra.Command{
	Use:   "examples",
	Short: "Enqueue example jobs",
	Run: func(cmd *cobra.Command, args []string) {
		q := queue.New(&queue.Config{RedisAddr: redisAddr, RedisPassword: redisPass, RedisDB: redisDB})
		defer q.Stop()

		if err := queue.EnqueueExampleJobs(q); err != nil {
			log.Fatal(err)
		}
		fmt.Println("Examples enqueued")
	},
}

var queueSyncCmd = &cobra.Command{
	Use:   "sync [type] [json]",
	Short: "Enqueue and wait",
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		var payload map[string]interface{}
		if err := json.Unmarshal([]byte(args[1]), &payload); err != nil {
			log.Fatal(err)
		}

		q := queue.New(&queue.Config{RedisAddr: redisAddr, RedisPassword: redisPass, RedisDB: redisDB})
		defer q.Stop()

		if err := q.EnqueueSync(context.Background(), args[0], payload, 60*time.Second); err != nil {
			log.Fatal(err)
		}
		fmt.Println("Job completed")
	},
}

var redisClearCmd = &cobra.Command{
	Use:   "redis-clear",
	Short: "Clear all Redis data (queue, cache, etc.)",
	Run: func(cmd *cobra.Command, args []string) {
		q := queue.New(&queue.Config{RedisAddr: redisAddr, RedisPassword: redisPass, RedisDB: redisDB})
		defer q.Stop()

		ctx := context.Background()
		client := q.GetRedisClient()

		// Flush the entire database
		if err := client.FlushDB(ctx).Err(); err != nil {
			log.Fatalf("Failed to clear Redis: %v", err)
		}

		logger.Info("✓ Redis database cleared successfully")
		logger.Info("  - All queue data cleared")
		logger.Info("  - All cache data cleared")
		logger.Info("")
		logger.Info("⚠️  NOTE: User sessions are stored in browser cookies")
		logger.Info("   To fully log out, users must:")
		logger.Info("   1. Call POST /authenticate/logout endpoint")
		logger.Info("   2. Or clear browser cookies manually")
	},
}

var migrateUserLimitsCmd = &cobra.Command{
	Use:   "migrate-user-limits",
	Short: "Add default resource limits to all users without limits",
	Run: func(cmd *cobra.Command, args []string) {
		store, err := mongo.NewStoreFromEnv()
		if err != nil {
			log.Fatalf("Failed to connect to database: %v", err)
		}

		ctx := context.Background()

		// Get the default limits that will be applied
		limits := mongo.DefaultUserLimits()

		count, err := store.MigrateUserLimits(ctx)
		if err != nil {
			log.Fatalf("Migration failed: %v", err)
		}

		logger.Info(fmt.Sprintf("✓ Migration completed successfully"))
		logger.Info(fmt.Sprintf("  - Updated %d users with default limits", count))
		logger.Info(fmt.Sprintf("  - Default limits: vcpu=%v, memory_mb=%v, storage_mb=%v",
			limits["vcpu"], limits["memory_mb"], limits["storage_mb"]))
	},
}

func init() {
	rootCmd.PersistentFlags().StringVar(&redisAddr, "redis-addr", "localhost:6379", "Redis address")
	rootCmd.PersistentFlags().StringVar(&redisPass, "redis-pass", "", "Redis password")
	rootCmd.PersistentFlags().IntVar(&redisDB, "redis-db", 0, "Redis DB")

	queueCmd.AddCommand(queueStatusCmd, queueTestCmd, queueWorkerCmd, queueEnqueueCmd, queueExamplesCmd, queueSyncCmd)
	rootCmd.AddCommand(queueCmd, redisClearCmd, migrateUserLimitsCmd)
}

func UseCLI() {
	rootCmd.SilenceErrors = true
	if err := rootCmd.Execute(); err != nil {
		log.Fatal(err)
	}
}

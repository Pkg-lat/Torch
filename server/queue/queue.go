package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/hibiken/asynq"
	"github.com/redis/go-redis/v9"
)

type Queue struct {
	client    *asynq.Client
	server    *asynq.Server
	mux       *asynq.ServeMux
	inspector *asynq.Inspector
	config    *Config
}

type Config struct {
	RedisAddr     string
	RedisPassword string
	RedisDB       int
	Concurrency   int
}

type JobHandler func(ctx context.Context, payload []byte) error

type JobOptions struct {
	MaxRetry  int
	Timeout   time.Duration
	Queue     string
	ProcessAt time.Time
	Unique    bool
}

type Stats struct {
	Queues         map[string]QueueStats
	TotalPending   int
	TotalActive    int
	TotalScheduled int
}

type QueueStats struct {
	Pending   int
	Active    int
	Scheduled int
	Retry     int
	Archived  int
	Completed int
}

func DefaultConfig() *Config {
	return &Config{
		RedisAddr:     "localhost:6379",
		RedisPassword: "",
		RedisDB:       0,
		Concurrency:   10,
	}
}

func New(config *Config) *Queue {
	if config == nil {
		config = DefaultConfig()
	}

	redisOpt := asynq.RedisClientOpt{
		Addr:     config.RedisAddr,
		Password: config.RedisPassword,
		DB:       config.RedisDB,
	}

	return &Queue{
		client:    asynq.NewClient(redisOpt),
		inspector: asynq.NewInspector(redisOpt),
		server: asynq.NewServer(redisOpt, asynq.Config{
			Concurrency: config.Concurrency,
			Queues:      map[string]int{"critical": 6, "default": 3, "low": 1},
		}),
		mux:    asynq.NewServeMux(),
		config: config,
	}
}

func (q *Queue) Enqueue(jobType string, payload interface{}, opts *JobOptions) (string, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	task := asynq.NewTask(jobType, data)
	var taskOpts []asynq.Option

	if opts != nil {
		if opts.MaxRetry > 0 {
			taskOpts = append(taskOpts, asynq.MaxRetry(opts.MaxRetry))
		}
		if opts.Timeout > 0 {
			taskOpts = append(taskOpts, asynq.Timeout(opts.Timeout))
		}
		if opts.Queue != "" {
			taskOpts = append(taskOpts, asynq.Queue(opts.Queue))
		}
		if !opts.ProcessAt.IsZero() {
			taskOpts = append(taskOpts, asynq.ProcessAt(opts.ProcessAt))
		}
		if opts.Unique {
			taskOpts = append(taskOpts, asynq.Unique(24*time.Hour))
		}
	}

	info, err := q.client.Enqueue(task, taskOpts...)
	if err != nil {
		return "", err
	}
	return info.ID, nil
}

func (q *Queue) EnqueueSync(ctx context.Context, jobType string, payload interface{}, timeout time.Duration) error {
	jobID, err := q.Enqueue(jobType, payload, &JobOptions{Timeout: timeout})
	if err != nil {
		return err
	}

	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	deadline := time.Now().Add(timeout)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			if time.Now().After(deadline) {
				return fmt.Errorf("timeout")
			}

			info, err := q.inspector.GetTaskInfo("default", jobID)
			if err != nil {
				continue
			}

			switch info.State {
			case asynq.TaskStateCompleted:
				return nil
			case asynq.TaskStateArchived:
				return fmt.Errorf("failed")
			}
		}
	}
}

func (q *Queue) Register(jobType string, handler JobHandler) {
	q.mux.HandleFunc(jobType, func(ctx context.Context, task *asynq.Task) error {
		return handler(ctx, task.Payload())
	})
}

func (q *Queue) Start() error {
	return q.server.Run(q.mux)
}

func (q *Queue) Stop() {
	q.server.Shutdown()
	q.client.Close()
}

func (q *Queue) Stats() (*Stats, error) {
	stats := &Stats{Queues: make(map[string]QueueStats)}

	for _, queueName := range []string{"critical", "default", "low"} {
		info, err := q.inspector.GetQueueInfo(queueName)
		if err != nil {
			continue
		}

		stats.Queues[queueName] = QueueStats{
			Pending:   info.Pending,
			Active:    info.Active,
			Scheduled: info.Scheduled,
			Retry:     info.Retry,
			Archived:  info.Archived,
			Completed: info.Completed,
		}

		stats.TotalPending += info.Pending
		stats.TotalActive += info.Active
		stats.TotalScheduled += info.Scheduled
	}

	return stats, nil
}

func (q *Queue) GetRedisClient() *redis.Client {
	return redis.NewClient(&redis.Options{
		Addr:     q.config.RedisAddr,
		Password: q.config.RedisPassword,
		DB:       q.config.RedisDB,
	})
}

package queue
/*
 Useless garbo
 Only used to test when u run if redis is available and what not
 :D
*/

import (
	"context"
	"encoding/json"
	"time"

	"torch/pkg.lat/logger"
)

const (
	JobTypeEmail   = "email:send"
	JobTypeBackup  = "backup:create"
	JobTypeCleanup = "cleanup:temp"
	JobTypeTest    = "test:job"
)

type EmailPayload struct {
	To      string `json:"to"`
	Subject string `json:"subject"`
	Body    string `json:"body"`
}

type BackupPayload struct {
	ServerID string `json:"server_id"`
	Type     string `json:"type"`
}

func RegisterExampleHandlers(q *Queue) {
	q.Register(JobTypeEmail, func(ctx context.Context, payload []byte) error {
		var email EmailPayload
		if err := json.Unmarshal(payload, &email); err != nil {
			logger.Error("Failed to parse email payload", err)
			return err
		}
		logger.Info("Sending email to " + email.To + ": " + email.Subject)
		time.Sleep(1 * time.Second)
		logger.Info("Email sent successfully")
		return nil
	})

	q.Register(JobTypeBackup, func(ctx context.Context, payload []byte) error {
		var backup BackupPayload
		if err := json.Unmarshal(payload, &backup); err != nil {
			logger.Error("Failed to parse backup payload", err)
			return err
		}
		logger.Info("Creating backup for server " + backup.ServerID + " (type: " + backup.Type + ")")
		time.Sleep(2 * time.Second)
		logger.Info("Backup completed")
		return nil
	})

	q.Register(JobTypeCleanup, func(ctx context.Context, payload []byte) error {
		logger.Info("Running cleanup job")
		time.Sleep(500 * time.Millisecond)
		logger.Info("Cleanup completed")
		return nil
	})

	q.Register(JobTypeTest, func(ctx context.Context, payload []byte) error {
		var data map[string]interface{}
		if err := json.Unmarshal(payload, &data); err != nil {
			logger.Error("Failed to parse test payload", err)
			return err
		}
		logger.Debug("Test job received")
		time.Sleep(1 * time.Second)
		logger.Info("Test job completed")
		return nil
	})
}

func EnqueueExampleJobs(q *Queue) error {
	if _, err := q.Enqueue(JobTypeEmail, EmailPayload{
		To:      "user@example.com",
		Subject: "Welcome",
		Body:    "Thanks for signing up",
	}, &JobOptions{MaxRetry: 3, Queue: "default"}); err != nil {
		return err
	}

	if _, err := q.Enqueue(JobTypeBackup, BackupPayload{
		ServerID: "srv_123",
		Type:     "full",
	}, &JobOptions{MaxRetry: 5, Queue: "critical"}); err != nil {
		return err
	}

	if _, err := q.Enqueue(JobTypeCleanup, map[string]string{"target": "/tmp"}, &JobOptions{
		ProcessAt: time.Now().Add(5 * time.Second),
		Queue:     "low",
	}); err != nil {
		return err
	}

	return nil
}

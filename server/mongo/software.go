package mongo

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/v2/bson"
)

// CreateSoftware creates a new software entry
func (s *Store) CreateSoftware(software *Software) (*Software, error) {
	software.UUID = uuid.New().String()
	software.CreatedAt = time.Now()
	software.UpdatedAt = time.Now()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := s.client.Database.Collection("software").InsertOne(ctx, software)
	if err != nil {
		return nil, fmt.Errorf("failed to create software: %w", err)
	}

	return software, nil
}

// ListSoftware returns all software entries
func (s *Store) ListSoftware() ([]Software, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cursor, err := s.client.Database.Collection("software").Find(ctx, bson.M{})
	if err != nil {
		return nil, fmt.Errorf("failed to list software: %w", err)
	}
	defer cursor.Close(ctx)

	var software []Software
	if err := cursor.All(ctx, &software); err != nil {
		return nil, fmt.Errorf("failed to decode software: %w", err)
	}

	return software, nil
}

// GetSoftwareByUUID retrieves a software entry by UUID
func (s *Store) GetSoftwareByUUID(uuid string) (*Software, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var software Software
	err := s.client.Database.Collection("software").FindOne(ctx, bson.M{"uuid": uuid}).Decode(&software)
	if err != nil {
		return nil, fmt.Errorf("software not found: %w", err)
	}

	return &software, nil
}

// UpdateSoftware updates a software entry
func (s *Store) UpdateSoftware(uuid string, updates map[string]any) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	updates["updated_at"] = time.Now()

	result, err := s.client.Database.Collection("software").UpdateOne(
		ctx,
		bson.M{"uuid": uuid},
		bson.M{"$set": updates},
	)
	if err != nil {
		return fmt.Errorf("failed to update software: %w", err)
	}

	if result.MatchedCount == 0 {
		return fmt.Errorf("software not found")
	}

	return nil
}

// DeleteSoftware deletes a software entry
func (s *Store) DeleteSoftware(uuid string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := s.client.Database.Collection("software").DeleteOne(ctx, bson.M{"uuid": uuid})
	if err != nil {
		return fmt.Errorf("failed to delete software: %w", err)
	}

	if result.DeletedCount == 0 {
		return fmt.Errorf("software not found")
	}

	return nil
}

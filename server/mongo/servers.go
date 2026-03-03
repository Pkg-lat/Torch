package mongo

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// CreateServer creates a new server entry
func (s *Store) CreateServer(server *Server) (*Server, error) {
	server.UUID = uuid.New().String()
	server.CreatedAt = time.Now()
	server.UpdatedAt = time.Now()
	server.Status = "installing"

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := s.client.Database.Collection("servers").InsertOne(ctx, server)
	if err != nil {
		return nil, fmt.Errorf("failed to create server: %w", err)
	}

	return server, nil
}

// ListServers returns servers for a workspace with pagination
func (s *Store) ListServers(workspaceID string, page, limit int) ([]Server, int64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"workspace_id": workspaceID}

	// Count total
	total, err := s.client.Database.Collection("servers").CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count servers: %w", err)
	}

	// Find with pagination
	skip := int64((page - 1) * limit)
	opts := options.Find().
		SetSkip(skip).
		SetLimit(int64(limit)).
		SetSort(bson.M{"created_at": -1})
	cursor, err := s.client.Database.Collection("servers").Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list servers: %w", err)
	}
	defer cursor.Close(ctx)

	var servers []Server
	if err := cursor.All(ctx, &servers); err != nil {
		return nil, 0, fmt.Errorf("failed to decode servers: %w", err)
	}

	return servers, total, nil
}

// GetServerByUUID retrieves a server by UUID
func (s *Store) GetServerByUUID(uuid string) (*Server, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var server Server
	err := s.client.Database.Collection("servers").FindOne(ctx, bson.M{"uuid": uuid}).Decode(&server)
	if err != nil {
		return nil, fmt.Errorf("server not found: %w", err)
	}

	return &server, nil
}

// UpdateServer updates a server entry
func (s *Store) UpdateServer(uuid string, updates map[string]any) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	updates["updated_at"] = time.Now()

	result, err := s.client.Database.Collection("servers").UpdateOne(
		ctx,
		bson.M{"uuid": uuid},
		bson.M{"$set": updates},
	)
	if err != nil {
		return fmt.Errorf("failed to update server: %w", err)
	}

	if result.MatchedCount == 0 {
		return fmt.Errorf("server not found")
	}

	return nil
}

// DeleteServer deletes a server entry
func (s *Store) DeleteServer(uuid string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := s.client.Database.Collection("servers").DeleteOne(ctx, bson.M{"uuid": uuid})
	if err != nil {
		return fmt.Errorf("failed to delete server: %w", err)
	}

	if result.DeletedCount == 0 {
		return fmt.Errorf("server not found")
	}

	return nil
}

// GetServerByInternalID retrieves a server by its LightD internal ID
func (s *Store) GetServerByInternalID(internalID string) (*Server, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var server Server
	err := s.client.Database.Collection("servers").FindOne(ctx, bson.M{"lightd_internal_id": internalID}).Decode(&server)
	if err != nil {
		return nil, fmt.Errorf("server not found: %w", err)
	}

	return &server, nil
}

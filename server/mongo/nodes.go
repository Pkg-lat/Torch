package mongo

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

// CreateNode creates a new node in the database
func (s *Store) CreateNode(name, fqdn, ip, host string, port int, sftpPort int, image, secretToken, scheme string, maxServers int) (*Node, error) {
	if name == "" || fqdn == "" || secretToken == "" {
		return nil, fmt.Errorf("name, fqdn, and secret_token are required")
	}

	if scheme != "http" && scheme != "https" {
		return nil, fmt.Errorf("scheme must be 'http' or 'https'")
	}

	now := time.Now().UTC()
	node := &Node{
		UUID:           uuid.NewString(),
		Name:           name,
		FQDN:           fqdn,
		IP:             ip,
		Host:           NodeHost{Host: host, Port: port, SFTPPort: sftpPort},
		Image:          image,
		SecretToken:    secretToken,
		Scheme:         scheme,
		CreatedAt:      now,
		UpdatedAt:      now,
		MaxServers:     maxServers,
		CurrentServers: 0,
		Status:         "pending", // Will be updated after health check
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err := s.nodes.InsertOne(ctx, node)
	if err != nil {
		return nil, err
	}

	return node, nil
}

// GetNodeByUUID retrieves a node by UUID
func (s *Store) GetNodeByUUID(nodeUUID string) (*Node, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var node Node
	err := s.nodes.FindOne(ctx, bson.M{"uuid": nodeUUID}).Decode(&node)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("node not found")
		}
		return nil, err
	}

	return &node, nil
}

// ListNodes retrieves all nodes
func (s *Store) ListNodes() ([]Node, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cursor, err := s.nodes.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var nodes []Node
	if err := cursor.All(ctx, &nodes); err != nil {
		return nil, err
	}

	return nodes, nil
}

// UpdateNodeStatus updates the node status and last health check time
func (s *Store) UpdateNodeStatus(nodeUUID, status string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	now := time.Now().UTC()
	update := bson.M{
		"$set": bson.M{
			"status":            status,
			"last_health_check": now,
			"updated_at":        now,
		},
	}

	result, err := s.nodes.UpdateOne(ctx, bson.M{"uuid": nodeUUID}, update)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return fmt.Errorf("node not found")
	}

	return nil
}

// UpdateNodeServerCount updates the current server count for a node
func (s *Store) UpdateNodeServerCount(nodeUUID string, count int) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	update := bson.M{
		"$set": bson.M{
			"current_servers": count,
			"updated_at":      time.Now().UTC(),
		},
	}

	result, err := s.nodes.UpdateOne(ctx, bson.M{"uuid": nodeUUID}, update)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return fmt.Errorf("node not found")
	}

	return nil
}

// DeleteNode deletes a node by UUID
func (s *Store) DeleteNode(nodeUUID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	result, err := s.nodes.DeleteOne(ctx, bson.M{"uuid": nodeUUID})
	if err != nil {
		return err
	}

	if result.DeletedCount == 0 {
		return fmt.Errorf("node not found")
	}

	return nil
}

// UpdateNode updates node details
func (s *Store) UpdateNode(nodeUUID string, updates map[string]any) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	updates["updated_at"] = time.Now().UTC()

	update := bson.M{"$set": updates}
	result, err := s.nodes.UpdateOne(ctx, bson.M{"uuid": nodeUUID}, update)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return fmt.Errorf("node not found")
	}

	return nil
}

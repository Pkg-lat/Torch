package mongo

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type Volume struct {
	UUID         string    `bson:"uuid" json:"uuid"`
	Name         string    `bson:"name" json:"name"`
	WorkspaceID  string    `bson:"workspace_id" json:"workspaceId"`
	CreatedBy    string    `bson:"created_by" json:"createdBy"`
	NodeUUID     string    `bson:"node_uuid" json:"nodeUuid"`
	LightdVolID  string    `bson:"lightd_vol_id" json:"lightdVolId"` // ID from lightd
	SizeMB       int       `bson:"size_mb" json:"sizeMb"`
	UsedMB       int       `bson:"used_mb" json:"usedMb"`
	Status       string    `bson:"status" json:"status"` // "active", "deleting", "error"
	CreatedAt    time.Time `bson:"created_at" json:"createdAt"`
	UpdatedAt    time.Time `bson:"updated_at" json:"updatedAt"`
	LastSyncedAt time.Time `bson:"last_synced_at" json:"lastSyncedAt"`
}

type WorkspaceAuditLog struct {
	UUID        string                 `bson:"uuid" json:"uuid"`
	WorkspaceID string                 `bson:"workspace_id" json:"workspaceId"`
	UserUUID    string                 `bson:"user_uuid" json:"userUuid"`
	UserEmail   string                 `bson:"user_email" json:"userEmail"`
	Action      string                 `bson:"action" json:"action"`
	Resource    string                 `bson:"resource" json:"resource"`
	ResourceID  string                 `bson:"resource_id,omitempty" json:"resourceId,omitempty"`
	Details     map[string]interface{} `bson:"details,omitempty" json:"details,omitempty"`
	IPAddress   string                 `bson:"ip_address,omitempty" json:"ipAddress,omitempty"`
	UserAgent   string                 `bson:"user_agent,omitempty" json:"userAgent,omitempty"`
	Timestamp   time.Time              `bson:"timestamp" json:"timestamp"`
}

func (s *Store) EnsureVolumeIndexes() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	volumes := s.client.Database.Collection("volumes")
	_, err := volumes.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "uuid", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "workspace_id", Value: 1}}},
		{Keys: bson.D{{Key: "created_by", Value: 1}}},
		{Keys: bson.D{{Key: "node_uuid", Value: 1}}},
		{Keys: bson.D{{Key: "lightd_vol_id", Value: 1}}},
	})
	if err != nil {
		return err
	}

	workspaceAudit := s.client.Database.Collection("workspace_audit_logs")
	_, err = workspaceAudit.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "uuid", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "workspace_id", Value: 1}}},
		{Keys: bson.D{{Key: "timestamp", Value: -1}}},
	})
	return err
}

// CreateVolume creates a new volume record
func (s *Store) CreateVolume(ctx context.Context, workspaceID, createdBy, nodeUUID, lightdVolID string, sizeMB int, name string) (*Volume, error) {
	volumes := s.client.Database.Collection("volumes")

	now := time.Now().UTC()
	volume := &Volume{
		UUID:         uuid.NewString(),
		Name:         name,
		WorkspaceID:  workspaceID,
		CreatedBy:    createdBy,
		NodeUUID:     nodeUUID,
		LightdVolID:  lightdVolID,
		SizeMB:       sizeMB,
		UsedMB:       0,
		Status:       "active",
		CreatedAt:    now,
		UpdatedAt:    now,
		LastSyncedAt: now,
	}

	_, err := volumes.InsertOne(ctx, volume)
	if err != nil {
		return nil, err
	}

	return volume, nil
}

// GetVolume retrieves a volume by UUID
func (s *Store) GetVolume(ctx context.Context, volumeUUID string) (*Volume, error) {
	volumes := s.client.Database.Collection("volumes")

	var volume Volume
	err := volumes.FindOne(ctx, bson.M{"uuid": volumeUUID}).Decode(&volume)
	if err != nil {
		return nil, err
	}

	return &volume, nil
}

// ListVolumesByWorkspace lists all volumes for a workspace
func (s *Store) ListVolumesByWorkspace(ctx context.Context, workspaceID string, limit, skip int64) ([]Volume, int64, error) {
	volumes := s.client.Database.Collection("volumes")

	filter := bson.M{"workspace_id": workspaceID}

	total, err := volumes.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetLimit(limit).
		SetSkip(skip)

	cursor, err := volumes.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var vols []Volume
	if err := cursor.All(ctx, &vols); err != nil {
		return nil, 0, err
	}

	return vols, total, nil
}

// UpdateVolumeUsage updates the used space for a volume
func (s *Store) UpdateVolumeUsage(ctx context.Context, volumeUUID string, usedMB int) error {
	volumes := s.client.Database.Collection("volumes")

	_, err := volumes.UpdateOne(
		ctx,
		bson.M{"uuid": volumeUUID},
		bson.M{
			"$set": bson.M{
				"used_mb":        usedMB,
				"updated_at":     time.Now().UTC(),
				"last_synced_at": time.Now().UTC(),
			},
		},
	)

	return err
}

// DeleteVolume marks a volume as deleted
func (s *Store) DeleteVolume(ctx context.Context, volumeUUID string) error {
	volumes := s.client.Database.Collection("volumes")

	result, err := volumes.DeleteOne(ctx, bson.M{"uuid": volumeUUID})
	if err != nil {
		return err
	}

	if result.DeletedCount == 0 {
		return errors.New("volume not found")
	}

	return nil
}

// GetWorkspaceStorageUsage calculates total storage used by a workspace
func (s *Store) GetWorkspaceStorageUsage(ctx context.Context, workspaceID string) (int, error) {
	volumes := s.client.Database.Collection("volumes")

	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"workspace_id": workspaceID, "status": "active"}}},
		{{Key: "$group", Value: bson.M{
			"_id":   nil,
			"total": bson.M{"$sum": "$size_mb"},
		}}},
	}

	cursor, err := volumes.Aggregate(ctx, pipeline)
	if err != nil {
		return 0, err
	}
	defer cursor.Close(ctx)

	var result []struct {
		Total int `bson:"total"`
	}

	if err := cursor.All(ctx, &result); err != nil {
		return 0, err
	}

	if len(result) == 0 {
		return 0, nil
	}

	return result[0].Total, nil
}

// LogWorkspaceAction logs an action to the workspace audit log
func (s *Store) LogWorkspaceAction(ctx context.Context, workspaceID, userUUID, userEmail, action, resource, resourceID string, details map[string]interface{}, ipAddress, userAgent string) error {
	workspaceAudit := s.client.Database.Collection("workspace_audit_logs")

	log := WorkspaceAuditLog{
		UUID:        uuid.NewString(),
		WorkspaceID: workspaceID,
		UserUUID:    userUUID,
		UserEmail:   userEmail,
		Action:      action,
		Resource:    resource,
		ResourceID:  resourceID,
		Details:     details,
		IPAddress:   ipAddress,
		UserAgent:   userAgent,
		Timestamp:   time.Now().UTC(),
	}

	_, err := workspaceAudit.InsertOne(ctx, log)
	return err
}

// GetWorkspaceAuditLogs retrieves audit logs for a workspace
func (s *Store) GetWorkspaceAuditLogs(ctx context.Context, workspaceID string, limit, skip int64) ([]WorkspaceAuditLog, int64, error) {
	workspaceAudit := s.client.Database.Collection("workspace_audit_logs")

	filter := bson.M{"workspace_id": workspaceID}

	total, err := workspaceAudit.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "timestamp", Value: -1}}).
		SetLimit(limit).
		SetSkip(skip)

	cursor, err := workspaceAudit.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var logs []WorkspaceAuditLog
	if err := cursor.All(ctx, &logs); err != nil {
		return nil, 0, err
	}

	return logs, total, nil
}

// CheckWorkspaceStorageLimit checks if workspace can create a volume of given size
func (s *Store) CheckWorkspaceStorageLimit(ctx context.Context, workspaceID string, requestedSizeMB int) error {
	// Get workspace owner
	org, err := s.GetOrganizationByUUID(ctx, workspaceID)
	if err != nil {
		return fmt.Errorf("workspace not found: %w", err)
	}

	// Get owner's limits
	owner, err := s.GetUserByUUID(org.CreatedBy)
	if err != nil {
		return fmt.Errorf("workspace owner not found: %w", err)
	}

	// Get storage limit from owner's limits
	storageLimitMB := 20480 // Default 20GB
	if limits, ok := owner.Limits["storage_mb"].(int); ok {
		storageLimitMB = limits
	} else if limits, ok := owner.Limits["storage_mb"].(int32); ok {
		storageLimitMB = int(limits)
	} else if limits, ok := owner.Limits["storage_mb"].(int64); ok {
		storageLimitMB = int(limits)
	} else if limits, ok := owner.Limits["storage_mb"].(float64); ok {
		storageLimitMB = int(limits)
	}

	// Get current usage
	currentUsageMB, err := s.GetWorkspaceStorageUsage(ctx, workspaceID)
	if err != nil {
		return fmt.Errorf("failed to get storage usage: %w", err)
	}

	// Check if adding this volume would exceed limit
	if currentUsageMB+requestedSizeMB > storageLimitMB {
		return fmt.Errorf("storage limit exceeded: current %dMB + requested %dMB > limit %dMB", currentUsageMB, requestedSizeMB, storageLimitMB)
	}

	return nil
}

// GetOrganizationByUUID retrieves an organization by UUID
func (s *Store) GetOrganizationByUUID(ctx context.Context, orgUUID string) (*Organization, error) {
	var org Organization
	err := s.orgs.FindOne(ctx, bson.M{"uuid": orgUUID}).Decode(&org)
	if err != nil {
		return nil, err
	}
	return &org, nil
}

// Transaction represents a billing transaction
type Transaction struct {
	UUID        string                 `bson:"uuid" json:"uuid"`
	WorkspaceID string                 `bson:"workspace_id" json:"workspaceId"`
	UserUUID    string                 `bson:"user_uuid" json:"userUuid"`
	Type        string                 `bson:"type" json:"type"` // credit, debit, refund
	Amount      int                    `bson:"amount" json:"amount"`
	Balance     int                    `bson:"balance" json:"balance"`
	Description string                 `bson:"description" json:"description"`
	Metadata    map[string]interface{} `bson:"metadata,omitempty" json:"metadata,omitempty"`
	CreatedAt   time.Time              `bson:"created_at" json:"createdAt"`
}

// CreateTransaction creates a new transaction and updates user balance
func (s *Store) CreateTransaction(ctx context.Context, workspaceID, userUUID, txType, description string, amount int, metadata map[string]interface{}) (*Transaction, error) {
	transactions := s.client.Database.Collection("transactions")

	// Get current user to check balance
	user, err := s.GetUserByUUID(userUUID)
	if err != nil {
		return nil, err
	}

	// Get current balance from Billing struct
	currentBalance := int(user.Billing.Credits)

	newBalance := currentBalance
	switch txType {
	case "credit", "refund":
		newBalance += amount
	case "debit":
		newBalance -= amount
		if newBalance < 0 {
			return nil, errors.New("insufficient balance")
		}
	default:
		return nil, errors.New("invalid transaction type")
	}

	// Create transaction
	tx := Transaction{
		UUID:        uuid.NewString(),
		WorkspaceID: workspaceID,
		UserUUID:    userUUID,
		Type:        txType,
		Amount:      amount,
		Balance:     newBalance,
		Description: description,
		Metadata:    metadata,
		CreatedAt:   time.Now().UTC(),
	}

	// Insert transaction
	_, err = transactions.InsertOne(ctx, tx)
	if err != nil {
		return nil, err
	}

	// Update user balance
	_, err = s.users.UpdateOne(
		ctx,
		bson.M{"uuid": userUUID},
		bson.M{"$set": bson.M{"billing.credits": float64(newBalance)}},
	)
	if err != nil {
		return nil, err
	}

	return &tx, nil
}

// GetWorkspaceTransactions retrieves transactions for a workspace
func (s *Store) GetWorkspaceTransactions(ctx context.Context, workspaceID string, limit, skip int64) ([]Transaction, int64, error) {
	transactions := s.client.Database.Collection("transactions")

	filter := bson.M{"workspace_id": workspaceID}

	total, err := transactions.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetLimit(limit).
		SetSkip(skip)

	cursor, err := transactions.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var txs []Transaction
	if err := cursor.All(ctx, &txs); err != nil {
		return nil, 0, err
	}

	return txs, total, nil
}

// CreateAdminTransaction creates a transaction record without modifying user balance.
// Used by admin operations where the balance is already updated directly.
func (s *Store) CreateAdminTransaction(ctx context.Context, workspaceID, userUUID, txType, description string, amount, newBalance int, metadata map[string]interface{}) (*Transaction, error) {
	transactions := s.client.Database.Collection("transactions")

	tx := Transaction{
		UUID:        uuid.NewString(),
		WorkspaceID: workspaceID,
		UserUUID:    userUUID,
		Type:        txType,
		Amount:      amount,
		Balance:     newBalance,
		Description: description,
		Metadata:    metadata,
		CreatedAt:   time.Now().UTC(),
	}

	_, err := transactions.InsertOne(ctx, tx)
	if err != nil {
		return nil, err
	}

	return &tx, nil
}

// EnsureTransactionIndexes creates indexes for transactions collection
func (s *Store) EnsureTransactionIndexes() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	transactions := s.client.Database.Collection("transactions")
	_, err := transactions.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "uuid", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "workspace_id", Value: 1}}},
		{Keys: bson.D{{Key: "user_uuid", Value: 1}}},
		{Keys: bson.D{{Key: "created_at", Value: -1}}},
	})
	return err
}

package mongo

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// AddAllocations adds port allocations to a node
func (s *Store) AddAllocations(nodeUUID string, allocations []PortAllocation) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Get current node to check for duplicates
	node, err := s.GetNodeByUUID(nodeUUID)
	if err != nil {
		return err
	}

	// Check for duplicate ports
	existingPorts := make(map[string]bool)
	for _, alloc := range node.Allocations {
		key := fmt.Sprintf("%d-%s", alloc.Port, alloc.Protocol)
		existingPorts[key] = true
	}

	// Filter out duplicates
	newAllocations := []PortAllocation{}
	for _, alloc := range allocations {
		key := fmt.Sprintf("%d-%s", alloc.Port, alloc.Protocol)
		if !existingPorts[key] {
			alloc.InUse = false
			alloc.ServerID = ""
			newAllocations = append(newAllocations, alloc)
		}
	}

	if len(newAllocations) == 0 {
		return nil // No new allocations to add
	}

	// Append new allocations
	_, err = s.client.Database.Collection("nodes").UpdateOne(
		ctx,
		bson.M{"uuid": nodeUUID},
		bson.M{
			"$push": bson.M{"allocations": bson.M{"$each": newAllocations}},
			"$set":  bson.M{"updated_at": time.Now()},
		},
	)

	return err
}

// RemoveAllocations removes port allocations from a node (only if not in use)
func (s *Store) RemoveAllocations(nodeUUID string, ports []int, protocol string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Get node
	node, err := s.GetNodeByUUID(nodeUUID)
	if err != nil {
		return err
	}

	// Filter allocations - keep those not in the removal list or those in use
	newAllocations := []PortAllocation{}
	for _, alloc := range node.Allocations {
		shouldRemove := false
		for _, port := range ports {
			if alloc.Port == port && alloc.Protocol == protocol {
				shouldRemove = true
				break
			}
		}

		// Keep if not marked for removal, or if in use
		if !shouldRemove || alloc.InUse {
			newAllocations = append(newAllocations, alloc)
		}
	}

	// Update node with filtered allocations
	_, err = s.client.Database.Collection("nodes").UpdateOne(
		ctx,
		bson.M{"uuid": nodeUUID},
		bson.M{
			"$set": bson.M{
				"allocations": newAllocations,
				"updated_at":  time.Now(),
			},
		},
	)

	return err
}

// AllocatePort finds and marks a free port as in use
func (s *Store) AllocatePort(nodeUUID string, containerPort int, protocol string, serverID string) (int, error) {
	_, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Get node
	node, err := s.GetNodeByUUID(nodeUUID)
	if err != nil {
		return 0, err
	}

	// Find free ports matching protocol
	freePorts := []int{}
	for _, alloc := range node.Allocations {
		if alloc.Protocol == protocol && !alloc.InUse {
			freePorts = append(freePorts, alloc.Port)
		}
	}

	if len(freePorts) == 0 {
		return 0, fmt.Errorf("no free %s ports available on node", protocol)
	}

	// Randomly select a free port
	selectedPort := freePorts[rand.Intn(len(freePorts))]

	// Mark as in use
	err = s.MarkPortInUse(nodeUUID, selectedPort, protocol, serverID)
	if err != nil {
		return 0, err
	}

	return selectedPort, nil
}

// MarkPortInUse marks a specific port as in use
func (s *Store) MarkPortInUse(nodeUUID string, port int, protocol string, serverID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Get node
	node, err := s.GetNodeByUUID(nodeUUID)
	if err != nil {
		return err
	}

	// Update the specific allocation
	updated := false
	for i, alloc := range node.Allocations {
		if alloc.Port == port && alloc.Protocol == protocol {
			if alloc.InUse && alloc.ServerID != serverID {
				return fmt.Errorf("port %d/%s is already in use by server %s", port, protocol, alloc.ServerID)
			}
			node.Allocations[i].InUse = true
			node.Allocations[i].ServerID = serverID
			updated = true
			break
		}
	}

	if !updated {
		return fmt.Errorf("port %d/%s not found in node allocations", port, protocol)
	}

	// Save updated node
	_, err = s.client.Database.Collection("nodes").UpdateOne(
		ctx,
		bson.M{"uuid": nodeUUID},
		bson.M{
			"$set": bson.M{
				"allocations": node.Allocations,
				"updated_at":  time.Now(),
			},
		},
	)

	return err
}

// FreeServerPorts frees all ports used by a server
func (s *Store) FreeServerPorts(nodeUUID string, serverID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Get node
	node, err := s.GetNodeByUUID(nodeUUID)
	if err != nil {
		return err
	}

	// Free all ports used by this server
	for i, alloc := range node.Allocations {
		if alloc.ServerID == serverID {
			node.Allocations[i].InUse = false
			node.Allocations[i].ServerID = ""
		}
	}

	// Save updated node
	_, err = s.client.Database.Collection("nodes").UpdateOne(
		ctx,
		bson.M{"uuid": nodeUUID},
		bson.M{
			"$set": bson.M{
				"allocations": node.Allocations,
				"updated_at":  time.Now(),
			},
		},
	)

	return err
}

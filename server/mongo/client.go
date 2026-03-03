package mongo

import (
	"context"
	"fmt"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const DatabaseName = "Torch-vendor"

type Client struct {
	Mongo    *mongo.Client
	Database *mongo.Database
}

func NewClientFromEnv() (*Client, error) {
	uri := os.Getenv("MONGO_URI")
	if uri == "" {
		return nil, fmt.Errorf("MONGO_URI is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(options.Client().ApplyURI(uri))
	if err != nil {
		return nil, err
	}

	if err := client.Ping(ctx, nil); err != nil {
		return nil, err
	}

	return &Client{
		Mongo:    client,
		Database: client.Database(DatabaseName),
	}, nil
}

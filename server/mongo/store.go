package mongo

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"golang.org/x/crypto/bcrypt"
)

const (
	RoleOwner     = "owner"
	RoleAdmin     = "admin"
	RoleModerator = "moderator"
	RoleGuest     = "guest"
)

// DefaultUserLimits returns the default resource limits from environment variables
func DefaultUserLimits() map[string]any {
	cpuLimit := getEnvInt("CPU_LIMIT", 100)
	memoryLimit := getEnvInt("MEMORY_LIMIT", 2048)
	storageLimit := getEnvInt("STORAGE_LIMIT", 20040)

	return map[string]any{
		"vcpu":       cpuLimit,
		"memory_mb":  memoryLimit,
		"storage_mb": storageLimit,
	}
}

// SignupBonusCredits returns the signup bonus credits from environment variable
func SignupBonusCredits() int {
	return getEnvInt("SIGNUP_BONUS", 0)
}

// getEnvInt reads an integer from environment variable with a default fallback
func getEnvInt(key string, defaultValue int) int {
	if val := os.Getenv(key); val != "" {
		if intVal, err := strconv.Atoi(val); err == nil {
			return intVal
		}
	}
	return defaultValue
}

type Store struct {
	client      *Client
	users       *mongo.Collection
	orgs        *mongo.Collection
	memberships *mongo.Collection
	orgInvites  *mongo.Collection
	adminAudit  *mongo.Collection
	nodes       *mongo.Collection
}

func NewStoreFromEnv() (*Store, error) {
	client, err := NewClientFromEnv()
	if err != nil {
		return nil, err
	}

	store := &Store{
		client:      client,
		users:       client.Database.Collection("users"),
		orgs:        client.Database.Collection("orgs"),
		memberships: client.Database.Collection("org_memberships"),
		orgInvites:  client.Database.Collection("org_invites"),
		adminAudit:  client.Database.Collection("admin_audit_logs"),
		nodes:       client.Database.Collection("nodes"),
	}

	if err := store.ensureIndexes(); err != nil {
		return nil, err
	}

	return store, nil
}

func (s *Store) ensureIndexes() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err := s.users.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "uuid", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "email", Value: 1}}, Options: options.Index().SetUnique(true)},
	})
	if err != nil {
		return err
	}

	_, err = s.orgs.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "uuid", Value: 1}},
		Options: options.Index().SetUnique(true),
	})
	if err != nil {
		return err
	}

	_, err = s.memberships.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "org_uuid", Value: 1}, {Key: "user_uuid", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "user_uuid", Value: 1}}},
	})
	if err != nil {
		return err
	}

	_, err = s.orgInvites.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "uuid", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "org_uuid", Value: 1}, {Key: "email", Value: 1}, {Key: "status", Value: 1}}},
	})
	return err
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func (s *Store) CreateEmailUser(email, username, password string) (*UserDocument, error) {
	email = normalizeEmail(email)
	username = strings.TrimSpace(username)
	if email == "" || password == "" || username == "" {
		return nil, fmt.Errorf("email, username and password are required")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	user := &UserDocument{
		UUID:         uuid.NewString(),
		Email:        email,
		Username:     username,
		PasswordHash: string(hash),
		CreatedAt:    now,
		LastUpdated:  now,
		Billing:      Billing{Credits: float64(SignupBonusCredits()), Used: 0},
		Instances:    []map[string]any{},
		Workspace:    map[string]any{},
		Audit:        map[string]any{},
		Sessions:     []UserSession{},
		API:          APIConfig{Enabled: false},
		Role:         "free",
		Limits:       DefaultUserLimits(),
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err = s.users.InsertOne(ctx, user)
	if err != nil {
		return nil, err
	}

	_ = s.EnsureDefaultWorkspace(user.UUID, username)

	return user, nil
}

func (s *Store) VerifyEmailUser(email, password string) (*UserDocument, error) {
	email = normalizeEmail(email)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var user UserDocument
	if err := s.users.FindOne(ctx, bson.M{"email": email}).Decode(&user); err != nil {
		return nil, err
	}

	if user.PasswordHash == "" {
		return nil, errors.New("password login unavailable for this account")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, errors.New("invalid credentials")
	}

	_ = s.TouchUser(user.UUID)
	return &user, nil
}

func (s *Store) UpdateUserPassword(userUUID, newPassword string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	_, err = s.users.UpdateOne(
		ctx,
		bson.M{"uuid": userUUID},
		bson.M{
			"$set": bson.M{
				"password_hash": string(hashedPassword),
				"last_updated":  time.Now(),
			},
		},
	)

	if err != nil {
		return err
	}

	return nil
}

func (s *Store) UpdateUsername(userUUID, username string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err := s.users.UpdateOne(
		ctx,
		bson.M{"uuid": userUUID},
		bson.M{
			"$set": bson.M{
				"usrname":      username,
				"last_updated": time.Now(),
			},
		},
	)

	return err
}

func (s *Store) UpsertOAuthUser(provider, providerID, email, username string) (*UserDocument, error) {
	provider = strings.TrimSpace(provider)
	providerID = strings.TrimSpace(providerID)
	if provider == "" {
		return nil, errors.New("provider is required")
	}
	if providerID == "" {
		providerID = uuid.NewString()
	}

	email = normalizeEmail(email)
	if strings.TrimSpace(username) == "" {
		username = provider + "_" + providerID
	}

	fallbackEmail := normalizeEmail(fmt.Sprintf("%s-%s@oauth.local", provider, providerID))
	effectiveEmail := email
	if effectiveEmail == "" {
		effectiveEmail = fallbackEmail
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	providerKey := "provider_ids." + provider
	filter := bson.M{providerKey: providerID}
	if email != "" {
		filter = bson.M{
			"$or": []bson.M{
				{"email": email},
				{providerKey: providerID},
			},
		}
	}

	now := time.Now().UTC()

	// Build $set - always update these fields
	setFields := bson.M{
		"usrname":      username,
		"last_updated": now,
		providerKey:    providerID,
	}
	if email != "" {
		setFields["email"] = email
	}

	// Build $setOnInsert - only set on new document creation
	// Don't include email here if we're setting it in $set to avoid MongoDB conflict
	setOnInsertFields := bson.M{
		"uuid":          uuid.NewString(),
		"created_at":    now,
		"billing":       Billing{Credits: float64(SignupBonusCredits()), Used: 0},
		"instances":     []map[string]any{},
		"workspace":     map[string]any{},
		"audit":         map[string]any{},
		"sessions":      []UserSession{},
		"api":           APIConfig{Enabled: false},
		"role":          "free",
		"limits":        DefaultUserLimits(),
		"password_hash": "",
	}
	// Only set fallback email on insert if no real email provided
	if email == "" {
		setOnInsertFields["email"] = effectiveEmail
	}

	update := bson.M{
		"$set":         setFields,
		"$setOnInsert": setOnInsertFields,
	}

	opts := options.FindOneAndUpdate().SetUpsert(true).SetReturnDocument(options.After)
	var user UserDocument
	if err := s.users.FindOneAndUpdate(ctx, filter, update, opts).Decode(&user); err != nil {
		return nil, err
	}

	_ = s.EnsureDefaultWorkspace(user.UUID, username)

	return &user, nil
}

func (s *Store) EnsureDefaultWorkspace(userUUID, username string) error {
	userUUID = strings.TrimSpace(userUUID)
	if userUUID == "" {
		return errors.New("user uuid is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	count, err := s.memberships.CountDocuments(ctx, bson.M{"user_uuid": userUUID})
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	workspaceOwner := strings.TrimSpace(username)
	if workspaceOwner == "" {
		workspaceOwner = "Default"
	}

	_, err = s.CreateOrganization(userUUID, workspaceOwner+"'s Workspace")
	return err
}

func (s *Store) TouchUser(userUUID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_, err := s.users.UpdateOne(ctx, bson.M{"uuid": userUUID}, bson.M{"$set": bson.M{"last_updated": time.Now().UTC()}})
	return err
}

func (s *Store) GetUserByUUID(userUUID string) (*UserDocument, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var user UserDocument
	if err := s.users.FindOne(ctx, bson.M{"uuid": userUUID}).Decode(&user); err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *Store) AddOrUpdateSession(userUUID, sessionID, provider, userAgent, ipAddress string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	now := time.Now().UTC()
	_, _ = s.users.UpdateOne(ctx,
		bson.M{"uuid": userUUID},
		bson.M{"$pull": bson.M{"sessions": bson.M{"session_id": sessionID}}},
	)

	_, err := s.users.UpdateOne(ctx,
		bson.M{"uuid": userUUID},
		bson.M{
			"$push": bson.M{"sessions": UserSession{
				SessionID:  sessionID,
				Provider:   provider,
				UserAgent:  userAgent,
				IPAddress:  ipAddress,
				LastSeenAt: now,
			}},
			"$set": bson.M{"last_updated": now},
		},
	)
	return err
}

func (s *Store) RemoveSession(userUUID, sessionID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_, err := s.users.UpdateOne(ctx,
		bson.M{"uuid": userUUID},
		bson.M{"$pull": bson.M{"sessions": bson.M{"session_id": sessionID}}},
	)
	return err
}

func IsValidOrgRole(role string) bool {
	return role == RoleOwner || role == RoleAdmin || role == RoleModerator || role == RoleGuest
}

func (s *Store) CreateOrganization(ownerUUID, name string) (*Organization, error) {
	name = strings.TrimSpace(name)
	if ownerUUID == "" || name == "" {
		return nil, errors.New("owner and name are required")
	}

	now := time.Now().UTC()
	org := &Organization{
		UUID:        uuid.NewString(),
		Name:        name,
		CreatedBy:   ownerUUID,
		CreatedAt:   now,
		LastUpdated: now,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if _, err := s.orgs.InsertOne(ctx, org); err != nil {
		return nil, err
	}

	member := OrgMembership{
		OrgUUID:     org.UUID,
		UserUUID:    ownerUUID,
		Role:        RoleOwner,
		JoinedAt:    now,
		LastUpdated: now,
	}
	if _, err := s.memberships.InsertOne(ctx, member); err != nil {
		return nil, err
	}

	return org, nil
}

func (s *Store) ListOrganizationsForUser(userUUID string) ([]Organization, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cursor, err := s.memberships.Find(ctx, bson.M{"user_uuid": userUUID})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	orgIDs := make([]string, 0)
	roleByOrg := make(map[string]string)
	for cursor.Next(ctx) {
		var m OrgMembership
		if err := cursor.Decode(&m); err != nil {
			continue
		}
		orgIDs = append(orgIDs, m.OrgUUID)
		roleByOrg[m.OrgUUID] = m.Role
	}
	if len(orgIDs) == 0 {
		return []Organization{}, nil
	}

	orgCursor, err := s.orgs.Find(ctx, bson.M{"uuid": bson.M{"$in": orgIDs}})
	if err != nil {
		return nil, err
	}
	defer orgCursor.Close(ctx)

	orgs := make([]Organization, 0)
	for orgCursor.Next(ctx) {
		var o Organization
		if err := orgCursor.Decode(&o); err == nil {
			o.Role = roleByOrg[o.UUID]
			o.TenantID = o.UUID
			orgs = append(orgs, o)
		}
	}
	return orgs, nil
}

func (s *Store) GetOrganizationForUser(userUUID, orgUUID string) (*Organization, error) {
	role, err := s.UserRoleInOrg(userUUID, orgUUID)
	if err != nil {
		return nil, errors.New("not a member of organization")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var org Organization
	if err := s.orgs.FindOne(ctx, bson.M{"uuid": orgUUID}).Decode(&org); err != nil {
		return nil, err
	}

	org.Role = role
	org.TenantID = org.UUID
	return &org, nil
}

func (s *Store) UserRoleInOrg(userUUID, orgUUID string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var m OrgMembership
	if err := s.memberships.FindOne(ctx, bson.M{"org_uuid": orgUUID, "user_uuid": userUUID}).Decode(&m); err != nil {
		return "", err
	}
	return m.Role, nil
}

func (s *Store) ListOrgMembers(requesterUUID, orgUUID string) ([]OrgMemberView, error) {
	if strings.TrimSpace(requesterUUID) == "" || strings.TrimSpace(orgUUID) == "" {
		return nil, errors.New("requester and org are required")
	}

	if _, err := s.UserRoleInOrg(requesterUUID, orgUUID); err != nil {
		return nil, errors.New("not a member of organization")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	membersCursor, err := s.memberships.Find(ctx, bson.M{"org_uuid": orgUUID})
	if err != nil {
		return nil, err
	}
	defer membersCursor.Close(ctx)

	userUUIDs := make([]string, 0)
	roleByUser := make(map[string]string)
	joinedByUser := make(map[string]time.Time)

	for membersCursor.Next(ctx) {
		var membership OrgMembership
		if err := membersCursor.Decode(&membership); err != nil {
			continue
		}
		userUUIDs = append(userUUIDs, membership.UserUUID)
		roleByUser[membership.UserUUID] = membership.Role
		joinedByUser[membership.UserUUID] = membership.JoinedAt
	}

	if len(userUUIDs) == 0 {
		return []OrgMemberView{}, nil
	}

	usersCursor, err := s.users.Find(ctx, bson.M{"uuid": bson.M{"$in": userUUIDs}})
	if err != nil {
		return nil, err
	}
	defer usersCursor.Close(ctx)

	members := make([]OrgMemberView, 0, len(userUUIDs))
	for usersCursor.Next(ctx) {
		var user UserDocument
		if err := usersCursor.Decode(&user); err != nil {
			continue
		}

		role, ok := roleByUser[user.UUID]
		if !ok {
			continue
		}

		members = append(members, OrgMemberView{
			UUID:     user.UUID,
			Email:    user.Email,
			Username: user.Username,
			Role:     role,
			JoinedAt: joinedByUser[user.UUID],
		})
	}

	return members, nil
}

func (s *Store) UpdateMemberRole(actorUUID, orgUUID, memberUUID, newRole string) error {
	newRole = strings.TrimSpace(newRole)
	if actorUUID == "" || orgUUID == "" || memberUUID == "" || newRole == "" {
		return errors.New("actor, org, member and role are required")
	}
	if !IsValidOrgRole(newRole) || newRole == RoleOwner {
		return errors.New("invalid target role")
	}

	actorRole, err := s.UserRoleInOrg(actorUUID, orgUUID)
	if err != nil {
		return errors.New("not a member of organization")
	}
	if !canInvite(actorRole) {
		return errors.New("insufficient org permissions")
	}

	targetRole, err := s.UserRoleInOrg(memberUUID, orgUUID)
	if err != nil {
		return errors.New("target member not found")
	}

	if targetRole == RoleOwner {
		return errors.New("owner role cannot be changed")
	}

	if actorRole == RoleAdmin {
		if targetRole == RoleAdmin {
			return errors.New("admins cannot manage other admins")
		}
		if newRole == RoleAdmin {
			return errors.New("admins cannot assign admin role")
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	result, err := s.memberships.UpdateOne(
		ctx,
		bson.M{"org_uuid": orgUUID, "user_uuid": memberUUID},
		bson.M{"$set": bson.M{"role": newRole, "last_updated": time.Now().UTC()}},
	)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return errors.New("target member not found")
	}

	return nil
}

func (s *Store) RemoveMember(actorUUID, orgUUID, memberUUID string) error {
	if actorUUID == "" || orgUUID == "" || memberUUID == "" {
		return errors.New("actor, org and member are required")
	}
	if actorUUID == memberUUID {
		return errors.New("cannot remove yourself")
	}

	actorRole, err := s.UserRoleInOrg(actorUUID, orgUUID)
	if err != nil {
		return errors.New("not a member of organization")
	}
	if !canInvite(actorRole) {
		return errors.New("insufficient org permissions")
	}

	targetRole, err := s.UserRoleInOrg(memberUUID, orgUUID)
	if err != nil {
		return errors.New("target member not found")
	}

	if targetRole == RoleOwner {
		return errors.New("owner cannot be removed")
	}
	if actorRole == RoleAdmin && targetRole == RoleAdmin {
		return errors.New("admins cannot remove other admins")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	result, err := s.memberships.DeleteOne(ctx, bson.M{"org_uuid": orgUUID, "user_uuid": memberUUID})
	if err != nil {
		return err
	}
	if result.DeletedCount == 0 {
		return errors.New("target member not found")
	}

	return nil
}

func canInvite(role string) bool {
	return role == RoleOwner || role == RoleAdmin
}

func (s *Store) CreateInvite(inviterUUID, orgUUID, email, role string) (*OrgInvite, error) {
	email = normalizeEmail(email)
	role = strings.TrimSpace(role)
	if !IsValidOrgRole(role) || role == RoleOwner {
		return nil, errors.New("invalid org role")
	}
	if inviterUUID == "" || orgUUID == "" || email == "" {
		return nil, errors.New("inviter, org and email are required")
	}

	inviterRole, err := s.UserRoleInOrg(inviterUUID, orgUUID)
	if err != nil {
		return nil, err
	}
	if !canInvite(inviterRole) {
		return nil, errors.New("insufficient org permissions")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	now := time.Now().UTC()
	invite := &OrgInvite{
		UUID:      uuid.NewString(),
		OrgUUID:   orgUUID,
		Email:     email,
		Role:      role,
		InvitedBy: inviterUUID,
		Status:    "pending",
		CreatedAt: now,
		ExpiresAt: now.Add(7 * 24 * time.Hour),
	}

	_, err = s.orgInvites.InsertOne(ctx, invite)
	if err != nil {
		return nil, err
	}
	return invite, nil
}

func (s *Store) ListPendingInvitesByEmail(email string) ([]OrgInvite, error) {
	email = normalizeEmail(email)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cursor, err := s.orgInvites.Find(ctx, bson.M{"email": email, "status": "pending", "expires_at": bson.M{"$gt": time.Now().UTC()}})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	invites := make([]OrgInvite, 0)
	orgCache := make(map[string]string) // Cache org names to avoid repeated lookups

	for cursor.Next(ctx) {
		var invite OrgInvite
		if err := cursor.Decode(&invite); err == nil {
			// Fetch org name if not in cache
			if _, exists := orgCache[invite.OrgUUID]; !exists {
				var org Organization
				if err := s.orgs.FindOne(ctx, bson.M{"uuid": invite.OrgUUID}).Decode(&org); err == nil {
					orgCache[invite.OrgUUID] = org.Name
				} else {
					orgCache[invite.OrgUUID] = "Unknown Organization"
				}
			}
			invite.OrgName = orgCache[invite.OrgUUID]
			invites = append(invites, invite)
		}
	}
	return invites, nil
}

func (s *Store) AcceptInvite(inviteUUID, userUUID, email string) error {
	email = normalizeEmail(email)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var invite OrgInvite
	if err := s.orgInvites.FindOne(ctx, bson.M{"uuid": inviteUUID, "status": "pending"}).Decode(&invite); err != nil {
		return err
	}

	if normalizeEmail(invite.Email) != email {
		return errors.New("invite email does not match logged-in user")
	}
	if invite.ExpiresAt.Before(time.Now().UTC()) {
		return errors.New("invite expired")
	}

	now := time.Now().UTC()
	_, err := s.memberships.UpdateOne(
		ctx,
		bson.M{"org_uuid": invite.OrgUUID, "user_uuid": userUUID},
		bson.M{"$set": bson.M{"role": invite.Role, "last_updated": now}, "$setOnInsert": bson.M{"joined_at": now}},
		options.UpdateOne().SetUpsert(true),
	)
	if err != nil {
		return err
	}

	_, err = s.orgInvites.UpdateOne(ctx, bson.M{"uuid": inviteUUID}, bson.M{"$set": bson.M{"status": "accepted", "accepted_at": now}})
	return err
}

// Admin Audit Log Functions

func (s *Store) LogAdminAction(ctx context.Context, adminUUID, adminEmail, action, resource, resourceID string, details map[string]interface{}, ipAddress, userAgent, status, errorMsg string) error {
	log := AdminAuditLog{
		UUID:       uuid.New().String(),
		AdminUUID:  adminUUID,
		AdminEmail: adminEmail,
		Action:     action,
		Resource:   resource,
		ResourceID: resourceID,
		Details:    details,
		IPAddress:  ipAddress,
		UserAgent:  userAgent,
		Status:     status,
		ErrorMsg:   errorMsg,
		Timestamp:  time.Now(),
	}

	_, err := s.adminAudit.InsertOne(ctx, log)
	return err
}

func (s *Store) GetAdminAuditLogs(ctx context.Context, limit int64, skip int64) ([]AdminAuditLog, error) {
	opts := options.Find().
		SetSort(bson.D{{Key: "timestamp", Value: -1}}).
		SetLimit(limit).
		SetSkip(skip)

	cursor, err := s.adminAudit.Find(ctx, bson.M{}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var logs []AdminAuditLog
	if err := cursor.All(ctx, &logs); err != nil {
		return nil, err
	}

	return logs, nil
}

func (s *Store) GetAdminAuditLogsByAdmin(ctx context.Context, adminUUID string, limit int64) ([]AdminAuditLog, error) {
	opts := options.Find().
		SetSort(bson.D{{Key: "timestamp", Value: -1}}).
		SetLimit(limit)

	cursor, err := s.adminAudit.Find(ctx, bson.M{"admin_uuid": adminUUID}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var logs []AdminAuditLog
	if err := cursor.All(ctx, &logs); err != nil {
		return nil, err
	}

	return logs, nil
}

func (s *Store) GetAdminAuditLogsByResource(ctx context.Context, resource, resourceID string, limit int64) ([]AdminAuditLog, error) {
	opts := options.Find().
		SetSort(bson.D{{Key: "timestamp", Value: -1}}).
		SetLimit(limit)

	filter := bson.M{"resource": resource}
	if resourceID != "" {
		filter["resource_id"] = resourceID
	}

	cursor, err := s.adminAudit.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var logs []AdminAuditLog
	if err := cursor.All(ctx, &logs); err != nil {
		return nil, err
	}

	return logs, nil
}

func (s *Store) CountAdminAuditLogs(ctx context.Context) (int64, error) {
	return s.adminAudit.CountDocuments(ctx, bson.M{})
}

func (s *Store) CountUsers(ctx context.Context) (int64, error) {
	return s.users.CountDocuments(ctx, bson.M{})
}

// Admin user management functions

func (s *Store) ListAllUsers(ctx context.Context, limit int64, skip int64) ([]UserDocument, int64, error) {
	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetLimit(limit).
		SetSkip(skip)

	cursor, err := s.users.Find(ctx, bson.M{}, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var users []UserDocument
	if err := cursor.All(ctx, &users); err != nil {
		return nil, 0, err
	}

	total, err := s.users.CountDocuments(ctx, bson.M{})
	if err != nil {
		return nil, 0, err
	}

	return users, total, nil
}

func (s *Store) UpdateUserRole(ctx context.Context, userUUID, role string) error {
	filter := bson.M{"uuid": userUUID}
	update := bson.M{
		"$set": bson.M{
			"role":         role,
			"last_updated": time.Now(),
		},
	}

	result, err := s.users.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return errors.New("user not found")
	}

	return nil
}

func (s *Store) AdminUpdateUserEmail(ctx context.Context, userUUID, newEmail string) error {
	filter := bson.M{"uuid": userUUID}
	update := bson.M{
		"$set": bson.M{
			"email":        newEmail,
			"last_updated": time.Now(),
		},
	}

	result, err := s.users.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return errors.New("user not found")
	}

	return nil
}

func (s *Store) AdminResetUserPassword(ctx context.Context, userUUID, newPassword string) error {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	filter := bson.M{"uuid": userUUID}
	update := bson.M{
		"$set": bson.M{
			"password_hash": string(hashedPassword),
			"last_updated":  time.Now(),
		},
	}

	result, err := s.users.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return errors.New("user not found")
	}

	return nil
}

func (s *Store) ClearUserSessions(ctx context.Context, userUUID string) error {
	filter := bson.M{"uuid": userUUID}
	update := bson.M{
		"$set": bson.M{
			"sessions":     []UserSession{},
			"last_updated": time.Now(),
		},
	}

	result, err := s.users.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return errors.New("user not found")
	}

	return nil
}

func (s *Store) BanUser(ctx context.Context, userUUID string) error {
	// For now, we'll set role to "banned" - you can add a separate banned field if needed
	return s.UpdateUserRole(ctx, userUUID, "banned")
}

func (s *Store) UnbanUser(ctx context.Context, userUUID string) error {
	// Restore to free role
	return s.UpdateUserRole(ctx, userUUID, "free")
}

func (s *Store) UpdateUserLimits(ctx context.Context, userUUID string, limits map[string]any) error {
	filter := bson.M{"uuid": userUUID}
	update := bson.M{
		"$set": bson.M{
			"limits":       limits,
			"last_updated": time.Now().UTC(),
		},
	}

	result, err := s.users.UpdateOne(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("failed to update user limits: %w", err)
	}

	if result.MatchedCount == 0 {
		return errors.New("user not found")
	}

	return nil
}

func (s *Store) UpdateUserCredits(ctx context.Context, userUUID string, credits int) error {
	filter := bson.M{"uuid": userUUID}
	update := bson.M{
		"$set": bson.M{
			"billing.credits": credits,
			"last_updated":    time.Now().UTC(),
		},
	}

	result, err := s.users.UpdateOne(ctx, filter, update)
	if err != nil {
		return fmt.Errorf("failed to update user credits: %w", err)
	}

	if result.MatchedCount == 0 {
		return errors.New("user not found")
	}

	return nil
}

// Session blacklist for invalidated sessions
func (s *Store) BlacklistSession(ctx context.Context, sessionID string, expiresAt time.Time) error {
	blacklist := s.client.Database.Collection("session_blacklist")

	doc := bson.M{
		"session_id": sessionID,
		"expires_at": expiresAt,
		"created_at": time.Now(),
	}

	_, err := blacklist.InsertOne(ctx, doc)
	return err
}

func (s *Store) IsSessionBlacklisted(ctx context.Context, sessionID string) (bool, error) {
	blacklist := s.client.Database.Collection("session_blacklist")

	filter := bson.M{
		"session_id": sessionID,
		"expires_at": bson.M{"$gt": time.Now()},
	}

	count, err := blacklist.CountDocuments(ctx, filter)
	if err != nil {
		return false, err
	}

	return count > 0, nil
}

func (s *Store) BlacklistAllUserSessions(ctx context.Context, userUUID string) error {
	// Get user's current sessions
	user, err := s.GetUserByUUID(userUUID)
	if err != nil {
		return err
	}

	blacklist := s.client.Database.Collection("session_blacklist")
	expiresAt := time.Now().Add(7 * 24 * time.Hour) // Match cookie expiry

	// Blacklist all session IDs
	for _, session := range user.Sessions {
		doc := bson.M{
			"session_id": session.SessionID,
			"expires_at": expiresAt,
			"created_at": time.Now(),
		}
		_, _ = blacklist.InsertOne(ctx, doc)
	}

	// Clear sessions from user document
	return s.ClearUserSessions(ctx, userUUID)
}

// MigrateUserLimits adds default resource limits to all users that don't have them
func (s *Store) MigrateUserLimits(ctx context.Context) (int64, error) {
	defaultLimits := DefaultUserLimits()

	// Find all users with empty limits or missing limits fields
	filter := bson.M{
		"$or": []bson.M{
			{"limits": bson.M{"$exists": false}},
			{"limits": bson.M{}},
		},
	}

	update := bson.M{
		"$set": bson.M{
			"limits":       defaultLimits,
			"last_updated": time.Now().UTC(),
		},
	}

	result, err := s.users.UpdateMany(ctx, filter, update)
	if err != nil {
		return 0, fmt.Errorf("failed to migrate user limits: %w", err)
	}

	return result.ModifiedCount, nil
}

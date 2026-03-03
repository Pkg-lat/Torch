# Torch Panel
A newer way to host servers.

## Authentication Routes

All authentication routes are under `/authenticate` to avoid conflicts with frontend routing:

- `GET /authenticate/providers` - List available auth providers
- `GET /authenticate/{provider}` - Start OAuth flow (discord, github)
- `GET /authenticate/{provider}/callback` - OAuth callback handler
- `GET /authenticate/session` - Get current session
- `POST /authenticate/logout` - Logout
- `POST /authenticate/email/login` - Email login
- `POST /authenticate/email/register` - Email registration

## Organization Routes

- `GET /orgs` - List user's organizations
- `POST /orgs` - Create new organization
- `POST /orgs/{uuid}/invite` - Invite user to organization
- `GET /org-invites` - List pending invites
- `POST /org-invites/{uuid}/accept` - Accept invite

## Configuration

See `.env.example` for required environment variables. Make sure to update OAuth callback URLs in your provider settings (Discord/GitHub) to use `/authenticate/{provider}/callback
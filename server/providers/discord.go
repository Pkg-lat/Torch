package providers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"torch/pkg.lat/types"
)

const (
	discordAuthURL     = "https://discord.com/api/oauth2/authorize"
	discordTokenURL    = "https://discord.com/api/oauth2/token"
	discordUserInfoURL = "https://discord.com/api/users/@me"
)

type DiscordProvider struct {
	config types.ProviderConfig
}

func NewDiscordProvider(config types.ProviderConfig) *DiscordProvider {
	return &DiscordProvider{config: config}
}

func (p *DiscordProvider) Name() string {
	return "discord"
}

func (p *DiscordProvider) AuthURL() string {
	return discordAuthURL
}

func (p *DiscordProvider) TokenURL() string {
	return discordTokenURL
}

func (p *DiscordProvider) UserInfoURL() string {
	return discordUserInfoURL
}

func (p *DiscordProvider) GetAuthURL(state string) string {
	params := url.Values{
		"client_id":     {p.config.ClientID},
		"redirect_uri":  {p.config.CallbackURL},
		"response_type": {"code"},
		"scope":         {"identify email"},
		"state":         {state},
	}
	return fmt.Sprintf("%s?%s", discordAuthURL, params.Encode())
}

func (p *DiscordProvider) ExchangeCode(code string) (*types.TokenResponse, error) {
	data := url.Values{
		"client_id":     {p.config.ClientID},
		"client_secret": {p.config.ClientSecret},
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {p.config.CallbackURL},
	}

	req, err := http.NewRequest("POST", discordTokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("discord token exchange failed: status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var tokenResp types.TokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, err
	}
	if strings.TrimSpace(tokenResp.AccessToken) == "" {
		return nil, fmt.Errorf("discord token exchange returned empty access token")
	}

	return &tokenResp, nil
}

func (p *DiscordProvider) GetUserInfo(accessToken string) (*types.User, error) {
	req, err := http.NewRequest("GET", discordUserInfoURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("discord user info failed: status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var discordUser struct {
		ID       string `json:"id"`
		Email    string `json:"email"`
		Username string `json:"username"`
		Avatar   string `json:"avatar"`
	}
	if err := json.Unmarshal(body, &discordUser); err != nil {
		return nil, err
	}
	if strings.TrimSpace(discordUser.ID) == "" {
		return nil, fmt.Errorf("discord user payload missing id")
	}

	avatarURL := ""
	if discordUser.Avatar != "" {
		avatarURL = fmt.Sprintf("https://cdn.discordapp.com/avatars/%s/%s.png", discordUser.ID, discordUser.Avatar)
	}

	return &types.User{
		ID:        discordUser.ID,
		Email:     discordUser.Email,
		Username:  discordUser.Username,
		AvatarURL: avatarURL,
		Provider:  "discord",
	}, nil
}

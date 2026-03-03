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
	githubAuthURL     = "https://github.com/login/oauth/authorize"
	githubTokenURL    = "https://github.com/login/oauth/access_token"
	githubUserInfoURL = "https://api.github.com/user"
)

type GitHubProvider struct {
	config types.ProviderConfig
}

func NewGitHubProvider(config types.ProviderConfig) *GitHubProvider {
	return &GitHubProvider{config: config}
}

func (p *GitHubProvider) Name() string {
	return "github"
}

func (p *GitHubProvider) AuthURL() string {
	return githubAuthURL
}

func (p *GitHubProvider) TokenURL() string {
	return githubTokenURL
}

func (p *GitHubProvider) UserInfoURL() string {
	return githubUserInfoURL
}

func (p *GitHubProvider) GetAuthURL(state string) string {
	params := url.Values{
		"client_id":    {p.config.ClientID},
		"redirect_uri": {p.config.CallbackURL},
		"scope":        {"user:email"},
		"state":        {state},
	}
	return fmt.Sprintf("%s?%s", githubAuthURL, params.Encode())
}

func (p *GitHubProvider) ExchangeCode(code string) (*types.TokenResponse, error) {
	data := url.Values{
		"client_id":     {p.config.ClientID},
		"client_secret": {p.config.ClientSecret},
		"code":          {code},
	}

	req, err := http.NewRequest("POST", githubTokenURL, strings.NewReader(data.Encode()))
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
		return nil, fmt.Errorf("github token exchange failed: status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var tokenResp types.TokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, err
	}
	if strings.TrimSpace(tokenResp.AccessToken) == "" {
		return nil, fmt.Errorf("github token exchange returned empty access token")
	}

	return &tokenResp, nil
}

func (p *GitHubProvider) GetUserInfo(accessToken string) (*types.User, error) {
	req, err := http.NewRequest("GET", githubUserInfoURL, nil)
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
		return nil, fmt.Errorf("github user info failed: status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var githubUser struct {
		ID        int    `json:"id"`
		Email     string `json:"email"`
		Login     string `json:"login"`
		AvatarURL string `json:"avatar_url"`
	}
	if err := json.Unmarshal(body, &githubUser); err != nil {
		return nil, err
	}
	if githubUser.ID == 0 {
		return nil, fmt.Errorf("github user payload missing id")
	}

	// GitHub might return null email, need to fetch emails separately
	email := githubUser.Email
	if email == "" {
		email, err = p.fetchEmail(accessToken)
		if err != nil {
			email = ""
		}
	}

	return &types.User{
		ID:        fmt.Sprintf("%d", githubUser.ID),
		Email:     email,
		Username:  githubUser.Login,
		AvatarURL: githubUser.AvatarURL,
		Provider:  "github",
	}, nil
}

func (p *GitHubProvider) fetchEmail(accessToken string) (string, error) {
	req, err := http.NewRequest("GET", "https://api.github.com/user/emails", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var emails []struct {
		Email   string `json:"email"`
		Primary bool   `json:"primary"`
	}
	if err := json.Unmarshal(body, &emails); err != nil {
		return "", err
	}

	for _, e := range emails {
		if e.Primary {
			return e.Email, nil
		}
	}
	return "", nil
}

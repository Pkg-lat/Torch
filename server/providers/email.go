package providers

import (
	"torch/pkg.lat/types"
)

// EmailProvider handles email/password authentication
type EmailProvider struct{}

func NewEmailProvider() *EmailProvider {
	return &EmailProvider{}
}

func (p *EmailProvider) Name() string {
	return "email"
}

func (p *EmailProvider) AuthURL() string {
	return ""
}

func (p *EmailProvider) TokenURL() string {
	return ""
}

func (p *EmailProvider) UserInfoURL() string {
	return ""
}

func (p *EmailProvider) GetAuthURL(state string) string {
	return ""
}

func (p *EmailProvider) ExchangeCode(code string) (*types.TokenResponse, error) {
	return nil, nil
}

func (p *EmailProvider) GetUserInfo(accessToken string) (*types.User, error) {
	return nil, nil
}

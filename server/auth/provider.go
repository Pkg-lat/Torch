package auth

import "torch/pkg.lat/types"

// Provider defines the interface for OAuth providers
type Provider interface {
	Name() string
	AuthURL() string
	TokenURL() string
	UserInfoURL() string
	GetAuthURL(state string) string
	ExchangeCode(code string) (*types.TokenResponse, error)
	GetUserInfo(accessToken string) (*types.User, error)
}

// ProviderRegistry holds all registered OAuth providers
type ProviderRegistry struct {
	providers map[string]Provider
}

func NewProviderRegistry() *ProviderRegistry {
	return &ProviderRegistry{
		providers: make(map[string]Provider),
	}
}

func (r *ProviderRegistry) Register(p Provider) {
	r.providers[p.Name()] = p
}

func (r *ProviderRegistry) Get(name string) (Provider, bool) {
	p, ok := r.providers[name]
	return p, ok
}

func (r *ProviderRegistry) List() []Provider {
	providers := []Provider{}
	for _, p := range r.providers {
		providers = append(providers, p)
	}
	return providers
}

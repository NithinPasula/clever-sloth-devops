package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// TokenType distinguishes short-lived access tokens from long-lived refresh
// tokens. A refresh token must NEVER be accepted where an access token is
// required (and vice-versa), so we encode the type inside the token itself.
type TokenType string

const (
	AccessToken  TokenType = "access"
	RefreshToken TokenType = "refresh"
)

const (
	// AccessTokenTTL is short on purpose: if an access token leaks, it expires
	// fast. The client silently refreshes it using the refresh token.
	AccessTokenTTL = 15 * time.Minute
	// RefreshTokenTTL governs how long a user stays logged in without
	// re-entering credentials.
	RefreshTokenTTL = 7 * 24 * time.Hour
)

// Claims is the payload encoded inside every JWT.
type Claims struct {
	UserID uuid.UUID `json:"uid"`
	Email  string    `json:"email"`
	Type   TokenType `json:"type"`
	jwt.RegisteredClaims
}

// GenerateToken signs a new JWT of the given type for the user.
// We use HS256 (HMAC + shared secret) — simple and perfect for a single
// service. (Asymmetric RS256 matters when many services must verify tokens
// without sharing the signing key.)
func GenerateToken(secret string, userID uuid.UUID, email string, tokenType TokenType, ttl time.Duration) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID: userID,
		Email:  email,
		Type:   tokenType,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// ParseToken validates a token's signature and expiry and returns its claims.
func ParseToken(secret, tokenStr string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
		// Guard against the "alg=none" / algorithm-confusion attack by rejecting
		// any signing method that isn't HMAC.
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}

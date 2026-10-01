using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SalonEvents.Api.Data;
using SalonEvents.Api.Models;

namespace SalonEvents.Api.Services;

/// <summary>Configuración de tokens leída del entorno.</summary>
public class JwtOptions
{
    public string Secret { get; set; } = string.Empty;
    public string Issuer { get; set; } = "salonevents";
    public string Audience { get; set; } = "salonevents-app";
    public int AccessTokenMinutes { get; set; } = 15;
    public int RefreshTokenDays { get; set; } = 30;
}

/// <summary>Par de tokens emitido tras login o refresh.</summary>
public record TokenPair(string AccessToken, string RefreshToken, DateTimeOffset AccessExpiresAt);

public interface ITokenService
{
    /// <summary>Emite un access JWT y un refresh token nuevo (persistido como hash).</summary>
    Task<TokenPair> IssueAsync(UserEntity user, CancellationToken ct = default);

    /// <summary>Valida un refresh token; si es válido, lo revoca y emite un par nuevo (rotación). Null si inválido.</summary>
    Task<TokenPair?> RotateAsync(string refreshToken, CancellationToken ct = default);

    /// <summary>Revoca un refresh token concreto (logout). No falla si no existe.</summary>
    Task RevokeAsync(string refreshToken, CancellationToken ct = default);
}

public class TokenService : ITokenService
{
    private readonly AppDbContext _db;
    private readonly JwtOptions _opt;

    public TokenService(AppDbContext db, JwtOptions opt)
    {
        _db = db;
        _opt = opt;
    }

    public async Task<TokenPair> IssueAsync(UserEntity user, CancellationToken ct = default)
    {
        var accessExpires = DateTimeOffset.UtcNow.AddMinutes(_opt.AccessTokenMinutes);
        var access = CreateAccessToken(user, accessExpires);

        var refresh = GenerateOpaqueToken();
        _db.RefreshTokens.Add(new RefreshTokenEntity
        {
            UserId = user.Id,
            TokenHash = HashToken(refresh),
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(_opt.RefreshTokenDays),
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await _db.SaveChangesAsync(ct);

        return new TokenPair(access, refresh, accessExpires);
    }

    public async Task<TokenPair?> RotateAsync(string refreshToken, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(refreshToken)) return null;

        var hash = HashToken(refreshToken);
        var stored = await _db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);

        if (stored is null || stored.RevokedAt is not null || stored.ExpiresAt <= DateTimeOffset.UtcNow)
            return null;

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == stored.UserId, ct);
        if (user is null) return null;

        // Rotación: revoca el actual y emite uno nuevo.
        stored.RevokedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return await IssueAsync(user, ct);
    }

    public async Task RevokeAsync(string refreshToken, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(refreshToken)) return;

        var hash = HashToken(refreshToken);
        var stored = await _db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (stored is not null && stored.RevokedAt is null)
        {
            stored.RevokedAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync(ct);
        }
    }

    private string CreateAccessToken(UserEntity user, DateTimeOffset expires)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_opt.Secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim("role", user.Role),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };

        var token = new JwtSecurityToken(
            issuer: _opt.Issuer,
            audience: _opt.Audience,
            claims: claims,
            expires: expires.UtcDateTime,
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string GenerateOpaqueToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes);
    }

    private static string HashToken(string token)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes);
    }
}

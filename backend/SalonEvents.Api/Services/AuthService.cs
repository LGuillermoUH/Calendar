using Microsoft.EntityFrameworkCore;
using SalonEvents.Api.Data;
using SalonEvents.Api.Models;

namespace SalonEvents.Api.Services;

public interface IAuthService
{
    /// <summary>Verifica credenciales y emite tokens. Null si el correo/contraseña no coinciden.</summary>
    Task<TokenPair?> LoginAsync(string email, string password, CancellationToken ct = default);

    Task<TokenPair?> RefreshAsync(string refreshToken, CancellationToken ct = default);

    Task LogoutAsync(string refreshToken, CancellationToken ct = default);

    /// <summary>Crea un usuario admin. Devuelve false si el correo ya existe.</summary>
    Task<bool> CreateAdminAsync(string email, string password, CancellationToken ct = default);
}

public class AuthService : IAuthService
{
    private readonly AppDbContext _db;
    private readonly IPasswordHasher _hasher;
    private readonly ITokenService _tokens;

    public AuthService(AppDbContext db, IPasswordHasher hasher, ITokenService tokens)
    {
        _db = db;
        _hasher = hasher;
        _tokens = tokens;
    }

    public async Task<TokenPair?> LoginAsync(string email, string password, CancellationToken ct = default)
    {
        var normalized = (email ?? string.Empty).Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == normalized, ct);

        if (user is null || !_hasher.Verify(password ?? string.Empty, user.PasswordHash))
            return null;

        return await _tokens.IssueAsync(user, ct);
    }

    public Task<TokenPair?> RefreshAsync(string refreshToken, CancellationToken ct = default)
        => _tokens.RotateAsync(refreshToken, ct);

    public Task LogoutAsync(string refreshToken, CancellationToken ct = default)
        => _tokens.RevokeAsync(refreshToken, ct);

    public async Task<bool> CreateAdminAsync(string email, string password, CancellationToken ct = default)
    {
        var normalized = (email ?? string.Empty).Trim().ToLowerInvariant();
        if (await _db.Users.AnyAsync(u => u.Email == normalized, ct))
            return false;

        _db.Users.Add(new UserEntity
        {
            Email = normalized,
            PasswordHash = _hasher.Hash(password),
            Role = "admin",
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await _db.SaveChangesAsync(ct);
        return true;
    }
}

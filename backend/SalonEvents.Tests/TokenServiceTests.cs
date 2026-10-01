using Microsoft.EntityFrameworkCore;
using SalonEvents.Api.Data;
using SalonEvents.Api.Models;
using SalonEvents.Api.Services;

namespace SalonEvents.Tests;

public class TokenServiceTests
{
    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static JwtOptions Opt() => new()
    {
        Secret = "test-secret-con-suficiente-longitud-para-hs256-0123456789",
        Issuer = "test",
        Audience = "test-app",
        AccessTokenMinutes = 15,
        RefreshTokenDays = 30,
    };

    private static UserEntity NewUser() => new()
    {
        Id = Guid.NewGuid(),
        Email = "admin@ejemplo.com",
        PasswordHash = "hash",
        Role = "admin",
        CreatedAt = DateTimeOffset.UtcNow,
    };

    [Fact]
    public async Task Issue_ReturnsAccessAndRefresh_AndPersistsHash()
    {
        using var db = NewDb();
        var user = NewUser();
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var svc = new TokenService(db, Opt());
        var pair = await svc.IssueAsync(user);

        Assert.False(string.IsNullOrWhiteSpace(pair.AccessToken));
        Assert.False(string.IsNullOrWhiteSpace(pair.RefreshToken));
        Assert.Equal(1, await db.RefreshTokens.CountAsync());
        // El token en claro NO se guarda: solo su hash.
        Assert.False(await db.RefreshTokens.AnyAsync(t => t.TokenHash == pair.RefreshToken));
    }

    [Fact]
    public async Task Rotate_ValidRefresh_IssuesNew_AndRevokesOld()
    {
        using var db = NewDb();
        var user = NewUser();
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var svc = new TokenService(db, Opt());
        var first = await svc.IssueAsync(user);

        var rotated = await svc.RotateAsync(first.RefreshToken);

        Assert.NotNull(rotated);
        Assert.NotEqual(first.RefreshToken, rotated!.RefreshToken);
        // El primero quedó revocado y el segundo activo.
        Assert.Equal(2, await db.RefreshTokens.CountAsync());
        Assert.Equal(1, await db.RefreshTokens.CountAsync(t => t.RevokedAt != null));
    }

    [Fact]
    public async Task Rotate_UsedRefresh_IsRejectedSecondTime()
    {
        using var db = NewDb();
        var user = NewUser();
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var svc = new TokenService(db, Opt());
        var first = await svc.IssueAsync(user);

        await svc.RotateAsync(first.RefreshToken);              // primera rotación: OK
        var second = await svc.RotateAsync(first.RefreshToken); // reutilizar el viejo: rechazado

        Assert.Null(second);
    }

    [Fact]
    public async Task Rotate_UnknownRefresh_ReturnsNull()
    {
        using var db = NewDb();
        var svc = new TokenService(db, Opt());
        Assert.Null(await svc.RotateAsync("token-inexistente"));
    }

    [Fact]
    public async Task Revoke_MakesRefreshUnusable()
    {
        using var db = NewDb();
        var user = NewUser();
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var svc = new TokenService(db, Opt());
        var pair = await svc.IssueAsync(user);

        await svc.RevokeAsync(pair.RefreshToken);

        Assert.Null(await svc.RotateAsync(pair.RefreshToken));
    }
}

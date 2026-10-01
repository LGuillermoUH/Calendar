using Microsoft.EntityFrameworkCore;
using SalonEvents.Api.Services;

namespace SalonEvents.Api.Data;

/// <summary>
/// Siembra el primer admin desde ADMIN_EMAIL / ADMIN_PASSWORD si no existe.
/// Idempotente: si el correo ya está, no hace nada (no pisa la contraseña).
/// </summary>
public static class AdminSeeder
{
    public static async Task SeedAsync(IServiceProvider services, IConfiguration config, ILogger logger)
    {
        var email = config["ADMIN_EMAIL"]?.Trim();
        var password = config["ADMIN_PASSWORD"];

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            logger.LogInformation("AdminSeeder: sin ADMIN_EMAIL/ADMIN_PASSWORD; se omite el sembrado.");
            return;
        }

        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        if (string.IsNullOrEmpty(db.Database.ProviderName))
            return;

        var normalized = email.ToLowerInvariant();
        var strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            if (await db.Users.AnyAsync(u => u.Email == normalized))
            {
                logger.LogInformation("AdminSeeder: el admin {Email} ya existe; se omite.", normalized);
                return;
            }

            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
            db.Users.Add(new Models.UserEntity
            {
                Email = normalized,
                PasswordHash = hasher.Hash(password),
                Role = "admin",
                CreatedAt = DateTimeOffset.UtcNow,
            });
            await db.SaveChangesAsync();
            logger.LogInformation("AdminSeeder: admin inicial {Email} creado.", normalized);
        });
    }
}

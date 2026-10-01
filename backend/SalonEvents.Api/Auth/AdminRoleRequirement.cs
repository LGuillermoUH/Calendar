using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using SalonEvents.Api.Data;

namespace SalonEvents.Api.Auth;

/// <summary>Exige que el usuario autenticado tenga rol 'admin' en la tabla users.</summary>
public class AdminRoleRequirement : IAuthorizationRequirement { }

public class AdminRoleHandler : AuthorizationHandler<AdminRoleRequirement>
{
    private readonly IServiceScopeFactory _scopeFactory;

    public AdminRoleHandler(IServiceScopeFactory scopeFactory) => _scopeFactory = scopeFactory;

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context, AdminRoleRequirement requirement)
    {
        // El id del usuario viaja en el claim "sub" (NameIdentifier).
        var sub = context.User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? context.User.FindFirstValue("sub");

        if (string.IsNullOrWhiteSpace(sub) || !Guid.TryParse(sub, out var userId))
            return;

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var role = await db.Users
            .Where(u => u.Id == userId)
            .Select(u => u.Role)
            .FirstOrDefaultAsync();

        if (string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase))
            context.Succeed(requirement);
    }
}

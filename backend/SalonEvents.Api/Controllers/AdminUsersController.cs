using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SalonEvents.Api.Services;

namespace SalonEvents.Api.Controllers;

[ApiController]
[Route("api/admin/users")]
[Authorize(Policy = "AdminOnly")]
public class AdminUsersController : ControllerBase
{
    private readonly IAuthService _auth;

    public AdminUsersController(IAuthService auth) => _auth = auth;

    public record CreateAdminRequest(string Email, string Password);

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateAdminRequest req, CancellationToken ct)
    {
        if (req is null || string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "Correo y contraseña son obligatorios." });

        if (req.Password.Length < 8)
            return BadRequest(new { error = "La contraseña debe tener al menos 8 caracteres." });

        var created = await _auth.CreateAdminAsync(req.Email, req.Password, ct);
        if (!created)
            return Conflict(new { error = "Ya existe un usuario con ese correo." });

        return StatusCode(StatusCodes.Status201Created, new { email = req.Email.Trim().ToLowerInvariant() });
    }
}

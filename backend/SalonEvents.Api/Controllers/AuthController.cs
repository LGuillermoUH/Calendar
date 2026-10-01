using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SalonEvents.Api.Services;

namespace SalonEvents.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _auth;

    public AuthController(IAuthService auth) => _auth = auth;

    public record LoginRequest(string Email, string Password);
    public record RefreshRequest(string RefreshToken);
    public record TokenResponse(string AccessToken, string RefreshToken, DateTimeOffset AccessExpiresAt);

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<ActionResult<TokenResponse>> Login([FromBody] LoginRequest req, CancellationToken ct)
    {
        if (req is null || string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "Correo y contraseña son obligatorios." });

        var pair = await _auth.LoginAsync(req.Email, req.Password, ct);
        if (pair is null)
            return Unauthorized(new { error = "Correo o contraseña incorrectos." });

        return Ok(new TokenResponse(pair.AccessToken, pair.RefreshToken, pair.AccessExpiresAt));
    }

    [AllowAnonymous]
    [HttpPost("refresh")]
    public async Task<ActionResult<TokenResponse>> Refresh([FromBody] RefreshRequest req, CancellationToken ct)
    {
        if (req is null || string.IsNullOrWhiteSpace(req.RefreshToken))
            return BadRequest(new { error = "Falta el refresh token." });

        var pair = await _auth.RefreshAsync(req.RefreshToken, ct);
        if (pair is null)
            return Unauthorized(new { error = "Sesión expirada. Inicia sesión de nuevo." });

        return Ok(new TokenResponse(pair.AccessToken, pair.RefreshToken, pair.AccessExpiresAt));
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] RefreshRequest req, CancellationToken ct)
    {
        if (req is not null && !string.IsNullOrWhiteSpace(req.RefreshToken))
            await _auth.LogoutAsync(req.RefreshToken, ct);
        return NoContent();
    }
}

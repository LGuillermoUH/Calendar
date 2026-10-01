using Microsoft.AspNetCore.Mvc;
using SalonEvents.Api.Models;
using SalonEvents.Api.Services;

namespace SalonEvents.Api.Controllers;

/// <summary>Disponibilidad pública del calendario. NO requiere autenticación.</summary>
[ApiController]
[Route("api/availability")]
public class AvailabilityController : ControllerBase
{
    private readonly IEventService _service;

    public AvailabilityController(IEventService service) => _service = service;

    /// <summary>Devuelve, para el mes dado, solo fecha + si está apartado.</summary>
    [HttpGet]
    public async Task<ActionResult<List<AvailabilityDto>>> Get(
        [FromQuery] int year, [FromQuery] int month, CancellationToken ct)
    {
        if (year < 1 || month < 1 || month > 12)
            return BadRequest(new { errors = new[] { "Parámetros de año/mes inválidos." } });

        var result = await _service.GetAvailabilityAsync(year, month, ct);
        return Ok(result);
    }
}

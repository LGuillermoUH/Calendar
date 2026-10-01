using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SalonEvents.Api.Models;
using SalonEvents.Api.Services;

namespace SalonEvents.Api.Controllers;

/// <summary>CRUD de eventos. Requiere un JWT válido y rol admin.</summary>
[ApiController]
[Route("api/events")]
[Authorize(Policy = "AdminOnly")]
public class EventsController : ControllerBase
{
    private readonly IEventService _service;

    public EventsController(IEventService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<List<EventDto>>> GetMonth(
        [FromQuery] int year, [FromQuery] int month, CancellationToken ct)
    {
        if (year < 1 || month < 1 || month > 12)
            return BadRequest(new { errors = new[] { "Parámetros de año/mes inválidos." } });

        return Ok(await _service.GetMonthAsync(year, month, ct));
    }

    [HttpPost]
    public async Task<ActionResult<EventDto>> Create([FromBody] EventInput input, CancellationToken ct)
    {
        var validation = _service.Validate(input);
        if (!validation.IsValid)
            return BadRequest(new { errors = validation.Errors });

        var created = await _service.CreateAsync(input, ct);
        return CreatedAtAction(nameof(GetMonth),
            new { year = created.EventDate.Year, month = created.EventDate.Month }, created);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<EventDto>> Update(Guid id, [FromBody] EventInput input, CancellationToken ct)
    {
        var validation = _service.Validate(input);
        if (!validation.IsValid)
            return BadRequest(new { errors = validation.Errors });

        var updated = await _service.UpdateAsync(id, input, ct);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var deleted = await _service.DeleteAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }
}

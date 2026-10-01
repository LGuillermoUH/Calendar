using SalonEvents.Api.Data;
using SalonEvents.Api.Models;

namespace SalonEvents.Api.Services;

/// <summary>Resultado de validación de un payload de evento.</summary>
public record ValidationResult(bool IsValid, IReadOnlyList<string> Errors)
{
    public static ValidationResult Ok() => new(true, Array.Empty<string>());
    public static ValidationResult Fail(IEnumerable<string> errors) => new(false, errors.ToList());
}

public interface IEventService
{
    ValidationResult Validate(EventInput input);
    Task<List<EventDto>> GetMonthAsync(int year, int month, CancellationToken ct = default);
    Task<List<AvailabilityDto>> GetAvailabilityAsync(int year, int month, CancellationToken ct = default);
    Task<EventDto> CreateAsync(EventInput input, CancellationToken ct = default);
    Task<EventDto?> UpdateAsync(Guid id, EventInput input, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct = default);
}

public class EventService : IEventService
{
    private readonly IEventRepository _repo;

    public EventService(IEventRepository repo) => _repo = repo;

    /// <summary>Reglas de negocio server-side. No depende de la base de datos.</summary>
    public ValidationResult Validate(EventInput input)
    {
        var errors = new List<string>();
        if (input.EventDate is null)
            errors.Add("La fecha del evento es obligatoria.");
        if (string.IsNullOrWhiteSpace(input.PersonName))
            errors.Add("El nombre de la persona es obligatorio.");
        if (input.AmountPaid < 0)
            errors.Add("El monto pagado no puede ser negativo.");
        return errors.Count == 0 ? ValidationResult.Ok() : ValidationResult.Fail(errors);
    }

    public async Task<List<EventDto>> GetMonthAsync(int year, int month, CancellationToken ct = default)
        => (await _repo.GetByMonthAsync(year, month, ct)).Select(ToDto).ToList();

    public Task<List<AvailabilityDto>> GetAvailabilityAsync(int year, int month, CancellationToken ct = default)
        => _repo.GetAvailabilityAsync(year, month, ct);

    public async Task<EventDto> CreateAsync(EventInput input, CancellationToken ct = default)
    {
        var entity = new EventEntity
        {
            Id = Guid.NewGuid(),
            EventDate = input.EventDate!.Value,
            IsReserved = input.IsReserved,
            PersonName = input.PersonName!.Trim(),
            ContactPhone = Trim(input.ContactPhone),
            ContactEmail = Trim(input.ContactEmail),
            AmountPaid = input.AmountPaid,
            Title = Trim(input.Title),
            Notes = Trim(input.Notes),
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };
        var saved = await _repo.AddAsync(entity, ct);
        return ToDto(saved);
    }

    public async Task<EventDto?> UpdateAsync(Guid id, EventInput input, CancellationToken ct = default)
    {
        var existing = await _repo.GetByIdAsync(id, ct);
        if (existing is null) return null;

        existing.EventDate = input.EventDate!.Value;
        existing.IsReserved = input.IsReserved;
        existing.PersonName = input.PersonName!.Trim();
        existing.ContactPhone = Trim(input.ContactPhone);
        existing.ContactEmail = Trim(input.ContactEmail);
        existing.AmountPaid = input.AmountPaid;
        existing.Title = Trim(input.Title);
        existing.Notes = Trim(input.Notes);
        existing.UpdatedAt = DateTimeOffset.UtcNow;

        await _repo.UpdateAsync(existing, ct);
        return ToDto(existing);
    }

    public Task<bool> DeleteAsync(Guid id, CancellationToken ct = default) => _repo.DeleteAsync(id, ct);

    private static string? Trim(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static EventDto ToDto(EventEntity e) => new(
        e.Id, e.EventDate, e.IsReserved, e.PersonName, e.ContactPhone,
        e.ContactEmail, e.AmountPaid, e.Title, e.Notes);
}

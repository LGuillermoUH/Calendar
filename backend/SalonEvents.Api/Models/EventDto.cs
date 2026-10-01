namespace SalonEvents.Api.Models;

/// <summary>Datos completos de un evento devueltos al administrador.</summary>
public record EventDto(
    Guid Id,
    DateOnly EventDate,
    bool IsReserved,
    string PersonName,
    string? ContactPhone,
    string? ContactEmail,
    decimal AmountPaid,
    string? Title,
    string? Notes);

/// <summary>Payload para crear o actualizar un evento.</summary>
public class EventInput
{
    public DateOnly? EventDate { get; set; }
    public bool IsReserved { get; set; }
    public string? PersonName { get; set; }
    public string? ContactPhone { get; set; }
    public string? ContactEmail { get; set; }
    public decimal AmountPaid { get; set; }
    public string? Title { get; set; }
    public string? Notes { get; set; }
}

/// <summary>Disponibilidad pública: solo fecha + si está apartado.</summary>
public record AvailabilityDto(DateOnly Date, bool Reserved);

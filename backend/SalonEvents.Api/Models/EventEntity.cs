using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SalonEvents.Api.Models;

/// <summary>Fila de la tabla `events` en Postgres.</summary>
[Table("events")]
public class EventEntity
{
    [Column("id")]
    public Guid Id { get; set; }

    [Column("event_date")]
    public DateOnly EventDate { get; set; }

    [Column("is_reserved")]
    public bool IsReserved { get; set; }

    [Column("person_name")]
    public string PersonName { get; set; } = string.Empty;

    [Column("contact_phone")]
    public string? ContactPhone { get; set; }

    [Column("contact_email")]
    public string? ContactEmail { get; set; }

    [Column("amount_paid")]
    public decimal AmountPaid { get; set; }

    [Column("title")]
    public string? Title { get; set; }

    [Column("notes")]
    public string? Notes { get; set; }

    [Column("created_at")]
    public DateTimeOffset CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTimeOffset UpdatedAt { get; set; }
}

using System.ComponentModel.DataAnnotations.Schema;

namespace SalonEvents.Api.Models;

/// <summary>Fila de la tabla `users`: usuario del panel con hash de contraseña y rol.</summary>
[Table("users")]
public class UserEntity
{
    [Column("id")]
    public Guid Id { get; set; }

    [Column("email")]
    public string Email { get; set; } = string.Empty;

    [Column("password_hash")]
    public string PasswordHash { get; set; } = string.Empty;

    [Column("role")]
    public string Role { get; set; } = "admin";

    [Column("created_at")]
    public DateTimeOffset CreatedAt { get; set; }
}

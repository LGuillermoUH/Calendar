using System.ComponentModel.DataAnnotations.Schema;

namespace SalonEvents.Api.Models;

/// <summary>Fila de la tabla `refresh_tokens`: hash del refresh token, expiración y revocación (rotación).</summary>
[Table("refresh_tokens")]
public class RefreshTokenEntity
{
    [Column("id")]
    public Guid Id { get; set; }

    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("token_hash")]
    public string TokenHash { get; set; } = string.Empty;

    [Column("expires_at")]
    public DateTimeOffset ExpiresAt { get; set; }

    [Column("revoked_at")]
    public DateTimeOffset? RevokedAt { get; set; }

    [Column("created_at")]
    public DateTimeOffset CreatedAt { get; set; }
}

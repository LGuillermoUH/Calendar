using Microsoft.EntityFrameworkCore;
using SalonEvents.Api.Models;

namespace SalonEvents.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<EventEntity> Events => Set<EventEntity>();
    public DbSet<UserEntity> Users => Set<UserEntity>();
    public DbSet<RefreshTokenEntity> RefreshTokens => Set<RefreshTokenEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var e = modelBuilder.Entity<EventEntity>();
        e.ToTable("events");
        e.HasKey(x => x.Id);
        e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
        e.Property(x => x.AmountPaid).HasColumnType("numeric(10,2)");
        e.HasIndex(x => x.EventDate);

        var u = modelBuilder.Entity<UserEntity>();
        u.ToTable("users");
        u.HasKey(x => x.Id);
        u.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
        u.HasIndex(x => x.Email).IsUnique();

        var r = modelBuilder.Entity<RefreshTokenEntity>();
        r.ToTable("refresh_tokens");
        r.HasKey(x => x.Id);
        r.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
        r.HasIndex(x => x.TokenHash);
        r.HasOne<UserEntity>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

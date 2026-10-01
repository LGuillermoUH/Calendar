using Microsoft.EntityFrameworkCore;
using SalonEvents.Api.Models;

namespace SalonEvents.Api.Data;

public interface IEventRepository
{
    Task<List<EventEntity>> GetByMonthAsync(int year, int month, CancellationToken ct = default);
    Task<List<AvailabilityDto>> GetAvailabilityAsync(int year, int month, CancellationToken ct = default);
    Task<EventEntity?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<EventEntity> AddAsync(EventEntity entity, CancellationToken ct = default);
    Task<bool> UpdateAsync(EventEntity entity, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct = default);
}

public class EventRepository : IEventRepository
{
    private readonly AppDbContext _db;

    public EventRepository(AppDbContext db) => _db = db;

    private static (DateOnly start, DateOnly endExclusive) MonthRange(int year, int month)
    {
        var start = new DateOnly(year, month, 1);
        return (start, start.AddMonths(1));
    }

    public async Task<List<EventEntity>> GetByMonthAsync(int year, int month, CancellationToken ct = default)
    {
        var (start, end) = MonthRange(year, month);
        return await _db.Events
            .Where(e => e.EventDate >= start && e.EventDate < end)
            .OrderBy(e => e.EventDate)
            .ToListAsync(ct);
    }

    public async Task<List<AvailabilityDto>> GetAvailabilityAsync(int year, int month, CancellationToken ct = default)
    {
        var (start, end) = MonthRange(year, month);
        // Se agrupa y agrega en SQL con un tipo anónimo (traducible por EF/Npgsql),
        // luego se materializa al DTO en memoria. Proyectar directo al record con
        // constructor + Any() no lo traduce EF Core.
        var rows = await _db.Events
            .Where(e => e.EventDate >= start && e.EventDate < end)
            .GroupBy(e => e.EventDate)
            .Select(g => new { Date = g.Key, Reserved = g.Max(x => x.IsReserved ? 1 : 0) })
            .OrderBy(x => x.Date)
            .ToListAsync(ct);

        return rows
            .Select(x => new AvailabilityDto(x.Date, x.Reserved == 1))
            .ToList();
    }

    public Task<EventEntity?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => _db.Events.FirstOrDefaultAsync(e => e.Id == id, ct);

    public async Task<EventEntity> AddAsync(EventEntity entity, CancellationToken ct = default)
    {
        _db.Events.Add(entity);
        await _db.SaveChangesAsync(ct);
        return entity;
    }

    public async Task<bool> UpdateAsync(EventEntity entity, CancellationToken ct = default)
    {
        _db.Events.Update(entity);
        var rows = await _db.SaveChangesAsync(ct);
        return rows > 0;
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var existing = await _db.Events.FirstOrDefaultAsync(e => e.Id == id, ct);
        if (existing is null) return false;
        _db.Events.Remove(existing);
        await _db.SaveChangesAsync(ct);
        return true;
    }
}

using SalonEvents.Api.Data;
using SalonEvents.Api.Models;
using SalonEvents.Api.Services;

namespace SalonEvents.Tests;

/// <summary>Repositorio en memoria para probar el servicio sin base de datos.</summary>
internal class FakeEventRepository : IEventRepository
{
    public readonly List<EventEntity> Store = new();

    public Task<List<EventEntity>> GetByMonthAsync(int year, int month, CancellationToken ct = default)
    {
        var start = new DateOnly(year, month, 1);
        var end = start.AddMonths(1);
        return Task.FromResult(Store.Where(e => e.EventDate >= start && e.EventDate < end)
            .OrderBy(e => e.EventDate).ToList());
    }

    public Task<List<AvailabilityDto>> GetAvailabilityAsync(int year, int month, CancellationToken ct = default)
    {
        var start = new DateOnly(year, month, 1);
        var end = start.AddMonths(1);
        var result = Store.Where(e => e.EventDate >= start && e.EventDate < end)
            .GroupBy(e => e.EventDate)
            .Select(g => new AvailabilityDto(g.Key, g.Any(x => x.IsReserved)))
            .OrderBy(a => a.Date).ToList();
        return Task.FromResult(result);
    }

    public Task<EventEntity?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => Task.FromResult(Store.FirstOrDefault(e => e.Id == id));

    public Task<EventEntity> AddAsync(EventEntity entity, CancellationToken ct = default)
    {
        Store.Add(entity);
        return Task.FromResult(entity);
    }

    public Task<bool> UpdateAsync(EventEntity entity, CancellationToken ct = default) => Task.FromResult(true);

    public Task<bool> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var e = Store.FirstOrDefault(x => x.Id == id);
        if (e is null) return Task.FromResult(false);
        Store.Remove(e);
        return Task.FromResult(true);
    }
}

public class EventServiceTests
{
    private static EventService NewService(FakeEventRepository? repo = null)
        => new(repo ?? new FakeEventRepository());

    [Fact]
    public void Validate_MissingDate_Fails()
    {
        var svc = NewService();
        var result = svc.Validate(new EventInput { EventDate = null, PersonName = "Ana", AmountPaid = 0 });
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.Contains("fecha", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Validate_MissingPerson_Fails()
    {
        var svc = NewService();
        var result = svc.Validate(new EventInput
        {
            EventDate = new DateOnly(2026, 9, 26),
            PersonName = "   ",
            AmountPaid = 0
        });
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.Contains("persona", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Validate_NegativeAmount_Fails()
    {
        var svc = NewService();
        var result = svc.Validate(new EventInput
        {
            EventDate = new DateOnly(2026, 9, 26),
            PersonName = "Ana",
            AmountPaid = -1m
        });
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.Contains("negativo", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Validate_ValidInput_Passes()
    {
        var svc = NewService();
        var result = svc.Validate(new EventInput
        {
            EventDate = new DateOnly(2026, 9, 26),
            PersonName = "Ana",
            AmountPaid = 1500.50m
        });
        Assert.True(result.IsValid);
        Assert.Empty(result.Errors);
    }

    [Fact]
    public async Task Create_TrimsAndPersists()
    {
        var repo = new FakeEventRepository();
        var svc = NewService(repo);
        var dto = await svc.CreateAsync(new EventInput
        {
            EventDate = new DateOnly(2026, 9, 26),
            PersonName = "  Ana  ",
            IsReserved = true,
            AmountPaid = 200m
        });
        Assert.Equal("Ana", dto.PersonName);
        Assert.Single(repo.Store);
        Assert.True(repo.Store[0].IsReserved);
    }

    [Fact]
    public async Task GetAvailability_AggregatesReservedByDay()
    {
        var repo = new FakeEventRepository();
        var svc = NewService(repo);
        var day = new DateOnly(2026, 9, 10);

        // Dos eventos el mismo día: uno no reservado, otro reservado -> el día queda reservado.
        await svc.CreateAsync(new EventInput { EventDate = day, PersonName = "A", IsReserved = false, AmountPaid = 0 });
        await svc.CreateAsync(new EventInput { EventDate = day, PersonName = "B", IsReserved = true, AmountPaid = 0 });
        // Un día distinto, no reservado.
        await svc.CreateAsync(new EventInput { EventDate = new DateOnly(2026, 9, 11), PersonName = "C", IsReserved = false, AmountPaid = 0 });

        var availability = await svc.GetAvailabilityAsync(2026, 9);

        Assert.Equal(2, availability.Count);
        Assert.True(availability.Single(a => a.Date == day).Reserved);
        Assert.False(availability.Single(a => a.Date == new DateOnly(2026, 9, 11)).Reserved);
    }

    [Fact]
    public async Task GetAvailability_ExcludesOtherMonths()
    {
        var repo = new FakeEventRepository();
        var svc = NewService(repo);
        await svc.CreateAsync(new EventInput { EventDate = new DateOnly(2026, 8, 31), PersonName = "A", AmountPaid = 0 });
        await svc.CreateAsync(new EventInput { EventDate = new DateOnly(2026, 9, 1), PersonName = "B", AmountPaid = 0 });

        var september = await svc.GetAvailabilityAsync(2026, 9);

        Assert.Single(september);
        Assert.Equal(new DateOnly(2026, 9, 1), september[0].Date);
    }
}

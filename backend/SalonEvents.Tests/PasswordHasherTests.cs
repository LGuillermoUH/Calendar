using SalonEvents.Api.Services;

namespace SalonEvents.Tests;

public class PasswordHasherTests
{
    private readonly PasswordHasher _hasher = new();

    [Fact]
    public void Hash_ProducesVerifiableHash()
    {
        var hash = _hasher.Hash("secreto123");
        Assert.NotEqual("secreto123", hash);
        Assert.True(_hasher.Verify("secreto123", hash));
    }

    [Fact]
    public void Verify_WrongPassword_Fails()
    {
        var hash = _hasher.Hash("secreto123");
        Assert.False(_hasher.Verify("otra", hash));
    }

    [Fact]
    public void Verify_MalformedHash_ReturnsFalse()
    {
        Assert.False(_hasher.Verify("secreto123", "no-es-un-hash"));
    }

    [Fact]
    public void Hash_IsSaltedPerCall()
    {
        var a = _hasher.Hash("misma");
        var b = _hasher.Hash("misma");
        Assert.NotEqual(a, b); // salt distinto
        Assert.True(_hasher.Verify("misma", a));
        Assert.True(_hasher.Verify("misma", b));
    }
}

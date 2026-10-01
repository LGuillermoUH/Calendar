namespace SalonEvents.Api;

/// <summary>
/// Cargador simple de archivos .env (KEY=VALUE por línea). Vuelca las claves en
/// variables de entorno del proceso SIN pisar las ya definidas, de modo que el
/// entorno real (Docker, Aspire, la shell) siempre tiene prioridad.
/// </summary>
public static class DotEnv
{
    public static void Load(string contentRootPath)
    {
        foreach (var path in CandidatePaths(contentRootPath))
        {
            if (File.Exists(path))
            {
                LoadFile(path);
                return; // usa el primer .env que encuentre
            }
        }
    }

    private static IEnumerable<string> CandidatePaths(string contentRoot)
    {
        // 1) junto al proyecto / content root (p. ej. backend/SalonEvents.Api/.env)
        yield return Path.Combine(contentRoot, ".env");

        // 2) directorio padre (backend/.env cuando el content root es SalonEvents.Api/)
        var parent = Directory.GetParent(contentRoot)?.FullName;
        if (parent is not null)
            yield return Path.Combine(parent, ".env");

        // 3) directorio de trabajo actual
        yield return Path.Combine(Directory.GetCurrentDirectory(), ".env");
    }

    private static void LoadFile(string path)
    {
        foreach (var raw in File.ReadAllLines(path))
        {
            var line = raw.Trim();
            if (line.Length == 0 || line.StartsWith('#')) continue;

            var idx = line.IndexOf('=');
            if (idx <= 0) continue;

            var key = line[..idx].Trim();
            var value = line[(idx + 1)..].Trim();

            // Quita comillas envolventes si las hay.
            if (value.Length >= 2 &&
                ((value[0] == '"' && value[^1] == '"') || (value[0] == '\'' && value[^1] == '\'')))
            {
                value = value[1..^1];
            }

            // No pisar lo ya definido en el entorno real.
            if (Environment.GetEnvironmentVariable(key) is null)
                Environment.SetEnvironmentVariable(key, value);
        }
    }
}

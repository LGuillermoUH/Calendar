using Microsoft.EntityFrameworkCore;

namespace SalonEvents.Api.Data;

/// <summary>
/// Ejecuta el esquema SQL idempotente (backend/db/schema.sql) al arrancar,
/// creando tablas, triggers y RLS si no existen. Seguro de correr en cada inicio:
/// el script usa `create table if not exists`, `create or replace`, etc.
/// </summary>
public static class DbInitializer
{
    public static async Task InitializeAsync(IServiceProvider services, ILogger logger)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Sin cadena de conexión configurada no se registró ningún proveedor.
        // ProviderName es null en ese caso (a diferencia de IsRelational(), que lanza).
        if (string.IsNullOrEmpty(db.Database.ProviderName))
        {
            logger.LogWarning("DbInitializer: no hay proveedor de base de datos configurado (¿falta DATABASE_URL?); se omite.");
            return;
        }

        var schemaPath = Path.Combine(AppContext.BaseDirectory, "db", "schema.sql");
        if (!File.Exists(schemaPath))
        {
            logger.LogWarning("DbInitializer: no se encontró el esquema en {Path}; se omite.", schemaPath);
            return;
        }

        string sql;
        try
        {
            sql = await File.ReadAllTextAsync(schemaPath);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "DbInitializer: no se pudo leer el esquema SQL.");
            return;
        }

        try
        {
            // Con EnableRetryOnFailure hay que ejecutar dentro de la estrategia de
            // reintentos; así los fallos transitorios (timeouts del pooler) se reintentan.
            var strategy = db.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                await db.Database.ExecuteSqlRawAsync(sql);
            });
            logger.LogInformation("DbInitializer: esquema aplicado correctamente.");
        }
        catch (Exception ex)
        {
            // Fail-fast: si el esquema no se puede aplicar, abortar el arranque UNA sola
            // vez (se relanza). No hay reintentos infinitos ni bucle: un fallo = una salida.
            logger.LogCritical(ex, "DbInitializer: falló la aplicación del esquema SQL. Abortando el arranque.");
            throw;
        }
    }
}

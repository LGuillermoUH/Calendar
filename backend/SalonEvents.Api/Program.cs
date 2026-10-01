using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SalonEvents.Api;
using SalonEvents.Api.Auth;
using SalonEvents.Api.Data;
using SalonEvents.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Carga un archivo .env (KEY=VALUE por línea) en variables de entorno del proceso,
// buscándolo en el directorio actual, la raíz del backend y junto al proyecto.
// No pisa variables ya definidas (Docker/Aspire tienen prioridad).
DotEnv.Load(builder.Environment.ContentRootPath);

builder.Configuration.AddEnvironmentVariables();

// --- Configuración desde entorno ---
// Prioridad de la cadena de conexión:
//   1) ConnectionStrings:db  -> la INYECTA Aspire vía WithReference(db). Cuando
//      corres con el AppHost, el backend se conecta DIRECTO a la base que Aspire
//      orquesta (contenedor + credenciales gestionadas por Aspire).
//   2) DATABASE_URL          -> fallback para el backend suelto o Docker Compose,
//      donde no hay AppHost que inyecte la conexión.
var databaseUrl = builder.Configuration.GetConnectionString("db")
                  ?? builder.Configuration["DATABASE_URL"];

var jwtSecret = builder.Configuration["JWT_SECRET"];
var jwtIssuer = builder.Configuration["JWT_ISSUER"] ?? "salonevents";
var jwtAudience = builder.Configuration["JWT_AUDIENCE"] ?? "salonevents-app";
var frontendOrigin = builder.Configuration["FRONTEND_ORIGIN"] ?? "http://localhost:5173";

if (string.IsNullOrWhiteSpace(jwtSecret))
    throw new InvalidOperationException("Falta JWT_SECRET: define un secreto para firmar los tokens.");

// --- Opciones de tokens ---
var jwtOptions = new JwtOptions
{
    Secret = jwtSecret,
    Issuer = jwtIssuer,
    Audience = jwtAudience,
    AccessTokenMinutes = 15,
    RefreshTokenDays = 30,
};
builder.Services.AddSingleton(jwtOptions);

// --- Base de datos (EF Core + Npgsql) ---
builder.Services.AddDbContext<AppDbContext>(opt =>
{
    if (!string.IsNullOrWhiteSpace(databaseUrl))
        opt.UseNpgsql(databaseUrl, npgsql =>
        {
            npgsql.EnableRetryOnFailure(
                maxRetryCount: 5,
                maxRetryDelay: TimeSpan.FromSeconds(3),
                errorCodesToAdd: null);
            npgsql.CommandTimeout(60);
        });
});

builder.Services.AddScoped<IEventRepository, EventRepository>();
builder.Services.AddScoped<IEventService, EventService>();
builder.Services.AddSingleton<IPasswordHasher, PasswordHasher>();
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<IAuthService, AuthService>();

// --- CORS para el frontend ---
const string CorsPolicy = "frontend";
builder.Services.AddCors(o => o.AddPolicy(CorsPolicy, p => p
    .WithOrigins(frontendOrigin)
    .AllowAnyHeader()
    .AllowAnyMethod()));

// --- Autenticación: JWT propio (HS256), validado localmente ---
var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret));
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false; // tokens firmados localmente, sin metadata externa
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = signingKey,
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudiences = new[] { jwtAudience },
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1),
        };
    });

// --- Autorización: solo usuarios con rol 'admin' en la tabla users ---
builder.Services.AddScoped<IAuthorizationHandler, AdminRoleHandler>();
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.Requirements.Add(new AdminRoleRequirement());
    });
});

builder.Services.AddControllers();

var app = builder.Build();

// Crea tablas/triggers/índices si no existen, ejecutando el schema.sql idempotente.
await DbInitializer.InitializeAsync(app.Services, app.Logger);
// Siembra el primer admin desde ADMIN_EMAIL / ADMIN_PASSWORD (idempotente).
await AdminSeeder.SeedAsync(app.Services, app.Configuration, app.Logger);

// --- Manejo de errores JSON consistente ---
app.UseExceptionHandler(handler => handler.Run(async context =>
{
    var feature = context.Features.Get<IExceptionHandlerFeature>();
    var error = feature?.Error;

    var isDbError = error is Npgsql.NpgsqlException
                    || error is Microsoft.EntityFrameworkCore.DbUpdateException
                    || error?.InnerException is Npgsql.NpgsqlException;

    context.Response.StatusCode = isDbError
        ? StatusCodes.Status503ServiceUnavailable
        : StatusCodes.Status500InternalServerError;
    context.Response.ContentType = "application/json";
    app.Logger.LogError(error, "Error no controlado ({Kind})", isDbError ? "DB" : "General");

    await context.Response.WriteAsJsonAsync(new
    {
        error = isDbError
            ? "La base de datos no está disponible en este momento."
            : "Ocurrió un error interno."
    });
}));

app.UseCors(CorsPolicy);
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

// Devuelve el rol del usuario autenticado para que el frontend sepa si es admin.
app.MapGet("/api/me", async (System.Security.Claims.ClaimsPrincipal user, AppDbContext db) =>
{
    var sub = user.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
              ?? user.FindFirst("sub")?.Value;

    if (string.IsNullOrWhiteSpace(sub) || !Guid.TryParse(sub, out var userId))
        return Results.Unauthorized();

    var role = await db.Users
        .Where(u => u.Id == userId)
        .Select(u => u.Role)
        .FirstOrDefaultAsync() ?? "viewer";

    return Results.Ok(new { role, isAdmin = string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase) });
}).RequireAuthorization();

app.Run();

// Necesario para las pruebas de integración con WebApplicationFactory.
public partial class Program { }

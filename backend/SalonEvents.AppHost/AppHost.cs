var builder = DistributedApplication.CreateBuilder(args);

// Postgres orquestado por Aspire (contenedor local con volumen de datos persistente).
var postgres = builder.AddPostgres("postgres")
    .WithDataVolume("salonevents-pgdata");

var db = postgres.AddDatabase("db", "salonevents");

// El backend recibe la cadena de conexión de "db" como ConnectionStrings:db
// (Program.cs la lee con GetConnectionString("db") como fallback de DATABASE_URL).
var backend = builder.AddProject<Projects.SalonEvents_Api>("backend")
    .WithReference(db)
    .WaitFor(db);

// Frontend Vite (React) orquestado por Aspire en desarrollo.
//
// El paquete oficial Aspire.Hosting.NodeJs no publica una versión alineada al
// esquema 13.x (se detuvo en 9.x) y el CommunityToolkit para 13.x sigue en
// prerelease, así que lanzamos el dev server con AddExecutable, que es API core
// del AppHost y no añade dependencias nuevas.
//
// - En Windows el ejecutable es "npm.cmd"; en el resto, "npm".
// - VITE_API_URL se toma del endpoint HTTP del backend que resuelve Aspire, con
//   fallback en api.js a http://localhost:5080 fuera de Aspire.
var npm = OperatingSystem.IsWindows() ? "npm.cmd" : "npm";

builder.AddExecutable("frontend", npm, "../../frontend", "run", "dev")
    .WithHttpEndpoint(env: "PORT", port: 5173, isProxied: false)
    .WithEnvironment("VITE_API_URL", backend.GetEndpoint("http"))
    .WithReference(backend)
    .WaitFor(backend)
    .WithExternalHttpEndpoints();

builder.Build().Run();

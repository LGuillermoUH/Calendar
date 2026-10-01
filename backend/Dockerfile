# syntax=docker/dockerfile:1

# --- build ---
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY nuget.config ./
COPY SalonEvents.Api/SalonEvents.Api.csproj SalonEvents.Api/
RUN dotnet restore SalonEvents.Api/SalonEvents.Api.csproj
COPY SalonEvents.Api/ SalonEvents.Api/
# El esquema SQL vive en backend/db/ y el .csproj lo enlaza como Content (..\db\schema.sql).
COPY db/ db/
RUN dotnet publish SalonEvents.Api/SalonEvents.Api.csproj -c Release -o /app --no-restore

# --- runtime ---
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app .
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "SalonEvents.Api.dll"]

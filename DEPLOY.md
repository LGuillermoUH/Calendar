# Despliegue en un VPS Linux propio

> **¿Publicas imágenes en Docker Hub y usas Traefik?** Ese flujo (recomendado)
> vive ahora en [DEPLOY-TRAEFIK.md](DEPLOY-TRAEFIK.md): construyes/publicas las
> imágenes en tu máquina y el VPS solo hace `pull`, enrutado por Traefik con TLS.
> Este documento (build en el VPS, HTTPS con Caddy) queda como alternativa/referencia.

Guía para desplegar el stack (Postgres + backend .NET + frontend) con Docker Compose en tu VPS. Comandos pensados para Debian/Ubuntu; adáptalos a tu distro.

> **Producción = Docker Compose.** El flujo de este documento (Compose en el
> VPS) es la vía de despliegue. Aspire se usa **solo en desarrollo local**
> (siguiente sección) para levantar los tres recursos con un comando.

---

## 0. Desarrollo local con Aspire

En tu máquina, el AppHost de Aspire orquesta Postgres, el backend y el frontend
(Vite) juntos:

```bash
cd backend/SalonEvents.AppHost
aspire run
```

Esto levanta:

- **postgres** — contenedor con volumen `salonevents-pgdata`.
- **backend** — `SalonEvents.Api`, con la cadena de conexión de `db` inyectada.
- **frontend** — `npm run dev` (Vite) en el puerto 5173, con `VITE_API_URL`
  apuntando al endpoint del backend que resuelve Aspire (no hay URL
  hardcodeada; fuera de Aspire, `api.js` usa `http://localhost:5080`).

Requisitos: .NET 10 SDK, Aspire CLI, Node 20+ y `npm install` hecho una vez en
`frontend/`. Los tres recursos aparecen en el dashboard de Aspire con sus
endpoints. Aspire **no** se usa para producción: para el VPS sigue con Docker
Compose más abajo.

---

## 1. Requisitos del VPS

Instala Docker y el plugin de Docker Compose:

```bash
# Docker (script oficial)
curl -fsSL https://get.docker.com | sh

# Que tu usuario pueda usar docker sin sudo (re-inicia sesión después)
sudo usermod -aG docker $USER

# Verifica
docker --version
docker compose version
```

## 2. Subir el código

Con git (recomendado):

```bash
git clone <URL_DE_TU_REPO> salon-eventos
cd salon-eventos
```

O con scp desde tu máquina (excluye node_modules/bin/obj):

```bash
scp -r ./Calendar usuario@TU_VPS:/home/usuario/salon-eventos
```

## 3. Configurar `.env`

```bash
cp .env.example .env
nano .env
```

Rellena, como mínimo:

- `POSTGRES_PASSWORD` — una contraseña fuerte para la base de datos.
- `DATABASE_URL` — usa el **mismo** usuario/contraseña/base y `Host=db`:
  `Host=db;Port=5432;Database=salonevents;Username=salon;Password=LA_MISMA_CONTRASEÑA`
- `JWT_SECRET` — genera uno:
  ```bash
  openssl rand -base64 48
  ```
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — credenciales del primer administrador.
- `FRONTEND_ORIGIN` — la URL pública desde la que se sirve el frontend, p. ej. `http://TU_VPS_IP:8080` o `https://tudominio.com`.
- `VITE_API_URL` — la URL pública del backend, p. ej. `http://TU_VPS_IP:5080`.

> `VITE_API_URL` se **hornea en el build** del frontend. Si la cambias, reconstruye (`docker compose up -d --build frontend`).

## 4. Levantar el stack

```bash
docker compose up -d --build
```

Comprueba que arrancó:

```bash
docker compose ps
curl http://localhost:5080/health          # {"status":"ok"}
```

El backend, al arrancar: espera a que `db` esté sana, aplica `schema.sql` y **siembra el primer admin** desde `ADMIN_EMAIL`/`ADMIN_PASSWORD`. Inicia sesión en el frontend con esas credenciales.

Crear administradores adicionales (con el token de un admin ya logueado):

```bash
curl -X POST http://localhost:5080/api/admin/users \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"email":"otro@ejemplo.com","password":"ContraseñaFuerte123"}'
```

## 5. Migrar los datos existentes desde Supabase

Solo se migran los **eventos** (`events`). Los usuarios **no** se migran: se usa el admin sembrado (el esquema de contraseñas cambió por completo).

**a)** Exporta la tabla `events` desde Supabase. En el SQL Editor de Supabase o con `psql` contra tu proyecto:

```bash
# Desde tu máquina, con la cadena de conexión de Supabase:
pg_dump "postgresql://postgres:<PASSWORD>@db.<proyecto>.supabase.co:5432/postgres" \
  --table=public.events --data-only --column-inserts > events.sql
```

**b)** Copia `events.sql` al VPS e impórtalo en el contenedor `db`:

```bash
# copia al VPS
scp events.sql usuario@TU_VPS:/home/usuario/salon-eventos/

# importa dentro del contenedor
docker compose exec -T db psql -U salon -d salonevents < events.sql
```

Verifica:

```bash
docker compose exec db psql -U salon -d salonevents -c "select count(*) from events;"
```

## 6. Backup y restauración

**Backup lógico** (recomendado, portátil):

```bash
docker compose exec db pg_dump -U salon -d salonevents > backup_$(date +%F).sql
```

**Restaurar**:

```bash
docker compose exec -T db psql -U salon -d salonevents < backup_2026-09-27.sql
```

**Backup del volumen** (copia física de los datos):

```bash
docker run --rm -v salon-eventos_db_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/db_data_$(date +%F).tar.gz -C /data .
```

> El nombre del volumen es `<carpeta>_db_data` (Compose lo prefija con el nombre del proyecto). Compruébalo con `docker volume ls`.

Automatiza el backup con cron (diario a las 3:00):

```bash
(crontab -l 2>/dev/null; echo "0 3 * * * cd /home/usuario/salon-eventos && docker compose exec -T db pg_dump -U salon -d salonevents > backups/backup_\$(date +\%F).sql") | crontab -
```

## 7. Actualizar la aplicación

```bash
cd /home/usuario/salon-eventos
git pull
docker compose up -d --build
```

El esquema es idempotente y el admin no se re-crea, así que actualizar es seguro.

## 8. (Opcional) HTTPS con reverse-proxy

Para servir con TLS y un dominio, pon un reverse-proxy delante (Caddy es el más simple):

```
# Caddyfile
tudominio.com {
    reverse_proxy localhost:8080
}
api.tudominio.com {
    reverse_proxy localhost:5080
}
```

Ajusta entonces `FRONTEND_ORIGIN` y `VITE_API_URL` a las URLs `https://…` y reconstruye el frontend.

---

## Resumen de comandos

| Acción | Comando |
|--------|---------|
| Levantar | `docker compose up -d --build` |
| Estado | `docker compose ps` |
| Logs | `docker compose logs -f backend` |
| Parar | `docker compose down` |
| Backup | `docker compose exec db pg_dump -U salon -d salonevents > backup.sql` |
| Actualizar | `git pull && docker compose up -d --build` |

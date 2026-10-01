# Despliegue con imágenes publicadas (Docker Hub) + Traefik

Esta guía sustituye el build-en-el-VPS y la sección Caddy de [DEPLOY.md](DEPLOY.md).
Ahora **construyes las imágenes en tu máquina, las publicas en Docker Hub** y el
VPS solo las **descarga** y las enruta con el **Traefik que ya tienes corriendo**.

**Modelo de un solo dominio (proxy `/api`):**

- `frontend` → `https://tudominio.com` (lo enruta Traefik con TLS).
- Las llamadas a `/api` y `/health` las **proxea nginx** (dentro del frontend)
  al `backend` por la red interna de Docker. El navegador solo habla con
  `tudominio.com`, así que **no hay CORS ni un segundo dominio de API**.
- `backend` y `db` quedan **internos**, sin exponerse al exterior.

> El frontend usa **rutas relativas** (`/api/...`), de modo que la imagen es
> genérica: **no** se hornea ninguna URL de API y no hay que reconstruirla si
> cambias de dominio.

---

## 1. Prerrequisitos

**En tu máquina (Windows):**
- Docker Desktop.
- Una cuenta de Docker Hub y un **token de acceso** (Account Settings → Security
  → New Access Token). Se usa en `docker login` en lugar de la contraseña.

**En el VPS:**
- Docker + Traefik ya corriendo como reverse-proxy, con:
  - un **entrypoint** `websecure` (puerto 443),
  - un **certresolver** de Let's Encrypt,
  - una **red Docker externa** a la que Traefik está conectado.
- Un **único dominio** `tudominio.com` con registro DNS (A/AAAA) apuntando a la
  IP del VPS.

### Confirmar el nombre de la red externa y el certresolver

En el VPS:

```bash
# Nombre de la red externa de Traefik (la que comparten los servicios enrutados)
docker network ls

# Revisa la config de tu Traefik para el nombre del certresolver
# (busca 'certificatesresolvers.<nombre>.acme' en tu traefik.yml o labels).
```

Anota esos dos valores: irán en `TRAEFIK_NETWORK` y `TRAEFIK_CERTRESOLVER` del `.env`.
Los valores por defecto del ejemplo son `traefik` y `letsencrypt`.

---

## 2. Construir y publicar las imágenes (en tu máquina)

Desde la raíz del repo (`C:\...\Calendar`), en PowerShell:

```powershell
.\scripts\build-push.ps1 -User TU_USUARIO_DOCKERHUB -Tag v1
```

El script:
1. Hace `docker login docker.io` (usuario + token).
2. Construye `salonevents-backend` y `salonevents-frontend`.
   - El frontend se construye **sin** `VITE_API_URL`: usa rutas relativas que
     nginx proxea. (`-ViteApiUrl` solo es necesario en el caso especial de
     servir la API en otro origen.)
3. Publica ambas con el tag indicado **y** `latest`.

Resultado:
`docker.io/TU_USUARIO/salonevents-backend:v1` y `...-frontend:v1` (+ `:latest`).

---

## 3. Preparar el VPS

Copia al VPS únicamente estos dos ficheros (no necesitas el código fuente):

```bash
# desde tu máquina (ejemplo con scp)
scp docker-compose.prod.yml usuario@TU_VPS:/home/usuario/salon-eventos/
scp .env.prod.example       usuario@TU_VPS:/home/usuario/salon-eventos/
```

En el VPS:

```bash
cd /home/usuario/salon-eventos
cp .env.prod.example .env
nano .env
```

Rellena el `.env` (ver [.env.prod.example](.env.prod.example)):

- `DOCKERHUB_USER`, `TAG` → los de la publicación (paso 2).
- `TRAEFIK_NETWORK`, `TRAEFIK_CERTRESOLVER` → los que confirmaste en el paso 1.
- `WEB_DOMAIN` → tu dominio (`tudominio.com`).
- `POSTGRES_PASSWORD` y `DATABASE_URL` → **la misma** contraseña en ambos.
- `JWT_SECRET` → `openssl rand -base64 48`.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` → primer admin.
- `FRONTEND_ORIGIN` → `https://tudominio.com` (mismo origen; el backend usa este
  valor para CORS aunque, al ir todo por `/api`, las peticiones ya son del mismo
  origen).

> El `.env` va **junto** al `docker-compose.prod.yml`; Compose lo carga solo.
> No existe `VITE_API_URL` ni un `API_DOMAIN`: todo va por `tudominio.com/api`.

---

## 4. Desplegar

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Traefik detecta el label del frontend y publica el router automáticamente. El
backend, al arrancar, espera a `db`, aplica `schema.sql` y siembra el admin.

---

## 5. Verificar

```bash
# Estado de los contenedores
docker compose -f docker-compose.prod.yml ps

# Frontend + API por el MISMO dominio (TLS real)
curl -I https://tudominio.com                 # 200 + certificado válido
curl https://tudominio.com/health             # {"status":"ok"} (proxeado al backend)

# Logs si algo falla
docker compose -f docker-compose.prod.yml logs -f frontend
docker compose -f docker-compose.prod.yml logs -f backend
```

Inicia sesión en `https://tudominio.com` con `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

---

## 6. Actualizar la aplicación

En tu máquina, re-publica con un tag nuevo (o re-usa `latest`):

```powershell
.\scripts\build-push.ps1 -User TU_USUARIO_DOCKERHUB -Tag v2
```

En el VPS, sube `TAG=v2` en el `.env` y:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

El esquema es idempotente y el admin no se re-crea: actualizar es seguro.

---

## 7. Cómo encaja con tu `docker-compose` de Traefik

Solo el **frontend** se une a la red externa de Traefik; `backend` y `db` viven
en la red interna. No hay que tocar el compose de Traefik; basta con que el
frontend comparta esa red. Ejemplo del lado de Traefik (referencia — el tuyo ya
existe):

```yaml
services:
  traefik:
    image: traefik:v3
    # ... command / entrypoints / certresolver ...
    networks:
      - traefik            # <-- misma red que usa salonevents-web (frontend)

networks:
  traefik:
    external: false        # aquí Traefik la CREA (name: traefik)
    name: traefik
```

En `docker-compose.prod.yml` de la app, esa red se declara como `external: true`
con `name: ${TRAEFIK_NETWORK}`, de modo que **no** se crea de nuevo: se reutiliza.

---

## 8. Troubleshooting

| Síntoma | Causa probable | Arreglo |
|---------|----------------|---------|
| Traefik no ve el frontend (404 o "no available server") | Frontend no está en la red de Traefik, o `TRAEFIK_NETWORK` mal puesto | Confirma `docker network ls` y que `TRAEFIK_NETWORK` coincide |
| 404 en el dominio | `Host()` mal escrito o DNS no propagado | Revisa `WEB_DOMAIN` y el registro A |
| Sin certificado / TLS falla | `TRAEFIK_CERTRESOLVER` no coincide con el de tu Traefik | Usa el nombre exacto del resolver de tu `traefik.yml` |
| `/api/...` da 502 Bad Gateway | El frontend no resuelve `backend:8080` (no está en la red `internal`) o el backend no arrancó | Confirma que `frontend` y `backend` comparten `internal`; revisa `logs backend` |
| Login/eventos fallan pero el sitio carga | Ruta del proxy mal (`location /api/` en `nginx.conf`) o backend caído | `curl https://tudominio.com/health`; revisa `logs frontend` (nginx) y `logs backend` |
| `image ... not found` al hacer pull | `DOCKERHUB_USER`/`TAG` no coinciden con lo publicado, o la imagen es privada | Verifica el nombre/tag en Docker Hub y que el repo es **público** |

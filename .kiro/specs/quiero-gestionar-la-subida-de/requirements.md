# Publicar imágenes Docker y desplegar en el VPS detrás de Traefik

## Objetivo

Dejar de construir las imágenes (`backend` y `frontend`) dentro del VPS y en su
lugar **construirlas y publicarlas en un registro Docker público**, para luego
consumirlas en el VPS con un `docker-compose.yml` que se integre con el
**Traefik ya registrado** en ese servidor. La entrega incluye:

1. Un flujo de **build + push** reproducible (script/comandos) que sube las
   imágenes al registro público.
2. Un `docker-compose.prod.yml` para el VPS que usa `image:` (no `build:`),
   se conecta a la red externa de Traefik y expone `frontend` y `backend` por
   etiquetas (labels) de Traefik con TLS.
3. Instrucciones claras de **dónde y cómo van las variables de entorno** en ese
   YML del VPS (fichero `.env` junto al compose) y qué diferencia hay entre las
   vars de build (`VITE_API_URL`, que se hornea en el frontend) y las de
   runtime del backend.
4. Documentación en Markdown (redactada, lista para pegar) con el paso a paso de
   despliegue junto a Traefik.

## Contexto actual (leído del repo)

- `docker-compose.yml` en la raíz construye 3 servicios: `db` (postgres:16),
  `backend` (`build: ./backend`, publica `5080:8080`) y `frontend`
  (`build: ./frontend`, publica `8080:80`, con `VITE_API_URL` como build-arg).
- `backend/Dockerfile` → imagen .NET 10 que escucha en `:8080`.
- `frontend/Dockerfile` → build Vite + nginx; `VITE_API_URL` es un `ARG` que se
  **hornea en el bundle** en tiempo de build.
- Variables de entorno definidas en `.env.example`: `POSTGRES_*`,
  `DATABASE_URL`, `JWT_*`, `ADMIN_*`, `FRONTEND_ORIGIN`, `VITE_API_URL`.
- El backend, al arrancar, aplica `db/schema.sql` y siembra el admin.
- `DEPLOY.md` describe hoy el flujo Compose con build en el VPS y una sección
  opcional de HTTPS con **Caddy**; este spec lo reemplaza por Traefik + imágenes
  publicadas.

## Alcance

Incluye:

- Etiquetar y publicar `backend` y `frontend` en un registro público.
- `docker-compose.prod.yml` (VPS) con `image:`, red externa de Traefik y labels.
- Colocación y documentación de variables de entorno para el VPS.
- Guía de despliegue redactada en Markdown.

No incluye:

- CI/CD automatizado (GitHub Actions). El build/push es manual por comandos/script.
- Cambios de código de la app (backend/frontend) más allá de Docker/compose/docs.
- Migración de datos (ya cubierta en otro spec/DEPLOY.md).

## Supuestos

- El VPS ya tiene Traefik corriendo como reverse-proxy con resolución TLS
  (Let's Encrypt) y una **red Docker externa** a la que se unen los servicios
  (se detecta/confirma el nombre real; por defecto se asume `traefik` o
  `web`).
- `db` (Postgres) sigue viviendo en el mismo Compose del VPS con un volumen
  persistente; **no** se publica su puerto al exterior.
- El usuario tiene un dominio (o subdominios) apuntando al VPS para
  `frontend` y `backend`.

## Criterios de aceptación

- [ ] Existe un flujo documentado de **build + push** que, ejecutado desde la
      máquina de desarrollo, publica `backend` y `frontend` etiquetadas
      (`<registro>/<usuario>/salonevents-backend:<tag>` y `...-frontend:<tag>`)
      en un registro público, con `latest` y un tag de versión.
- [ ] El `frontend` se construye pasando `VITE_API_URL` (la URL **pública**
      del backend, p. ej. `https://api.tudominio.com`) como build-arg, de modo
      que quede horneada correctamente en la imagen publicada.
- [ ] Existe `docker-compose.prod.yml` para el VPS que:
      - usa `image:` para `backend` y `frontend` (sin `build:`),
      - mantiene `db` con su volumen y healthcheck, sin exponer puertos,
      - **no** publica puertos de `backend`/`frontend` al host (los enruta Traefik),
      - se conecta a la **red externa de Traefik** además de una red interna,
      - define labels de Traefik para enrutar `frontend` y `backend` por host,
        con `entrypoints=websecure` y `certresolver` TLS.
- [ ] Las variables de entorno del VPS están en un `.env` **junto** al
      `docker-compose.prod.yml`, referenciadas con `${VAR}`; el documento indica
      exactamente qué variables van ahí, cuáles son secretas y cuál
      (`VITE_API_URL`) se hornea en build y no en runtime.
- [ ] `FRONTEND_ORIGIN` (CORS del backend) y `VITE_API_URL` apuntan a las URLs
      públicas `https://…` reales del despliegue.
- [ ] Hay una guía Markdown redactada (paso a paso) que cubre: prerequisitos,
      login al registro, build+push, preparar `.env` en el VPS, `docker compose
      -f docker-compose.prod.yml pull && up -d`, verificación (`ps`, `/health`,
      certificado TLS) y actualización (pull de nueva imagen + `up -d`).
- [ ] La guía explica cómo confirmar/ajustar el nombre de la **red externa** de
      Traefik y los routers/labels si el Traefik del VPS usa nombres distintos.

## Decisión abierta (necesito tu confirmación)

- **Registro público:** ¿Docker Hub (`docker.io/<usuario>/...`) o GitHub
  Container Registry (`ghcr.io/<usuario>/...`)?
  Recomendación: **Docker Hub** por simplicidad de "público" y login directo.
  Ambos quedan documentados; solo cambian el prefijo de imagen y el `docker login`.

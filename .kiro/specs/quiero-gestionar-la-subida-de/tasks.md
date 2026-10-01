# Tareas — Publicar imágenes en Docker Hub y desplegar tras Traefik

Registro elegido: **Docker Hub** (`docker.io/<TU_USUARIO>/...`).
Trabajo dentro de `C:\Users\luisg\OneDrive\Desktop\Calendar`.

## 1. Preparar el build para publicación

- [x] 1.1 Confirmar el nombre de imagen: `docker.io/<TU_USUARIO>/salonevents-backend`
      y `docker.io/<TU_USUARIO>/salonevents-frontend`. Definir esquema de tags:
      `latest` + versión semántica (`v1`, `v1.0.0`, o el SHA corto de git).
- [x] 1.2 Verificar `.dockerignore` en `backend/` y `frontend/` para que no se
      suban `bin/`, `obj/`, `node_modules/`, `.env`. Ajustar si falta algo.
- [x] 1.3 Crear script `scripts/build-push.ps1` (PowerShell, para tu máquina
      Windows) que reciba `TU_USUARIO`, `TAG` y `VITE_API_URL`, y ejecute:
      - `docker build -t docker.io/<usuario>/salonevents-backend:<tag> -t ...:latest ./backend`
      - `docker build --build-arg VITE_API_URL=<url_publica> -t docker.io/<usuario>/salonevents-frontend:<tag> -t ...:latest ./frontend`
      - `docker push` de las 4 referencias (backend+frontend, `<tag>` y `latest`).
      Los comandos se listan secuencialmente (PowerShell no soporta `&&`).
- [x] 1.4 Documentar el `docker login docker.io` (usuario + token de acceso de
      Docker Hub, no la contraseña) como paso previo.

## 2. `docker-compose.prod.yml` para el VPS (Traefik + imágenes publicadas)

- [x] 2.1 Crear `docker-compose.prod.yml` en la raíz del repo con servicios
      `db`, `backend`, `frontend` usando `image: docker.io/<usuario>/...:${TAG}`
      (sin `build:`).
- [x] 2.2 `db`: mantener `postgres:16-alpine`, volumen `db_data`, healthcheck;
      **sin** `ports:` publicados; solo en la red interna.
- [x] 2.3 Definir dos redes: una **interna** (`internal`) para db↔backend↔frontend
      y la **externa de Traefik** (`external: true`, nombre real del VPS — por
      defecto `traefik`/`web`, a confirmar). `backend` y `frontend` van a ambas;
      `db` solo a la interna.
- [x] 2.4 Quitar `ports:` de `backend` y `frontend` (los enruta Traefik) y añadir
      labels:
      - `traefik.enable=true`
      - frontend: router por `Host(\`tudominio.com\`)`, `entrypoints=websecure`,
        `tls.certresolver=<resolver>`, `loadbalancer.server.port=80`.
      - backend: router por `Host(\`api.tudominio.com\`)`, `entrypoints=websecure`,
        `tls.certresolver=<resolver>`, `loadbalancer.server.port=8080`.
- [x] 2.5 `backend.environment`: `DATABASE_URL`, `JWT_SECRET`, `JWT_ISSUER`,
      `JWT_AUDIENCE`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `FRONTEND_ORIGIN` (=
      `https://tudominio.com`), todos vía `${VAR}`.
- [x] 2.6 `depends_on` con `condition: service_healthy` en `db` para `backend`.

## 3. Variables de entorno del VPS

- [x] 3.1 Crear `.env.prod.example` documentando TODAS las vars que consume
      `docker-compose.prod.yml`: `TAG`, `POSTGRES_*`, `DATABASE_URL` (`Host=db`),
      `JWT_*`, `ADMIN_*`, `FRONTEND_ORIGIN`, y el nombre de la red externa /
      `certresolver` si se parametrizan.
- [x] 3.2 Documentar explícitamente que en el VPS el fichero se llama `.env` y va
      **junto** al `docker-compose.prod.yml`; Compose lo carga automáticamente.
- [x] 3.3 Dejar claro que `VITE_API_URL` **no** va en el `.env` del VPS: es
      build-arg y ya quedó horneada en la imagen `frontend` publicada. Si cambia,
      hay que **reconstruir y re-publicar** el frontend (paso 1.3) con la nueva URL.

## 4. Guía de despliegue redactada (Markdown)

- [x] 4.1 Crear `DEPLOY-TRAEFIK.md` con el paso a paso completo:
      - Prerrequisitos (Docker en VPS, Traefik ya corriendo, dominio→VPS, red externa).
      - Cómo confirmar el nombre de la red externa de Traefik
        (`docker network ls`) y el `certresolver` (revisar el yml de Traefik).
      - En tu máquina: `docker login` + ejecutar `scripts/build-push.ps1`.
      - En el VPS: copiar `docker-compose.prod.yml` + `.env`, rellenar `.env`,
        `docker compose -f docker-compose.prod.yml pull`,
        `docker compose -f docker-compose.prod.yml up -d`.
      - Verificación: `docker compose -f docker-compose.prod.yml ps`,
        `curl -k https://api.tudominio.com/health`, comprobar el certificado TLS.
      - Actualización: re-build+push con nuevo `TAG` → en el VPS `pull` + `up -d`.
- [x] 4.2 Incluir un bloque de ejemplo de cómo se integra con el `docker-compose`
      de Traefik existente (dónde encaja la red externa) para pegar/comparar.
- [x] 4.3 Añadir nota de troubleshooting: labels no detectadas (Traefik en otra
      red), 404 de router (Host mal escrito), CORS (`FRONTEND_ORIGIN` != dominio),
      frontend llama a `localhost` (VITE_API_URL mal horneada).

## 5. Cierre

- [x] 5.1 Actualizar `README.md`/`DEPLOY.md` con un enlace a `DEPLOY-TRAEFIK.md`
      indicando que producción ahora usa imágenes publicadas + Traefik (la sección
      Caddy queda como alternativa histórica).
- [x] 5.2 Prueba de humo local opcional: `docker compose -f docker-compose.prod.yml
      config` para validar la sintaxis del YAML antes de subirlo al VPS.

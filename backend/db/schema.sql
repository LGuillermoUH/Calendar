-- Esquema de la base de datos del salón de eventos (Postgres estándar, autohospedado).
-- Se ejecuta al arrancar el backend (DbInitializer). Idempotente: seguro en cada inicio.

-- pgcrypto para gen_random_uuid().
create extension if not exists pgcrypto;

-- ============================================================
-- Eventos / reservas
-- ============================================================
create table if not exists public.events (
    id            uuid primary key default gen_random_uuid(),
    event_date    date not null,
    is_reserved   boolean not null default false,
    person_name   text not null,
    contact_phone text,
    contact_email text,
    amount_paid   numeric(10, 2) not null default 0,
    title         text,
    notes         text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    constraint events_amount_paid_nonnegative check (amount_paid >= 0)
);

-- Índice para consultas por rango de mes.
create index if not exists events_event_date_idx on public.events (event_date);

-- Trigger que mantiene updated_at en cada UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
    before update on public.events
    for each row
    execute function public.set_updated_at();

-- ============================================================
-- Usuarios (autenticación propia)
-- ============================================================
-- Un usuario del panel: correo + hash de contraseña (BCrypt) + rol.
-- El primer admin se siembra al arrancar (ADMIN_EMAIL / ADMIN_PASSWORD).
-- No hay registro público: los admins adicionales se crean vía /api/admin/users.
create table if not exists public.users (
    id            uuid primary key default gen_random_uuid(),
    email         text not null unique,
    password_hash text not null,
    role          text not null default 'admin'
                    check (role in ('admin', 'viewer')),
    created_at    timestamptz not null default now()
);

-- ============================================================
-- Refresh tokens (rotación)
-- ============================================================
-- Se guarda solo el hash del refresh token. Al refrescar, el token usado se
-- marca revocado (revoked_at) y se emite uno nuevo (rotación).
create table if not exists public.refresh_tokens (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references public.users (id) on delete cascade,
    token_hash text not null,
    expires_at timestamptz not null,
    revoked_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists refresh_tokens_token_hash_idx on public.refresh_tokens (token_hash);
create index if not exists refresh_tokens_user_id_idx on public.refresh_tokens (user_id);

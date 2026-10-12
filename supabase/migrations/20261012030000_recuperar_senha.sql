-- Recuperar a senha por e-mail sem falar com a central: link de uso único, válido por 1 hora.
-- Só o servidor (chave de serviço) lê e grava aqui; guardamos apenas o hash do código.
create table if not exists public.senha_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  expira_em timestamptz not null,
  usado_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists senha_resets_user_idx on public.senha_resets(user_id, created_at);
alter table public.senha_resets enable row level security;
revoke all on public.senha_resets from anon, authenticated;

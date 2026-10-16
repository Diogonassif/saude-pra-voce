-- Campanhas de convite por e-mail (gestão): contatos, envio pelo app (convite@saudepravoce.com) e descadastro (LGPD).
create table if not exists public.campanha_contatos (
  id uuid primary key default gen_random_uuid(),
  campanha text not null,
  nome text not null default '',
  email text not null,
  cargo text not null default '',
  empresa text not null default '',
  cidade text not null default '',
  origem text not null default 'manual',
  status text not null default 'pendente' check (status in ('pendente','enviado','erro','descadastrado','cadastrou')),
  token uuid not null default gen_random_uuid() unique,
  enviado_em timestamptz,
  clicou_em timestamptz,
  nota text not null default '',
  created_at timestamptz not null default now(),
  unique (campanha, email)
);
create index if not exists campanha_contatos_camp_idx on public.campanha_contatos(campanha, status);

-- quem pediu para não receber mais nada (vale para todas as campanhas)
create table if not exists public.descadastros (
  email text primary key,
  em timestamptz not null default now()
);

alter table public.campanha_contatos enable row level security;
alter table public.descadastros enable row level security;
drop policy if exists camp_admin on public.campanha_contatos;
create policy camp_admin on public.campanha_contatos for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists desc_admin on public.descadastros;
create policy desc_admin on public.descadastros for select to authenticated using (public.is_admin());
grant select, insert, update, delete on public.campanha_contatos to authenticated;
grant select on public.descadastros to authenticated;

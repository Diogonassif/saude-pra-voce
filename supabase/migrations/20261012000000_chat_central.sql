-- Conversa entre a central e o contratante dentro de cada pedido à central (necessidade)
create table if not exists public.necessidade_mensagens (
  id uuid primary key default gen_random_uuid(),
  necessidade_id uuid not null references public.necessidades(id) on delete cascade,
  autor uuid references public.profiles(id) on delete set null,
  da_central boolean not null default false,
  texto text not null check (char_length(texto) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists necessidade_mensagens_nec_idx on public.necessidade_mensagens(necessidade_id, created_at);
create index if not exists necessidade_mensagens_autor_idx on public.necessidade_mensagens(autor);
alter table public.necessidade_mensagens enable row level security;

create or replace function public.necmsg_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.autor := auth.uid();
  new.da_central := public.is_admin();
  new.created_at := now();
  return new;
end $$;
drop trigger if exists necmsg_guard on public.necessidade_mensagens;
create trigger necmsg_guard before insert on public.necessidade_mensagens for each row execute function public.necmsg_guard();

drop policy if exists necmsg_read on public.necessidade_mensagens;
create policy necmsg_read on public.necessidade_mensagens for select to authenticated using (
  public.is_admin() or exists (select 1 from public.necessidades n where n.id = necessidade_id and n.cliente_id = (select auth.uid())));
drop policy if exists necmsg_ins on public.necessidade_mensagens;
create policy necmsg_ins on public.necessidade_mensagens for insert to authenticated with check (
  public.is_admin() or exists (select 1 from public.necessidades n where n.id = necessidade_id and n.cliente_id = (select auth.uid())));

grant select, insert on public.necessidade_mensagens to authenticated;
do $$ begin
  alter publication supabase_realtime add table public.necessidade_mensagens;
exception when others then null; end $$;

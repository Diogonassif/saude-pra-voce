-- Boas-vindas ao profissional novo: vídeo pelo WhatsApp (API oficial do WhatsApp, quando configurada) e por e-mail.
-- Uma linha por profissional; a gestão vê quem já recebeu e manda manualmente quem ficou pendente.
create table if not exists public.boas_vindas (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  whatsapp_status text not null default 'pendente' check (whatsapp_status in ('pendente','enviando','enviado','manual','erro')),
  whatsapp_em timestamptz,
  whatsapp_erro text,
  email_status text not null default 'pendente' check (email_status in ('pendente','enviando','enviado','sem_email','erro')),
  email_em timestamptz
);
alter table public.boas_vindas enable row level security;
drop policy if exists bv_admin on public.boas_vindas;
create policy bv_admin on public.boas_vindas for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, update on public.boas_vindas to authenticated;

-- quando alguém vira profissional (escolher_papel cria a linha em pros), entra na fila de boas-vindas
create or replace function public.pro_boas_vindas() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles where id = new.user_id and role = 'pro') then
    insert into public.boas_vindas(user_id) values (new.user_id) on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists pros_boas_vindas on public.pros;
create trigger pros_boas_vindas after insert on public.pros for each row execute function public.pro_boas_vindas();

-- quem se cadastrou nos últimos 3 dias entra na fila (para a gestão mandar o vídeo)
insert into public.boas_vindas(user_id, created_at)
select p.id, p.created_at from public.profiles p join public.pros x on x.user_id = p.id
 where p.role = 'pro' and p.created_at >= now() - interval '3 days'
on conflict do nothing;

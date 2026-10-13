-- Banco de TESTE (saude-pra-voce): todas as migrações em ordem, com o projeto de produção trocado pelo de teste.
-- Gerado para montar o banco de teste; rode no SQL Editor do projeto fbeqxeaynxhxnrpyekji.
create extension if not exists pgcrypto;
create table public.config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.config(key, value) values
  ('taxa_debcare', '15'),
  ('taxa_mind', '10'),
  ('admins', '[]'),               -- celulares da central/Mind, só dígitos com 55 (ex.: "5516999990000")
  ('central_whatsapp', '""');     -- WhatsApp da central Saúde Pra Você, só dígitos com 55
create or replace function public.so_digitos(s text) returns text
language sql immutable as $$ select regexp_replace(coalesce(s, ''), '\D', '', 'g') $$;
create or replace function public.preco_cliente(v numeric) returns numeric
language sql stable security definer set search_path = public as $$
  select case when v is null then null else round(v * (1 + (
    coalesce((select (value #>> '{}')::numeric from public.config where key = 'taxa_debcare'), 15) +
    coalesce((select (value #>> '{}')::numeric from public.config where key = 'taxa_mind'), 10)) / 100), 2) end
$$;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text check (role in ('pro','cliente','admin')),
  nome text not null default '',
  telefone text not null default '',
  email text,                       -- opcional, para avisos por e-mail
  created_at timestamptz not null default now()
);
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;
create or replace function public.is_sys() returns boolean
language sql stable set search_path = public as $$
  select auth.uid() is null or coalesce(current_setting('dc.sys', true), '') = '1'
$$;
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare adm jsonb; tel text;
begin
  select value into adm from public.config where key = 'admins';
  tel := public.so_digitos(coalesce(new.raw_user_meta_data->>'phone',
           case when new.email like '%@tel.debcare.app' then split_part(new.email, '@', 1) end, new.phone));
  insert into public.profiles(id, nome, telefone, role)
  values (new.id,
          coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'Sem nome'),
          tel,
          case when tel <> '' and adm ? tel then 'admin' else null end);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and not public.is_sys() then
    new.role := old.role; new.telefone := old.telefone;
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();
create or replace function public.config_admins() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.key = 'admins' then
    perform set_config('dc.sys', '1', true);
    update public.profiles set role = 'admin' where telefone <> '' and new.value ? telefone and role is distinct from 'admin';
    perform set_config('dc.sys', '', true);
  end if;
  return new;
end $$;
create trigger config_admins after insert or update on public.config
  for each row execute function public.config_admins();
create table public.pros (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  nome text not null default '',
  avatar_url text,
  especialidade text check (especialidade in ('enfermeiro','tecnico','cuidador','acompanhante')),
  titulo text not null default '',           -- ex.: "Técnica de enfermagem · experiência em UTI"
  resumo text not null default '' check (char_length(resumo) <= 1500),
  coren text,                                 -- enfermeiro e técnico
  coren_uf text,
  experiencia_anos int check (experiencia_anos between 0 and 70),
  cidade text,
  uf text,
  regioes text not null default '',          -- bairros/cidades que atende
  atende text[] not null default '{residencia,hospital}',
  habilidades text[] not null default '{}',
  genero text check (genero in ('feminino','masculino','outro')),
  valor_hora numeric(10,2) check (valor_hora > 0),
  valor_12h numeric(10,2) check (valor_12h > 0),
  valor_24h numeric(10,2) check (valor_24h > 0),
  publicado boolean not null default false,
  verificado boolean not null default false, -- selo Saúde Pra Você: documentos e COREN conferidos
  rating numeric(3,2),
  n_avaliacoes int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.pro_privado (
  user_id uuid primary key references public.pros(user_id) on delete cascade,
  cpf text,
  cnpj text,
  doc_coren text,          -- caminho no storage (bucket docs)
  doc_antecedentes text,
  doc_identidade text,
  updated_at timestamptz not null default now()
);
create table public.mp_contas (
  user_id uuid primary key references public.pros(user_id) on delete cascade,
  mp_user_id text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  conectado_em timestamptz not null default now()
);
create or replace function public.pros_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and not public.is_sys() then
    if tg_op = 'UPDATE' then
      new.verificado := old.verificado; new.rating := old.rating; new.n_avaliacoes := old.n_avaliacoes;
      if new.coren is distinct from old.coren then new.verificado := false; end if;
    else
      new.verificado := false; new.rating := null; new.n_avaliacoes := 0;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger pros_guard before insert or update on public.pros
  for each row execute function public.pros_guard();
create table public.agenda (
  pro_id uuid references public.pros(user_id) on delete cascade,
  dia date,
  status text not null check (status in ('livre','parcial','off','alocado')),
  primary key (pro_id, dia)
);
create or replace function public.catalogo()
returns table (user_id uuid, nome text, avatar_url text, especialidade text, titulo text, resumo text,
  experiencia_anos int, cidade text, uf text, regioes text, atende text[], habilidades text[], genero text,
  tem_coren boolean, verificado boolean, rating numeric, n_avaliacoes int,
  preco_hora numeric, preco_12h numeric, preco_24h numeric)
language sql stable security definer set search_path = public as $$
  select p.user_id,
         split_part(trim(p.nome), ' ', 1) ||
           case when position(' ' in trim(p.nome)) > 0
                then ' ' || left(split_part(trim(p.nome), ' ', array_length(string_to_array(trim(p.nome), ' '), 1)), 1) || '.'
                else '' end,
         p.avatar_url, p.especialidade, p.titulo, p.resumo, p.experiencia_anos, p.cidade, p.uf, p.regioes,
         p.atende, p.habilidades, p.genero, coalesce(trim(p.coren), '') <> '', p.verificado, p.rating, p.n_avaliacoes,
         public.preco_cliente(p.valor_hora), public.preco_cliente(p.valor_12h), public.preco_cliente(p.valor_24h)
    from public.pros p
   where p.publicado and p.valor_hora is not null and p.especialidade is not null
   order by p.verificado desc, p.rating desc nulls last, p.n_avaliacoes desc, random()
$$;
create table public.necessidades (
  id uuid primary key default gen_random_uuid(),
  codigo bigint generated always as identity,
  cliente_id uuid not null references public.profiles(id) on delete cascade,
  cliente_nome text not null default '',
  especialidade text check (especialidade in ('enfermeiro','tecnico','cuidador','acompanhante')),
  paciente_nome text not null default '',
  paciente_idade int check (paciente_idade between 0 and 120),
  cuidados text not null default '' check (char_length(cuidados) <= 3000),
  local_tipo text not null default 'residencia' check (local_tipo in ('residencia','hospital','clinica','outro')),
  cidade text,
  endereco text,
  inicio date,
  fim date,
  turno text not null default 'dia' check (turno in ('dia','noite','24h','horas')),
  horas_dia int check (horas_dia between 1 and 24),
  genero_pref text check (genero_pref in ('feminino','masculino')),
  orcamento numeric(12,2),
  observacoes text not null default '' check (char_length(observacoes) <= 2000),
  status text not null default 'aberta' check (status in ('aberta','em_busca','atendida','cancelada')),
  nota_central text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.necessidades(status);
create index on public.necessidades(cliente_id);
create or replace function public.necessidades_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and not public.is_sys() then
    if tg_op = 'INSERT' then
      new.cliente_id := auth.uid(); new.status := 'aberta'; new.nota_central := '';
      new.cliente_nome := coalesce((select nome from public.profiles where id = auth.uid()), '');
    else
      if new.status <> old.status and new.status <> 'cancelada' then new.status := old.status; end if;
      new.nota_central := old.nota_central; new.cliente_id := old.cliente_id;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger necessidades_guard before insert or update on public.necessidades
  for each row execute function public.necessidades_guard();
create table public.contratacoes (
  id uuid primary key default gen_random_uuid(),
  codigo bigint generated always as identity,
  cliente_id uuid not null references public.profiles(id) on delete restrict,
  pro_id uuid not null references public.pros(user_id) on delete restrict,
  cliente_nome text not null default '',
  pro_nome text not null default '',
  necessidade_id uuid references public.necessidades(id) on delete set null,
  origem text not null default 'catalogo' check (origem in ('catalogo','central')),
  especialidade text not null,
  modalidade text not null check (modalidade in ('hora','plantao12','plantao24')),
  inicio date not null,
  fim date not null,
  horario time,
  horas_dia int check (horas_dia between 1 and 24),
  dias_semana int[] not null default '{0,1,2,3,4,5,6}',
  dias int not null check (dias between 1 and 366),
  quantidade numeric(10,2) not null,        -- horas totais (hora) ou número de plantões
  local_tipo text not null default 'residencia' check (local_tipo in ('residencia','hospital','clinica','outro')),
  endereco text not null default '',
  cidade text,
  paciente_nome text not null default '',
  paciente_idade int,
  cuidados text not null default '',
  notas text not null default '',
  status text not null default 'solicitado'
    check (status in ('solicitado','aceito','confirmado','concluido','recusado','cancelado')),
  motivo text not null default '',
  aceito_em timestamptz,
  pago_em timestamptz,
  concluido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fim >= inicio)
);
create index on public.contratacoes(cliente_id);
create index on public.contratacoes(pro_id);
create index on public.contratacoes(status);
create table public.contratacao_pro (
  contratacao_id uuid primary key references public.contratacoes(id) on delete cascade,
  valor_unit numeric(12,2) not null,
  total numeric(14,2) not null
);
create table public.contratacao_cliente (
  contratacao_id uuid primary key references public.contratacoes(id) on delete cascade,
  valor_unit numeric(12,2) not null,
  total numeric(14,2) not null
);
create table public.contratacao_split (
  contratacao_id uuid primary key references public.contratacoes(id) on delete cascade,
  taxa_debcare_pct numeric(5,2) not null,
  taxa_mind_pct numeric(5,2) not null,
  pro numeric(14,2) not null,
  debcare numeric(14,2) not null,
  mind numeric(14,2) not null
);
create table public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  contratacao_id uuid not null references public.contratacoes(id) on delete cascade,
  valor_total numeric(14,2) not null,
  taxa numeric(14,2) not null,              -- marketplace_fee: Saúde Pra Você + Mind
  debcare numeric(14,2) not null,
  mind numeric(14,2) not null,
  mp_pref_id text,
  mp_payment_id text,
  status text not null default 'pendente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.pagamentos(contratacao_id);
create table public.repasses_mind (
  id uuid primary key default gen_random_uuid(),
  referencia text not null,                 -- ex.: 2026-10
  valor numeric(14,2) not null check (valor > 0),
  pago_em date not null default current_date,
  nota text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.mensagens (
  id uuid primary key default gen_random_uuid(),
  contratacao_id uuid not null references public.contratacoes(id) on delete cascade,
  autor uuid not null references public.profiles(id) on delete cascade,
  texto text not null check (length(texto) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index on public.mensagens(contratacao_id, created_at);
create table public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  contratacao_id uuid not null unique references public.contratacoes(id) on delete cascade,
  cliente_id uuid not null references public.profiles(id) on delete cascade,
  pro_id uuid not null references public.pros(user_id) on delete cascade,
  nota int not null check (nota between 1 and 5),
  comentario text not null default '' check (char_length(comentario) <= 1000),
  created_at timestamptz not null default now()
);
create or replace function public.parte(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.contratacoes x where x.id = c
    and (x.pro_id = auth.uid() or x.cliente_id = auth.uid() or public.is_admin()))
$$;
create or replace function public.mensagens_mask() returns trigger
language plpgsql security definer set search_path = public as $$
declare st text;
begin
  select status into st from public.contratacoes where id = new.contratacao_id;
  new.autor := auth.uid();
  if st not in ('confirmado','concluido') then
    new.texto := regexp_replace(new.texto, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[contato oculto]', 'g');
    new.texto := regexp_replace(new.texto, '(https?://|www\.)\S+', '[link oculto]', 'gi');
    new.texto := regexp_replace(new.texto, '(\+?55[\s.-]?)?\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}', '[contato oculto]', 'g');
  end if;
  return new;
end $$;
create trigger mensagens_mask before insert on public.mensagens
  for each row execute function public.mensagens_mask();
create or replace function public.contato(c uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when x.pro_id = auth.uid() then (select telefone from public.profiles where id = x.cliente_id)
              when x.cliente_id = auth.uid() then (select telefone from public.profiles where id = x.pro_id)
              when public.is_admin() then null end
    from public.contratacoes x
   where x.id = c and x.status in ('confirmado','concluido')
$$;
create or replace function public.avaliacoes_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare x public.contratacoes;
begin
  select * into x from public.contratacoes where id = new.contratacao_id;
  if x.id is null or x.status <> 'concluido' or x.cliente_id <> auth.uid() then
    raise exception 'Só o contratante avalia, depois de concluído';
  end if;
  new.cliente_id := x.cliente_id; new.pro_id := x.pro_id;
  return new;
end $$;
create trigger avaliacoes_guard before insert on public.avaliacoes
  for each row execute function public.avaliacoes_guard();
create or replace function public.avaliacoes_rating() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('dc.sys', '1', true);
  update public.pros p set
    rating = (select avg(nota) from public.avaliacoes where pro_id = p.user_id),
    n_avaliacoes = (select count(*) from public.avaliacoes where pro_id = p.user_id)
  where p.user_id = new.pro_id;
  perform set_config('dc.sys', '', true);
  return new;
end $$;
create trigger avaliacoes_rating after insert on public.avaliacoes
  for each row execute function public.avaliacoes_rating();
create or replace function public.avaliacoes_pro(p uuid)
returns table (nota int, comentario text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select nota, comentario, created_at from public.avaliacoes where pro_id = p order by created_at desc limit 10
$$;
create or replace function public.agenda_pro(p uuid)
returns table (dia date, status text)
language sql stable security definer set search_path = public as $$
  select a.dia, a.status from public.agenda a
    join public.pros x on x.user_id = a.pro_id and x.publicado
   where a.pro_id = p and a.dia between current_date and current_date + 90
   order by a.dia
$$;
create or replace function public.escolher_papel(papel text)
returns void language plpgsql security definer set search_path = public as $$
declare me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'sem perfil'; end if;
  if papel not in ('pro','cliente') then raise exception 'papel inválido'; end if;
  if me.role is not null and me.role <> 'admin' then raise exception 'papel já escolhido'; end if;
  perform set_config('dc.sys', '1', true);
  if me.role is null then update public.profiles set role = papel where id = me.id; end if;
  if papel = 'pro' then
    insert into public.pros(user_id, nome) values (me.id, me.nome) on conflict do nothing;
    insert into public.pro_privado(user_id) values (me.id) on conflict do nothing;
  end if;
  perform set_config('dc.sys', '', true);
end $$;
alter table public.config enable row level security;
alter table public.profiles enable row level security;
alter table public.pros enable row level security;
alter table public.pro_privado enable row level security;
alter table public.mp_contas enable row level security;
alter table public.agenda enable row level security;
alter table public.necessidades enable row level security;
alter table public.contratacoes enable row level security;
alter table public.contratacao_pro enable row level security;
alter table public.contratacao_cliente enable row level security;
alter table public.contratacao_split enable row level security;
alter table public.pagamentos enable row level security;
alter table public.repasses_mind enable row level security;
alter table public.mensagens enable row level security;
alter table public.avaliacoes enable row level security;
create policy config_publico on public.config for select to anon, authenticated using (key = 'central_whatsapp');
create policy config_read on public.config for select to authenticated using (public.is_admin());
create policy config_admin on public.config for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy profiles_self on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_upd on public.profiles for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
create policy pros_read on public.pros for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy pros_upd on public.pros for update to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy privado_own on public.pro_privado for all to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy agenda_read on public.agenda for select to authenticated using (pro_id = auth.uid() or public.is_admin());
create policy agenda_own on public.agenda for all to authenticated using (pro_id = auth.uid() and status <> 'alocado') with check (pro_id = auth.uid() and status <> 'alocado');
create policy nec_read on public.necessidades for select to authenticated using (cliente_id = auth.uid() or public.is_admin());
create policy nec_ins on public.necessidades for insert to authenticated with check (cliente_id = auth.uid());
create policy nec_upd on public.necessidades for update to authenticated using (cliente_id = auth.uid() or public.is_admin()) with check (cliente_id = auth.uid() or public.is_admin());
create policy ctr_read on public.contratacoes for select to authenticated using (cliente_id = auth.uid() or pro_id = auth.uid() or public.is_admin());
create policy ctrp_read on public.contratacao_pro for select to authenticated using (
  public.is_admin() or exists(select 1 from public.contratacoes x where x.id = contratacao_id and x.pro_id = auth.uid()));
create policy ctrc_read on public.contratacao_cliente for select to authenticated using (
  public.is_admin() or exists(select 1 from public.contratacoes x where x.id = contratacao_id and x.cliente_id = auth.uid()));
create policy ctrs_read on public.contratacao_split for select to authenticated using (public.is_admin());
create policy pag_read on public.pagamentos for select to authenticated using (public.is_admin());
create policy rep_admin on public.repasses_mind for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy msg_read on public.mensagens for select to authenticated using (public.parte(contratacao_id));
create policy msg_ins on public.mensagens for insert to authenticated with check (public.parte(contratacao_id));
create policy aval_read on public.avaliacoes for select to authenticated using (cliente_id = auth.uid() or pro_id = auth.uid() or public.is_admin());
create policy aval_ins on public.avaliacoes for insert to authenticated with check (cliente_id = auth.uid());
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.parte(uuid) to authenticated;
grant execute on function public.so_digitos(text) to authenticated;
grant execute on function public.preco_cliente(numeric) to authenticated;
grant execute on function public.catalogo() to anon, authenticated;
grant execute on function public.agenda_pro(uuid) to anon, authenticated;
grant execute on function public.avaliacoes_pro(uuid) to anon, authenticated;
grant execute on function public.contato(uuid) to authenticated;
grant execute on function public.escolher_papel(text) to authenticated;
grant execute on function public.is_sys() to authenticated;
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.mensagens';
  end if;
end $$;
do $$ begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
    values ('docs', 'docs', false, 8388608, array['application/pdf','image/jpeg','image/png','image/webp'])
    on conflict (id) do nothing;
    execute $p$create policy docs_own_read on storage.objects for select to authenticated
      using (bucket_id = 'docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()))$p$;
    execute $p$create policy docs_own_write on storage.objects for insert to authenticated
      with check (bucket_id = 'docs' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy docs_own_upd on storage.objects for update to authenticated
      using (bucket_id = 'docs' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  end if;
end $$;
create schema if not exists mindsaas;
create or replace function mindsaas.debcare_cobranca()
returns table (referencia text, devido numeric, pago numeric, saldo numeric, atendimentos int, ultimo_pagamento timestamptz)
language sql stable security definer set search_path = public as $$
  with d as (
    select to_char(p.updated_at at time zone 'America/Sao_Paulo', 'YYYY-MM') ref, sum(p.mind) v, count(*)::int n, max(p.updated_at) ult
      from public.pagamentos p where p.status = 'approved' group by 1),
  r as (select referencia ref, sum(valor) v from public.repasses_mind group by 1)
  select coalesce(d.ref, r.ref), coalesce(d.v, 0), coalesce(r.v, 0), coalesce(d.v, 0) - coalesce(r.v, 0), coalesce(d.n, 0), d.ult
    from d full join r on r.ref = d.ref
   order by 1 desc
$$;
revoke all on function mindsaas.debcare_cobranca() from public, anon, authenticated;
grant usage on schema mindsaas to service_role;
grant execute on function mindsaas.debcare_cobranca() to service_role;
revoke execute on function public.preco_cliente(numeric) from authenticated;
revoke execute on function public.so_digitos(text) from authenticated;
alter function public.so_digitos(text) set search_path = public;
revoke execute on function public.is_sys() from authenticated;
alter table public.pros
  add column if not exists coren_status text not null default 'pendente'
    check (coren_status in ('pendente', 'ativo', 'irregular')),
  add column if not exists coren_conferido_em timestamptz;
alter table public.pros drop constraint if exists pros_coren_uf_check;
alter table public.pros add constraint pros_coren_uf_check check (coren_uf is null or coren_uf in
  ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'));
create or replace function public.pros_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.coren := nullif(trim(new.coren), '');
  new.coren_uf := nullif(upper(trim(new.coren_uf)), '');
  if not public.is_admin() and not public.is_sys() then
    if tg_op = 'UPDATE' then
      new.verificado := old.verificado; new.rating := old.rating; new.n_avaliacoes := old.n_avaliacoes;
      new.coren_status := old.coren_status; new.coren_conferido_em := old.coren_conferido_em;
      if new.coren is distinct from old.coren or new.coren_uf is distinct from old.coren_uf
         or new.especialidade is distinct from old.especialidade then
        new.verificado := false; new.coren_status := 'pendente'; new.coren_conferido_em := null;
      end if;
    else
      new.verificado := false; new.rating := null; new.n_avaliacoes := 0;
      new.coren_status := 'pendente'; new.coren_conferido_em := null;
    end if;
  end if;
  if new.publicado and new.especialidade in ('tecnico', 'enfermeiro') and (new.coren is null or new.coren_uf is null) then
    raise exception 'Para técnico(a) de enfermagem e enfermeiro(a), informe o número do COREN e a UF';
  end if;
  new.updated_at := now();
  return new;
end $$;
create or replace function public.catalogo()
returns table (user_id uuid, nome text, avatar_url text, especialidade text, titulo text, resumo text,
  experiencia_anos int, cidade text, uf text, regioes text, atende text[], habilidades text[], genero text,
  tem_coren boolean, verificado boolean, rating numeric, n_avaliacoes int,
  preco_hora numeric, preco_12h numeric, preco_24h numeric)
language sql stable security definer set search_path = public as $$
  select p.user_id,
         split_part(trim(p.nome), ' ', 1) ||
           case when position(' ' in trim(p.nome)) > 0
                then ' ' || left(split_part(trim(p.nome), ' ', array_length(string_to_array(trim(p.nome), ' '), 1)), 1) || '.'
                else '' end,
         p.avatar_url, p.especialidade, p.titulo, p.resumo, p.experiencia_anos, p.cidade, p.uf, p.regioes,
         p.atende, p.habilidades, p.genero, p.coren_status = 'ativo', p.verificado, p.rating, p.n_avaliacoes,
         public.preco_cliente(p.valor_hora), public.preco_cliente(p.valor_12h), public.preco_cliente(p.valor_24h)
    from public.pros p
   where p.publicado and p.valor_hora is not null and p.especialidade is not null
     and (p.especialidade not in ('tecnico', 'enfermeiro') or p.coren_status = 'ativo')
   order by p.verificado desc, p.rating desc nulls last, p.n_avaliacoes desc, random()
$$;
update public.profiles set email = nullif(lower(trim(email)), '');
create unique index if not exists profiles_email_unico on public.profiles (lower(email)) where email is not null;
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and not public.is_sys() then
    new.role := old.role; new.telefone := old.telefone;
  end if;
  new.email := nullif(lower(trim(new.email)), '');
  if new.email is not null and new.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail inválido';
  end if;
  return new;
end $$;
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare adm jsonb; tel text; em text;
begin
  select value into adm from public.config where key = 'admins';
  tel := public.so_digitos(coalesce(new.raw_user_meta_data->>'phone',
           case when new.email like '%@tel.debcare.app' then split_part(new.email, '@', 1) end, new.phone));
  em := nullif(lower(trim(new.raw_user_meta_data->>'contact_email')), '');
  if em is not null and (em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
                         or exists (select 1 from public.profiles where lower(email) = em)) then
    em := null;   -- e-mail inválido ou já usado: a conta é criada sem ele
  end if;
  insert into public.profiles(id, nome, telefone, role, email)
  values (new.id,
          coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'Sem nome'),
          tel,
          case when tel <> '' and adm ? tel then 'admin' else null end,
          em);
  return new;
end $$;
insert into public.config(key, value) values ('gestores_mind', '["5511992009906"]'::jsonb)
  on conflict (key) do nothing;
update public.config
   set value = (select to_jsonb(array(select distinct x from jsonb_array_elements_text(value || '["5511992009906"]'::jsonb) x))),
       updated_at = now()
 where key = 'admins';
create or replace function mindsaas.contas()
returns json language sql stable security definer set search_path = public, auth as $$
  select coalesce(json_agg(x order by x.criado desc), '[]'::json) from (
    select p.id, 'user'::text as tipo, p.nome, p.nome as responsavel, p.email, p.telefone,
           u.created_at as criado, u.last_sign_in_at as ultimo_acesso,
           (u.banned_until is not null and u.banned_until > now()) as bloqueado,
           'free'::text as plano, coalesce(p.role, 'sem_papel') as papel,
           pr.especialidade, pr.publicado, pr.verificado, pr.coren, pr.coren_uf, pr.coren_status, pr.cidade, pr.uf,
           pr.valor_hora, pr.valor_12h, pr.valor_24h, pr.rating, pr.n_avaliacoes,
           (select count(*) from public.contratacoes c where c.pro_id = p.id or c.cliente_id = p.id)::int as contratacoes,
           (select count(*) from public.contratacoes c where (c.pro_id = p.id or c.cliente_id = p.id) and c.status in ('confirmado','concluido'))::int as pagas,
           (select coalesce(sum(g.valor_total), 0) from public.pagamentos g join public.contratacoes c on c.id = g.contratacao_id
             where g.status = 'approved' and (c.pro_id = p.id or c.cliente_id = p.id)) as movimentado,
           (select coalesce(sum(g.mind), 0) from public.pagamentos g join public.contratacoes c on c.id = g.contratacao_id
             where g.status = 'approved' and (c.pro_id = p.id or c.cliente_id = p.id)) as mind_gerado,
           exists (select 1 from public.mp_contas m where m.user_id = p.id) as mp_conectado
      from public.profiles p
      join auth.users u on u.id = p.id
      left join public.pros pr on pr.user_id = p.id
  ) x
$$;
create or replace function mindsaas.bloquear(tipo text, alvo uuid, bloquear boolean)
returns int language plpgsql security definer set search_path = public, auth as $$
declare n int;
begin
  update auth.users set banned_until = case when bloquear then 'infinity'::timestamptz else null end where id = alvo;
  get diagnostics n = row_count;
  if bloquear then
    delete from auth.sessions where user_id = alvo;
    perform set_config('dc.sys', '1', true);
    update public.pros set publicado = false where user_id = alvo;   -- sai do catálogo
    perform set_config('dc.sys', '', true);
  end if;
  return n;
end $$;
revoke all on function mindsaas.contas() from public, anon, authenticated;
revoke all on function mindsaas.bloquear(text, uuid, boolean) from public, anon, authenticated;
grant execute on function mindsaas.contas() to service_role;
grant execute on function mindsaas.bloquear(text, uuid, boolean) to service_role;
alter table public.contratacoes add column if not exists proposta jsonb;
create index if not exists avaliacoes_cliente_idx on public.avaliacoes(cliente_id);
create index if not exists avaliacoes_pro_idx on public.avaliacoes(pro_id);
create index if not exists contratacoes_necessidade_idx on public.contratacoes(necessidade_id);
create index if not exists mensagens_autor_idx on public.mensagens(autor);
create index if not exists repasses_mind_created_by_idx on public.repasses_mind(created_by);
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
alter table public.contratacoes add column if not exists proposta_valor jsonb;
alter table public.contratacao_cliente add column if not exists proposta_total numeric(14,2);
alter table public.contratacao_pro add column if not exists proposta_total numeric(14,2);
alter table public.contratacao_split add column if not exists proposta_base numeric(12,2);
alter table public.contratacao_split add column if not exists base_negociada numeric(12,2);
alter table public.mensagens add column if not exists tipo text not null default 'texto';
do $$ begin
  alter table public.mensagens add constraint mensagens_tipo_chk check (tipo in ('texto','proposta','aceita','recusada'));
exception when duplicate_object then null; end $$;
create or replace function public.mensagens_mask() returns trigger
language plpgsql security definer set search_path = public as $$
declare st text;
begin
  if public.is_sys() then return new; end if;   -- servidor (mensagens de negociação) grava como está
  select status into st from public.contratacoes where id = new.contratacao_id;
  new.autor := auth.uid();
  new.tipo := 'texto';
  if st not in ('confirmado','concluido') then
    new.texto := regexp_replace(new.texto, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[contato oculto]', 'g');
    new.texto := regexp_replace(new.texto, '(https?://|www\.)\S+', '[link oculto]', 'gi');
    new.texto := regexp_replace(new.texto, '(\+?55[\s.-]?)?\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}', '[contato oculto]', 'g');
  end if;
  return new;
end $$;
alter table public.profiles add column if not exists foto_url text;
do $$ begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
    values ('fotos', 'fotos', true, 2097152, array['image/jpeg','image/png','image/webp'])
    on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg','image/png','image/webp'];
    execute 'drop policy if exists fotos_own_ins on storage.objects';
    execute 'drop policy if exists fotos_own_upd on storage.objects';
    execute 'drop policy if exists fotos_own_del on storage.objects';
    execute 'drop policy if exists fotos_own_sel on storage.objects';
    execute $p$create policy fotos_own_sel on storage.objects for select to authenticated
      using (bucket_id = 'fotos' and name = auth.uid()::text || '.jpg')$p$;
    execute $p$create policy fotos_own_ins on storage.objects for insert to authenticated
      with check (bucket_id = 'fotos' and name = auth.uid()::text || '.jpg')$p$;
    execute $p$create policy fotos_own_upd on storage.objects for update to authenticated
      using (bucket_id = 'fotos' and name = auth.uid()::text || '.jpg')$p$;
    execute $p$create policy fotos_own_del on storage.objects for delete to authenticated
      using (bucket_id = 'fotos' and name = auth.uid()::text || '.jpg')$p$;
  end if;
end $$;
alter table public.contratacoes add column if not exists tipo text not null default 'avulso';
alter table public.contratacoes add column if not exists empresa_nome text;
alter table public.contratacoes add column if not exists empresa_cnpj text;
do $$ begin
  alter table public.contratacoes add constraint contratacoes_tipo_chk check (tipo in ('avulso','fixo'));
exception when duplicate_object then null; end $$;
alter table public.necessidades add column if not exists tipo text not null default 'avulso';
alter table public.necessidades add column if not exists empresa_nome text;
alter table public.necessidades add column if not exists meses int;
do $$ begin
  alter table public.necessidades add constraint necessidades_tipo_chk check (tipo in ('avulso','fixo'));
  alter table public.necessidades add constraint necessidades_meses_chk check (meses is null or meses between 1 and 12);
exception when duplicate_object then null; end $$;
create table if not exists public.contratacao_parcelas (
  id uuid primary key default gen_random_uuid(),
  contratacao_id uuid not null references public.contratacoes(id) on delete cascade,
  n int not null,
  inicio date not null,
  fim date not null,
  dias int not null,
  quantidade numeric(10,2) not null,
  vence_em date,
  status text not null default 'pendente' check (status in ('pendente','pago')),
  pago_em timestamptz,
  pagamento_id uuid references public.pagamentos(id) on delete set null,
  unique (contratacao_id, n)
);
create index if not exists contratacao_parcelas_pag_idx on public.contratacao_parcelas(pagamento_id);
alter table public.contratacao_parcelas enable row level security;
drop policy if exists parc_read on public.contratacao_parcelas;
create policy parc_read on public.contratacao_parcelas for select to authenticated using (public.parte(contratacao_id));
grant select on public.contratacao_parcelas to authenticated;
alter table public.pagamentos add column if not exists parcela int;
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
alter table public.contratacoes drop constraint if exists contratacoes_tipo_chk;
alter table public.contratacoes add constraint contratacoes_tipo_chk check (tipo in ('avulso','fixo','clt'));
alter table public.contratacoes add column if not exists clt jsonb;
insert into public.config(key, value) values ('taxa_clt', '20') on conflict (key) do nothing;
create or replace function public.taxa_clt_cliente() returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::numeric from public.config where key = 'taxa_clt'), 20)
       + coalesce((select (value #>> '{}')::numeric from public.config where key = 'taxa_mind'), 10)
$$;
grant execute on function public.taxa_clt_cliente() to anon, authenticated;

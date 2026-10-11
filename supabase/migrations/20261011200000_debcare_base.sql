-- DebCare · banco base
-- Contratação de profissionais de saúde e cuidado: enfermeiros, técnicos de enfermagem,
-- cuidadores e acompanhantes hospitalares.
-- Papéis: pro (profissional), cliente (contratante), admin (central DebCare e equipe Mind).
--
-- Regras de dinheiro:
--   o profissional define o valor dele (hora, plantão 12h, plantão 24h);
--   o contratante vê esse valor + 15% DebCare + 10% Mind (soma simples sobre o valor do profissional);
--   o pagamento cai na conta Mercado Pago do profissional e os 25% vão para a conta da DebCare pelo split;
--   a DebCare repassa à Mind os 10% dela (controle no painel).
-- Quem vê o quê:
--   contratante só vê o preço final (tabela contratacao_cliente e função catalogo);
--   profissional só vê o valor dele (tabela contratacao_pro);
--   a divisão (contratacao_split, pagamentos, repasses_mind) só o painel vê.
-- Toda conta de dinheiro é feita no servidor (api/contratar.js, api/pagar.js) com a chave de serviço.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- configuração
create table public.config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.config(key, value) values
  ('taxa_debcare', '15'),
  ('taxa_mind', '10'),
  ('admins', '[]'),               -- celulares da central/Mind, só dígitos com 55 (ex.: "5516999990000")
  ('central_whatsapp', '""');     -- WhatsApp da central DebCare, só dígitos com 55

-- ---------------------------------------------------------------- utilidades
create or replace function public.so_digitos(s text) returns text
language sql immutable as $$ select regexp_replace(coalesce(s, ''), '\D', '', 'g') $$;

-- preço ao contratante: valor do profissional + taxas somadas (soma simples)
create or replace function public.preco_cliente(v numeric) returns numeric
language sql stable security definer set search_path = public as $$
  select case when v is null then null else round(v * (1 + (
    coalesce((select (value #>> '{}')::numeric from public.config where key = 'taxa_debcare'), 15) +
    coalesce((select (value #>> '{}')::numeric from public.config where key = 'taxa_mind'), 10)) / 100), 2) end
$$;

-- ---------------------------------------------------------------- perfis
-- login por celular + senha: o e-mail técnico é <dígitos>@tel.debcare.app e o celular vai em telefone
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

-- rotinas do sistema (service role ou funções internas) passam pelos guardas
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

-- celulares adicionados à equipe no painel viram administradores (também para quem já tem conta)
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

-- ---------------------------------------------------------------- profissionais
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
  verificado boolean not null default false, -- selo DebCare: documentos e COREN conferidos
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
-- credenciais do Mercado Pago do profissional: só o servidor lê (sem políticas)
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

-- ---------------------------------------------------------------- catálogo (o que o contratante vê)
-- nome abreviado, sem documentos e com preços já com as taxas; o valor do profissional não sai daqui
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

-- ---------------------------------------------------------------- necessidades (vão para a central)
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
      -- o contratante só pode cancelar; a central conduz o resto
      if new.status <> old.status and new.status <> 'cancelada' then new.status := old.status; end if;
      new.nota_central := old.nota_central; new.cliente_id := old.cliente_id;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger necessidades_guard before insert or update on public.necessidades
  for each row execute function public.necessidades_guard();

-- ---------------------------------------------------------------- contratações
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

-- o que o profissional recebe (só profissional e painel)
create table public.contratacao_pro (
  contratacao_id uuid primary key references public.contratacoes(id) on delete cascade,
  valor_unit numeric(12,2) not null,
  total numeric(14,2) not null
);
-- o que o contratante paga (só contratante e painel)
create table public.contratacao_cliente (
  contratacao_id uuid primary key references public.contratacoes(id) on delete cascade,
  valor_unit numeric(12,2) not null,
  total numeric(14,2) not null
);
-- divisão (só painel)
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
  taxa numeric(14,2) not null,              -- marketplace_fee: DebCare + Mind
  debcare numeric(14,2) not null,
  mind numeric(14,2) not null,
  mp_pref_id text,
  mp_payment_id text,
  status text not null default 'pendente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.pagamentos(contratacao_id);

-- repasses da DebCare para a Mind (os 10% da gestora da plataforma)
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

-- ---------------------------------------------------------------- acesso
create or replace function public.parte(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.contratacoes x where x.id = c
    and (x.pro_id = auth.uid() or x.cliente_id = auth.uid() or public.is_admin()))
$$;

-- contatos ficam ocultos no chat até o pagamento
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

-- telefone da outra parte, só depois do pagamento
create or replace function public.contato(c uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when x.pro_id = auth.uid() then (select telefone from public.profiles where id = x.cliente_id)
              when x.cliente_id = auth.uid() then (select telefone from public.profiles where id = x.pro_id)
              when public.is_admin() then null end
    from public.contratacoes x
   where x.id = c and x.status in ('confirmado','concluido')
$$;

-- avaliação: só o contratante, depois de concluído
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

-- avaliações públicas de um profissional (sem nome do contratante)
create or replace function public.avaliacoes_pro(p uuid)
returns table (nota int, comentario text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select nota, comentario, created_at from public.avaliacoes where pro_id = p order by created_at desc limit 10
$$;

-- disponibilidade pública (só o status do dia)
create or replace function public.agenda_pro(p uuid)
returns table (dia date, status text)
language sql stable security definer set search_path = public as $$
  select a.dia, a.status from public.agenda a
    join public.pros x on x.user_id = a.pro_id and x.publicado
   where a.pro_id = p and a.dia between current_date and current_date + 90
   order by a.dia
$$;

-- escolha do papel no primeiro acesso
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

-- ---------------------------------------------------------------- RLS
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

-- só o WhatsApp da central é público; taxas e lista da central ficam com o painel (o contratante não vê a divisão)
create policy config_publico on public.config for select to anon, authenticated using (key = 'central_whatsapp');
create policy config_read on public.config for select to authenticated using (public.is_admin());
create policy config_admin on public.config for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy profiles_self on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_upd on public.profiles for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- o perfil completo (com o valor do profissional) só para ele mesmo e o painel; o contratante usa catalogo()
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

-- ---------------------------------------------------------------- permissões das funções
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

-- realtime do chat
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.mensagens';
  end if;
end $$;

-- ---------------------------------------------------------------- documentos do profissional
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

-- ---------------------------------------------------------------- MindSaaS: cobrança dos 10% da Mind
-- Cada pagamento aprovado gera a parte da Mind (pagamentos.mind). A DebCare recebe tudo pelo split
-- e repassa à Mind; o painel MindSaaS lê este resumo para alertar quando há valor a cobrar.
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

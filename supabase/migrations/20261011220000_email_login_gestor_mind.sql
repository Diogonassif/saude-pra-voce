-- 1) Entrar também com e-mail: o e-mail do perfil é único (sem diferenciar maiúsculas) e pode ser
--    informado no cadastro. O login por e-mail passa pela função /api/entrar, que acha a conta pelo e-mail.
-- 2) Gestores da Mind: celulares que entram no Painel Mind e podem ver o app como qualquer perfil.

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

-- gestores da Mind (celulares com DDI, só dígitos). Também viram administradores.
insert into public.config(key, value) values ('gestores_mind', '["5511992009906"]'::jsonb)
  on conflict (key) do nothing;
update public.config
   set value = (select to_jsonb(array(select distinct x from jsonb_array_elements_text(value || '["5511992009906"]'::jsonb) x))),
       updated_at = now()
 where key = 'admins';

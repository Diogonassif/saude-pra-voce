-- COREN obrigatório para técnico(a) de enfermagem e enfermeiro(a), com conferência pela central.
-- Enfermagem só aparece no catálogo depois que a central confirma o COREN como ativo no Cofen.

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
  -- enfermagem publicada precisa de COREN e UF
  if new.publicado and new.especialidade in ('tecnico', 'enfermeiro') and (new.coren is null or new.coren_uf is null) then
    raise exception 'Para técnico(a) de enfermagem e enfermeiro(a), informe o número do COREN e a UF';
  end if;
  new.updated_at := now();
  return new;
end $$;

-- catálogo: enfermagem só com COREN conferido como ativo
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

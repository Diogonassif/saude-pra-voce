-- MindSaaS: lista as contas da Saúde Pra Você (profissionais, contratantes e gestão) no formato comum do painel
-- e permite bloquear/liberar o acesso. Só o painel da Mind (service role / conector) executa.

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

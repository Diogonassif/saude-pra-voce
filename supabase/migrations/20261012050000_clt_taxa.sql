-- Vaga CLT com taxa de serviço: a Saúde Pra Você fica com 20% do salário mensal oferecido pela empresa
-- (pagamento do serviço de encontrar o profissional) e a Mind com os 10% dela somados por cima.
-- A empresa paga uma única vez, quando registra no app que o contrato foi assinado ("Contratado").
-- O valor cai na conta Mercado Pago da Saúde Pra Você, que repassa a parte da Mind (como nos atendimentos).
insert into public.config(key, value) values ('taxa_clt', '20') on conflict (key) do nothing;

-- % total que a empresa paga sobre um salário (Saúde Pra Você + Mind), sem mostrar a divisão
create or replace function public.taxa_clt_cliente() returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::numeric from public.config where key = 'taxa_clt'), 20)
       + coalesce((select (value #>> '{}')::numeric from public.config where key = 'taxa_mind'), 10)
$$;
grant execute on function public.taxa_clt_cliente() to anon, authenticated;

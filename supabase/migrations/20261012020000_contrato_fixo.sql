-- Contrato fixo: clínica ou empresa contrata um profissional por um período (até 12 meses), com pagamento mensal.
alter table public.contratacoes add column if not exists tipo text not null default 'avulso';
alter table public.contratacoes add column if not exists empresa_nome text;
alter table public.contratacoes add column if not exists empresa_cnpj text;
do $$ begin
  alter table public.contratacoes add constraint contratacoes_tipo_chk check (tipo in ('avulso','fixo'));
exception when duplicate_object then null; end $$;

-- pedido à central também pode ser de contrato fixo
alter table public.necessidades add column if not exists tipo text not null default 'avulso';
alter table public.necessidades add column if not exists empresa_nome text;
alter table public.necessidades add column if not exists meses int;
do $$ begin
  alter table public.necessidades add constraint necessidades_tipo_chk check (tipo in ('avulso','fixo'));
  alter table public.necessidades add constraint necessidades_meses_chk check (meses is null or meses between 1 and 12);
exception when duplicate_object then null; end $$;

-- parcelas mensais do contrato fixo. Os valores não ficam aqui: cada parte calcula a parcela a partir do próprio total
-- (proporcional à quantidade de horas/plantões do mês), então o contratante não vê o valor do profissional e vice-versa.
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

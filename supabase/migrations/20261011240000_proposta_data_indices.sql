-- Nova data proposta (pela central ou pelo profissional) que o contratante aceita ou recusa no app.
-- Formato: {"por":"pro"|"central","inicio":"AAAA-MM-DD","fim":"AAAA-MM-DD","horario":"HH:MM","nota":"...","em":"timestamp"}
alter table public.contratacoes add column if not exists proposta jsonb;

-- índices das chaves estrangeiras apontados pelo verificador de desempenho do Supabase
create index if not exists avaliacoes_cliente_idx on public.avaliacoes(cliente_id);
create index if not exists avaliacoes_pro_idx on public.avaliacoes(pro_id);
create index if not exists contratacoes_necessidade_idx on public.contratacoes(necessidade_id);
create index if not exists mensagens_autor_idx on public.mensagens(autor);
create index if not exists repasses_mind_created_by_idx on public.repasses_mind(created_by);

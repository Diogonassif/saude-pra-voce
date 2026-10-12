-- Contratação CLT: a empresa usa o app só para encontrar o profissional e manifestar interesse em contratá-lo
-- com carteira assinada. Não há pagamento pelo app; quando o profissional responde "tenho interesse",
-- os contatos são liberados para os dois combinarem a contratação diretamente.
alter table public.contratacoes drop constraint if exists contratacoes_tipo_chk;
alter table public.contratacoes add constraint contratacoes_tipo_chk check (tipo in ('avulso','fixo','clt'));
-- detalhes da vaga: {"cargo":"...","salario":2500,"jornada":"12x36 noturno","beneficios":"..."}
alter table public.contratacoes add column if not exists clt jsonb;

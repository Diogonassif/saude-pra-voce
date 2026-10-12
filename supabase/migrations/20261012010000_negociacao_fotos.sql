-- 1) Negociação de valor no chat da contratação (contratante ↔ profissional, antes do pagamento)
-- contratacoes.proposta_valor = {"por":"cliente"|"pro","em":"timestamp","nota":"..."} (visível às duas partes)
-- o valor de cada lado fica na tabela que só aquela parte vê: contratacao_cliente.proposta_total (o que o contratante pagaria)
-- e contratacao_pro.proposta_total (o que o profissional receberia). A base negociada fica na divisão (só o painel).
alter table public.contratacoes add column if not exists proposta_valor jsonb;
alter table public.contratacao_cliente add column if not exists proposta_total numeric(14,2);
alter table public.contratacao_pro add column if not exists proposta_total numeric(14,2);
alter table public.contratacao_split add column if not exists proposta_base numeric(12,2);
alter table public.contratacao_split add column if not exists base_negociada numeric(12,2);

-- mensagens do sistema no chat (proposta enviada, aceita, recusada): só o servidor grava esse tipo
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

-- 2) Foto de perfil (selfie) de contratantes e profissionais
-- arquivo público em fotos/<id do usuário>.jpg; o profissional também grava em pros.avatar_url (catálogo)
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

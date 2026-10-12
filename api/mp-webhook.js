// Aviso de pagamento do Mercado Pago. Nunca confia no corpo: consulta o pagamento na API com o token do profissional.
import { send, readJson, admin, one, isUuid, handler, sendEmail, shell, escH, brl, emailDe, emailCentral, diasDoPeriodo, alocar, env } from './_lib.js';

export default handler(async (req, res) => {
  const b = req.method === 'POST' ? await readJson(req) : {};
  const q = new URL(req.url, 'http://x').searchParams;
  const pgId = q.get('pg');
  const payId = String((b.data && b.data.id) || q.get('data.id') || q.get('id') || '').replace(/\D/g, '');
  const tipo = b.type || q.get('type') || q.get('topic');
  if (!isUuid(pgId) || !payId || (tipo && tipo !== 'payment')) return send(res, 200, { ok: true, ignorado: true });

  const pg = await one(`pagamentos?id=eq.${pgId}&select=*`);
  if (!pg) return send(res, 200, { ok: true });
  const c = await one(`contratacoes?id=eq.${pg.contratacao_id}&select=*`);
  // vaga CLT: a taxa é cobrada na conta da própria Saúde Pra Você; os atendimentos, na conta do profissional
  const token = c.tipo === 'clt' ? env('MP_ACCESS_TOKEN') : ((await one(`mp_contas?user_id=eq.${c.pro_id}&select=access_token`)) || {}).access_token;
  if (!token) return send(res, 200, { ok: true });

  const r = await fetch('https://api.mercadopago.com/v1/payments/' + payId, { headers: { authorization: 'Bearer ' + token } });
  if (!r.ok) return send(res, 200, { ok: true });
  const pay = await r.json();
  if (String(pay.external_reference) !== pg.id) return send(res, 200, { ok: true });
  if (Math.abs(+pay.transaction_amount - +pg.valor_total) > 0.01) return send(res, 200, { ok: true, divergente: true });

  const st = pay.status; // approved, pending, rejected, refunded, charged_back...
  await admin(`pagamentos?id=eq.${pg.id}`, { method: 'PATCH', body: { mp_payment_id: payId, status: st, updated_at: new Date().toISOString() } });
  // vaga CLT: taxa paga → contratação registrada
  if (c.tipo === 'clt') {
    if (st === 'approved' && pg.status !== 'approved' && c.status === 'confirmado') {
      const agora = new Date().toISOString();
      await admin(`contratacoes?id=eq.${c.id}`, { method: 'PATCH', body: { status: 'concluido', pago_em: agora, concluido_em: agora, updated_at: agora } });
      if (c.necessidade_id) await admin(`necessidades?id=eq.${c.necessidade_id}`, { method: 'PATCH', body: { status: 'atendida', updated_at: agora } });
      const cargo = escH((c.clt && c.clt.cargo) || 'vaga CLT');
      sendEmail({ to: await emailDe(c.cliente_id), subject: `Contratação registrada · vaga CLT #${c.codigo}`,
        html: shell('Taxa paga, contratação registrada', `<p>Recebemos a taxa de serviço de <b>${brl(pg.valor_total)}</b> pela contratação de ${escH(c.pro_nome)} (${cargo}). Obrigado por usar a Saúde Pra Você!</p>`) });
      sendEmail({ to: await emailDe(c.pro_id), subject: `Parabéns pela contratação · ${c.empresa_nome || 'vaga CLT'}`,
        html: shell('Contratação registrada', `<p>${escH(c.empresa_nome || c.cliente_nome)} registrou a sua contratação como ${cargo} (CLT). Boa parceria!</p>`) });
      sendEmail({ to: await emailCentral(), subject: `Taxa CLT paga #${c.codigo}: ${brl(pg.valor_total)}`,
        html: shell('Taxa de contratação CLT recebida', `<p>${escH(c.empresa_nome || c.cliente_nome)} → ${escH(c.pro_nome)} · ${cargo}. Taxa ${brl(pg.valor_total)} (Saúde Pra Você ${brl(pg.debcare)} · Mind ${brl(pg.mind)}).</p>`) });
    }
    if (['refunded', 'charged_back'].includes(st) && pg.status === 'approved')
      sendEmail({ to: await emailCentral(), subject: `Estorno da taxa CLT #${c.codigo}`, html: shell('Taxa estornada', `<p>${escH(c.empresa_nome || c.cliente_nome)}: ${brl(pg.valor_total)} (${escH(st)}).</p>`) });
    return send(res, 200, { ok: true });
  }
  // contrato fixo: marca a parcela como paga
  let parc = null;
  if (st === 'approved' && pg.status !== 'approved' && pg.parcela) {
    await admin(`contratacao_parcelas?contratacao_id=eq.${c.id}&n=eq.${pg.parcela}`, { method: 'PATCH', body: { status: 'pago', pago_em: new Date().toISOString(), pagamento_id: pg.id } });
    const P = (await admin(`contratacao_parcelas?contratacao_id=eq.${c.id}&select=n,quantidade&order=n`)) || [];
    const pro = await one(`contratacao_pro?contratacao_id=eq.${c.id}&select=total`);
    parc = { n: pg.parcela, de: P.length, pro: pro ? alocar(pro.total, P.map((x) => +x.quantidade), P.findIndex((x) => x.n === pg.parcela)) : null };
    if (c.status === 'confirmado') {
      sendEmail({ to: await emailDe(c.cliente_id), subject: `Parcela ${parc.n}/${parc.de} paga · contrato #${c.codigo}`, html: shell('Parcela paga', `<p>Recebemos a parcela ${parc.n} de ${parc.de} do contrato com ${escH(c.pro_nome)}. Obrigado!</p>`) });
      sendEmail({ to: await emailDe(c.pro_id), subject: `Parcela ${parc.n}/${parc.de} paga · contrato #${c.codigo}`, html: shell('Parcela paga', `<p>${escH(c.empresa_nome || c.cliente_nome)} pagou a parcela ${parc.n} de ${parc.de}. Você recebe <b>${brl(parc.pro)}</b> na sua conta Mercado Pago.</p>`) });
    }
  }
  if (st === 'approved' && pg.status !== 'approved' && c.status === 'aceito') {
    await admin(`contratacoes?id=eq.${c.id}`, { method: 'PATCH', body: { status: 'confirmado', pago_em: new Date().toISOString(), updated_at: new Date().toISOString() } });
    const dias = diasDoPeriodo(c.inicio, c.fim, c.dias_semana || [0, 1, 2, 3, 4, 5, 6]);
    if (dias.length) await admin('agenda?on_conflict=pro_id,dia', { method: 'POST', prefer: 'resolution=merge-duplicates',
      body: dias.map((dia) => ({ pro_id: c.pro_id, dia, status: 'alocado' })) });
    if (c.necessidade_id) await admin(`necessidades?id=eq.${c.necessidade_id}`, { method: 'PATCH', body: { status: 'atendida', updated_at: new Date().toISOString() } });
    const pro = await one(`contratacao_pro?contratacao_id=eq.${c.id}&select=total`);
    sendEmail({ to: await emailDe(c.cliente_id), subject: 'Pagamento confirmado · Saúde Pra Você', html: shell('Atendimento confirmado', `<p>${escH(c.pro_nome)} está confirmado(a). O contato dele(a) já aparece no app.</p>`) });
    sendEmail({ to: await emailDe(c.pro_id), subject: parc ? 'Contrato fixo confirmado · Saúde Pra Você' : 'Atendimento pago · Saúde Pra Você', html: shell(parc ? 'Contrato confirmado' : 'Atendimento confirmado e pago', parc
      ? `<p>${escH(c.empresa_nome || c.cliente_nome)} pagou a 1ª parcela (de ${parc.de}) do contrato fixo. Você recebe <b>${brl(parc.pro)}</b> agora e o restante mês a mês, a cada parcela paga.</p>`
      : `<p>${escH(c.cliente_nome)} pagou. Você recebe <b>${brl(pro && pro.total)}</b> na sua conta Mercado Pago.</p>`) });
  }
  if (['refunded', 'charged_back'].includes(st) && pg.status === 'approved') {
    sendEmail({ to: await emailCentral(), subject: `Estorno no atendimento #${c.codigo}`, html: shell('Pagamento estornado', `<p>${escH(c.cliente_nome)} → ${escH(c.pro_nome)}: ${brl(pg.valor_total)} (${escH(st)}). Confira o atendimento no painel.</p>`) });
  }
  return send(res, 200, { ok: true });
});

// Aviso de pagamento do Mercado Pago. Nunca confia no corpo: consulta o pagamento na API com o token do profissional.
import { send, readJson, admin, one, isUuid, handler, sendEmail, shell, escH, brl, emailDe, emailCentral, diasDoPeriodo } from './_lib.js';

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
  const conta = await one(`mp_contas?user_id=eq.${c.pro_id}&select=access_token`);
  if (!conta || !conta.access_token) return send(res, 200, { ok: true });

  const r = await fetch('https://api.mercadopago.com/v1/payments/' + payId, { headers: { authorization: 'Bearer ' + conta.access_token } });
  if (!r.ok) return send(res, 200, { ok: true });
  const pay = await r.json();
  if (String(pay.external_reference) !== pg.id) return send(res, 200, { ok: true });
  if (Math.abs(+pay.transaction_amount - +pg.valor_total) > 0.01) return send(res, 200, { ok: true, divergente: true });

  const st = pay.status; // approved, pending, rejected, refunded, charged_back...
  await admin(`pagamentos?id=eq.${pg.id}`, { method: 'PATCH', body: { mp_payment_id: payId, status: st, updated_at: new Date().toISOString() } });
  if (st === 'approved' && pg.status !== 'approved' && c.status === 'aceito') {
    await admin(`contratacoes?id=eq.${c.id}`, { method: 'PATCH', body: { status: 'confirmado', pago_em: new Date().toISOString(), updated_at: new Date().toISOString() } });
    const dias = diasDoPeriodo(c.inicio, c.fim, c.dias_semana || [0, 1, 2, 3, 4, 5, 6]);
    if (dias.length) await admin('agenda?on_conflict=pro_id,dia', { method: 'POST', prefer: 'resolution=merge-duplicates',
      body: dias.map((dia) => ({ pro_id: c.pro_id, dia, status: 'alocado' })) });
    if (c.necessidade_id) await admin(`necessidades?id=eq.${c.necessidade_id}`, { method: 'PATCH', body: { status: 'atendida', updated_at: new Date().toISOString() } });
    const pro = await one(`contratacao_pro?contratacao_id=eq.${c.id}&select=total`);
    sendEmail({ to: await emailDe(c.cliente_id), subject: 'Pagamento confirmado · Saúde Pra Você', html: shell('Atendimento confirmado', `<p>${escH(c.pro_nome)} está confirmado(a). O contato dele(a) já aparece no app.</p>`) });
    sendEmail({ to: await emailDe(c.pro_id), subject: 'Atendimento pago · Saúde Pra Você', html: shell('Atendimento confirmado e pago', `<p>${escH(c.cliente_nome)} pagou. Você recebe <b>${brl(pro && pro.total)}</b> na sua conta Mercado Pago.</p>`) });
  }
  if (['refunded', 'charged_back'].includes(st) && pg.status === 'approved') {
    sendEmail({ to: await emailCentral(), subject: `Estorno no atendimento #${c.codigo}`, html: shell('Pagamento estornado', `<p>${escH(c.cliente_nome)} → ${escH(c.pro_nome)}: ${brl(pg.valor_total)} (${escH(st)}). Confira o atendimento no painel.</p>`) });
  }
  return send(res, 200, { ok: true });
});

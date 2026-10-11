// Gera o pagamento (Checkout Pro do Mercado Pago) de uma contratação aceita pelo profissional.
// Cobra na conta Mercado Pago do profissional; DebCare (15%) + Mind (10%) entram juntos como marketplace_fee,
// que cai na conta da DebCare (dona da aplicação de marketplace). O contratante vê só o total.
import { send, readJson, who, admin, one, isUuid, fail, handler, appUrl, sendEmail, shell, escH, emailCentral } from './_lib.js';

export default handler(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'use POST' });
  const me = await who(req);
  const b = await readJson(req);
  if (!isUuid(b.contratacao_id)) throw fail(400, 'Contratação inválida');
  const c = await one(`contratacoes?id=eq.${b.contratacao_id}&select=*`);
  if (!c || c.cliente_id !== me.id) throw fail(403, 'Só o contratante paga');
  if (c.status === 'confirmado' || c.status === 'concluido') throw fail(409, 'Este atendimento já está pago');
  if (c.status !== 'aceito') throw fail(409, 'Aguarde o profissional aceitar o pedido');
  const [cli, sp] = await Promise.all([
    one(`contratacao_cliente?contratacao_id=eq.${c.id}&select=total`),
    one(`contratacao_split?contratacao_id=eq.${c.id}&select=pro,debcare,mind`),
  ]);
  if (!cli || !sp) throw fail(500, 'Valores da contratação não encontrados');
  const conta = await one(`mp_contas?user_id=eq.${c.pro_id}&select=access_token`);
  if (!conta || !conta.access_token) {
    sendEmail({ to: await emailCentral(), subject: `Pagamento travado #${c.codigo}: profissional sem Mercado Pago`,
      html: shell('Profissional sem conta de recebimento', `<p>${escH(c.pro_nome)} ainda não conectou o Mercado Pago e ${escH(c.cliente_nome)} tentou pagar.</p>`) });
    throw fail(409, 'O profissional ainda não conectou a conta de recebimento. A central DebCare já foi avisada e fala com você.');
  }
  const taxa = +(+sp.debcare + +sp.mind).toFixed(2);
  const [pg] = await admin('pagamentos', { method: 'POST', prefer: 'return=representation',
    body: { contratacao_id: c.id, valor_total: cli.total, taxa, debcare: sp.debcare, mind: sp.mind, status: 'pendente' } });
  const url = appUrl(req);
  const titulo = `DebCare #${c.codigo} · ${c.pro_nome.split(' ')[0]} · ${c.dias} dia(s)`;
  const pref = {
    items: [{ id: pg.id, title: titulo.slice(0, 250), quantity: 1, unit_price: +cli.total, currency_id: 'BRL' }],
    external_reference: pg.id,
    marketplace_fee: taxa,
    notification_url: `${url}/api/mp-webhook?pg=${pg.id}`,
    back_urls: { success: `${url}/cliente.html?pago=${pg.id}#contratacoes`, pending: `${url}/cliente.html#contratacoes`, failure: `${url}/cliente.html#contratacoes` },
    auto_return: 'approved',
    statement_descriptor: 'DEBCARE',
  };
  const r = await fetch('https://api.mercadopago.com/checkout/preferences', { method: 'POST',
    headers: { authorization: 'Bearer ' + conta.access_token, 'content-type': 'application/json' }, body: JSON.stringify(pref) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.init_point) {
    await admin(`pagamentos?id=eq.${pg.id}`, { method: 'PATCH', body: { status: 'erro' } });
    throw fail(502, 'O Mercado Pago recusou a cobrança: ' + (j.message || r.status));
  }
  await admin(`pagamentos?id=eq.${pg.id}`, { method: 'PATCH', body: { mp_pref_id: j.id } });
  await admin(`pagamentos?contratacao_id=eq.${c.id}&status=eq.pendente&id=neq.${pg.id}`, { method: 'PATCH', body: { status: 'substituido' } });
  return send(res, 200, { url: j.init_point });
});

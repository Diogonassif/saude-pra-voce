// Gera o pagamento (Checkout Pro do Mercado Pago) de uma contratação aceita pelo profissional.
// Cobra na conta Mercado Pago do profissional; Saúde Pra Você (15%) + Mind (10%) entram juntos como marketplace_fee,
// que cai na conta da Saúde Pra Você (dona da aplicação de marketplace). O contratante vê só o total.
import { send, readJson, who, admin, one, isUuid, fail, handler, appUrl, sendEmail, shell, escH, emailCentral, alocar, money, env } from './_lib.js';

// Vaga CLT: a empresa paga a taxa de serviço (20% Saúde Pra Você + 10% Mind sobre um salário mensal) uma única vez,
// quando registra que o contrato foi assinado. Cobra direto na conta Mercado Pago da Saúde Pra Você (MP_ACCESS_TOKEN),
// sem split: a Saúde Pra Você repassa a parte da Mind, como nos atendimentos.
async function taxaCLT(req, c) {
  if (c.status === 'concluido') throw fail(409, 'Esta contratação já foi registrada e paga');
  if (c.status !== 'confirmado') throw fail(409, 'Aguarde o profissional confirmar interesse na vaga');
  const [cli, sp] = await Promise.all([
    one(`contratacao_cliente?contratacao_id=eq.${c.id}&select=total`),
    one(`contratacao_split?contratacao_id=eq.${c.id}&select=debcare,mind`),
  ]);
  const valor = money(cli && cli.total);
  if (!(valor > 0) || !sp) throw fail(409, 'Esta vaga não tem salário informado para calcular a taxa. Fale com a central.');
  const token = env('MP_ACCESS_TOKEN');
  if (!token) {
    sendEmail({ to: await emailCentral(), subject: `Taxa CLT travada #${c.codigo}: falta a conta Mercado Pago da Saúde Pra Você`,
      html: shell('Conta de recebimento não configurada', `<p>${escH(c.empresa_nome || c.cliente_nome)} tentou pagar a taxa da vaga CLT #${c.codigo}, mas a chave MP_ACCESS_TOKEN da Saúde Pra Você não está na Vercel.</p>`) });
    throw fail(503, 'O pagamento da taxa ainda está sendo liberado. A nossa central já foi avisada e fala com você.');
  }
  const [pg] = await admin('pagamentos', { method: 'POST', prefer: 'return=representation',
    body: { contratacao_id: c.id, valor_total: valor, taxa: valor, debcare: +sp.debcare, mind: +sp.mind, status: 'pendente' } });
  const url = appUrl(req);
  const cargo = (c.clt && c.clt.cargo) || 'vaga CLT';
  const pref = {
    items: [{ id: pg.id, title: `Saúde Pra Você #${c.codigo} · taxa de contratação CLT · ${cargo} · ${c.pro_nome.split(' ')[0]}`.slice(0, 250), quantity: 1, unit_price: valor, currency_id: 'BRL' }],
    external_reference: pg.id,
    notification_url: `${url}/api/mp-webhook?pg=${pg.id}`,
    back_urls: { success: `${url}/cliente.html?pago=${pg.id}#contratacoes`, pending: `${url}/cliente.html#contratacoes`, failure: `${url}/cliente.html#contratacoes` },
    auto_return: 'approved',
    statement_descriptor: 'SAUDEPARAVOCE',
  };
  const r = await fetch('https://api.mercadopago.com/checkout/preferences', { method: 'POST',
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(pref) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.init_point) {
    await admin(`pagamentos?id=eq.${pg.id}`, { method: 'PATCH', body: { status: 'erro' } });
    throw fail(502, 'O Mercado Pago recusou a cobrança: ' + (j.message || r.status));
  }
  await admin(`pagamentos?id=eq.${pg.id}`, { method: 'PATCH', body: { mp_pref_id: j.id } });
  await admin(`pagamentos?contratacao_id=eq.${c.id}&status=eq.pendente&id=neq.${pg.id}`, { method: 'PATCH', body: { status: 'substituido' } });
  return { url: j.init_point };
}

export default handler(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'use POST' });
  const me = await who(req);
  const b = await readJson(req);
  if (!isUuid(b.contratacao_id)) throw fail(400, 'Contratação inválida');
  const c = await one(`contratacoes?id=eq.${b.contratacao_id}&select=*`);
  if (!c || c.cliente_id !== me.id) throw fail(403, 'Só o contratante paga');
  if (c.tipo === 'clt') return send(res, 200, await taxaCLT(req, c));
  const fixo = c.tipo === 'fixo';
  if (!fixo && (c.status === 'confirmado' || c.status === 'concluido')) throw fail(409, 'Este atendimento já está pago');
  if (fixo && !['aceito', 'confirmado'].includes(c.status)) throw fail(409, c.status === 'solicitado' ? 'Aguarde o profissional aceitar o contrato' : 'Este contrato não aceita mais pagamentos');
  if (!fixo && c.status !== 'aceito') throw fail(409, 'Aguarde o profissional aceitar o pedido');
  if (c.proposta_valor) throw fail(409, 'Há uma proposta de valor em aberto no chat. Responda (ou aguarde a resposta) antes de pagar.');
  const [cli, sp] = await Promise.all([
    one(`contratacao_cliente?contratacao_id=eq.${c.id}&select=total`),
    one(`contratacao_split?contratacao_id=eq.${c.id}&select=pro,debcare,mind`),
  ]);
  if (!cli || !sp) throw fail(500, 'Valores da contratação não encontrados');
  const conta = await one(`mp_contas?user_id=eq.${c.pro_id}&select=access_token`);
  if (!conta || !conta.access_token) {
    sendEmail({ to: await emailCentral(), subject: `Pagamento travado #${c.codigo}: profissional sem Mercado Pago`,
      html: shell('Profissional sem conta de recebimento', `<p>${escH(c.pro_nome)} ainda não conectou o Mercado Pago e ${escH(c.cliente_nome)} tentou pagar.</p>`) });
    throw fail(409, 'O profissional ainda não conectou a conta de recebimento. A nossa central já foi avisada e fala com você.');
  }
  // contrato fixo: cobra a próxima parcela mensal (proporcional às horas/plantões do mês)
  let valor = +cli.total, debcare = +sp.debcare, mind = +sp.mind, parcela = null, rotulo = `${c.dias} dia(s)`;
  if (fixo) {
    const P = (await admin(`contratacao_parcelas?contratacao_id=eq.${c.id}&select=n,inicio,fim,quantidade,status&order=n`)) || [];
    if (!P.length) throw fail(409, 'As parcelas deste contrato ainda não foram geradas. Fale com a central.');
    const i = P.findIndex((x) => x.status !== 'pago');
    if (i < 0) throw fail(409, 'Todas as parcelas deste contrato já foram pagas');
    const q = P.map((x) => +x.quantidade);
    valor = alocar(cli.total, q, i); debcare = alocar(sp.debcare, q, i); mind = alocar(sp.mind, q, i);
    parcela = P[i].n;
    rotulo = `contrato fixo · parcela ${P[i].n}/${P.length} (${P[i].inicio.split('-').reverse().join('/').slice(0, 5)} a ${P[i].fim.split('-').reverse().join('/').slice(0, 5)})`;
  }
  const taxa = money(debcare + mind);
  const [pg] = await admin('pagamentos', { method: 'POST', prefer: 'return=representation',
    body: { contratacao_id: c.id, valor_total: valor, taxa, debcare, mind, status: 'pendente', parcela } });
  const url = appUrl(req);
  const titulo = `Saúde Pra Você #${c.codigo} · ${c.pro_nome.split(' ')[0]} · ${rotulo}`;
  const pref = {
    items: [{ id: pg.id, title: titulo.slice(0, 250), quantity: 1, unit_price: valor, currency_id: 'BRL' }],
    external_reference: pg.id,
    marketplace_fee: taxa,
    notification_url: `${url}/api/mp-webhook?pg=${pg.id}`,
    back_urls: { success: `${url}/cliente.html?pago=${pg.id}#contratacoes`, pending: `${url}/cliente.html#contratacoes`, failure: `${url}/cliente.html#contratacoes` },
    auto_return: 'approved',
    statement_descriptor: 'SAUDEPARAVOCE',
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

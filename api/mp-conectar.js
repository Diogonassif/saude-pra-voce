// Conecta a conta Mercado Pago do profissional à aplicação de marketplace da Saúde Pra Você (OAuth), para receber com split.
// POST (logado) → devolve a URL de autorização. GET com ?code&state → troca o código e guarda o token.
import { send, who, admin, one, env, sign, unsign, fail, handler, appUrl } from './_lib.js';

export default handler(async (req, res) => {
  const url = appUrl(req);
  const redirect = url + '/api/mp-conectar';
  // dados da conta conectada (para o profissional ver qual é) e desconectar
  if (req.method === 'POST' && (req.headers['x-acao'] === 'info' || req.headers['x-acao'] === 'desconectar')) {
    const me = await who(req);
    const conta = await one(`mp_contas?user_id=eq.${me.id}&select=mp_user_id,access_token,conectado_em`);
    if (req.headers['x-acao'] === 'desconectar') {
      const ativos = await admin(`contratacoes?pro_id=eq.${me.id}&status=eq.aceito&select=id`);
      if ((ativos || []).length) throw fail(409, 'Você tem pedido aceito aguardando pagamento. Conecte outra conta em vez de desconectar.');
      await admin(`mp_contas?user_id=eq.${me.id}`, { method: 'DELETE' });
      return send(res, 200, { ok: true });
    }
    if (!conta) return send(res, 200, { conectado: false });
    let nome = '', email = '';
    try {
      const r = await fetch('https://api.mercadopago.com/users/me', { headers: { authorization: 'Bearer ' + conta.access_token } });
      if (r.ok) { const u = await r.json(); nome = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.nickname || ''; email = u.email || ''; }
    } catch (e) { /* mostra só o número da conta */ }
    const mascara = (e) => e.replace(/^(.{2}).*(@.*)$/, '$1•••$2');
    return send(res, 200, { conectado: true, conta: conta.mp_user_id, nome, email: email ? mascara(email) : '', desde: conta.conectado_em });
  }
  if (req.method === 'POST') {
    const me = await who(req);
    if (me.role !== 'pro' && !me.isAdmin) throw fail(403, 'Só profissionais conectam conta de recebimento');
    if (!env('MP_CLIENT_ID') || !env('MP_CLIENT_SECRET')) throw fail(503, 'Recebimentos ainda não liberados. A nossa central avisa você.');
    const state = sign(me.id + ':' + Date.now());
    const u = new URL('https://auth.mercadopago.com.br/authorization');
    u.searchParams.set('client_id', env('MP_CLIENT_ID'));
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('platform_id', 'mp');
    u.searchParams.set('state', state);
    u.searchParams.set('redirect_uri', redirect);
    return send(res, 200, { url: u.toString() });
  }
  // retorno do Mercado Pago
  const q = new URL(req.url, 'http://x').searchParams;
  const s = unsign(q.get('state'));
  const back = (ok) => { res.statusCode = 302; res.setHeader('location', url + '/pro.html?mp=' + (ok ? 'ok' : 'erro') + '#recebimentos'); res.end(); };
  if (!s || !q.get('code')) return back(false);
  const [uid, ts] = s.split(':');
  if (Date.now() - +ts > 30 * 60 * 1000) return back(false);
  const r = await fetch('https://api.mercadopago.com/oauth/token', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: env('MP_CLIENT_ID'), client_secret: env('MP_CLIENT_SECRET'), code: q.get('code'), grant_type: 'authorization_code', redirect_uri: redirect }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) return back(false);
  await admin('mp_contas?on_conflict=user_id', { method: 'POST', prefer: 'resolution=merge-duplicates', body: {
    user_id: uid, mp_user_id: String(j.user_id || ''), access_token: j.access_token, refresh_token: j.refresh_token || null,
    expires_at: j.expires_in ? new Date(Date.now() + j.expires_in * 1000).toISOString() : null, conectado_em: new Date().toISOString() } });
  return back(true);
});

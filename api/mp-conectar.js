// Conecta a conta Mercado Pago do profissional à aplicação de marketplace da DebCare (OAuth), para receber com split.
// POST (logado) → devolve a URL de autorização. GET com ?code&state → troca o código e guarda o token.
import { send, who, admin, env, sign, unsign, fail, handler, appUrl } from './_lib.js';

export default handler(async (req, res) => {
  const url = appUrl(req);
  const redirect = url + '/api/mp-conectar';
  if (req.method === 'POST') {
    const me = await who(req);
    if (me.role !== 'pro' && !me.isAdmin) throw fail(403, 'Só profissionais conectam conta de recebimento');
    if (!env('MP_CLIENT_ID') || !env('MP_CLIENT_SECRET')) throw fail(503, 'Recebimentos ainda não liberados. A central DebCare avisa você.');
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

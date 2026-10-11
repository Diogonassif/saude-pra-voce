// Entrar com e-mail + senha. A conta no Supabase usa um e-mail técnico do celular; aqui achamos a conta
// pelo e-mail do perfil e fazemos o login no servidor, devolvendo a sessão para o navegador.
import { send, readJson, one, env, svc, fail, handler } from './_lib.js';

export default handler(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'use POST' });
  const b = await readJson(req);
  const email = String(b.email || '').trim().toLowerCase();
  const senha = String(b.senha || '');
  const errado = () => fail(400, 'E-mail ou senha incorretos');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200 || !senha || senha.length > 200) throw errado();

  const p = await one(`profiles?email=eq.${encodeURIComponent(email)}&select=id`);
  if (!p) throw errado();
  const u = await fetch(env('SUPABASE_URL') + '/auth/v1/admin/users/' + p.id, { headers: svc() });
  if (!u.ok) throw fail(502, 'Não deu para entrar agora. Tente de novo.');
  const user = await u.json();
  if (!user.email) throw errado();

  const r = await fetch(env('SUPABASE_URL') + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: env('SUPABASE_ANON_KEY'), 'content-type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: senha }) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 429) throw fail(429, 'Muitas tentativas. Espere um pouco e tente de novo.');
  if (!r.ok || !j.access_token) throw errado();
  return send(res, 200, { access_token: j.access_token, refresh_token: j.refresh_token });
});

// Saúde Pra Você · utilidades do servidor (Vercel Functions). Variáveis de ambiente: veja README.md
import crypto from 'node:crypto';
export const env = (k) => process.env[k] || '';
const SB = () => env('SUPABASE_URL');

export function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(obj));
}
export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let d = ''; for await (const c of req) d += c;
  try { return d ? JSON.parse(d) : {}; } catch (e) { return {}; }
}
export const bearer = (req) => { const h = req.headers.authorization || ''; return h.startsWith('Bearer ') ? h.slice(7) : ''; };
export const fail = (status, msg) => Object.assign(new Error(msg), { status });

// usuário a partir do token da sessão
export async function getUser(token) {
  if (!token) return null;
  const r = await fetch(SB() + '/auth/v1/user', { headers: { apikey: env('SUPABASE_ANON_KEY'), authorization: 'Bearer ' + token } });
  if (!r.ok) return null;
  return r.json();
}
// PostgREST com a chave de serviço (ignora RLS: use só depois de checar o acesso)
export async function admin(path, opts = {}) {
  const r = await fetch(SB() + '/rest/v1/' + path, {
    method: opts.method || 'GET',
    headers: Object.assign({ apikey: env('SUPABASE_SERVICE_ROLE_KEY'), authorization: 'Bearer ' + env('SUPABASE_SERVICE_ROLE_KEY'), 'content-type': 'application/json' },
      opts.prefer ? { prefer: opts.prefer } : {}),
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = t; }
  if (!r.ok) throw Object.assign(new Error('db ' + r.status + ': ' + t.slice(0, 300)), { status: 500 });
  return j;
}
export const one = async (path) => ((await admin(path)) || [])[0] || null;
export async function rpc(fn, args) {
  return admin('rpc/' + fn, { method: 'POST', body: args });
}

// contexto de quem chama: usuário e perfil
export async function who(req) {
  const u = await getUser(bearer(req));
  if (!u) throw fail(401, 'Entre na sua conta');
  const p = await one(`profiles?id=eq.${u.id}&select=id,role,nome,telefone,email`);
  if (!p) throw fail(401, 'Perfil não encontrado');
  return { id: u.id, role: p.role, nome: p.nome, telefone: p.telefone, email: p.email, isAdmin: p.role === 'admin' };
}
export async function config(key, def) {
  const c = await one(`config?key=eq.${key}&select=value`);
  return c ? c.value : def;
}
export const isUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ''));
export const money = (v) => Math.round((+v || 0) * 100) / 100;
export const brl = (v) => 'R$ ' + (+v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const appUrl = (req) => env('APP_URL') || ('https://' + req.headers.host);

// assinatura simples (HMAC) para o "state" do OAuth do Mercado Pago
export const sign = (s) => s + '.' + crypto.createHmac('sha256', env('APP_SECRET') || env('SUPABASE_SERVICE_ROLE_KEY')).update(s).digest('hex').slice(0, 32);
export const unsign = (v) => { const i = String(v || '').lastIndexOf('.'); if (i < 0) return null; const s = v.slice(0, i); return sign(s) === v ? s : null; };

// e-mails (Resend), opcionais: só para quem cadastrou e-mail. Sem chave configurada, só registra e segue.
export const escH = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const shell = (title, body, cta) => `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0E2B36">
<div style="background:#0E2B36;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;font-weight:bold;font-size:18px"><span style="color:#2BB59A">&#10084;</span> Saúde <span style="color:#6FE0C6">Pra Você</span></div>
<div style="border:1px solid #DCE6E8;border-top:0;padding:20px;border-radius:0 0 12px 12px"><h2 style="margin:0 0 12px;font-size:18px">${escH(title)}</h2>${body}
${cta ? `<p style="margin:20px 0 0"><a href="${escH(cta.url)}" style="background:#17705F;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold">${escH(cta.label)}</a></p>` : ''}</div>
<p style="font-size:12px;color:#5A6B72">Saúde Pra Você · tecnologia MindFy Tech</p></div>`;
export async function sendEmail({ to, subject, html }) {
  const key = env('RESEND_API_KEY');
  const list = [].concat(to).filter(Boolean);
  if (!key || !list.length) { console.log('[email não enviado]', subject, list.join(',')); return null; }
  try {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      body: JSON.stringify({ from: env('EMAIL_FROM') || 'Saúde Pra Você <nao-responda@mindfytech.com>', to: list, subject, html }) });
    if (!r.ok) console.log('[email falhou]', r.status, await r.text());
  } catch (e) { console.log('[email erro]', e.message); }
  return null;
}
export async function emailDe(userId) { const p = await one(`profiles?id=eq.${userId}&select=email`); return p ? p.email : null; }
export async function emailCentral() { const v = await config('central_email', ''); return typeof v === 'string' && v.includes('@') ? v : null; }

// ---------------------------------------------------------------- regras de preço da Saúde Pra Você
export const MODAL = {
  hora: { campo: 'valor_hora', nome: 'por hora', un: '/h' },
  plantao12: { campo: 'valor_12h', nome: 'plantão de 12h', un: ' por plantão de 12h' },
  plantao24: { campo: 'valor_24h', nome: 'plantão de 24h', un: ' por plantão de 24h' },
};
export async function taxas() {
  const num = (v, d) => { const n = +v; return isFinite(n) && n >= 0 && n <= 100 ? n : d; };
  return { debcare: num(await config('taxa_debcare', 15), 15), mind: num(await config('taxa_mind', 10), 10) };
}
// valor do profissional + taxas somadas por cima (soma simples). A Mind fica com o centavo do arredondamento.
export function calcular(base, quantidade, t) {
  const unitCli = money(base * (1 + (t.debcare + t.mind) / 100));
  const pro = money(base * quantidade);
  const cliente = money(unitCli * quantidade);
  const debcare = money(pro * t.debcare / 100);
  const mind = money(cliente - pro - debcare);
  return { unitPro: money(base), unitCli, pro, cliente, debcare, mind, taxa: money(cliente - pro) };
}
// dias do período que caem nos dias da semana escolhidos (0 = domingo)
export function diasDoPeriodo(inicio, fim, semana) {
  const a = new Date(inicio + 'T12:00:00Z'), b = new Date(fim + 'T12:00:00Z');
  const out = [];
  if (!(b >= a)) return out;
  for (let d = new Date(a); d <= b && out.length < 400; d = new Date(+d + 864e5)) if (semana.includes(d.getUTCDay())) out.push(d.toISOString().slice(0, 10));
  return out;
}

export function handler(fn) {
  return async (req, res) => {
    try { await fn(req, res); }
    catch (e) { if (!e.status || e.status >= 500) console.error(e); send(res, e.status || 500, { error: e.status && e.status < 500 ? e.message : 'Erro no servidor. Tente de novo.' }); }
  };
}

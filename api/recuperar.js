// "Esqueci a senha" sem falar com a central: manda um link por e-mail (o e-mail do perfil) para criar uma senha nova.
// GET  -> { email: true|false }  (se o envio de e-mail está configurado)
// POST { acao: 'pedir', login }            -> sempre responde igual (não revela se a conta existe)
// POST { acao: 'redefinir', token, senha } -> troca a senha se o link for válido (1 hora, uso único)
import { send, readJson, one, admin, env, svc, fail, handler, sendEmail, shell, escH, appUrl } from './_lib.js';
import crypto from 'node:crypto';

const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');
const telNorm = (raw) => {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  return d.length === 10 || d.length === 11 ? '55' + d : null;
};

export default handler(async (req, res) => {
  if (req.method === 'GET') return send(res, 200, { email: !!env('RESEND_API_KEY') });
  if (req.method !== 'POST') return send(res, 405, { error: 'use POST' });
  const b = await readJson(req);

  if (b.acao === 'pedir') {
    if (!env('RESEND_API_KEY')) throw fail(409, 'O envio de e-mail ainda está sendo ativado. Por enquanto, fale com a nossa central pelo WhatsApp (link abaixo) que mandamos uma senha nova.');
    const login = String(b.login || '').trim().toLowerCase().slice(0, 200);
    let p = null;
    if (login.includes('@')) {
      if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(login)) p = await one(`profiles?email=eq.${encodeURIComponent(login)}&select=id,nome,email`);
    } else {
      const t = telNorm(login);
      if (!t) throw fail(400, 'Digite o celular com DDD ou o e-mail da conta');
      p = await one(`profiles?telefone=eq.${t}&select=id,nome,email`);
    }
    const resposta = { ok: true, msg: 'Se esta conta tiver um e-mail cadastrado, enviamos agora um link para criar uma senha nova. Confira também a caixa de spam.' };
    if (!p || !p.email) return send(res, 200, resposta);
    // no máximo 3 links por hora para a mesma conta
    const desde = new Date(Date.now() - 3600e3).toISOString();
    const recentes = await admin(`senha_resets?user_id=eq.${p.id}&created_at=gte.${desde}&select=id`);
    if ((recentes || []).length >= 3) return send(res, 200, resposta);
    const token = crypto.randomBytes(32).toString('base64url');
    await admin('senha_resets', { method: 'POST', body: { user_id: p.id, token_hash: hash(token), expira_em: new Date(Date.now() + 3600e3).toISOString() } });
    const link = `${appUrl(req)}/nova-senha.html?t=${token}`;
    const ok = await sendEmail({ to: p.email, subject: 'Criar uma senha nova · Saúde Pra Você',
      html: shell('Criar uma senha nova', `<p>Olá, ${escH((p.nome || '').split(' ')[0])}! Recebemos um pedido para trocar a senha da sua conta na Saúde Pra Você.</p><p>O link vale por 1 hora e só funciona uma vez. Se não foi você, ignore este e-mail: sua senha continua a mesma.</p>`,
        { url: link, label: 'Criar senha nova' }) });
    if (!ok) throw fail(409, 'Não conseguimos enviar o e-mail agora. Tente de novo em alguns minutos ou fale com a central pelo WhatsApp.');
    return send(res, 200, resposta);
  }

  if (b.acao === 'redefinir') {
    const token = String(b.token || ''), senha = String(b.senha || '');
    if (!/^[A-Za-z0-9_-]{30,80}$/.test(token)) throw fail(400, 'Link inválido. Peça um novo em "Esqueci a senha".');
    if (senha.length < 6 || senha.length > 72) throw fail(400, 'A senha precisa ter de 6 a 72 caracteres');
    const r0 = await one(`senha_resets?token_hash=eq.${hash(token)}&select=id,user_id,expira_em,usado_em`);
    if (!r0 || r0.usado_em) throw fail(400, 'Este link já foi usado ou não é válido. Peça um novo em "Esqueci a senha".');
    if (new Date(r0.expira_em) < new Date()) throw fail(400, 'Este link venceu (vale 1 hora). Peça um novo em "Esqueci a senha".');
    const r = await fetch(env('SUPABASE_URL') + '/auth/v1/admin/users/' + r0.user_id, { method: 'PUT',
      headers: { ...svc(), 'content-type': 'application/json' }, body: JSON.stringify({ password: senha }) });
    if (!r.ok) throw fail(409, 'Não deu para trocar a senha agora. Tente de novo.');
    const agora = new Date().toISOString();
    await admin(`senha_resets?user_id=eq.${r0.user_id}&usado_em=is.null`, { method: 'PATCH', body: { usado_em: agora } });
    return send(res, 200, { ok: true });
  }

  throw fail(400, 'Ação desconhecida');
});

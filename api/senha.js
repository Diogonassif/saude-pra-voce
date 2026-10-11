// A central gera uma senha nova para quem esqueceu (o login é por celular + senha, sem SMS).
import { send, readJson, who, one, isUuid, env, fail, handler, svc } from './_lib.js';
import crypto from 'node:crypto';

export default handler(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'use POST' });
  const me = await who(req);
  if (!me.isAdmin) throw fail(403, 'Só a central');
  const b = await readJson(req);
  if (!isUuid(b.user_id)) throw fail(400, 'Usuário inválido');
  const p = await one(`profiles?id=eq.${b.user_id}&select=id,nome,telefone`);
  if (!p) throw fail(404, 'Usuário não encontrado');
  const senha = 'dc' + crypto.randomInt(100000, 999999);
  const r = await fetch(env('SUPABASE_URL') + '/auth/v1/admin/users/' + p.id, { method: 'PUT',
    headers: { ...svc(), 'content-type': 'application/json' },
    body: JSON.stringify({ password: senha }) });
  if (!r.ok) throw fail(502, 'Não deu para trocar a senha agora');
  return send(res, 200, { ok: true, senha, nome: p.nome, telefone: p.telefone });
});

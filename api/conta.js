// Dados da conta que o navegador não lê direto do banco (ex.: se a conta de recebimento está conectada).
import { send, who, one, config, handler } from './_lib.js';

export default handler(async (req, res) => {
  const me = await who(req);
  let mp = false;
  if (me.role === 'pro' || me.isAdmin) { const c = await one(`mp_contas?user_id=eq.${me.id}&select=conectado_em`); mp = !!c; }
  let isMind = false;
  if (me.isAdmin) { const g = await config('gestores_mind', []); isMind = Array.isArray(g) && g.includes(me.telefone); }
  const f = await one(`profiles?id=eq.${me.id}&select=foto_url`).catch(() => null);   // tolera banco sem a coluna ainda
  return send(res, 200, { foto_url: (f && f.foto_url) || null, id: me.id, role: me.role, nome: me.nome, telefone: me.telefone, email: me.email, isAdmin: me.isAdmin, isMind, mpConectado: mp });
});

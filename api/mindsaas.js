// Leitura para o painel MindSaaS: quanto a Saúde Pra Você deve à Mind (10% de cada atendimento pago) e o que já repassou.
// Autenticação por chave: header x-api-key = MINDSAAS_KEY (mesma chave cadastrada no MindSaaS).
import { send, env, fail, handler, svc } from './_lib.js';
import crypto from 'node:crypto';

const igual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

export default handler(async (req, res) => {
  const key = env('MINDSAAS_KEY');
  if (!key) throw fail(503, 'MINDSAAS_KEY não configurada');
  if (!igual(req.headers['x-api-key'] || '', key)) throw fail(401, 'Chave inválida');
  const r = await fetch(env('SUPABASE_URL') + '/rest/v1/rpc/debcare_cobranca', { method: 'POST',
    headers: { ...svc(), 'content-type': 'application/json', 'content-profile': 'mindsaas', 'accept-profile': 'mindsaas' },
    body: '{}' });
  if (!r.ok) throw fail(502, 'Não deu para ler a cobrança');
  const meses = await r.json();
  const saldo = Math.round(meses.reduce((s, m) => s + +m.saldo, 0) * 100) / 100;
  return send(res, 200, { app: 'Saúde Pra Você', cobrar: saldo > 0, saldo, meses });
});

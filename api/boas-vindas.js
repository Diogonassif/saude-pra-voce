// Boas-vindas ao profissional novo: vídeo pelo WhatsApp + e-mail com o vídeo.
// WhatsApp automático usa a API oficial do WhatsApp (Meta Cloud API), com um modelo de mensagem aprovado que tem o vídeo no cabeçalho.
// Variáveis: WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_TPL_BOAS_VINDAS (padrão boas_vindas_profissional), WHATSAPP_TPL_LANG (padrão pt_BR).
// Sem elas, o WhatsApp fica pendente e a gestão manda com um toque (Gestão → Campanhas → Boas-vindas).
// GET                              -> { whatsapp: bool, email: bool }  (o que está configurado)
// POST {}                          -> o próprio profissional recém-cadastrado (chamado logo depois de escolher "Profissional")
// POST { acao: 'enviar', user_id } -> gestão: tenta de novo
// POST { acao: 'manual', user_id } -> gestão: marca que mandou pelo WhatsApp manualmente
import { send, readJson, who, admin, one, env, fail, handler, sendEmail, shell, escH, appUrl, isUuid } from './_lib.js';

export const VIDEO = '/videos/boas-vindas-profissional.mp4';
const waOk = () => !!(env('WHATSAPP_TOKEN') && env('WHATSAPP_PHONE_ID'));
const primeiro = (n) => (String(n || '').trim().split(/\s+/)[0] || '');

async function marcar(uid, campo, de, para, extra = {}) {
  // troca o estado só se ainda estiver no estado esperado: evita mandar duas vezes
  const r = await admin(`boas_vindas?user_id=eq.${uid}&${campo}=in.(${de.join(',')})`, { method: 'PATCH', prefer: 'return=representation', body: Object.assign({ [campo]: para }, extra) });
  return (r || []).length > 0;
}

async function whatsapp(p, url) {
  const r = await fetch(`https://graph.facebook.com/v21.0/${env('WHATSAPP_PHONE_ID')}/messages`, {
    method: 'POST', headers: { authorization: 'Bearer ' + env('WHATSAPP_TOKEN'), 'content-type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: p.telefone, type: 'template',
      template: { name: env('WHATSAPP_TPL_BOAS_VINDAS') || 'boas_vindas_profissional', language: { code: env('WHATSAPP_TPL_LANG') || 'pt_BR' },
        components: [
          { type: 'header', parameters: [{ type: 'video', video: { link: url + VIDEO } }] },
          { type: 'body', parameters: [{ type: 'text', text: primeiro(p.nome) || 'tudo bem' }] },
        ] } }) });
  if (r.ok) return null;
  const j = await r.json().catch(() => ({}));
  return ((j.error && (j.error.error_user_msg || j.error.message)) || 'erro ' + r.status).slice(0, 300);
}

export async function enviarBoasVindas(uid, url, { forcar = false } = {}) {
  const bv = await one(`boas_vindas?user_id=eq.${uid}&select=*`);
  if (!bv) return { ok: false, motivo: 'fora da fila' };
  const p = await one(`profiles?id=eq.${uid}&select=id,nome,telefone,email,role`);
  if (!p || p.role !== 'pro') return { ok: false, motivo: 'não é profissional' };
  const out = {};
  // WhatsApp
  if (waOk() && p.telefone && await marcar(uid, 'whatsapp_status', forcar ? ['pendente', 'erro', 'enviando'] : ['pendente'], 'enviando')) {
    const erro = await whatsapp(p, url);
    await admin(`boas_vindas?user_id=eq.${uid}`, { method: 'PATCH', body: erro ? { whatsapp_status: 'erro', whatsapp_erro: erro } : { whatsapp_status: 'enviado', whatsapp_em: new Date().toISOString(), whatsapp_erro: null } });
    out.whatsapp = erro ? 'erro' : 'enviado';
  }
  // e-mail
  if (!p.email) { if (bv.email_status === 'pendente') await admin(`boas_vindas?user_id=eq.${uid}`, { method: 'PATCH', body: { email_status: 'sem_email' } }); out.email = 'sem_email'; }
  else if (env('RESEND_API_KEY') && await marcar(uid, 'email_status', forcar ? ['pendente', 'erro', 'enviando'] : ['pendente'], 'enviando')) {
    const ok = await sendEmail({ to: p.email, subject: 'Bem-vindo(a) à Saúde Pra Você! Veja como funciona',
      html: shell(`Bem-vindo(a), ${primeiro(p.nome)}!`, `<p>Que bom ter você na Saúde Pra Você. Preparamos um vídeo de 1 minuto explicando como o app funciona: você define o seu valor, escolhe os pedidos que aceita e recebe pelo app, direto na sua conta Mercado Pago.</p>
<p><a href="${url}/boas-vindas.html"><img src="${url}/videos/poster-boas-vindas.jpg" alt="Assistir ao vídeo de boas-vindas" width="270" style="border-radius:14px;max-width:100%"></a></p>
<p><b>Para aparecer no catálogo:</b> coloque sua foto, especialidade e valores (técnico e enfermeiro informam o COREN), conecte o Mercado Pago em Recebimentos e publique o perfil. Com os documentos enviados você ganha o selo verificado.</p>
<p><b>🤝 Indique a Saúde Pra Você!</b> Conhece colegas cuidadores, técnicos ou enfermeiros? Mande para eles: <a href="${url}/profissional.html">${url.replace(/^https?:\/\//, '')}/profissional.html</a>. Conhece uma família ou clínica que precisa de cuidado? Mande: <a href="${url}/contratante.html">${url.replace(/^https?:\/\//, '')}/contratante.html</a>.</p>`,
        { url: url + '/boas-vindas.html', label: 'Assistir ao vídeo' }) });
    await admin(`boas_vindas?user_id=eq.${uid}`, { method: 'PATCH', body: ok ? { email_status: 'enviado', email_em: new Date().toISOString() } : { email_status: 'erro' } });
    out.email = ok ? 'enviado' : 'erro';
  }
  return { ok: true, ...out };
}

export default handler(async (req, res) => {
  if (req.method === 'GET') return send(res, 200, { whatsapp: waOk(), email: !!env('RESEND_API_KEY') });
  if (req.method !== 'POST') return send(res, 405, { error: 'use POST' });
  const me = await who(req);
  const b = await readJson(req);
  const url = appUrl(req);
  if (!b.acao) {
    if (me.role !== 'pro') return send(res, 200, { ok: false });
    return send(res, 200, await enviarBoasVindas(me.id, url));
  }
  if (!me.isAdmin) throw fail(403, 'Só a gestão');
  if (!isUuid(b.user_id)) throw fail(400, 'Profissional inválido');
  if (b.acao === 'enviar') return send(res, 200, await enviarBoasVindas(b.user_id, url, { forcar: true }));
  if (b.acao === 'manual') {
    await admin(`boas_vindas?user_id=eq.${b.user_id}`, { method: 'PATCH', body: { whatsapp_status: 'manual', whatsapp_em: new Date().toISOString(), whatsapp_erro: null } });
    return send(res, 200, { ok: true });
  }
  throw fail(400, 'Ação desconhecida');
});

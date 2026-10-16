// Campanhas de convite por e-mail, enviadas pelo app como convite@saudepravoce.com.
// GET  ?ir=<token>    -> registra o clique e leva para a página de cadastro do profissional
// GET  ?sair=<token>  -> descadastra (LGPD) e mostra a confirmação
// POST { acao: 'enviar', campanha, assunto, corpo, limite }  (só a gestão) -> envia para os pendentes, em lotes
import { send, readJson, who, admin, one, env, fail, handler, sendEmail, escH, appUrl, isUuid } from './_lib.js';

const FROM = () => env('CAMPANHA_FROM') || 'Saúde Pra Você <convite@saudepravoce.com>';
const pagina = (titulo, texto) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${titulo} · Saúde Pra Você</title>
<style>body{font-family:Arial,Helvetica,sans-serif;background:#0E2B36;color:#0E2B36;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px}
.c{background:#fff;border-radius:18px;padding:28px;max-width:440px;text-align:center}h1{font-size:22px;margin:0 0 10px}p{color:#46636A;line-height:1.5}a{color:#17705F;font-weight:700}</style></head>
<body><div class="c"><h1>${titulo}</h1><p>${texto}</p><p><a href="/">saudepravoce.com</a></p></div></body></html>`;

// texto simples do corpo (com {nome}) -> HTML do e-mail, com botão e rodapé de descadastro
function montar(corpo, c, url) {
  const primeiro = (c.nome || '').trim().split(/\s+/)[0] || '';
  const txt = String(corpo || '').replace(/\{nome\}/g, primeiro).replace(/Olá, !/g, 'Olá!');
  const linkIr = `${url}/api/campanha?ir=${c.token}`, linkSair = `${url}/api/campanha?sair=${c.token}`;
  const paragrafos = escH(txt).split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;line-height:1.55">${p.replace(/\n/g, '<br>')}</p>`).join('');
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0E2B36">
    <div style="background:#0E2B36;color:#fff;padding:18px 22px;border-radius:14px 14px 0 0;font-size:20px;font-weight:800">Saúde <span style="color:#7FE0C8">Pra Você</span></div>
    <div style="border:1px solid #DDE7E9;border-top:0;border-radius:0 0 14px 14px;padding:22px">${paragrafos}
      <p style="margin:22px 0"><a href="${linkIr}" style="background:#17705F;color:#fff;text-decoration:none;padding:14px 22px;border-radius:12px;font-weight:700;display:inline-block">Quero me cadastrar grátis</a></p>
      <p style="font-size:12px;color:#7A9298;margin-top:26px">Você recebeu este convite porque atua na área da saúde em Franca e região. Se não quiser receber mais nossos e-mails, <a href="${linkSair}" style="color:#7A9298">clique aqui</a>.</p>
    </div></div>`;
}

export default handler(async (req, res) => {
  const url = appUrl(req);
  const q = new URL(req.url, 'http://x').searchParams;
  const ir = q.get('ir'), sair = q.get('sair');
  if (req.method === 'GET' || (req.method === 'POST' && sair)) {   // POST com ?sair = descadastro de um clique do Gmail/Outlook
    if (ir && isUuid(ir)) {
      // antivírus de e-mail corporativo abrem os links segundos depois da entrega: clique só conta depois de 60 s do envio
      const c = await one(`campanha_contatos?token=eq.${ir}&select=id,enviado_em,clicou_em`).catch(() => null);
      if (c && !c.clicou_em && (!c.enviado_em || Date.now() - new Date(c.enviado_em) > 60e3))
        await admin(`campanha_contatos?id=eq.${c.id}`, { method: 'PATCH', body: { clicou_em: new Date().toISOString() } }).catch(() => null);
      res.statusCode = 302; res.setHeader('location', '/profissional.html?utm_source=email&utm_campaign=convite'); return res.end();
    }
    if (sair && isUuid(sair)) {
      const c = await one(`campanha_contatos?token=eq.${sair}&select=id,email`);
      const confirmou = req.method === 'POST';   // o link do e-mail só abre a confirmação; quem descadastra é o botão (ou o "cancelar inscrição" do Gmail/Outlook, que usa POST)
      res.statusCode = 200; res.setHeader('content-type', 'text/html; charset=utf-8');
      if (!confirmou) return res.end(pagina('Não quer mais receber?', `Toque no botão para não receber mais e-mails de convite da Saúde Pra Você.</p><form method="post" action="/api/campanha?sair=${sair}"><button style="background:#17705F;color:#fff;border:0;border-radius:12px;padding:14px 22px;font-weight:700;font-size:16px;cursor:pointer">Não quero mais receber</button></form><p>`));
      if (c) {
        if (c.email) {
          await admin('descadastros?on_conflict=email', { method: 'POST', prefer: 'resolution=ignore-duplicates', body: { email: c.email.toLowerCase() } });
          await admin(`campanha_contatos?email=eq.${encodeURIComponent(c.email)}`, { method: 'PATCH', body: { status: 'descadastrado' } });
        } else await admin(`campanha_contatos?id=eq.${c.id}`, { method: 'PATCH', body: { status: 'descadastrado' } });
      }
      return res.end(pagina('Pronto, você foi descadastrado', 'Você não vai receber mais e-mails de convite da Saúde Pra Você. Desculpe o incômodo.'));
    }
    return send(res, 200, { ok: true, email: !!env('RESEND_API_KEY') });
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'use POST' });
  const me = await who(req);
  if (!me.isAdmin) throw fail(403, 'Só a gestão');
  const b = await readJson(req);

  if (b.acao === 'enviar') {
    if (!env('RESEND_API_KEY')) throw fail(409, 'O envio de e-mails do app ainda não está ativo (falta configurar o Resend com o domínio saudepravoce.com).');
    const campanha = String(b.campanha || '').trim().slice(0, 80);
    const assunto = String(b.assunto || '').trim().slice(0, 150);
    const corpo = String(b.corpo || '').trim().slice(0, 4000);
    if (!campanha || !assunto || corpo.length < 20) throw fail(400, 'Preencha o assunto e o texto do convite');
    const limite = Math.min(25, Math.max(1, +b.limite || 25));
    const pend = (await admin(`campanha_contatos?campanha=eq.${encodeURIComponent(campanha)}&canal=eq.email&status=eq.pendente&email=not.is.null&select=id,nome,email,token&order=created_at&limit=${limite}`)) || [];
    const fora = new Set(((await admin('descadastros?select=email')) || []).map((x) => x.email.toLowerCase()));
    let enviados = 0, erros = 0;
    for (const c of pend) {
      if (fora.has(c.email.toLowerCase())) { await admin(`campanha_contatos?id=eq.${c.id}`, { method: 'PATCH', body: { status: 'descadastrado' } }); continue; }
      const ok = await sendEmail({ from: FROM(), to: c.email, subject: assunto, html: montar(corpo, c, url), replyTo: b.responder || undefined,
        headers: { 'List-Unsubscribe': `<${url}/api/campanha?sair=${c.token}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } });
      await admin(`campanha_contatos?id=eq.${c.id}`, { method: 'PATCH', body: ok ? { status: 'enviado', enviado_em: new Date().toISOString() } : { status: 'erro' } });
      if (ok) enviados++; else erros++;
      await new Promise((r) => setTimeout(r, 250));
    }
    const resta = (await admin(`campanha_contatos?campanha=eq.${encodeURIComponent(campanha)}&canal=eq.email&status=eq.pendente&select=id`)) || [];
    return send(res, 200, { ok: true, enviados, erros, restam: resta.length });
  }

  if (b.acao === 'previa') {
    const c = { nome: String(b.nome || 'Maria'), token: '00000000-0000-0000-0000-000000000000' };
    return send(res, 200, { html: montar(b.corpo, c, url) });
  }
  throw fail(400, 'Ação desconhecida');
});

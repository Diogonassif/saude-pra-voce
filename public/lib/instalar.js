/* Saúde Pra Você · card "Instale o app no celular" (Android e iPhone) */
(function () {
  try { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {}); } catch (e) {}
  const instalado = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const ua = navigator.userAgent || '';
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document);
  const android = /Android/i.test(ua);
  let pedido = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); pedido = e; desenha(); });
  window.addEventListener('appinstalled', () => { pedido = null; document.querySelectorAll('[data-instalar]').forEach((el) => (el.innerHTML = '<p class="inst-ok">App instalado. Abra pela tela inicial do celular.</p>')); });

  const ic = '<svg viewBox="0 0 64 64" width="52" height="52" aria-hidden="true"><rect x="1" y="1" width="62" height="62" rx="15" fill="#0E2B36"/><path d="M32 50C18 41 12 33 12 25c0-6.5 5-11 10.8-11 4.2 0 7.4 2.4 9.2 5.6C33.8 16.4 37 14 41.2 14 47 14 52 18.5 52 25c0 8-6 16-20 25z" fill="#2BB59A"/><path d="M32 25v12M26 31h12" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/></svg>';
  const share = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-3px"><path d="M12 3v12M8 7l4-4 4 4"/><rect x="5" y="11" width="14" height="10" rx="2"/></svg>';
  const passosIos = `<ol class="inst-p"><li>Abra este site no <b>Safari</b></li><li>Toque em <b>Compartilhar</b> ${share}</li><li>Escolha <b>Adicionar à Tela de Início</b></li></ol>`;
  const passosAnd = `<ol class="inst-p"><li>Abra este site no <b>Chrome</b></li><li>Toque no menu <b>⋮</b> no canto de cima</li><li>Escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b></li></ol>`;

  function card(el) {
    if (instalado) { el.innerHTML = ''; el.hidden = true; return; }
    const titulo = el.dataset.instalar === 'pro' ? 'Receba pedidos na palma da mão' : el.dataset.instalar === 'cliente' ? 'Acompanhe o cuidado de quem você ama' : 'Tenha o app no seu celular';
    const corpo = ios ? passosIos : android ? (pedido ? '<button type="button" class="inst-btn" data-inst-go>Instalar agora</button>' : passosAnd)
      : `<div class="inst-2"><div><b>iPhone</b>${passosIos}</div><div><b>Android</b>${passosAnd}</div></div>`;
    el.innerHTML = `<div class="inst"><div class="inst-h">${ic}<div><b>${titulo}</b><span>Instale o Saúde Pra Você grátis. Abre como um app, direto da tela inicial.</span></div></div>${corpo}</div>`;
    const b = el.querySelector('[data-inst-go]');
    if (b) b.onclick = async () => { if (!pedido) return; pedido.prompt(); try { await pedido.userChoice; } catch (e) {} pedido = null; desenha(); };
  }
  function desenha() { document.querySelectorAll('[data-instalar]').forEach(card); }
  window.desenhaInstalar = desenha;
  const css = document.createElement('style');
  css.textContent = `.inst{background:#fff;color:#0E2B36;border-radius:18px;padding:18px;box-shadow:0 10px 30px rgba(14,43,54,.12);border:1px solid #DCE7E9;display:flex;flex-direction:column;gap:12px;text-align:left}
  .inst-h{display:flex;gap:14px;align-items:center}.inst-h b{display:block;font-size:17px}.inst-h span{display:block;font-size:14px;color:#5E7C84;margin-top:2px}
  .inst-p{margin:0;padding-left:20px;font-size:14px;line-height:1.7;color:#0E2B36}.inst-2{display:grid;grid-template-columns:1fr 1fr;gap:14px}.inst-2>div>b{font-size:14px}
  @media(max-width:560px){.inst-2{grid-template-columns:1fr}}
  .inst-btn{background:#2BB59A;color:#fff;border:0;border-radius:12px;padding:14px 18px;font:inherit;font-weight:800;font-size:16px;cursor:pointer}.inst-ok{font-weight:700;color:#0F574A;margin:0}`;
  document.head.appendChild(css);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', desenha); else desenha();
})();

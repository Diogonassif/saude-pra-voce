/*!
 * mind-padrao.js · Padrão MindFy Tech para todos os apps
 * Versão: 2026-10-12.1
 *
 * NÃO edite este arquivo dentro de um app. Ele é igual em todos os apps da Mind.
 * Melhorias novas entram aqui e são copiadas para todos (ver PADRAO-APPS.md).
 *
 * Itens do padrão:
 *  P-001 (2026-10-12) Botão de olho em todo campo de senha: mostra/esconde o que foi digitado.
 */
(function () {
  'use strict';
  if (window.MindPadrao) return;
  var MP = (window.MindPadrao = { versao: '2026-10-12.1' });

  // ---------- estilos do padrão (injetados uma vez) ----------
  var css = [
    '.mp-pw{position:relative;display:block}',
    '.mp-pw>input{width:100%;padding-right:52px !important;box-sizing:border-box}',
    '.mp-eye{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:42px;height:42px;border:0;background:none;',
    'color:currentColor;opacity:.6;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;margin:0}',
    '.mp-eye:hover,.mp-eye:focus-visible{opacity:1;background:rgba(127,127,127,.12)}',
    '.mp-eye svg{display:block}'
  ].join('');
  function estilos() {
    if (document.getElementById('mp-estilos')) return;
    var s = document.createElement('style'); s.id = 'mp-estilos'; s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  // ---------- P-001 · mostrar/esconder senha ----------
  var OLHO = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var FECHADO = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17.9 17.9A10.8 10.8 0 0 1 12 19c-7 0-11-7-11-7a20 20 0 0 1 5.1-5.9M9.9 5.2A10 10 0 0 1 12 5c7 0 11 7 11 7a20 20 0 0 1-2.4 3.4M14.1 14.1a3 3 0 1 1-4.2-4.2M1 1l22 22"/></svg>';

  MP.olhos = function (root) {
    var lista = (root || document).querySelectorAll('input[type="password"]:not([data-olho])');
    for (var i = 0; i < lista.length; i++) (function (inp) {
      inp.setAttribute('data-olho', '1');
      var w = document.createElement('span'); w.className = 'mp-pw';
      inp.parentNode.insertBefore(w, inp); w.appendChild(inp);
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'mp-eye'; b.tabIndex = 0;
      b.setAttribute('aria-label', 'Mostrar senha'); b.title = 'Mostrar senha'; b.innerHTML = OLHO;
      b.addEventListener('click', function () {
        var ver = inp.type === 'password';
        inp.type = ver ? 'text' : 'password';
        b.innerHTML = ver ? FECHADO : OLHO;
        var t = ver ? 'Esconder senha' : 'Mostrar senha';
        b.setAttribute('aria-label', t); b.title = t;
        try { inp.focus({ preventScroll: true }); var n = inp.value.length; inp.setSelectionRange(n, n); } catch (e) {}
      });
      w.appendChild(b);
    })(lista[i]);
  };

  // Ao enviar o formulário, volta a esconder (a senha não fica à vista nem vai para o autocompletar como texto)
  document.addEventListener('submit', function (e) {
    var f = e.target; if (!f || !f.querySelectorAll) return;
    var l = f.querySelectorAll('input[data-olho]');
    for (var i = 0; i < l.length; i++) if (l[i].type === 'text') { l[i].type = 'password'; var b = l[i].parentNode.querySelector('.mp-eye'); if (b) { b.innerHTML = OLHO; b.setAttribute('aria-label', 'Mostrar senha'); b.title = 'Mostrar senha'; } }
  }, true);

  function iniciar() {
    estilos(); MP.olhos();
    new MutationObserver(function () { MP.olhos(); }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();

/* Configuração pública (chave publicável; a segurança dos dados fica nas regras do banco) */
window.DC = Object.assign(window.DC || {}, {
  url: 'https://daqmpctkcilfzweqdthh.supabase.co',
  key: 'sb_publishable_c7lY3esi8y_F-KmZ7Ce7WQ_tMiUpaB1',
});

/* Ambiente de TESTE: a branch "teste" publicada pela Vercel usa o banco de teste (dados fictícios, nada afeta clientes reais) */
(function(){if(!/-git-teste-/.test(location.hostname))return;window.DC=Object.assign(window.DC||{},{url:'https://fbeqxeaynxhxnrpyekji.supabase.co',key:'sb_publishable_jB0O1P28PlTuNVv10kncVw_2FrwskYO',ambiente:'teste'});
  document.addEventListener('DOMContentLoaded',function(){var b=document.createElement('div');b.textContent='AMBIENTE DE TESTE';b.setAttribute('style','position:fixed;left:8px;bottom:8px;z-index:99999;background:#C2362F;color:#fff;font:800 11px/1 system-ui,sans-serif;letter-spacing:.08em;padding:6px 9px;border-radius:999px;pointer-events:none;opacity:.92');document.body.appendChild(b)});})();

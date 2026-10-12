/* Saúde Pra Você · páginas de apresentação: marca e prévia do catálogo (sem login) */
(function () {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mk = '<span class="mk" aria-hidden="true"><svg viewBox="0 0 64 64" width="30" height="30"><rect x="1" y="1" width="62" height="62" rx="15" fill="#0E2B36" stroke="rgba(255,255,255,.22)" stroke-width="2"/><path d="M32 50C18 41 12 33 12 25c0-6.5 5-11 10.8-11 4.2 0 7.4 2.4 9.2 5.6C33.8 16.4 37 14 41.2 14 47 14 52 18.5 52 25c0 8-6 16-20 25z" fill="#2BB59A"/><path d="M32 25v12M26 31h12" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/></svg></span><span class="wm">Saúde <b>Pra Você</b></span>';
  document.querySelectorAll('[data-marca]').forEach((el) => { el.innerHTML = mk + (el.dataset.marca ? `<small>${esc(el.dataset.marca)}</small>` : ''); });
  const box = document.getElementById('previa');
  if (!box || !window.supabase || !window.DC || /SEU-PROJETO/.test(window.DC.url)) return;
  const ESP = { cuidador: 'Cuidador(a)', tecnico: 'Técnico(a) de enfermagem', enfermeiro: 'Enfermeiro(a)', acompanhante: 'Acompanhante hospitalar' };
  const brl = (v) => 'R$ ' + (+v).toLocaleString('pt-BR', { minimumFractionDigits: (+v % 1) ? 2 : 0, maximumFractionDigits: 2 });
  window.supabase.createClient(window.DC.url, window.DC.key).rpc('catalogo').then(({ data }) => {
    const L = (data || []).slice(0, 6);
    if (!L.length) return;
    box.closest('section').classList.remove('hide');
    box.innerHTML = L.map((p) => `<div class="card pc"><div class="head-pro"><span class="av lg">${p.avatar_url ? `<img src="${esc(p.avatar_url)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover">` : esc(p.nome.split(' ').map((x) => x[0]).join('').slice(0, 2))}</span><div class="grow"><b style="font-size:17px">${esc(p.nome)}</b> ${p.verificado ? '<span class="selo">✓ Selo verificado</span>' : ''}
      <div class="small mute">${esc(ESP[p.especialidade] || '')}${p.experiencia_anos ? ' · ' + p.experiencia_anos + ' anos' : ''}</div><div class="small mute">${esc(p.cidade || '')}</div></div></div>
      <div class="pr"><div><span class="tiny mute">Por hora</span><b>${brl(p.preco_hora)}</b></div><div class="${p.preco_12h ? '' : 'na'}"><span class="tiny mute">Plantão 12h</span><b>${p.preco_12h ? brl(p.preco_12h) : '—'}</b></div><div class="${p.preco_24h ? '' : 'na'}"><span class="tiny mute">Plantão 24h</span><b>${p.preco_24h ? brl(p.preco_24h) : '—'}</b></div></div></div>`).join('');
  });
})();

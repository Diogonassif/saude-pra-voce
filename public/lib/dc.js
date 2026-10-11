/* Saúde Pra Você · núcleo do navegador: sessão, API, utilidades de tela */
(function () {
  const DC = window.DC = window.DC || {};
  DC.sb = window.supabase.createClient(DC.url, DC.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });

  DC.$ = (s, el) => (el || document).querySelector(s);
  DC.$$ = (s, el) => [...(el || document).querySelectorAll(s)];
  DC.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  DC.brl = (v, dec) => 'R$ ' + (+v || 0).toLocaleString('pt-BR', { minimumFractionDigits: dec ?? ((+v % 1) ? 2 : 0), maximumFractionDigits: 2 });
  DC.data = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');
  DC.dataCurta = (s) => DC.data(s).slice(0, 5);
  DC.hoje = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  DC.ini = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
  DC.av = (nome, url, cls) => `<span class="av ${cls || ''}">${url ? `<img src="${DC.esc(url)}" alt="">` : DC.esc(DC.ini(nome))}</span>`;
  DC.norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

  // telefone: "(16) 99999-0000" → "5516999990000"
  DC.tel = (raw) => {
    let d = String(raw || '').replace(/\D/g, '');
    if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
    if (d.startsWith('0')) d = d.slice(1);
    return d.length === 10 || d.length === 11 ? '55' + d : null;
  };
  DC.telBonito = (d) => { d = String(d || '').replace(/\D/g, '').replace(/^55/, ''); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d; };
  DC.emailTec = (digitos) => digitos + '@tel.debcare.app';
  DC.wa = (digitos, texto) => `https://wa.me/${String(digitos || '').replace(/\D/g, '')}${texto ? '?text=' + encodeURIComponent(texto) : ''}`;

  DC.ESPEC = {
    cuidador: { nome: 'Cuidador(a)', curto: 'Cuidador', dica: 'Companhia, higiene, alimentação, rotina e medicação no horário', coren: false },
    tecnico: { nome: 'Técnico(a) de enfermagem', curto: 'Técnico', dica: 'Curativos, sinais vitais, medicação, sondas', coren: true },
    enfermeiro: { nome: 'Enfermeiro(a)', curto: 'Enfermeiro', dica: 'Procedimentos de enfermagem, avaliação e plano de cuidado', coren: true },
    acompanhante: { nome: 'Acompanhante hospitalar', curto: 'Acompanhante', dica: 'Fica com o paciente no hospital, de dia ou à noite', coren: false },
  };
  DC.espec = (e) => (DC.ESPEC[e] || {}).nome || 'Profissional de saúde';
  DC.MODAL = { hora: { nome: 'Por hora', un: '/h', campo: 'preco_hora' }, plantao12: { nome: 'Plantão 12h', un: ' / 12h', campo: 'preco_12h' }, plantao24: { nome: 'Plantão 24h', un: ' / 24h', campo: 'preco_24h' } };
  DC.LOCAL = { residencia: 'Residência', hospital: 'Hospital', clinica: 'Clínica / casa de repouso', outro: 'Outro' };
  DC.HABIL = ['Higiene e banho', 'Troca de fralda', 'Alimentação', 'Medicação', 'Curativos', 'Sinais vitais', 'Sonda nasogástrica', 'Gastrostomia', 'Traqueostomia', 'Aspiração', 'Mudança de decúbito', 'Pós-operatório', 'Alzheimer / demência', 'Paliativos', 'Acamados', 'Diabetes / insulina', 'Acompanhamento em consultas', 'Pediatria'];
  DC.SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  DC.STATUS = { solicitado: ['Aguardando o profissional', 't-amber'], aceito: ['Aceito · aguardando pagamento', 't-blue'], confirmado: ['Confirmado e pago', 't-green'],
    concluido: ['Concluído', 't-gray'], recusado: ['Não aceito', 't-red'], cancelado: ['Cancelado', 't-red'] };
  DC.stTag = (s) => { const x = DC.STATUS[s] || [s, 't-gray']; return `<span class="tag ${x[1]}">${DC.esc(x[0])}</span>`; };
  DC.NEC = { aberta: ['Na central', 't-amber'], em_busca: ['Central buscando', 't-blue'], atendida: ['Atendida', 't-green'], cancelada: ['Cancelada', 't-gray'] };
  DC.necTag = (s) => { const x = DC.NEC[s] || [s, 't-gray']; return `<span class="tag ${x[1]}">${DC.esc(x[0])}</span>`; };
  DC.estrelas = (p) => (p.rating ? `<span class="stars">★ ${(+p.rating).toFixed(1).replace('.', ',')}</span> <span class="tiny mute">(${p.n_avaliacoes})</span>` : '<span class="tiny mute">Novo por aqui</span>');
  DC.periodo = (c) => DC.data(c.inicio) + (c.fim && c.fim !== c.inicio ? ' a ' + DC.data(c.fim) : '');
  DC.qtdTxt = (c) => (c.modalidade === 'hora' ? `${c.dias} dia(s) × ${c.horas_dia}h = ${+c.quantidade}h` : `${+c.quantidade} plantão(ões) de ${c.modalidade === 'plantao12' ? '12h' : '24h'}`);
  // dias do período nos dias da semana escolhidos (igual ao servidor)
  DC.dias = (ini, fim, semana) => {
    const out = []; if (!ini) return out; fim = fim || ini;
    const a = new Date(ini + 'T12:00:00Z'), b = new Date(fim + 'T12:00:00Z');
    for (let d = new Date(a); d <= b && out.length < 400; d = new Date(+d + 864e5)) if (semana.includes(d.getUTCDay())) out.push(d.toISOString().slice(0, 10));
    return out;
  };

  DC.session = async () => (await DC.sb.auth.getSession()).data.session;
  DC.api = async (path, body, method) => {
    const s = await DC.session();
    const r = await fetch(path, { method: method || 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (s ? s.access_token : '') },
      body: method === 'GET' ? undefined : JSON.stringify(body || {}) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || 'Erro ' + r.status), { status: r.status });
    return j;
  };
  // exige login e o papel certo; devolve a conta
  DC.boot = async (papel) => {
    const s = await DC.session();
    if (!s) { location.replace('/entrar.html?volta=' + encodeURIComponent(location.pathname + location.hash)); return null; }
    const me = await DC.api('/api/conta', null, 'GET').catch(() => null);
    if (!me) { await DC.sb.auth.signOut(); location.replace('/entrar.html'); return null; }
    if (!me.role) { location.replace('/entrar.html?papel=1'); return null; }
    if (papel && me.role !== papel && me.role !== 'admin') { location.replace(DC.home(me.role, me)); return null; }
    if (papel === 'mind' && !me.isMind) { location.replace(DC.home(me.role)); return null; }
    me.user = s.user;
    DC.me = me;
    const cfg = await DC.sb.from('config').select('key,value');
    DC.cfg = Object.fromEntries((cfg.data || []).map((x) => [x.key, x.value]));
    return me;
  };
  DC.home = (role, me) => (me && me.isMind ? '/mind.html' : role === 'pro' ? '/pro.html' : role === 'cliente' ? '/cliente.html' : role === 'admin' ? '/admin.html' : '/entrar.html');
  DC.sair = async () => { await DC.sb.auth.signOut(); location.href = '/'; };

  DC.toast = (msg, err) => {
    const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), err ? 5200 : 3200);
  };
  DC.erro = (e) => DC.toast(e && e.message ? e.message.replace(/^db \d+: /, '') : 'Algo deu errado. Tente de novo.', true);
  DC.modal = (html, opts = {}) => {
    const sc = document.createElement('div'); sc.className = 'scrim';
    sc.innerHTML = `<div class="sheet ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(sc);
    const close = () => { sc.remove(); document.removeEventListener('keydown', onk); if (opts.onClose) opts.onClose(); };
    const onk = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onk);
    sc.addEventListener('click', (e) => { if (e.target === sc || e.target.closest('[data-close]')) close(); });
    const first = sc.querySelector('input,select,textarea'); if (first && !opts.semFoco) setTimeout(() => first.focus(), 30);
    return { el: sc.firstElementChild, close };
  };
  DC.confirm = (msg, ok, extra) => new Promise((res) => {
    let done = false;
    const m = DC.modal(`<h2>${DC.esc(msg)}</h2>${extra || ''}<div class="acts"><button class="btn btn-ghost" data-close>Voltar</button><button class="btn" id="ok">${DC.esc(ok || 'Confirmar')}</button></div>`,
      { semFoco: !extra, onClose: () => { if (!done) res(false); } });
    m.el.querySelector('#ok').onclick = () => { done = true; const v = m.el.querySelector('textarea,input'); m.close(); res(v ? { valor: v.value } : true); };
  });
  DC.busy = async (btn, fn) => {
    const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin" style="width:16px;height:16px;border-width:2px"></span>';
    try { return await fn(); } catch (e) { DC.erro(e); } finally { btn.disabled = false; btn.innerHTML = old; }
  };
  // abas por hash (#aba)
  DC.tabs = (names, render) => {
    const go = () => {
      const h = (location.hash || '').slice(1) || names[0];
      const t = names.includes(h) ? h : names[0];
      DC.$$('[data-tab]').forEach((a) => a.classList.toggle('on', a.dataset.tab === t));
      render(t);
    };
    window.addEventListener('hashchange', go); go();
  };
  DC.marca = (sub) => `<span class="mk" aria-hidden="true"><svg viewBox="0 0 64 64" width="30" height="30"><rect x="1" y="1" width="62" height="62" rx="15" fill="#0E2B36" stroke="rgba(255,255,255,.22)" stroke-width="2"/><path d="M32 50C18 41 12 33 12 25c0-6.5 5-11 10.8-11 4.2 0 7.4 2.4 9.2 5.6C33.8 16.4 37 14 41.2 14 47 14 52 18.5 52 25c0 8-6 16-20 25z" fill="#2BB59A"/><path d="M32 25v12M26 31h12" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/></svg></span><span class="wm">Saúde <b>Pra Você</b></span>${sub ? `<small>${DC.esc(sub)}</small>` : ''}`;
  DC.topo = (me, abas, aud) => {
    const el = DC.$('#top');
    el.innerHTML = `<div class="top-in">
      <a class="brand" href="${DC.home(me.role, me)}">${DC.marca(aud)}</a>
      <nav class="nav" aria-label="Principal">${abas.map(([k, l]) => `<a href="#${k}" data-tab="${k}">${DC.esc(l)}</a>`).join('')}</nav>
      <div class="who">${me.isMind ? `<a class="btn btn-sm ${aud === 'Mind' ? '' : 'btn-ghost'}" href="/mind.html" title="Painel Mind: ver como qualquer perfil">Mind</a>` : me.isAdmin && aud !== 'Central' ? '<a class="btn btn-sm btn-ghost" href="/admin.html">Central</a>' : ''}
        <button class="btn btn-sm btn-ghost" id="sair" title="${DC.esc(DC.telBonito(me.telefone))}">Sair</button>${DC.av(me.nome)}</div></div>`;
    DC.$('#sair').onclick = DC.sair;
    // gestor da Mind: troca de perfil com um toque, sem novo login (a mesma conta abre todas as áreas)
    if (me.isMind && !DC.$('#trocaPerfil')) {
      const ops = [['/cliente.html', 'Contratante'], ['/pro.html', 'Profissional'], ['/admin.html', 'Gestão'], ['/mind.html', 'Painel Mind']];
      el.insertAdjacentHTML('afterend', `<nav class="troca" id="trocaPerfil" aria-label="Trocar de perfil"><span>Ver como</span>${ops.map(([h, n]) =>
        `<a href="${h}" class="${location.pathname === h ? 'on' : ''}" ${location.pathname === h ? 'aria-current="page"' : ''}>${n}</a>`).join('')}</nav>`);
    }
  };
  DC.centralWa = (texto) => { const n = DC.cfg && DC.cfg.central_whatsapp; return n ? DC.wa(n, texto) : null; };
})();

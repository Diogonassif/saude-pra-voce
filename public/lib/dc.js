/* Saúde Pra Você · núcleo do navegador: sessão, API, utilidades de tela */
(function () {
  const DC = window.DC = window.DC || {};
  DC.sb = window.supabase.createClient(DC.url, DC.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });

  DC.$ = (s, el) => (el || document).querySelector(s);
  DC.$$ = (s, el) => [...(el || document).querySelectorAll(s)];
  DC.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  DC.brl = (v, dec) => 'R$ ' + (+v || 0).toLocaleString('pt-BR', { minimumFractionDigits: dec ?? ((+v % 1) ? 2 : 0), maximumFractionDigits: 2 });
  // contrato fixo: valor de cada parcela a partir do total de quem está vendo (mesma conta do servidor)
  DC.alocar = (total, qtds, i) => {
    const r = (v) => Math.round(v * 100) / 100, Q = qtds.reduce((a, b) => a + +b, 0) || 1;
    if (i < qtds.length - 1) return r(+total * +qtds[i] / Q);
    let soma = 0; for (let k = 0; k < qtds.length - 1; k++) soma += r(+total * +qtds[k] / Q);
    return r(+total - soma);
  };
  DC.MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  DC.mesTxt = (d) => { const [y, m] = String(d).split('-'); return DC.MESES[+m - 1] + '/' + y; };
  DC.addMeses = (d, n) => { const [y, m, dd] = d.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1 + n, dd)); t.setUTCDate(t.getUTCDate() - 1); return t.toISOString().slice(0, 10); };
  // divide o período em meses do calendário (só para mostrar a estimativa antes de enviar)
  DC.partesMensais = (ini, fim, semana, mod, hd) => {
    const out = []; let a = ini;
    while (a && a <= fim && out.length < 13) {
      const [y, m] = a.split('-').map(Number); const ult = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); const b = ult < fim ? ult : fim;
      const d = DC.dias(a, b, semana).length; if (d) out.push({ inicio: a, fim: b, dias: d, quantidade: mod === 'hora' ? d * hd : d });
      a = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    }
    return out;
  };
  // botão de olho em todo campo de senha (mostrar/esconder o que foi digitado)
  DC.olhos = (root) => {
    (root || document).querySelectorAll('input[type="password"]:not([data-olho])').forEach((inp) => {
      inp.dataset.olho = '1';
      const w = document.createElement('span'); w.className = 'pw-wrap';
      inp.parentNode.insertBefore(w, inp); w.appendChild(inp);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'pw-eye'; b.setAttribute('aria-label', 'Mostrar senha');
      const olho = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
      const fechado = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17.9 17.9A10.8 10.8 0 0 1 12 19c-7 0-11-7-11-7a20 20 0 0 1 5.1-5.9M9.9 5.2A10 10 0 0 1 12 5c7 0 11 7 11 7a20 20 0 0 1-2.4 3.4M14.1 14.1a3 3 0 1 1-4.2-4.2M1 1l22 22"/></svg>';
      b.innerHTML = olho;
      b.onclick = () => { const ver = inp.type === 'password'; inp.type = ver ? 'text' : 'password'; b.innerHTML = ver ? fechado : olho; b.setAttribute('aria-label', ver ? 'Esconder senha' : 'Mostrar senha'); inp.focus(); };
      w.appendChild(b);
    });
  };
  const olhar = () => { DC.olhos(); new MutationObserver(() => DC.olhos()).observe(document.body, { childList: true, subtree: true }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', olhar); else olhar();
  DC.data = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');
  DC.dataCurta = (s) => DC.data(s).slice(0, 5);
  DC.hoje = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  DC.ini = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
  // avatar: foto quando existe; se a imagem não carregar, volta para as iniciais
  DC.av = (nome, url, cls) => `<span class="av ${cls || ''}">${url ? `<img src="${DC.esc(url)}" alt="" loading="lazy" data-i="${DC.esc(DC.ini(nome))}" onerror="this.parentNode.textContent=this.dataset.i">` : DC.esc(DC.ini(nome))}</span>`;
  // foto de perfil pública de cada usuário (fotos/<id>.jpg)
  DC.foto = (uid, v) => (uid ? `${DC.url}/storage/v1/object/public/fotos/${uid}.jpg${v ? '?v=' + v : ''}` : '');

  // recorta no centro, reduz para 480×480 e devolve um JPEG
  DC.prepararFoto = (file) => new Promise((ok, erro) => {
    if (!file || !/^image\//.test(file.type)) return erro(new Error('Escolha uma imagem'));
    const img = new Image(); const u = URL.createObjectURL(file);
    img.onload = () => {
      const lado = Math.min(img.naturalWidth, img.naturalHeight), T = 480;
      const cv = document.createElement('canvas'); cv.width = T; cv.height = T;
      cv.getContext('2d').drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, T, T);
      URL.revokeObjectURL(u);
      cv.toBlob((b) => (b ? ok(b) : erro(new Error('Não deu para ler a imagem'))), 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(u); erro(new Error('Não deu para abrir essa imagem')); };
    img.src = u;
  });

  // cartão "Sua foto": tirar selfie (câmera frontal no celular) ou escolher da galeria
  DC.fotoEditor = (el, opts) => {
    const me = DC.me; const o = opts || {};
    const desenha = (url) => {
      el.innerHTML = `<div class="card col"><h2>Sua foto</h2><p class="small mute">${o.texto || 'Uma foto do rosto passa confiança. Pode ser uma selfie.'}</p>
        <div class="av-edit">${DC.av(me.nome, url, 'xl')}<div class="col" style="gap:8px">
          <label class="btn btn-sm">📷 Tirar selfie<input type="file" accept="image/*" capture="user" hidden data-foto></label>
          <label class="btn btn-sm btn-ghost">Escolher da galeria<input type="file" accept="image/*" hidden data-foto></label>
          ${url ? '<button class="btn btn-sm btn-ghost" data-tirar style="color:var(--red)">Remover foto</button>' : ''}</div></div></div>`;
      el.querySelectorAll('[data-foto]').forEach((inp) => (inp.onchange = () => DC.busy(inp.parentNode, async () => {
        const blob = await DC.prepararFoto(inp.files[0]);
        const { error } = await DC.sb.storage.from('fotos').upload(me.id + '.jpg', blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '60' });
        if (error) throw error;
        const nova = DC.foto(me.id, Date.now());
        await DC.sb.from('profiles').update({ foto_url: nova }).eq('id', me.id);
        if (o.pro) await DC.sb.from('pros').update({ avatar_url: nova }).eq('user_id', me.id);
        me.foto_url = nova; DC.toast('Foto salva'); desenha(nova); if (o.depois) o.depois(nova);
      })));
      const t = el.querySelector('[data-tirar]');
      if (t) t.onclick = () => DC.busy(t, async () => {
        await DC.sb.storage.from('fotos').remove([me.id + '.jpg']);
        await DC.sb.from('profiles').update({ foto_url: null }).eq('id', me.id);
        if (o.pro) await DC.sb.from('pros').update({ avatar_url: null }).eq('user_id', me.id);
        me.foto_url = null; DC.toast('Foto removida'); desenha(null); if (o.depois) o.depois(null);
      });
    };
    desenha(o.url !== undefined ? o.url : me.foto_url);
  };
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
    let anterior = null;
    const go = () => {
      const h = (location.hash || '').slice(1) || names[0];
      const t = names.includes(h) ? h : names[0];
      DC.$$('[data-tab]').forEach((a) => a.classList.toggle('on', a.dataset.tab === t));
      veio = anterior; anterior = t; atual = t;
      render(t);
      poeVoltar();
    };
    // botão Voltar nas telas que não são a inicial (volta à tela anterior do app, ou à inicial);
    // reaparece sozinho quando a tela se redesenha
    let veio = null, atual = null;
    const poeVoltar = () => {
      const app = DC.$('#app');
      if (!app || atual === names[0] || app.querySelector('.empty .spin') || DC.$('#voltar')) return;
      app.insertAdjacentHTML('afterbegin', `<button type="button" class="voltar" id="voltar">← Voltar</button>`);
      DC.$('#voltar').onclick = () => { if (veio && veio !== atual) history.back(); else location.hash = names[0]; };
    };
    const appEl = DC.$('#app');
    if (appEl) new MutationObserver(poeVoltar).observe(appEl, { childList: true });
    window.addEventListener('hashchange', go); go();
  };
  DC.marca = (sub) => `<span class="mk" aria-hidden="true"><svg viewBox="0 0 64 64" width="30" height="30"><rect x="1" y="1" width="62" height="62" rx="15" fill="#0E2B36" stroke="rgba(255,255,255,.22)" stroke-width="2"/><path d="M32 50C18 41 12 33 12 25c0-6.5 5-11 10.8-11 4.2 0 7.4 2.4 9.2 5.6C33.8 16.4 37 14 41.2 14 47 14 52 18.5 52 25c0 8-6 16-20 25z" fill="#2BB59A"/><path d="M32 25v12M26 31h12" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/></svg></span><span class="wm">Saúde <b>Pra Você</b></span>${sub ? `<small>${DC.esc(sub)}</small>` : ''}`;
  // qual área está aberta: selo colorido no topo, para nunca confundir os perfis
  DC.AREAS = {
    '/cliente.html': { nome: 'Contratante', selo: 'Área do contratante', ic: '👪', cls: 'a-cli' },
    '/pro.html': { nome: 'Profissional', selo: 'Área do profissional', ic: '🩺', cls: 'a-pro' },
    '/admin.html': { nome: 'Gestão', selo: 'Gestão · Central', ic: '🏥', cls: 'a-adm' },
    '/mind.html': { nome: 'Painel Mind', selo: 'Painel Mind', ic: '📊', cls: 'a-mind' },
  };
  DC.topo = (me, abas, aud) => {
    const el = DC.$('#top');
    const aqui = DC.AREAS[location.pathname] || null;
    // gestor da Mind: barra fina separada, acima do menu, para trocar de perfil com um toque (sem novo login)
    const troca = me.isMind ? `<div class="troca" id="trocaPerfil" role="navigation" aria-label="Trocar de perfil">
        <span class="troca-l">Modo gestor <b>·</b> ver o app como</span>
        <span class="troca-seg">${Object.entries(DC.AREAS).map(([h, a]) => `<a href="${h}" class="${location.pathname === h ? 'on ' + a.cls : ''}" ${location.pathname === h ? 'aria-current="page"' : ''}><span aria-hidden="true">${a.ic}</span> ${a.nome}</a>`).join('')}</span></div>` : '';
    el.innerHTML = `${troca}<div class="top-in">
      <a class="brand" href="${DC.home(me.role, me)}">${DC.marca()}</a>
      ${aqui && !me.isMind ? `<span class="area ${aqui.cls}"><span aria-hidden="true">${aqui.ic}</span> ${aqui.selo}</span>` : ''}
      <nav class="nav${abas.length < 2 ? ' so1' : ''}${me.isMind ? ' semdiv' : ''}" aria-label="Menu da ${aqui ? DC.esc(aqui.selo.toLowerCase()) : 'área'}">${abas.map(([k, l]) => `<a href="#${k}" data-tab="${k}">${DC.esc(l)}</a>`).join('')}</nav>
      <div class="who">${!me.isMind && me.isAdmin && location.pathname !== '/admin.html' ? '<a class="btn btn-sm btn-ghost" href="/admin.html">Central</a>' : ''}
        <button class="btn btn-sm btn-ghost" id="sair" title="${DC.esc(DC.telBonito(me.telefone))}">Sair</button><span id="meuAv">${DC.av(me.nome, me.foto_url)}</span></div></div>`;
    DC.$('#sair').onclick = DC.sair;
  };
;
  // conversa entre a central e o contratante dentro de um pedido à central
  DC.chatNec = async (el, necId, souCentral) => {
    if (!el) return;
    const { data, error } = await DC.sb.from('necessidade_mensagens').select('*').eq('necessidade_id', necId).order('created_at').limit(300);
    if (error) { el.innerHTML = `<p class="tiny mute">Conversa indisponível agora.</p>`; return; }
    el.innerHTML = `<div class="chat" style="max-height:320px">${(data || []).length ? '' : `<p class="small mute nm">${souCentral ? 'Nenhuma mensagem ainda. Escreva para o contratante.' : 'Fale com a nossa central por aqui.'}</p>`}</div>
      <form class="row"><label class="sr">Mensagem</label><input class="in grow" maxlength="4000" placeholder="${souCentral ? 'Mensagem para o contratante' : 'Mensagem para a central'}" autocomplete="off"><button class="btn btn-sm" type="submit">Enviar</button></form>`;
    const chat = el.querySelector('.chat');
    const poe = (x) => { if (chat.querySelector(`[data-mid="${x.id}"]`)) return; const nm = chat.querySelector('.nm'); if (nm) nm.remove();
      const meu = souCentral ? x.da_central : !x.da_central;
      chat.insertAdjacentHTML('beforeend', `<div data-mid="${x.id}" class="bub ${meu ? 'out' : 'in'}">${x.da_central && !souCentral ? '<b class="tiny">Central</b><br>' : ''}${DC.esc(x.texto)}<small>${new Date(x.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small></div>`);
      chat.scrollTop = chat.scrollHeight; };
    (data || []).forEach(poe);
    DC.sb.channel('nec-' + necId + '-' + Math.random().toString(36).slice(2, 7)).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'necessidade_mensagens', filter: 'necessidade_id=eq.' + necId }, (ev) => poe(ev.new)).subscribe();
    const f = el.querySelector('form'), inp = f.querySelector('input');
    f.onsubmit = async (e) => { e.preventDefault(); const t = inp.value.trim(); if (!t) return; inp.value = '';
      const { data: m, error: er } = await DC.sb.from('necessidade_mensagens').insert({ necessidade_id: necId, texto: t }).select().single();
      if (er) { DC.erro(er); inp.value = t; return; } poe(m); };
  };
  DC.centralWa = (texto) => { const n = DC.cfg && DC.cfg.central_whatsapp; return n ? DC.wa(n, texto) : null; };
})();

/* Saúde Pra Você · app do contratante */
(async function () {
  const { $, $$, sb, esc, brl } = DC;
  const me = await DC.boot('cliente'); if (!me) return;
  DC.topo(me, [['catalogo', 'Profissionais'], ['contratacoes', 'Minhas contratações'], ['ajuda', 'Pedir à central'], ['conta', 'Conta']], 'para famílias');
  const app = $('#app');
  const qs = new URLSearchParams(location.search);
  if (qs.get('pago')) DC.toast('Pagamento recebido! Assim que o Mercado Pago confirmar, o atendimento fica confirmado.');


  // dados do último pedido, para não digitar de novo (fica só neste aparelho)
  const UK = 'dc_ult_' + me.id;
  const ultimo = () => { try { return JSON.parse(localStorage.getItem(UK) || '{}'); } catch (e) { return {}; } };
  const guardaUltimo = (o) => { try { localStorage.setItem(UK, JSON.stringify(o)); } catch (e) {} };

  // ------------------------------------------------------------------ catálogo
  let CAT = null;
  async function catalogo() {
    const { data, error } = await sb.rpc('catalogo');
    if (error) throw error;
    CAT = data || [];
    const st = { e: qs.get('esp') || '', q: '', local: '', plantao: '', gen: '', ver: false };
    const wa = DC.centralWa('Olá! Preciso de ajuda para encontrar um profissional na Saúde Pra Você.');
    app.innerHTML = `
      <div class="head"><div><h1>Encontre quem vai cuidar</h1><p>Escolha o profissional, o período e pague pelo app. Tudo registrado e com segurança.</p></div>
        <a class="btn btn-coral" href="#ajuda" id="pedeAjuda">Não encontrei: pedir à central</a></div>
      <div class="banner info row" id="fixoBan" style="justify-content:space-between"><span>🏥 <b>É clínica ou empresa?</b> Contrate um profissional fixo por 1 a 12 meses, com pagamento mensal pelo app.</span><button class="btn btn-sm ${DC.tipoPadrao === 'fixo' ? 'btn-green' : ''}" id="fixoOn">${DC.tipoPadrao === 'fixo' ? '✓ Modo contrato fixo' : 'Quero contrato fixo'}</button></div>
      <div class="seg" id="fe" style="max-width:760px"><button data-e="" class="on">Todos</button>${Object.entries(DC.ESPEC).map(([k, v]) => `<button data-e="${k}">${v.curto}</button>`).join('')}</div>
      <div class="split">
        <aside class="side" style="max-width:300px"><details class="card filtros" ${innerWidth > 800 ? 'open' : ''}><summary>Filtros</summary><div class="col">
          <label class="f">Buscar<input class="in" id="q" placeholder="Cidade, bairro, cuidado (ex.: sonda)"></label>
          <label class="f">Local do atendimento<select class="in" id="fl"><option value="">Qualquer</option><option value="residencia">Em casa</option><option value="hospital">No hospital</option></select></label>
          <label class="f">Plantão<select class="in" id="fp"><option value="">Qualquer</option><option value="preco_12h">Faz plantão de 12h</option><option value="preco_24h">Faz plantão de 24h</option></select></label>
          <label class="f">Preferência<select class="in" id="fg"><option value="">Indiferente</option><option value="feminino">Profissional mulher</option><option value="masculino">Profissional homem</option></select></label>
          <label class="check"><input type="checkbox" id="fv">Só com selo verificado</label>
          <p class="tiny mute">O selo verificado indica que conferimos documentos e, para enfermagem, o COREN.</p>
        </div></details></aside>
        <section class="main"><div class="grid" id="res"></div></section>
      </div>`;
    const draw = () => {
      const q = DC.norm(st.q);
      const L = CAT.filter((p) => (!st.e || p.especialidade === st.e) && (!st.local || (p.atende || []).includes(st.local))
        && (!st.plantao || p[st.plantao]) && (!st.gen || p.genero === st.gen) && (!st.ver || p.verificado)
        && (!q || DC.norm([p.nome, p.titulo, p.cidade, p.regioes, (p.habilidades || []).join(' '), p.resumo].join(' ')).includes(q)));
      $('#res').innerHTML = L.length ? L.map(cartao).join('')
        : `<div class="card empty" style="grid-column:1/-1"><b>Nenhum profissional com esses filtros</b>A nossa central procura para você: conte do que precisa e nós indicamos alguém de confiança.<br><br><a class="btn btn-coral" href="#ajuda">Pedir à central</a>${wa ? ` <a class="btn btn-ghost" href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp da central</a>` : ''}</div>`;
      $$('[data-ver]').forEach((b) => (b.onclick = () => verPro(b.dataset.ver)));
      $$('[data-ctr]').forEach((b) => (b.onclick = () => contratar(CAT.find((p) => p.user_id === b.dataset.ctr), null, null, DC.tipoPadrao)));
    };
    $$('#fe button').forEach((b) => { b.classList.toggle('on', b.dataset.e === st.e); b.onclick = () => { st.e = b.dataset.e; $$('#fe button').forEach((x) => x.classList.toggle('on', x === b)); draw(); }; });
    $('#q').oninput = (e) => { st.q = e.target.value; draw(); };
    $('#fl').onchange = (e) => { st.local = e.target.value; draw(); };
    $('#fp').onchange = (e) => { st.plantao = e.target.value; draw(); };
    $('#fg').onchange = (e) => { st.gen = e.target.value; draw(); };
    $('#fv').onchange = (e) => { st.ver = e.target.checked; draw(); };
    $('#fixoOn').onclick = () => { DC.tipoPadrao = DC.tipoPadrao === 'fixo' ? null : 'fixo'; const on = DC.tipoPadrao === 'fixo'; $('#fixoOn').textContent = on ? '✓ Modo contrato fixo' : 'Quero contrato fixo'; $('#fixoOn').classList.toggle('btn-green', on); DC.toast(on ? 'Agora escolha o profissional e toque em Contratar: já abre como contrato fixo.' : 'Voltou para atendimento avulso'); };
    $('#pedeAjuda').onclick = (e) => { e.preventDefault(); location.hash = 'ajuda'; setTimeout(() => novaNecessidade(st.e), 60); };
    draw();
  }
  const precos = (p) => `<div class="pr">${Object.entries(DC.MODAL).map(([k, x]) => `<div class="${p[x.campo] ? '' : 'na'}"><span class="tiny mute">${x.nome}</span><b>${p[x.campo] ? brl(p[x.campo]) : '—'}</b></div>`).join('')}</div>`;
  const cartao = (p) => `<article class="card pc">
      <div class="head-pro">${DC.av(p.nome, p.avatar_url, 'lg')}<div class="grow"><b style="font-size:17px">${esc(p.nome)}</b> ${p.verificado ? '<span class="selo">✓ Selo verificado</span>' : ''}
        <div class="small mute">${esc(DC.espec(p.especialidade))}${p.experiencia_anos ? ` · ${p.experiencia_anos} ${p.experiencia_anos === 1 ? 'ano' : 'anos'}` : ''}</div>
        <div class="small mute">${esc([p.cidade, p.uf].filter(Boolean).join('/'))}</div><div>${DC.estrelas(p)}</div></div></div>
      ${p.titulo ? `<div class="small"><b>${esc(p.titulo)}</b></div>` : ''}
      ${(p.habilidades || []).length ? `<div class="chips">${p.habilidades.slice(0, 4).map((h) => `<span class="chip">${esc(h)}</span>`).join('')}${p.habilidades.length > 4 ? `<span class="tiny mute">+${p.habilidades.length - 4}</span>` : ''}</div>` : ''}
      ${precos(p)}
      <div class="row"><button class="btn btn-ghost btn-sm grow" data-ver="${p.user_id}">Ver perfil</button><button class="btn btn-sm grow" data-ctr="${p.user_id}">Contratar</button></div></article>`;

  async function verPro(id) {
    const p = (CAT || []).find((x) => x.user_id === id); if (!p) return;
    const [ag, av] = await Promise.all([sb.rpc('agenda_pro', { p: id }), sb.rpc('avaliacoes_pro', { p: id })]);
    const st = Object.fromEntries((ag.data || []).map((d) => [d.dia, d.status]));
    const dias = []; for (let i = 0; i < 42; i++) { const d = new Date(Date.now() + i * 864e5 - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10); dias.push([d, st[d] || 'vazio']); }
    const m = DC.modal(`<div class="row" style="flex-wrap:nowrap">${DC.av(p.nome, p.avatar_url, 'lg')}<div class="grow"><h2>${esc(p.nome)} ${p.verificado ? '<span class="selo">✓ Selo verificado</span>' : ''}</h2>
        <p class="mute">${esc(DC.espec(p.especialidade))}${p.experiencia_anos ? ` · ${p.experiencia_anos} anos de experiência` : ''}${p.cidade ? ' · ' + esc(p.cidade) + (p.uf ? '/' + esc(p.uf) : '') : ''}</p><p>${DC.estrelas(p)}</p></div></div>
      ${p.titulo ? `<h3>${esc(p.titulo)}</h3>` : ''}
      ${p.resumo ? `<p style="white-space:pre-wrap">${esc(p.resumo)}</p>` : ''}
      ${(p.habilidades || []).length ? `<div class="chips">${p.habilidades.map((h) => `<span class="chip">${esc(h)}</span>`).join('')}</div>` : ''}
      <p class="small"><b>Atende:</b> ${esc((p.atende || []).map((x) => DC.LOCAL[x]).join(', '))}${p.regioes ? ' · ' + esc(p.regioes) : ''}${p.tem_coren ? ' · COREN informado' : ''}</p>
      ${precos(p)}
      <div><h3>Próximas semanas</h3>${calendario(dias)}
        <div class="leg" style="margin-top:6px"><span><i class="d-livre"></i>Disponível</span><span><i class="d-parcial"></i>Parcial</span><span><i class="d-alocado"></i>Ocupado</span><span><i class="d-off"></i>Folga</span></div></div>
      ${(av.data || []).length ? `<div><h3>Avaliações</h3>${av.data.map((a) => `<p class="small"><span class="stars">${'★'.repeat(a.nota)}</span> ${esc(a.comentario)}</p>`).join('')}</div>` : ''}
      <div class="acts"><button class="btn btn-ghost" data-close>Fechar</button><button class="btn" id="ctr">Contratar ${esc(p.nome.split(' ')[0])}</button></div>`, { wide: true, semFoco: true });
    $('#ctr', m.el).onclick = () => { m.close(); contratar(p, null, null, DC.tipoPadrao); };
  }

  // calendário por semana (segunda a domingo), com a data de cada dia e o período de cada semana
  function calendario(dias) {
    const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const NOME = { livre: 'disponível', vazio: 'disponível', parcial: 'parcial', alocado: 'ocupado', off: 'folga' };
    const dow = (d) => (new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7;   // 0 = segunda
    const cel = [...Array(dow(dias[0][0])).fill(null), ...dias];
    while (cel.length % 7) cel.push(null);
    const sem = []; for (let i = 0; i < cel.length; i += 7) sem.push(cel.slice(i, i + 7));
    const curto = (d) => { const [, m, dd] = d.split('-'); return `${+dd} ${MES[+m - 1]}`; };
    return `<div class="calw">
      <div class="cal-h"><span></span>${['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((x) => `<span>${x}</span>`).join('')}</div>
      ${sem.map((w) => { const v = w.filter(Boolean); return `<div class="cal-w"><span class="cal-l">${v.length > 1 ? `${curto(v[0][0])}<br>a ${curto(v[v.length - 1][0])}` : curto(v[0][0])}</span>${w.map((x) => x
        ? `<span class="cal-d d-${x[1] === 'vazio' ? 'livre' : x[1]}${x[1] === 'vazio' ? ' leve' : ''}" title="${DC.data(x[0])} · ${NOME[x[1]] || ''}">${+x[0].slice(8)}</span>`
        : '<span class="cal-d cal-x"></span>').join('')}</div>`; }).join('')}
    </div>`;
  }

  // ------------------------------------------------------------------ contratar (escolhe tempo e paga)
  // ed = contratação existente (editar o pedido antes de pagar)
  function contratar(p, ed, depois, tipoIni) {
    if (!p) return;
    const u = ed ? { paciente_nome: ed.paciente_nome, paciente_idade: ed.paciente_idade, cuidados: ed.cuidados, local_tipo: ed.local_tipo, endereco: ed.endereco, cidade: ed.cidade, horario: ed.horario ? ed.horario.slice(0, 5) : '', horas_dia: ed.horas_dia } : ultimo();
    const mods = Object.keys(DC.MODAL).filter((k) => p[DC.MODAL[k].campo]);
    const st = { tipo: ed ? (ed.tipo || 'avulso') : (tipoIni || 'avulso'), mod: ed && mods.includes(ed.modalidade) ? ed.modalidade : mods[0], semana: ed && (ed.dias_semana || []).length ? [...ed.dias_semana].sort() : [0, 1, 2, 3, 4, 5, 6], local: u.local_tipo || ((p.atende || [])[0]) || 'residencia' };
    const hoje = DC.hoje(), iniV = ed && ed.inicio >= hoje ? ed.inicio : hoje, fimV = ed && ed.fim >= iniV ? ed.fim : iniV;
    const m = DC.modal(`<div class="row" style="flex-wrap:nowrap">${DC.av(p.nome, p.avatar_url)}<div class="grow"><h2>${ed ? 'Editar pedido #' + ed.codigo : 'Contratar ' + esc(p.nome)}</h2><p class="small mute">${esc(DC.espec(p.especialidade))}</p></div></div>
      <div class="col" style="gap:6px"><b class="small">Tipo de contratação</b><div class="grid2" id="tp">
        <button type="button" class="opt ${st.tipo === 'avulso' ? 'on' : ''}" data-t="avulso"><b>Atendimento avulso</b><span>Alguns dias ou semanas, para a família. Paga tudo de uma vez.</span></button>
        <button type="button" class="opt ${st.tipo === 'fixo' ? 'on' : ''}" data-t="fixo"><b>🏥 Contrato fixo</b><span>Clínicas e empresas: o profissional fixo por meses, com pagamento mensal.</span></button></div></div>
      <div class="col" id="fixoBox" style="gap:10px">
        <div class="grid2" style="grid-template-columns:1fr 220px"><label class="f">Clínica ou empresa<input class="in" id="emp" maxlength="120" value="${esc(ed ? ed.empresa_nome || '' : (u.empresa_nome || ''))}" placeholder="Ex.: Clínica Bem Viver"></label>
          <label class="f">CNPJ (opcional)<input class="in" id="cnpj" inputmode="numeric" maxlength="18" value="${esc(ed ? ed.empresa_cnpj || '' : (u.empresa_cnpj || ''))}" placeholder="00.000.000/0000-00"></label></div>
        <label class="f">Duração do contrato<select class="in" id="mes">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => `<option value="${n}" ${n === 3 ? 'selected' : ''}>${n} ${n === 1 ? 'mês' : 'meses'}</option>`).join('')}</select><small>Ajusta o último dia sozinho; você pode mudar a data depois, se quiser</small></label></div>
      <div class="col"><b class="small">Como cobrar</b><div class="seg" id="md">${mods.map((k) => `<button type="button" data-m="${k}" class="${k === st.mod ? 'on' : ''}">${DC.MODAL[k].nome}<br><span class="tiny">${brl(p[DC.MODAL[k].campo])}</span></button>`).join('')}</div></div>
      <div class="grid2">
        <label class="f">Primeiro dia<input class="in" type="date" id="ini" min="${hoje}" value="${iniV}"></label>
        <label class="f">Último dia<input class="in" type="date" id="fim" min="${iniV}" value="${fimV}"></label>
        <label class="f">Horário de início<input class="in" type="time" id="hor" value="${ed ? (u.horario || '') : (u.horario || '07:00')}"></label>
        <label class="f" id="hdL">Horas por dia<input class="in" type="number" id="hd" min="1" max="24" value="${u.horas_dia || 6}"></label>
      </div>
      <div class="col" style="gap:6px"><b class="small">Dias da semana</b><div class="sem" id="sem">${DC.SEMANA.map((d, i) => `<button type="button" data-d="${i}" class="${st.semana.includes(i) ? 'on' : ''}">${d}</button>`).join('')}</div></div>
      <h3 id="quemT">Quem vai receber o cuidado</h3>
      <div class="grid2" style="grid-template-columns:1fr 110px"><label class="f"><span id="pnL">Nome</span><input class="in" id="pn" maxlength="120" value="${esc(u.paciente_nome || '')}" placeholder="Ex.: Dona Lúcia"></label>
        <label class="f">Idade<input class="in" id="pi" inputmode="numeric" maxlength="3" value="${esc(u.paciente_idade ?? '')}"></label></div>
      <label class="f">Cuidados necessários<small>Quanto mais detalhe, melhor o profissional se prepara</small><textarea class="in" id="cu" maxlength="3000" placeholder="Ex.: acamada, troca de fralda, medicação às 8h e 20h, curativo na perna, dieta por sonda">${esc(u.cuidados || '')}</textarea></label>
      <div class="col" style="gap:6px"><b class="small">Onde</b><div class="seg" id="lc">${Object.entries(DC.LOCAL).map(([k, v]) => `<button type="button" data-l="${k}" class="${k === st.local ? 'on' : ''}">${v.split(' /')[0]}</button>`).join('')}</div></div>
      <div class="grid2" style="grid-template-columns:1fr 200px"><label class="f">Endereço<small id="endDica">rua, número, bairro${''}</small><input class="in" id="en" maxlength="300" value="${esc(u.endereco || '')}"></label>
        <label class="f">Cidade<input class="in" id="ci" maxlength="80" value="${esc(u.cidade || p.cidade || '')}"></label></div>
      <label class="f">Observações (opcional)<textarea class="in" id="no" maxlength="2000" style="min-height:70px" placeholder="Portaria, animais em casa, quem estará presente…">${esc(ed ? ed.notas || '' : '')}</textarea></label>
      ${ed && ed.status === 'aceito' ? '<div class="banner">Se você mudar datas, horários ou dias, o pedido volta para o profissional confirmar de novo.</div>' : ''}
      <div class="resumo-total" id="tot"></div>
      <div class="priv"><span aria-hidden="true">🔒</span><span>Os dados do paciente ficam só entre você, o profissional e a nossa central. O contato do profissional aparece depois do pagamento.</span></div>
      <div class="acts"><button class="btn btn-ghost" data-close>${ed ? 'Voltar' : 'Cancelar'}</button><button class="btn btn-green" id="env">${ed ? 'Salvar alterações' : 'Enviar pedido'}</button></div>`, { wide: true, semFoco: true });
    const val = () => {
      const ini = $('#ini', m.el).value, fim = $('#fim', m.el).value || ini;
      const dias = DC.dias(ini, fim, st.semana);
      const hd = Math.max(1, Math.min(24, +$('#hd', m.el).value || 0));
      const q = st.mod === 'hora' ? dias.length * hd : dias.length;
      const unit = +p[DC.MODAL[st.mod].campo];
      return { ini, fim, dias, hd, q, unit, total: Math.round(unit * q * 100) / 100 };
    };
    const draw = () => {
      $('#hdL', m.el).classList.toggle('hide', st.mod !== 'hora');
      const fixo = st.tipo === 'fixo';
      $('#fixoBox', m.el).classList.toggle('hide', !fixo);
      $('#quemT', m.el).textContent = fixo ? 'Quem será atendido' : 'Quem vai receber o cuidado';
      $('#pnL', m.el).textContent = fixo ? 'Pacientes ou setor' : 'Nome';
      $('#pn', m.el).placeholder = fixo ? 'Ex.: Pacientes da ala de internação' : 'Ex.: Dona Lúcia';
      $('#endDica', m.el).textContent = st.local === 'hospital' || st.local === 'clinica' ? 'nome do hospital, quarto e leito' : 'rua, número, bairro';
      const v = val();
      const parts = fixo && v.dias.length ? DC.partesMensais(v.ini, v.fim, st.semana, st.mod, v.hd) : [];
      if (fixo && v.dias.length) {
        const q = parts.map((x) => x.quantidade), p1 = DC.alocar(v.total, q, 0);
        $('#tot', m.el).innerHTML = `<span class="small mute">Contrato fixo · ${parts.length} parcela(s) mensal(is)</span><span class="price">${brl(v.total / parts.length, 2)}<small style="font-size:14px"> /mês em média</small></span>
          <span class="small mute">Total do contrato ${brl(v.total, 2)} · ${v.dias.length} dia(s) · ${st.mod === 'hora' ? v.q + ' horas × ' + brl(v.unit, 2) : v.q + ' plantão(ões) × ' + brl(v.unit, 2)}.<br>1ª parcela (${DC.mesTxt(parts[0].inicio)}): <b>${brl(p1, 2)}</b>, paga quando o profissional aceitar. As outras, uma por mês, pelo app.</span>`;
        return;
      }
      $('#tot', m.el).innerHTML = v.dias.length
        ? `<span class="small mute">Total a pagar pelo app</span><span class="price">${brl(v.total, 2)}</span><span class="small mute">${v.dias.length} dia(s) · ${st.mod === 'hora' ? v.q + ' horas × ' + brl(v.unit, 2) : v.q + ' plantão(ões) × ' + brl(v.unit, 2)}. Você só paga depois que o profissional aceitar.</span>`
        : '<span class="small">Nenhum dia do período cai nos dias da semana escolhidos.</span>';
    };
    const poeMeses = () => { const ini = $('#ini', m.el).value; if (ini) { const f = DC.addMeses(ini, +$('#mes', m.el).value); $('#fim', m.el).value = f; } };
    $$('#tp [data-t]', m.el).forEach((b) => (b.onclick = () => {
      st.tipo = b.dataset.t; $$('#tp [data-t]', m.el).forEach((x) => x.classList.toggle('on', x === b));
      if (st.tipo === 'fixo') { if (!ed) poeMeses(); if (st.local === 'residencia') { st.local = 'clinica'; $$('#lc button', m.el).forEach((x) => x.classList.toggle('on', x.dataset.l === 'clinica')); } }
      draw();
    }));
    $('#mes', m.el).onchange = () => { poeMeses(); draw(); };
    if (st.tipo === 'fixo' && !ed) poeMeses();
    $$('#md button', m.el).forEach((b) => (b.onclick = () => { st.mod = b.dataset.m; $$('#md button', m.el).forEach((x) => x.classList.toggle('on', x === b)); draw(); }));
    $$('#lc button', m.el).forEach((b) => (b.onclick = () => { st.local = b.dataset.l; $$('#lc button', m.el).forEach((x) => x.classList.toggle('on', x === b)); draw(); }));
    $$('#sem button', m.el).forEach((b) => (b.onclick = () => {
      const d = +b.dataset.d; st.semana = st.semana.includes(d) ? st.semana.filter((x) => x !== d) : [...st.semana, d].sort();
      b.classList.toggle('on', st.semana.includes(d)); draw();
    }));
    $('#ini', m.el).onchange = () => { if (st.tipo === 'fixo') poeMeses(); if ($('#fim', m.el).value < $('#ini', m.el).value) $('#fim', m.el).value = $('#ini', m.el).value; $('#fim', m.el).min = $('#ini', m.el).value; draw(); };
    ['#fim', '#hd'].forEach((s) => ($(s, m.el).oninput = draw));
    draw();
    $('#env', m.el).onclick = () => DC.busy($('#env', m.el), async () => {
      const v = val();
      if (!v.dias.length) throw new Error('Escolha datas e dias da semana');
      const body = { acao: ed ? 'editar' : 'criar', id: ed ? ed.id : undefined, pro_id: p.user_id, modalidade: st.mod, inicio: v.ini, fim: v.fim, horario: $('#hor', m.el).value, horas_dia: v.hd,
        dias_semana: st.semana, paciente_nome: $('#pn', m.el).value.trim(), paciente_idade: $('#pi', m.el).value.replace(/\D/g, ''),
        cuidados: $('#cu', m.el).value.trim(), local_tipo: st.local, endereco: $('#en', m.el).value.trim(), cidade: $('#ci', m.el).value.trim(), notas: $('#no', m.el).value.trim(),
        tipo: st.tipo, empresa_nome: st.tipo === 'fixo' ? $('#emp', m.el).value.trim() : null, empresa_cnpj: st.tipo === 'fixo' ? $('#cnpj', m.el).value.replace(/\D/g, '') : null };
      if (body.tipo === 'fixo' && !body.empresa_nome) throw new Error('Informe o nome da clínica ou empresa');
      if (body.empresa_cnpj && body.empresa_cnpj.length !== 14) throw new Error('CNPJ inválido: são 14 números');
      if (!body.paciente_nome) throw new Error('Informe quem vai receber o cuidado');
      if (!body.endereco) throw new Error('Informe o endereço do atendimento');
      const r = await DC.api('/api/contratar', body);
      if (ed) { m.close(); DC.toast(r.voltou ? 'Pedido alterado. Ele volta para o profissional confirmar.' : 'Pedido alterado · total ' + brl(r.total_cliente, 2)); if (depois) depois(); return; }
      guardaUltimo({ empresa_nome: body.empresa_nome || u.empresa_nome, empresa_cnpj: body.empresa_cnpj || u.empresa_cnpj, paciente_nome: body.paciente_nome, paciente_idade: body.paciente_idade, cuidados: body.cuidados, local_tipo: body.local_tipo, endereco: body.endereco, cidade: body.cidade, horario: body.horario, horas_dia: body.horas_dia });
      m.close(); DC.toast((body.tipo === 'fixo' ? 'Proposta de contrato fixo enviada! Avisamos ' : 'Pedido enviado! Avisamos ') + p.nome.split(' ')[0] + '.');
      location.hash = 'contratacoes'; setTimeout(() => DC.abrirContratacao(r.id, 'cliente', contratacoes), 250);
    });
  }

  DC.editarPedido = async (c, depois) => {
    const { data, error } = await sb.rpc('catalogo');
    if (error) throw error;
    const p = (data || []).find((x) => x.user_id === c.pro_id);
    if (!p) throw new Error('Este profissional não está no catálogo agora. Cancele e escolha outro, ou fale com a central.');
    contratar(p, c, depois);
  };

  // ------------------------------------------------------------------ minhas contratações
  async function contratacoes() {
    const { data, error } = await sb.from('contratacoes').select('*,contratacao_cliente(total)').eq('cliente_id', me.id).order('updated_at', { ascending: false });
    if (error) throw error;
    const L = data || [];
    const tot = (c) => { const v = Array.isArray(c.contratacao_cliente) ? c.contratacao_cliente[0] : c.contratacao_cliente; return v ? brl(v.total, 2) : '—'; };
    const linha = (c) => `<button class="li" data-c="${c.id}" style="width:100%;text-align:left;background:none;border-left:0;border-right:0;border-bottom:0;cursor:pointer">
      ${DC.av(c.pro_nome, DC.foto(c.pro_id))}<span class="grow"><b>${esc(c.pro_nome)}</b> <span class="small mute">· ${esc(DC.espec(c.especialidade))}</span>${c.tipo === 'fixo' ? ' <span class="tag t-blue">Contrato fixo</span>' : ''}<br><span class="small mute">${c.tipo === 'fixo' && c.empresa_nome ? esc(c.empresa_nome) + ' · ' : ''}${DC.periodo(c)} · ${esc(c.paciente_nome)} · ${esc(DC.LOCAL[c.local_tipo])}</span></span>
      <span style="text-align:right">${DC.stTag(c.status)}<br><b class="small">${tot(c)}</b></span></button>`;
    const bloco = (tit, F, vazio, extra) => { const X = L.filter(F); return X.length || vazio ? `<div class="card col ${extra || ''}"><h2>${tit}</h2>${X.length ? `<div class="list">${X.map(linha).join('')}</div>` : `<p class="small mute">${vazio}</p>`}</div>` : ''; };
    app.innerHTML = `<div class="head"><div><h1>Minhas contratações</h1><p>Acompanhe pedidos, pague pelo app e converse com o profissional.</p></div><a class="btn" href="#catalogo">Contratar profissional</a></div>
      ${bloco('Pague para confirmar', (c) => c.status === 'aceito', '', 'alerta')}
      ${bloco('Aguardando o profissional', (c) => c.status === 'solicitado', '')}
      ${bloco('Confirmados', (c) => c.status === 'confirmado', L.length ? 'Nenhum atendimento confirmado agora.' : 'Você ainda não contratou. Escolha um profissional no catálogo.')}
      ${bloco('Histórico', (c) => ['concluido', 'recusado', 'cancelado'].includes(c.status), '')}`;
    $$('[data-c]').forEach((b) => (b.onclick = () => DC.abrirContratacao(b.dataset.c, 'cliente', contratacoes)));
    const abrir = qs.get('abrir'); if (abrir) DC.abrirContratacao(abrir, 'cliente', contratacoes);
  }

  // ------------------------------------------------------------------ pedir à central (necessidades)
  async function ajuda() {
    const { data, error } = await sb.from('necessidades').select('*').eq('cliente_id', me.id).order('created_at', { ascending: false });
    if (error) throw error;
    const wa = DC.centralWa('Olá! Preciso de ajuda para encontrar um profissional na Saúde Pra Você.');
    app.innerHTML = `<div class="head"><div><h1>Pedir à nossa central</h1><p>Não encontrou o profissional certo? Conte do que precisa: a central procura e indica alguém de confiança. Você confirma e paga pelo app, como sempre.</p></div>
      <div class="row">${wa ? `<a class="btn btn-ghost" href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp da central</a>` : ''}<button class="btn btn-coral" id="nova">Descrever minha necessidade</button></div></div>
      ${(data || []).length ? `<div class="card"><div class="list">${data.map((n) => `<div class="li"><span class="grow"><b>#${n.codigo} · ${esc(DC.espec(n.especialidade))}</b> para ${esc(n.paciente_nome || '—')}<br>
          <span class="small mute">${n.inicio ? DC.data(n.inicio) + (n.fim ? ' a ' + DC.data(n.fim) : '') + ' · ' : ''}${esc(n.cidade || '')}</span>${n.nota_central ? `<br><span class="small">Central: ${esc(n.nota_central)}</span>` : ''}</span>
          ${DC.necTag(n.status)}${['aberta', 'em_busca'].includes(n.status) ? `<button class="btn btn-sm btn-ghost" data-cn="${n.id}">Cancelar</button>` : ''}</div>
          <div class="col" style="gap:8px;padding:0 0 14px"><b class="small">Conversa com a central</b><div data-chat="${n.id}"></div></div>`).join('')}</div></div>`
        : '<div class="card empty"><b>Nenhum pedido à central</b>Use quando não achar no catálogo, para casos difíceis ou com urgência.</div>'}`;
    $('#nova').onclick = () => novaNecessidade();
    $$('[data-cn]').forEach((b) => (b.onclick = () => DC.busy(b, async () => { const { error: e } = await sb.from('necessidades').update({ status: 'cancelada' }).eq('id', b.dataset.cn); if (e) throw e; ajuda(); })));
    $$('[data-chat]').forEach((el) => DC.chatNec(el, el.dataset.chat, false));
  }
  function novaNecessidade(esp) {
    const u = ultimo();
    let e = esp || 'cuidador', turno = 'dia', local = u.local_tipo || 'residencia', tipo = DC.tipoPadrao === 'fixo' ? 'fixo' : 'avulso';
    const m = DC.modal(`<h2>Do que você precisa?</h2>
      <div class="seg" id="ntp"><button type="button" data-t="avulso" class="${tipo === 'avulso' ? 'on' : ''}">Atendimento avulso</button><button type="button" data-t="fixo" class="${tipo === 'fixo' ? 'on' : ''}">🏥 Contrato fixo (clínica/empresa)</button></div>
      <div class="grid2 ${tipo === 'fixo' ? '' : 'hide'}" id="nfx"><label class="f">Clínica ou empresa<input class="in" id="nemp" maxlength="120" value="${esc(u.empresa_nome || '')}"></label>
        <label class="f">Por quantos meses?<select class="in" id="nmes">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => `<option value="${n}" ${n === 3 ? 'selected' : ''}>${n} ${n === 1 ? 'mês' : 'meses'}</option>`).join('')}</select></label></div>
      <div class="grid2" id="es">${Object.entries(DC.ESPEC).map(([k, v]) => `<button type="button" class="opt ${k === e ? 'on' : ''}" data-e="${k}"><b>${v.nome}</b><span>${v.dica}</span></button>`).join('')}</div>
      <div class="grid2" style="grid-template-columns:1fr 110px"><label class="f">Quem vai receber o cuidado<input class="in" id="pn" maxlength="120" value="${esc(u.paciente_nome || '')}"></label><label class="f">Idade<input class="in" id="pi" inputmode="numeric" maxlength="3" value="${esc(u.paciente_idade ?? '')}"></label></div>
      <label class="f">Cuidados necessários<textarea class="in" id="cu" maxlength="3000">${esc(u.cuidados || '')}</textarea></label>
      <div class="grid2">
        <label class="f">Onde<select class="in" id="lc">${Object.entries(DC.LOCAL).map(([k, v]) => `<option value="${k}" ${k === local ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="f">Cidade<input class="in" id="ci" maxlength="80" value="${esc(u.cidade || '')}"></label>
        <label class="f">Início<input class="in" type="date" id="ini" min="${DC.hoje()}"></label>
        <label class="f">Fim (se souber)<input class="in" type="date" id="fim" min="${DC.hoje()}"></label>
        <label class="f">Turno<select class="in" id="tu"><option value="dia">Diurno</option><option value="noite">Noturno</option><option value="24h">24 horas</option><option value="horas">Algumas horas</option></select></label>
        <label class="f">Preferência<select class="in" id="gp"><option value="">Indiferente</option><option value="feminino">Mulher</option><option value="masculino">Homem</option></select></label>
        <label class="f">Orçamento (opcional)<input class="in" type="number" id="or" min="0" step="10" placeholder="R$ por dia ou total"></label>
      </div>
      <label class="f">Endereço do atendimento<small>rua, número, bairro · ou hospital e quarto</small><input class="in" id="en" maxlength="300" value="${esc(u.endereco || '')}"></label>
      <label class="f">Mais alguma coisa? (opcional)<textarea class="in" id="ob" maxlength="2000" style="min-height:70px"></textarea></label>
      <div class="acts"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-coral" id="env">Enviar para a central</button></div>`, { wide: true, semFoco: true });
    $$('#es [data-e]', m.el).forEach((b) => (b.onclick = () => { e = b.dataset.e; $$('#es [data-e]', m.el).forEach((x) => x.classList.toggle('on', x === b)); }));
    $$('#ntp [data-t]', m.el).forEach((b) => (b.onclick = () => { tipo = b.dataset.t; $$('#ntp [data-t]', m.el).forEach((x) => x.classList.toggle('on', x === b)); $('#nfx', m.el).classList.toggle('hide', tipo !== 'fixo'); if (tipo === 'fixo' && $('#lc', m.el).value === 'residencia') $('#lc', m.el).value = 'clinica'; }));
    $('#env', m.el).onclick = () => DC.busy($('#env', m.el), async () => {
      turno = $('#tu', m.el).value; local = $('#lc', m.el).value;
      const row = { cliente_id: me.id, especialidade: e, paciente_nome: $('#pn', m.el).value.trim(), paciente_idade: +$('#pi', m.el).value || null,
        cuidados: $('#cu', m.el).value.trim(), local_tipo: local, cidade: $('#ci', m.el).value.trim() || null, endereco: $('#en', m.el).value.trim() || null,
        inicio: $('#ini', m.el).value || null, fim: $('#fim', m.el).value || null, turno, horas_dia: turno === '24h' ? 24 : null,
        genero_pref: $('#gp', m.el).value || null, orcamento: +$('#or', m.el).value || null, observacoes: $('#ob', m.el).value.trim(),
        tipo, empresa_nome: tipo === 'fixo' ? $('#nemp', m.el).value.trim() : null, meses: tipo === 'fixo' ? +$('#nmes', m.el).value : null };
      if (tipo === 'fixo' && !row.empresa_nome) throw new Error('Informe o nome da clínica ou empresa');
      if (tipo === 'fixo' && row.inicio && !row.fim) row.fim = DC.addMeses(row.inicio, row.meses);
      if (!row.paciente_nome) throw new Error('Informe quem vai receber o cuidado');
      if (!row.inicio) throw new Error('Informe quando precisa começar');
      if (!row.endereco) throw new Error('Informe o endereço do atendimento');
      if (!row.cidade) throw new Error('Informe a cidade');
      if (row.fim && row.fim < row.inicio) throw new Error('O fim precisa ser depois do início');
      const { data, error } = await sb.from('necessidades').insert(row).select('id,codigo').single();
      if (error) throw error;
      DC.api('/api/contratar', { acao: 'avisar_necessidade', id: data.id }).catch(() => {});
      m.close();
      const wa = DC.centralWa(`Olá! Acabei de enviar o pedido #${data.codigo} na Saúde Pra Você (${DC.espec(e)}).`);
      DC.modal(`<h2>Pedido #${data.codigo} enviado à central</h2><p>A nossa central já recebeu e vai procurar o profissional certo. Quando encontrar, o pedido aparece em <b>Minhas contratações</b> para você confirmar e pagar.</p>
        <div class="acts"><button class="btn btn-ghost" data-close>OK</button>${wa ? `<a class="btn btn-green" href="${esc(wa)}" target="_blank" rel="noopener">Avisar no WhatsApp (mais rápido)</a>` : ''}</div>`, { semFoco: true });
      ajuda();
    });
  }

  // ------------------------------------------------------------------ conta
  async function conta() {
    const { data: p, error } = await sb.from('profiles').select('*').eq('id', me.id).single();
    if (error) throw error;
    app.innerHTML = `<div class="head"><div><h1>Sua conta</h1></div></div>
      <div class="card col" style="max-width:640px">
        <label class="f">Nome<input class="in" id="nm" value="${esc(p.nome)}" maxlength="80"></label>
        <label class="f">Celular<input class="in" value="${esc(DC.telBonito(p.telefone))}" disabled></label>
        <label class="f">E-mail (opcional)<small>para entrar também com o e-mail e receber avisos</small><input class="in" id="em" type="email" value="${esc(p.email || '')}"></label>
        <div class="row"><button class="btn" id="sv">Salvar</button><button class="btn btn-ghost" id="sn">Trocar senha</button></div></div>
      <div id="fotoBox" style="max-width:640px"></div>
      <div data-instalar="cliente" style="max-width:640px"></div>`;
    if (window.desenhaInstalar) window.desenhaInstalar();
    DC.fotoEditor($('#fotoBox'), { url: p.foto_url || null, texto: 'Os profissionais veem sua foto nos pedidos. Pode ser uma selfie.', depois: (u) => { const a = $('#meuAv'); if (a) a.innerHTML = DC.av(me.nome, u); } });
    $('#sv').onclick = () => DC.busy($('#sv'), async () => {
      const em = $('#em').value.trim();
      if (em && !/^\S+@\S+\.\S+$/.test(em)) throw new Error('E-mail inválido');
      const { error: e } = await sb.from('profiles').update({ nome: $('#nm').value.trim() || p.nome, email: em || null }).eq('id', me.id);
      if (e) throw (e.code === '23505' ? new Error('Esse e-mail já está em outra conta') : e); DC.toast('Dados salvos');
    });
    $('#sn').onclick = () => trocarSenha();
  }
  function trocarSenha() {
    const m = DC.modal(`<h2>Trocar senha</h2><label class="f">Nova senha<input class="in" type="password" id="s1" minlength="6" autocomplete="new-password"></label><label class="f">Repita<input class="in" type="password" id="s2" autocomplete="new-password"></label>
      <div class="acts"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn" id="ok">Salvar</button></div>`);
    $('#ok', m.el).onclick = () => DC.busy($('#ok', m.el), async () => {
      const a = $('#s1', m.el).value; if (a.length < 6) throw new Error('Mínimo de 6 caracteres'); if (a !== $('#s2', m.el).value) throw new Error('As senhas não conferem');
      const { error } = await sb.auth.updateUser({ password: a }); if (error) throw error; m.close(); DC.toast('Senha trocada');
    });
  }
  DC.trocarSenha = trocarSenha;

  // abas: iniciadas por último, depois de todas as funções existirem
  DC.tabs(['catalogo', 'contratacoes', 'ajuda', 'conta'], (t) => {
    app.innerHTML = '<div class="empty"><span class="spin"></span></div>';
    return ({ catalogo, contratacoes, ajuda, conta })[t]().catch(DC.erro);
  });
})();

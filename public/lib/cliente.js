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
      $$('[data-ctr]').forEach((b) => (b.onclick = () => contratar(CAT.find((p) => p.user_id === b.dataset.ctr))));
    };
    $$('#fe button').forEach((b) => { b.classList.toggle('on', b.dataset.e === st.e); b.onclick = () => { st.e = b.dataset.e; $$('#fe button').forEach((x) => x.classList.toggle('on', x === b)); draw(); }; });
    $('#q').oninput = (e) => { st.q = e.target.value; draw(); };
    $('#fl').onchange = (e) => { st.local = e.target.value; draw(); };
    $('#fp').onchange = (e) => { st.plantao = e.target.value; draw(); };
    $('#fg').onchange = (e) => { st.gen = e.target.value; draw(); };
    $('#fv').onchange = (e) => { st.ver = e.target.checked; draw(); };
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
      <div><h3>Próximas semanas</h3><div class="row" style="gap:4px;margin-top:8px">${dias.map(([d, s]) => `<i title="${DC.data(d)}" class="d-${s === 'vazio' ? 'livre' : s}" style="width:18px;height:18px;border-radius:4px;display:inline-block${s === 'vazio' ? ';opacity:.35' : ''}"></i>`).join('')}</div>
        <div class="leg" style="margin-top:6px"><span><i class="d-livre"></i>Disponível</span><span><i class="d-parcial"></i>Parcial</span><span><i class="d-alocado"></i>Ocupado</span><span><i class="d-off"></i>Folga</span></div></div>
      ${(av.data || []).length ? `<div><h3>Avaliações</h3>${av.data.map((a) => `<p class="small"><span class="stars">${'★'.repeat(a.nota)}</span> ${esc(a.comentario)}</p>`).join('')}</div>` : ''}
      <div class="acts"><button class="btn btn-ghost" data-close>Fechar</button><button class="btn" id="ctr">Contratar ${esc(p.nome.split(' ')[0])}</button></div>`, { wide: true, semFoco: true });
    $('#ctr', m.el).onclick = () => { m.close(); contratar(p); };
  }

  // ------------------------------------------------------------------ contratar (escolhe tempo e paga)
  function contratar(p) {
    if (!p) return;
    const u = ultimo();
    const mods = Object.keys(DC.MODAL).filter((k) => p[DC.MODAL[k].campo]);
    const st = { mod: mods[0], semana: [0, 1, 2, 3, 4, 5, 6], local: u.local_tipo || ((p.atende || [])[0]) || 'residencia' };
    const m = DC.modal(`<div class="row" style="flex-wrap:nowrap">${DC.av(p.nome, p.avatar_url)}<div class="grow"><h2>Contratar ${esc(p.nome)}</h2><p class="small mute">${esc(DC.espec(p.especialidade))}</p></div></div>
      <div class="col"><b class="small">Como cobrar</b><div class="seg" id="md">${mods.map((k) => `<button type="button" data-m="${k}" class="${k === st.mod ? 'on' : ''}">${DC.MODAL[k].nome}<br><span class="tiny">${brl(p[DC.MODAL[k].campo])}</span></button>`).join('')}</div></div>
      <div class="grid2">
        <label class="f">Primeiro dia<input class="in" type="date" id="ini" min="${DC.hoje()}" value="${DC.hoje()}"></label>
        <label class="f">Último dia<input class="in" type="date" id="fim" min="${DC.hoje()}" value="${DC.hoje()}"></label>
        <label class="f">Horário de início<input class="in" type="time" id="hor" value="${u.horario || '07:00'}"></label>
        <label class="f" id="hdL">Horas por dia<input class="in" type="number" id="hd" min="1" max="24" value="${u.horas_dia || 6}"></label>
      </div>
      <div class="col" style="gap:6px"><b class="small">Dias da semana</b><div class="sem" id="sem">${DC.SEMANA.map((d, i) => `<button type="button" data-d="${i}" class="on">${d}</button>`).join('')}</div></div>
      <h3>Quem vai receber o cuidado</h3>
      <div class="grid2" style="grid-template-columns:1fr 110px"><label class="f">Nome<input class="in" id="pn" maxlength="120" value="${esc(u.paciente_nome || '')}" placeholder="Ex.: Dona Lúcia"></label>
        <label class="f">Idade<input class="in" id="pi" inputmode="numeric" maxlength="3" value="${esc(u.paciente_idade ?? '')}"></label></div>
      <label class="f">Cuidados necessários<small>Quanto mais detalhe, melhor o profissional se prepara</small><textarea class="in" id="cu" maxlength="3000" placeholder="Ex.: acamada, troca de fralda, medicação às 8h e 20h, curativo na perna, dieta por sonda">${esc(u.cuidados || '')}</textarea></label>
      <div class="col" style="gap:6px"><b class="small">Onde</b><div class="seg" id="lc">${Object.entries(DC.LOCAL).map(([k, v]) => `<button type="button" data-l="${k}" class="${k === st.local ? 'on' : ''}">${v.split(' /')[0]}</button>`).join('')}</div></div>
      <div class="grid2" style="grid-template-columns:1fr 200px"><label class="f">Endereço<small id="endDica">rua, número, bairro${''}</small><input class="in" id="en" maxlength="300" value="${esc(u.endereco || '')}"></label>
        <label class="f">Cidade<input class="in" id="ci" maxlength="80" value="${esc(u.cidade || p.cidade || '')}"></label></div>
      <label class="f">Observações (opcional)<textarea class="in" id="no" maxlength="2000" style="min-height:70px" placeholder="Portaria, animais em casa, quem estará presente…"></textarea></label>
      <div class="resumo-total" id="tot"></div>
      <div class="priv"><span aria-hidden="true">🔒</span><span>Os dados do paciente ficam só entre você, o profissional e a nossa central. O contato do profissional aparece depois do pagamento.</span></div>
      <div class="acts"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-green" id="env">Enviar pedido</button></div>`, { wide: true, semFoco: true });
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
      $('#endDica', m.el).textContent = st.local === 'hospital' || st.local === 'clinica' ? 'nome do hospital, quarto e leito' : 'rua, número, bairro';
      const v = val();
      $('#tot', m.el).innerHTML = v.dias.length
        ? `<span class="small mute">Total a pagar pelo app</span><span class="price">${brl(v.total, 2)}</span><span class="small mute">${v.dias.length} dia(s) · ${st.mod === 'hora' ? v.q + ' horas × ' + brl(v.unit, 2) : v.q + ' plantão(ões) × ' + brl(v.unit, 2)}. Você só paga depois que o profissional aceitar.</span>`
        : '<span class="small">Nenhum dia do período cai nos dias da semana escolhidos.</span>';
    };
    $$('#md button', m.el).forEach((b) => (b.onclick = () => { st.mod = b.dataset.m; $$('#md button', m.el).forEach((x) => x.classList.toggle('on', x === b)); draw(); }));
    $$('#lc button', m.el).forEach((b) => (b.onclick = () => { st.local = b.dataset.l; $$('#lc button', m.el).forEach((x) => x.classList.toggle('on', x === b)); draw(); }));
    $$('#sem button', m.el).forEach((b) => (b.onclick = () => {
      const d = +b.dataset.d; st.semana = st.semana.includes(d) ? st.semana.filter((x) => x !== d) : [...st.semana, d].sort();
      b.classList.toggle('on', st.semana.includes(d)); draw();
    }));
    $('#ini', m.el).onchange = () => { if ($('#fim', m.el).value < $('#ini', m.el).value) $('#fim', m.el).value = $('#ini', m.el).value; $('#fim', m.el).min = $('#ini', m.el).value; draw(); };
    ['#fim', '#hd'].forEach((s) => ($(s, m.el).oninput = draw));
    draw();
    $('#env', m.el).onclick = () => DC.busy($('#env', m.el), async () => {
      const v = val();
      if (!v.dias.length) throw new Error('Escolha datas e dias da semana');
      const body = { acao: 'criar', pro_id: p.user_id, modalidade: st.mod, inicio: v.ini, fim: v.fim, horario: $('#hor', m.el).value, horas_dia: v.hd,
        dias_semana: st.semana, paciente_nome: $('#pn', m.el).value.trim(), paciente_idade: $('#pi', m.el).value.replace(/\D/g, ''),
        cuidados: $('#cu', m.el).value.trim(), local_tipo: st.local, endereco: $('#en', m.el).value.trim(), cidade: $('#ci', m.el).value.trim(), notas: $('#no', m.el).value.trim() };
      if (!body.paciente_nome) throw new Error('Informe quem vai receber o cuidado');
      if (!body.endereco) throw new Error('Informe o endereço do atendimento');
      const r = await DC.api('/api/contratar', body);
      guardaUltimo({ paciente_nome: body.paciente_nome, paciente_idade: body.paciente_idade, cuidados: body.cuidados, local_tipo: body.local_tipo, endereco: body.endereco, cidade: body.cidade, horario: body.horario, horas_dia: body.horas_dia });
      m.close(); DC.toast('Pedido enviado! Avisamos ' + p.nome.split(' ')[0] + '.');
      location.hash = 'contratacoes'; setTimeout(() => DC.abrirContratacao(r.id, 'cliente', contratacoes), 250);
    });
  }

  // ------------------------------------------------------------------ minhas contratações
  async function contratacoes() {
    const { data, error } = await sb.from('contratacoes').select('*,contratacao_cliente(total)').eq('cliente_id', me.id).order('updated_at', { ascending: false });
    if (error) throw error;
    const L = data || [];
    const tot = (c) => { const v = Array.isArray(c.contratacao_cliente) ? c.contratacao_cliente[0] : c.contratacao_cliente; return v ? brl(v.total, 2) : '—'; };
    const linha = (c) => `<button class="li" data-c="${c.id}" style="width:100%;text-align:left;background:none;border-left:0;border-right:0;border-bottom:0;cursor:pointer">
      ${DC.av(c.pro_nome)}<span class="grow"><b>${esc(c.pro_nome)}</b> <span class="small mute">· ${esc(DC.espec(c.especialidade))}</span><br><span class="small mute">${DC.periodo(c)} · ${esc(c.paciente_nome)} · ${esc(DC.LOCAL[c.local_tipo])}</span></span>
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
          ${DC.necTag(n.status)}${['aberta', 'em_busca'].includes(n.status) ? `<button class="btn btn-sm btn-ghost" data-cn="${n.id}">Cancelar</button>` : ''}</div>`).join('')}</div></div>`
        : '<div class="card empty"><b>Nenhum pedido à central</b>Use quando não achar no catálogo, para casos difíceis ou com urgência.</div>'}`;
    $('#nova').onclick = () => novaNecessidade();
    $$('[data-cn]').forEach((b) => (b.onclick = () => DC.busy(b, async () => { const { error: e } = await sb.from('necessidades').update({ status: 'cancelada' }).eq('id', b.dataset.cn); if (e) throw e; ajuda(); })));
  }
  function novaNecessidade(esp) {
    const u = ultimo();
    let e = esp || 'cuidador', turno = 'dia', local = u.local_tipo || 'residencia';
    const m = DC.modal(`<h2>Do que você precisa?</h2>
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
      <label class="f">Endereço<input class="in" id="en" maxlength="300" value="${esc(u.endereco || '')}"></label>
      <label class="f">Mais alguma coisa? (opcional)<textarea class="in" id="ob" maxlength="2000" style="min-height:70px"></textarea></label>
      <div class="acts"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-coral" id="env">Enviar para a central</button></div>`, { wide: true, semFoco: true });
    $$('#es [data-e]', m.el).forEach((b) => (b.onclick = () => { e = b.dataset.e; $$('#es [data-e]', m.el).forEach((x) => x.classList.toggle('on', x === b)); }));
    $('#env', m.el).onclick = () => DC.busy($('#env', m.el), async () => {
      turno = $('#tu', m.el).value; local = $('#lc', m.el).value;
      const row = { cliente_id: me.id, especialidade: e, paciente_nome: $('#pn', m.el).value.trim(), paciente_idade: +$('#pi', m.el).value || null,
        cuidados: $('#cu', m.el).value.trim(), local_tipo: local, cidade: $('#ci', m.el).value.trim() || null, endereco: $('#en', m.el).value.trim() || null,
        inicio: $('#ini', m.el).value || null, fim: $('#fim', m.el).value || null, turno, horas_dia: turno === '24h' ? 24 : null,
        genero_pref: $('#gp', m.el).value || null, orcamento: +$('#or', m.el).value || null, observacoes: $('#ob', m.el).value.trim() };
      if (!row.paciente_nome) throw new Error('Informe quem vai receber o cuidado');
      if (!row.inicio) throw new Error('Informe quando precisa começar');
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
        <div class="row"><button class="btn" id="sv">Salvar</button><button class="btn btn-ghost" id="sn">Trocar senha</button></div></div>`;
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
    ({ catalogo, contratacoes, ajuda, conta })[t]().catch(DC.erro);
  });
})();

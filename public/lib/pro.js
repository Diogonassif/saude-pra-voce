/* Saúde Pra Você · app do profissional de saúde */
(async function () {
  const { $, $$, sb, esc, brl } = DC;
  const me = await DC.boot('pro'); if (!me) return;
  DC.topo(me, [['inicio', 'Início'], ['pedidos', 'Pedidos'], ['agenda', 'Agenda'], ['perfil', 'Perfil e valores'], ['recebimentos', 'Recebimentos']], 'profissional');
  const app = $('#app');
  let pro = null, priv = null;

  async function loadPro() {
    const [a, b] = await Promise.all([
      sb.from('pros').select('*').eq('user_id', me.id).maybeSingle(),
      sb.from('pro_privado').select('*').eq('user_id', me.id).maybeSingle(),
    ]);
    if (!a.data && me.role === 'admin') { await sb.rpc('escolher_papel', { papel: 'pro' }); return loadPro(); }
    pro = a.data; priv = b.data || {};
  }
  await loadPro();
  const qs = new URLSearchParams(location.search);
  if (qs.get('mp') === 'ok') DC.toast('Conta Mercado Pago conectada. Você já pode receber.');
  if (qs.get('mp') === 'erro') DC.toast('Não foi possível conectar o Mercado Pago. Tente de novo.', true);

  const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
  const precisaCoren = () => DC.ESPEC[pro.especialidade] && DC.ESPEC[pro.especialidade].coren;
  const pendencias = () => {
    const L = [];
    if (!pro.especialidade || !pro.titulo || !pro.valor_hora) L.push(['#perfil', 'Complete seu perfil: especialidade, título e valor por hora']);
    if (precisaCoren() && (!pro.coren || !pro.coren_uf)) L.push(['#perfil', 'Informe o número do seu COREN e a UF']);
    else if (precisaCoren() && pro.coren_status === 'pendente') L.push(['#perfil', 'Seu COREN está em conferência pela central. Você aparece no catálogo assim que for confirmado.']);
    else if (precisaCoren() && pro.coren_status === 'irregular') L.push(['#perfil', 'A central não encontrou seu COREN ativo. Confira o número e a UF ou fale com a central.']);
    if (!priv.doc_identidade) L.push(['#perfil', 'Envie seus documentos para ganhar o selo verificado']);
    if (!me.mpConectado) L.push(['#recebimentos', 'Conecte sua conta Mercado Pago para receber']);
    if (!pro.publicado) L.push(['#perfil', 'Publique seu perfil para aparecer no catálogo']);
    return L;
  };


  const lista = async () => (await sb.from('contratacoes').select('*,contratacao_pro(total)').eq('pro_id', me.id).order('inicio')).data || [];
  const totPro = (c) => { const v = Array.isArray(c.contratacao_pro) ? c.contratacao_pro[0] : c.contratacao_pro; return v ? +v.total : 0; };
  const linha = (c) => `<button class="li" data-c="${c.id}" style="width:100%;text-align:left;background:none;border-left:0;border-right:0;border-bottom:0;cursor:pointer">
    ${DC.av(c.cliente_nome)}<span class="grow"><b>${esc(c.cliente_nome)}</b> <span class="small mute">· ${esc(DC.MODAL[c.modalidade].nome)}</span><br>
    <span class="small mute">${DC.periodo(c)}${c.horario ? ' · ' + c.horario.slice(0, 5) : ''} · ${esc(DC.LOCAL[c.local_tipo])}${c.cidade ? ', ' + esc(c.cidade) : ''} · ${esc(c.paciente_nome)}</span></span>
    <span style="text-align:right">${DC.stTag(c.status)}<br><b class="small">${brl(totPro(c), 2)}</b></span></button>`;
  const liga = (recarregar) => $$('[data-c]').forEach((b) => (b.onclick = () => DC.abrirContratacao(b.dataset.c, 'pro', recarregar)));

  // ------------------------------------------------------------------ início
  async function inicio() {
    const L = await lista();
    const novos = L.filter((c) => c.status === 'solicitado');
    const prox = L.filter((c) => c.status === 'confirmado' && c.fim >= DC.hoje()).slice(0, 5);
    const pend = pendencias();
    const mes = DC.hoje().slice(0, 7);
    const ganhoMes = L.filter((c) => ['confirmado', 'concluido'].includes(c.status) && (c.pago_em || '').slice(0, 7) === mes).reduce((s, c) => s + totPro(c), 0);
    app.innerHTML = `
      <div class="head"><div><p class="mute" style="margin:0">Olá, ${esc((pro.nome || me.nome).split(' ')[0])}</p><h1>${novos.length ? novos.length + (novos.length > 1 ? ' pedidos esperam' : ' pedido espera') + ' sua resposta' : 'Tudo em dia'}</h1></div></div>
      ${pend.length ? `<div class="card col alerta"><h2>Para começar a receber pedidos</h2><div class="list">${pend.map(([h, t]) => `<a class="li" href="${h}" style="text-decoration:none;color:inherit"><span class="tag t-amber">PENDENTE</span><span class="grow">${esc(t)}</span><span aria-hidden="true">→</span></a>`).join('')}</div></div>` : ''}
      <div class="split">
        <div class="main">
          <div class="card col"><h2>Pedidos novos</h2>${novos.length ? `<div class="list">${novos.map(linha).join('')}</div>` : '<p class="small mute">Nenhum pedido novo. Mantenha a agenda atualizada para aparecer para mais famílias.</p>'}</div>
          <div class="card col"><h2>Próximos atendimentos</h2>${prox.length ? `<div class="list">${prox.map(linha).join('')}</div>` : '<p class="small mute">Nenhum atendimento confirmado.</p>'}</div>
        </div>
        <div class="side">
          <div class="card dark col"><span class="small mute">Recebido neste mês</span><div class="price">${brl(ganhoMes, 2)}</div>
            <div class="row">${pro.publicado ? '<span class="tag t-green">PERFIL NO CATÁLOGO</span>' : '<span class="tag t-amber">PERFIL NÃO PUBLICADO</span>'}${pro.verificado ? '<span class="selo">✓ Selo verificado</span>' : ''}</div></div>
          <div class="card col"><h2>Seus valores</h2>
            <div class="list small">${Object.entries({ valor_hora: 'Por hora', valor_12h: 'Plantão 12h', valor_24h: 'Plantão 24h' }).map(([k, n]) => `<div class="li"><span class="grow">${n}</span><b>${pro[k] ? brl(pro[k], 2) : '—'}</b></div>`).join('')}</div>
            <p class="small mute">Você define o seu valor. A taxa da plataforma não sai dele: é somada por cima no preço do contratante. Tarifas do Mercado Pago seguem a sua conta.</p><a class="btn btn-ghost btn-sm" href="#perfil">Ajustar valores</a></div>
        </div>
      </div><div data-instalar="pro" style="max-width:640px"></div>`;
    if (window.desenhaInstalar) window.desenhaInstalar();
    liga(inicio);
  }

  // ------------------------------------------------------------------ pedidos
  async function pedidos() {
    const L = (await lista()).reverse();
    const bloco = (tit, F, vazio) => { const X = L.filter(F); return `<div class="card col"><h2>${tit}</h2>${X.length ? `<div class="list">${X.map(linha).join('')}</div>` : `<p class="small mute">${vazio}</p>`}</div>`; };
    app.innerHTML = `<div class="head"><div><h1>Pedidos e atendimentos</h1><p>Aceite os pedidos, converse com a família e acompanhe os pagamentos.</p></div></div>
      ${bloco('Aguardando sua resposta', (c) => c.status === 'solicitado', 'Nenhum pedido novo.')}
      ${bloco('Aceitos · aguardando pagamento', (c) => c.status === 'aceito', 'Nada aguardando pagamento.')}
      ${bloco('Confirmados e pagos', (c) => c.status === 'confirmado', 'Nenhum atendimento confirmado.')}
      ${L.some((c) => ['concluido', 'recusado', 'cancelado'].includes(c.status)) ? bloco('Histórico', (c) => ['concluido', 'recusado', 'cancelado'].includes(c.status), '') : ''}`;
    liga(pedidos);
  }

  // ------------------------------------------------------------------ agenda
  let mesRef = DC.hoje().slice(0, 7);
  const NOMEST = { vazio: 'Sem marcação', livre: 'Disponível', parcial: 'Parcial', off: 'Folga', alocado: 'Ocupado' };
  const dIso = (dt) => dt.toISOString().slice(0, 10);
  const somaDias = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return dIso(d); };
  async function salvaDias(dias, status) {   // status null = limpar (volta a "sem marcação")
    const hoje = DC.hoje();
    const { data: oc } = await sb.from('agenda').select('dia').eq('pro_id', me.id).eq('status', 'alocado').in('dia', dias);
    const ocup = new Set((oc || []).map((x) => x.dia));
    const alvo = dias.filter((d) => d >= hoje && !ocup.has(d));
    for (let k = 0; k < alvo.length; k += 200) {
      const lote = alvo.slice(k, k + 200);
      const { error } = status ? await sb.from('agenda').upsert(lote.map((dia) => ({ pro_id: me.id, dia, status })))
        : await sb.from('agenda').delete().eq('pro_id', me.id).neq('status', 'alocado').in('dia', lote);
      if (error) throw error;
    }
    return { feitos: alvo.length, ocupados: dias.filter((d) => ocup.has(d)).length };
  }
  async function agenda() {
    const [y, mo] = mesRef.split('-').map(Number);
    const ini = `${mesRef}-01`, fimD = new Date(Date.UTC(y, mo, 0)).getUTCDate(), fim = `${mesRef}-${String(fimD).padStart(2, '0')}`;
    const hoje = DC.hoje();
    const [ag, ct] = await Promise.all([
      sb.from('agenda').select('dia,status').eq('pro_id', me.id).gte('dia', ini).lte('dia', fim),
      sb.from('contratacoes').select('id,codigo,cliente_nome,inicio,fim,horario,modalidade,status,dias_semana,local_tipo,cidade').eq('pro_id', me.id).in('status', ['solicitado', 'aceito', 'confirmado']).gte('fim', hoje).order('inicio'),
    ]);
    if (ag.error) throw ag.error;
    const st = Object.fromEntries((ag.data || []).map((d) => [d.dia, d.status]));
    const C = ct.data || [];
    const pedidosNoDia = (dia) => C.filter((c) => c.inicio <= dia && c.fim >= dia && (!(c.dias_semana || []).length || c.dias_semana.includes(new Date(dia + 'T12:00:00Z').getUTCDay())));
    const first = (new Date(Date.UTC(y, mo - 1, 1)).getUTCDay() + 6) % 7;   // semana começa na segunda
    const nomeMes0 = new Date(Date.UTC(y, mo - 1, 15)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const nomeMes = nomeMes0[0].toUpperCase() + nomeMes0.slice(1);
    const cells = [];
    for (let i = 0; i < first; i++) cells.push('<span></span>');
    const cont = { livre: 0, parcial: 0, off: 0, alocado: 0, vazio: 0 };
    for (let d = 1; d <= fimD; d++) {
      const dia = `${mesRef}-${String(d).padStart(2, '0')}`; const s = st[dia] || 'vazio';
      if (dia >= hoje) cont[s]++;
      const ped = pedidosNoDia(dia).filter((c) => c.status !== 'confirmado').length;
      cells.push(`<button type="button" class="d-${s}${dia === hoje ? ' hoje' : ''}" data-d="${dia}" ${dia < hoje ? 'disabled' : ''} aria-label="${d}, ${NOMEST[s]}">${d}${ped ? '<i class="pin" title="pedido aguardando"></i>' : ''}</button>`);
    }
    const proximos = C.filter((c) => c.status === 'confirmado').slice(0, 8);
    const pend = C.filter((c) => c.status !== 'confirmado');
    app.innerHTML = `
      <div class="head"><div><h1>Agenda</h1><p>Toque num dia para marcar <b>disponível</b>, <b>parcial</b> ou <b>folga</b>. Dias de folga bloqueiam novos pedidos. Dias contratados e pagos ficam como <b>ocupados</b>.</p></div></div>
      <div class="split"><div class="main">
        <div class="card col">
          <div class="row"><button class="btn btn-sm btn-ghost" id="ant" aria-label="Mês anterior">←</button><h2 class="grow" style="text-align:center">${esc(nomeMes)}</h2><button class="btn btn-sm btn-ghost" id="prox" aria-label="Próximo mês">→</button></div>
          <div class="cal">${['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((x) => `<span class="dw">${x}</span>`).join('')}${cells.join('')}</div>
          <div class="leg"><span><i class="d-livre"></i>Disponível</span><span><i class="d-parcial"></i>Parcial</span><span><i class="d-off"></i>Folga</span><span><i class="d-alocado"></i>Ocupado</span><span><i class="d-vazio"></i>Sem marcação</span><span><i class="pin" style="position:static"></i>Pedido aguardando</span></div>
          <p class="small mute">Neste mês, a partir de hoje: ${cont.livre} disponível(is) · ${cont.parcial} parcial(is) · ${cont.off} folga(s) · ${cont.alocado} ocupado(s) · ${cont.vazio} sem marcação.</p>
          <div class="row"><button class="btn btn-sm btn-ghost" id="todos">Marcar o mês todo como disponível</button><button class="btn btn-sm btn-ghost" id="limpaMes">Limpar o mês</button></div>
        </div>
        <div class="card col"><h2>Atendimentos confirmados</h2>${proximos.length ? `<div class="list small">${proximos.map((c) => `<button class="li linha" data-c="${c.id}"><span class="grow"><b>${DC.periodo(c)}</b>${c.horario ? ' · ' + c.horario.slice(0, 5) : ''}<br><span class="mute">${esc(c.cliente_nome)} · ${esc(DC.MODAL[c.modalidade].nome)} · ${esc(DC.LOCAL[c.local_tipo] || '')}${c.cidade ? ', ' + esc(c.cidade) : ''}</span></span>${DC.stTag(c.status)}</button>`).join('')}</div>` : '<p class="small mute">Nenhum atendimento confirmado pela frente.</p>'}
          ${pend.length ? `<h3>Pedidos aguardando</h3><div class="list small">${pend.map((c) => `<button class="li linha" data-c="${c.id}"><span class="grow"><b>${DC.periodo(c)}</b> · ${esc(c.cliente_nome)}</span>${DC.stTag(c.status)}</button>`).join('')}</div>` : ''}</div>
      </div><div class="side">
        <div class="card col"><h2>Bloquear um período</h2><p class="small mute">Férias, viagem ou outro trabalho. Os dias viram folga e ninguém consegue pedir nesse período.</p>
          <div class="grid2"><label class="f">De<input class="in" type="date" id="bI" min="${hoje}" value="${hoje}"></label><label class="f">Até<input class="in" type="date" id="bF" min="${hoje}" value="${somaDias(hoje, 6)}"></label></div>
          <div class="row"><button class="btn btn-sm" id="bloq">Bloquear</button><button class="btn btn-sm btn-ghost" id="liberaP">Marcar como disponível</button><button class="btn btn-sm btn-ghost" id="limpaP">Limpar</button></div></div>
        <div class="card col"><h2>Folga fixa na semana</h2><p class="small mute">Os dias da semana em que você não trabalha. Marcamos como folga nas próximas semanas.</p>
          <div class="chips" id="fsem">${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((n, k) => `<button type="button" class="chip off" data-w="${k}">${n}</button>`).join('')}</div>
          <label class="f">Por quanto tempo<select class="in" id="fN"><option value="4">4 semanas</option><option value="8">8 semanas</option><option value="13" selected>3 meses</option><option value="26">6 meses</option></select></label>
          <div class="row"><button class="btn btn-sm" id="fixa">Aplicar folga fixa</button><button class="btn btn-sm btn-ghost" id="dispSem">Disponível nos outros dias</button></div></div>
      </div></div>`;

    $$('[data-d]').forEach((b) => (b.onclick = () => {
      const dia = b.dataset.d, s = st[dia] || 'vazio';
      if (s === 'alocado') { const c = pedidosNoDia(dia).find((x) => x.status === 'confirmado'); if (c) DC.abrirContratacao(c.id, 'pro', agenda); else DC.toast('Dia ocupado por um atendimento'); return; }
      const peds = pedidosNoDia(dia);
      const mm = DC.modal(`<h2>${DC.data(dia)} · ${new Date(dia + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' })}</h2><p class="small mute">Agora: <b>${NOMEST[s]}</b></p>
        ${peds.length ? `<div class="banner info">Há ${peds.length} pedido(s) neste dia. ${peds.map((c) => `<button class="link" data-pc="${c.id}">#${c.codigo} · ${esc(c.cliente_nome)}</button>`).join(' ')}</div>` : ''}
        <div class="grid2"><button class="opt ${s === 'livre' ? 'on' : ''}" data-s="livre"><b>Disponível</b><span>Pode receber pedidos o dia todo</span></button><button class="opt ${s === 'parcial' ? 'on' : ''}" data-s="parcial"><b>Parcial</b><span>Só parte do dia</span></button>
          <button class="opt ${s === 'off' ? 'on' : ''}" data-s="off"><b>Folga</b><span>Não recebe pedidos neste dia</span></button><button class="opt ${s === 'vazio' ? 'on' : ''}" data-s=""><b>Sem marcação</b><span>Limpa o dia</span></button></div>
        <div class="acts"><button class="btn btn-ghost" data-close>Fechar</button></div>`);
      $$('[data-s]', mm.el).forEach((x) => (x.onclick = () => DC.busy(x, async () => { await salvaDias([dia], x.dataset.s || null); mm.close(); agenda(); })));
      $$('[data-pc]', mm.el).forEach((x) => (x.onclick = () => { mm.close(); DC.abrirContratacao(x.dataset.pc, 'pro', agenda); }));
    }));
    $$('[data-c]').forEach((b) => (b.onclick = () => DC.abrirContratacao(b.dataset.c, 'pro', agenda)));
    $('#ant').onclick = () => { const d = new Date(Date.UTC(y, mo - 2, 1)); mesRef = d.toISOString().slice(0, 7); agenda(); };
    $('#prox').onclick = () => { const d = new Date(Date.UTC(y, mo, 1)); mesRef = d.toISOString().slice(0, 7); agenda(); };
    const mesTodo = () => { const L = []; for (let d = 1; d <= fimD; d++) L.push(`${mesRef}-${String(d).padStart(2, '0')}`); return L; };
    const periodo = () => { const a = $('#bI').value, b = $('#bF').value || a; if (!a) throw new Error('Escolha a data de início'); if (b < a) throw new Error('O fim precisa ser depois do início');
      const L = []; for (let d = a; d <= b && L.length < 370; d = somaDias(d, 1)) L.push(d); return L; };
    const aviso = (r, txt) => DC.toast(`${r.feitos} dia(s) ${txt}${r.ocupados ? ` · ${r.ocupados} dia(s) ocupado(s) ficaram como estavam` : ''}`);
    $('#todos').onclick = () => DC.busy($('#todos'), async () => { const L = mesTodo().filter((d) => st[d] !== 'off'); aviso(await salvaDias(L, 'livre'), 'disponível(is)'); agenda(); });
    $('#limpaMes').onclick = () => DC.busy($('#limpaMes'), async () => { if (!(await DC.confirm('Limpar todas as marcações do mês (menos os dias ocupados)?', 'Limpar'))) return; aviso(await salvaDias(mesTodo(), null), 'limpo(s)'); agenda(); });
    $('#bloq').onclick = () => DC.busy($('#bloq'), async () => { aviso(await salvaDias(periodo(), 'off'), 'bloqueado(s) como folga'); agenda(); });
    $('#liberaP').onclick = () => DC.busy($('#liberaP'), async () => { aviso(await salvaDias(periodo(), 'livre'), 'disponível(is)'); agenda(); });
    $('#limpaP').onclick = () => DC.busy($('#limpaP'), async () => { aviso(await salvaDias(periodo(), null), 'limpo(s)'); agenda(); });
    $$('#fsem [data-w]').forEach((b) => (b.onclick = () => b.classList.toggle('off')));
    const semanas = (quer) => { const ws = $$('#fsem [data-w]').filter((b) => !b.classList.contains('off')).map((b) => +b.dataset.w); if (!ws.length) throw new Error('Escolha pelo menos um dia da semana');
      const L = []; for (let k = 0; k < +$('#fN').value * 7; k++) { const d = somaDias(hoje, k); const w = new Date(d + 'T12:00:00Z').getUTCDay(); if (quer(ws.includes(w))) L.push(d); } return L; };
    $('#fixa').onclick = () => DC.busy($('#fixa'), async () => { aviso(await salvaDias(semanas((x) => x), 'off'), 'marcado(s) como folga'); agenda(); });
    $('#dispSem').onclick = () => DC.busy($('#dispSem'), async () => { aviso(await salvaDias(semanas((x) => !x), 'livre'), 'disponível(is)'); agenda(); });
  }

  // ------------------------------------------------------------------ perfil e valores
  async function perfil() {
    const hab = new Set(pro.habilidades || []);
    app.innerHTML = `
      <div class="head"><div><h1>Perfil e valores</h1><p>É o que as famílias veem no catálogo. Você define quanto quer ganhar.</p></div>
        <div class="row">${pro.publicado ? '<span class="tag t-green">NO CATÁLOGO</span>' : '<span class="tag t-amber">NÃO PUBLICADO</span>'}${pro.verificado ? '<span class="selo">✓ Selo verificado</span>' : ''}</div></div>
      <div class="split"><div class="main"><div class="card col">
        <label class="f">Nome completo<input class="in" id="pn" value="${esc(pro.nome)}" maxlength="80"></label>
        <div class="col" style="gap:6px"><b class="small">Você é</b><div class="grid2" id="es">${Object.entries(DC.ESPEC).map(([k, v]) => `<button type="button" class="opt ${pro.especialidade === k ? 'on' : ''}" data-e="${k}"><b>${v.nome}</b><span>${v.dica}</span></button>`).join('')}</div></div>
        <div class="col" id="corenBox" style="gap:6px"><div class="grid2"><label class="f">Número do COREN (obrigatório)<input class="in" id="co" value="${esc(pro.coren || '')}" maxlength="30" inputmode="numeric" placeholder="ex.: 123456"></label><label class="f">UF do COREN (obrigatório)<select class="in" id="cuf"><option value="">Escolha</option>${UFS.map((u) => `<option ${pro.coren_uf === u ? 'selected' : ''}>${u}</option>`).join('')}</select></label></div>
          <p class="small">${pro.coren_status === 'ativo' ? '<span class="tag t-green">COREN CONFERIDO</span> A central confirmou no Cofen que seu COREN está ativo.' : pro.coren_status === 'irregular' ? '<span class="tag t-red">COREN NÃO CONFIRMADO</span> A central não encontrou seu COREN ativo. Confira o número e a UF.' : '<span class="tag t-amber">EM CONFERÊNCIA</span> A central confere seu COREN no site do Cofen. Enfermagem só aparece no catálogo com o COREN confirmado.'}</p></div>
        <label class="f">Título<small>uma frase que resume você</small><input class="in" id="pt" value="${esc(pro.titulo)}" maxlength="100" placeholder="ex.: Técnica de enfermagem com experiência em UTI e idosos"></label>
        <label class="f">Sobre você<textarea class="in" id="pr" maxlength="1500" placeholder="Experiência, onde já trabalhou, como cuida">${esc(pro.resumo)}</textarea></label>
        <div class="grid2">
          <label class="f">Anos de experiência<input class="in" type="number" id="px" min="0" max="70" value="${pro.experiencia_anos ?? ''}"></label>
          <label class="f">Gênero<small>algumas famílias preferem</small><select class="in" id="pg"><option value="">Prefiro não informar</option><option value="feminino" ${pro.genero === 'feminino' ? 'selected' : ''}>Feminino</option><option value="masculino" ${pro.genero === 'masculino' ? 'selected' : ''}>Masculino</option><option value="outro" ${pro.genero === 'outro' ? 'selected' : ''}>Outro</option></select></label>
          <label class="f">Cidade<input class="in" id="pc" value="${esc(pro.cidade || '')}"></label>
          <label class="f">UF<input class="in" id="pu" maxlength="2" value="${esc(pro.uf || '')}"></label>
        </div>
        <label class="f">Bairros ou cidades que atende<input class="in" id="prg" maxlength="200" value="${esc(pro.regioes || '')}" placeholder="ex.: Zona Sul, Centro, Bonfim Paulista"></label>
        <div class="col" style="gap:6px"><b class="small">Atende em</b><div class="row">${['residencia', 'hospital', 'clinica'].map((t) => `<label class="check"><input type="checkbox" data-at="${t}" ${(pro.atende || []).includes(t) ? 'checked' : ''}>${DC.LOCAL[t]}</label>`).join('')}</div></div>
        <div class="col" style="gap:6px"><b class="small">Cuidados que você faz</b><div class="chips" id="hb">${[...DC.HABIL, ...[...hab].filter((h) => !DC.HABIL.includes(h))].map((h) => `<button type="button" class="chip ${hab.has(h) ? '' : 'off'}" data-h="${esc(h)}">${esc(h)}</button>`).join('')}</div>
          <div class="row"><input class="in grow" id="hbNovo" maxlength="40" placeholder="Outro cuidado que você faz (ex.: fisioterapia respiratória)" aria-label="Outro cuidado"><button type="button" class="btn btn-sm btn-ghost" id="hbAdd">Adicionar</button></div>
          <p class="tiny mute">Toque num cuidado para marcar ou desmarcar. Os que você escrever ficam salvos no seu perfil.</p></div>
      </div></div>
      <div class="side">
        <div class="card col"><h2>Quanto você quer ganhar</h2><p class="small mute">A taxa da plataforma não sai do seu valor: é somada por cima no preço que o contratante vê. Tarifas do Mercado Pago seguem as condições da sua conta.</p>
          <label class="f">Por hora (obrigatório)<input class="in" type="number" id="vh" min="1" step="0.01" value="${pro.valor_hora ?? ''}"></label>
          <label class="f">Plantão de 12h (opcional)<input class="in" type="number" id="v12" min="1" step="0.01" value="${pro.valor_12h ?? ''}"></label>
          <label class="f">Plantão de 24h (opcional)<input class="in" type="number" id="v24" min="1" step="0.01" value="${pro.valor_24h ?? ''}"></label></div>
        <div class="card col"><h2>Documentos</h2><p class="small mute">Só você e a nossa central veem. Com eles conferidos, você ganha o selo verificado e aparece primeiro.</p>
          <label class="f">CPF<input class="in" id="cpf" inputmode="numeric" value="${esc(priv.cpf || '')}"></label>
          ${[['doc_identidade', 'Documento com foto (RG ou CNH)'], ['doc_coren', 'Carteira do COREN'], ['doc_antecedentes', 'Certidão de antecedentes criminais']].map(([k, n]) => `<div class="row"><span class="grow small">${n}<br>${priv[k] ? '<span class="tag t-green">ENVIADO</span>' : '<span class="tag t-gray">PENDENTE</span>'}</span><label class="btn btn-sm btn-ghost" for="f_${k}">${priv[k] ? 'Trocar' : 'Enviar'}</label><input type="file" id="f_${k}" data-doc="${k}" accept="application/pdf,image/*" class="sr"></div>`).join('')}
          <button class="btn btn-ghost btn-sm" id="salvaCpf">Salvar CPF</button></div>
      </div></div>
      <div class="row"><button class="btn" id="salva">Salvar perfil</button>${pro.publicado ? '<button class="btn btn-ghost" id="pub">Tirar do catálogo</button>' : '<button class="btn btn-green" id="pub">Salvar e publicar no catálogo</button>'}</div>`;
    let esp = pro.especialidade;
    const corenVis = () => $('#corenBox').classList.toggle('hide', !(DC.ESPEC[esp] && DC.ESPEC[esp].coren));
    $$('#es [data-e]').forEach((b) => (b.onclick = () => { esp = b.dataset.e; $$('#es [data-e]').forEach((x) => x.classList.toggle('on', x === b)); corenVis(); }));
    corenVis();
    const ligaHab = () => $$('#hb [data-h]').forEach((b) => (b.onclick = () => b.classList.toggle('off')));
    ligaHab();
    const addHab = () => {
      const t = $('#hbNovo').value.replace(/\s+/g, ' ').trim().slice(0, 40);
      if (!t) return;
      const ja = $$('#hb [data-h]').find((b) => DC.norm(b.dataset.h) === DC.norm(t));
      if (ja) ja.classList.remove('off');
      else {
        if ($$('#hb [data-h]').length >= 40) return DC.toast('Limite de cuidados atingido', true);
        const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.dataset.h = t; b.textContent = t; $('#hb').appendChild(b); ligaHab();
      }
      $('#hbNovo').value = ''; $('#hbNovo').focus();
    };
    $('#hbAdd').onclick = addHab;
    $('#hbNovo').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addHab(); } };
    const num = (s) => { const v = +$(s).value; return v > 0 ? Math.round(v * 100) / 100 : null; };
    const coleta = () => ({ nome: $('#pn').value.trim(), especialidade: esp || null, titulo: $('#pt').value.trim(), resumo: $('#pr').value.trim(),
      coren: $('#co').value.trim() || null, coren_uf: $('#cuf').value || null, experiencia_anos: $('#px').value === '' ? null : +$('#px').value,
      genero: $('#pg').value || null, cidade: $('#pc').value.trim() || null, uf: $('#pu').value.trim().toUpperCase() || null, regioes: $('#prg').value.trim(),
      atende: $$('[data-at]').filter((c) => c.checked).map((c) => c.dataset.at), habilidades: $$('#hb [data-h]').filter((b) => !b.classList.contains('off')).map((b) => b.dataset.h),
      valor_hora: num('#vh'), valor_12h: num('#v12'), valor_24h: num('#v24') });
    const salvar = async (extra) => {
      const row = Object.assign(coleta(), extra || {});
      if (row.publicado) {
        if (!row.especialidade || !row.titulo || !row.valor_hora) throw new Error('Para publicar, escolha a especialidade e preencha título e valor por hora');
        if (!row.atende.length) throw new Error('Marque onde você atende');
      }
      if (row.especialidade && DC.ESPEC[row.especialidade].coren) {
        if (!row.coren || !/\d{3,}/.test(row.coren)) throw new Error('Para técnico(a) de enfermagem e enfermeiro(a), o número do COREN é obrigatório');
        if (!row.coren_uf) throw new Error('Escolha a UF do seu COREN');
      }
      const { error } = await sb.from('pros').update(row).eq('user_id', me.id); if (error) throw error;
      await sb.from('profiles').update({ nome: row.nome || me.nome }).eq('id', me.id);
      await loadPro();
    };
    $('#salva').onclick = () => DC.busy($('#salva'), async () => { await salvar(); DC.toast('Perfil salvo'); perfil(); });
    $('#pub').onclick = () => DC.busy($('#pub'), async () => {
      await salvar({ publicado: !pro.publicado });
      DC.toast(pro.publicado ? 'Pronto! Seu perfil já aparece no catálogo.' : 'Perfil fora do catálogo');
      if (pro.publicado && !me.mpConectado) setTimeout(() => DC.toast('Conecte o Mercado Pago em Recebimentos para receber os pagamentos.'), 3400);
      perfil();
    });
    $('#salvaCpf').onclick = () => DC.busy($('#salvaCpf'), async () => {
      const { error } = await sb.from('pro_privado').upsert({ user_id: me.id, cpf: $('#cpf').value.replace(/\D/g, '') || null, updated_at: new Date().toISOString() });
      if (error) throw error; await loadPro(); DC.toast('CPF salvo');
    });
    $$('[data-doc]').forEach((inp) => (inp.onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (f.size > 8 * 1024 * 1024) return DC.toast('Arquivo muito grande (máximo 8 MB)', true);
      const ext = (f.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${me.id}/${inp.dataset.doc}-${Date.now()}.${ext}`;
      DC.toast('Enviando…');
      const up = await sb.storage.from('docs').upload(path, f, { contentType: f.type || 'application/pdf' });
      if (up.error) return DC.erro(up.error);
      const { error } = await sb.from('pro_privado').upsert({ user_id: me.id, [inp.dataset.doc]: path, updated_at: new Date().toISOString() });
      if (error) return DC.erro(error);
      await loadPro(); DC.toast('Documento enviado. A central confere e libera o selo.'); perfil();
    }));
  }

  // ------------------------------------------------------------------ recebimentos
  async function recebimentos() {
    const L = (await lista()).filter((c) => ['confirmado', 'concluido'].includes(c.status)).sort((a, z) => (z.pago_em || '').localeCompare(a.pago_em || ''));
    const porMes = {};
    L.forEach((c) => { const k = (c.pago_em || c.inicio).slice(0, 7); porMes[k] = (porMes[k] || 0) + totPro(c); });
    app.innerHTML = `<div class="head"><div><h1>Recebimentos</h1><p>Os pagamentos caem direto na sua conta Mercado Pago. A taxa da plataforma não é descontada do seu valor.</p></div></div>
      <div class="split"><div class="main">
        <div class="card col"><h2>Atendimentos pagos</h2>${L.length ? `<div class="list">${L.map(linha).join('')}</div>` : '<p class="small mute">Nenhum pagamento ainda.</p>'}</div>
      </div><div class="side">
        <div class="card col"><h2>Conta de recebimento</h2>
          ${me.mpConectado ? '<div class="banner ok">Conta Mercado Pago conectada. Os pagamentos caem nela e você saca para o seu banco quando quiser.</div><div id="mpInfo" class="small mute">Carregando os dados da conta…</div><div class="row"><button class="btn btn-sm btn-ghost" id="mp">Trocar de conta</button><button class="btn btn-sm btn-ghost" id="mpSair" style="color:var(--red)">Desconectar</button></div><p class="tiny mute">Para trocar, saia da conta atual no site do Mercado Pago antes, ou entre com a outra conta quando ele pedir.</p>'
            : '<p class="small">Conecte uma conta Mercado Pago (é grátis) para receber os pagamentos dos atendimentos. Do Mercado Pago você transfere para o seu banco.</p><button class="btn btn-dark" id="mp">Conectar Mercado Pago</button>'}</div>
        <div class="card col"><h2>Por mês</h2>${Object.keys(porMes).length ? `<div class="list small">${Object.entries(porMes).map(([k, v]) => `<div class="li"><span class="grow">${k.split('-').reverse().join('/')}</span><b>${brl(v, 2)}</b></div>`).join('')}</div>` : '<p class="small mute">—</p>'}</div>
        <div class="card col"><h2>Acesso</h2>
          <label class="f">E-mail (opcional)<small>para entrar também com o e-mail e receber avisos</small><input class="in" id="em" type="email" maxlength="120" value="${esc(me.email || '')}"></label>
          <div class="row"><button class="btn btn-sm" id="sve">Salvar e-mail</button><button class="btn btn-ghost btn-sm" id="sn">Trocar senha</button></div></div>
      </div></div>`;
    liga(recebimentos);
    $('#sve').onclick = () => DC.busy($('#sve'), async () => {
      const em = $('#em').value.trim().toLowerCase();
      if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) throw new Error('E-mail inválido');
      const { error: e } = await sb.from('profiles').update({ email: em || null }).eq('id', me.id);
      if (e) throw (e.code === '23505' ? new Error('Esse e-mail já está em outra conta') : e);
      me.email = em || null; DC.toast(em ? 'Pronto! Agora você também entra com ' + em : 'E-mail removido');
    });
    if (me.mpConectado) {
      const tk = (await DC.session()).access_token;
      fetch('/api/mp-conectar', { method: 'POST', headers: { authorization: 'Bearer ' + tk, 'x-acao': 'info' } }).then((r) => r.json()).then((x) => {
        const el = $('#mpInfo'); if (!el) return;
        el.innerHTML = x.conectado ? `<b>${esc(x.nome || 'Conta Mercado Pago')}</b>${x.email ? ' · ' + esc(x.email) : ''}<br>Número da conta: ${esc(x.conta || '—')} · conectada em ${DC.data(x.desde)}` : 'Conta não encontrada.';
      }).catch(() => { const el = $('#mpInfo'); if (el) el.textContent = ''; });
      $('#mpSair').onclick = () => DC.busy($('#mpSair'), async () => {
        if (!(await DC.confirm('Desconectar a conta Mercado Pago? Sem conta conectada, as famílias não conseguem pagar seus atendimentos.', 'Desconectar'))) return;
        const r = await fetch('/api/mp-conectar', { method: 'POST', headers: { authorization: 'Bearer ' + (await DC.session()).access_token, 'x-acao': 'desconectar' } });
        const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Não deu para desconectar');
        me.mpConectado = false; DC.toast('Conta desconectada'); recebimentos();
      });
    }
    if ($('#mp')) $('#mp').onclick = () => DC.busy($('#mp'), async () => {
      try { const r = await DC.api('/api/mp-conectar'); location.href = r.url; }
      catch (e) {
        if (e.status !== 503) throw e;
        DC.modal(`<h2>Recebimentos em breve</h2><p>A conexão com o Mercado Pago ainda está sendo liberada pela Saúde Pra Você. Seu perfil já pode ficar pronto e publicado; avisamos você assim que puder conectar sua conta.</p><div class="acts"><button class="btn" data-close>Entendi</button></div>`);
      }
    });
    $('#sn').onclick = () => {
      const m = DC.modal(`<h2>Trocar senha</h2><label class="f">Nova senha<input class="in" type="password" id="s1" minlength="6" autocomplete="new-password"></label><label class="f">Repita<input class="in" type="password" id="s2" autocomplete="new-password"></label>
        <div class="acts"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn" id="ok">Salvar</button></div>`);
      $('#ok', m.el).onclick = () => DC.busy($('#ok', m.el), async () => {
        const a = $('#s1', m.el).value; if (a.length < 6) throw new Error('Mínimo de 6 caracteres'); if (a !== $('#s2', m.el).value) throw new Error('As senhas não conferem');
        const { error } = await sb.auth.updateUser({ password: a }); if (error) throw error; m.close(); DC.toast('Senha trocada');
      });
    };
  }

  // abas: iniciadas por último, depois de todas as funções existirem
  DC.tabs(['inicio', 'pedidos', 'agenda', 'perfil', 'recebimentos'], (t) => {
    app.innerHTML = '<div class="empty"><span class="spin"></span></div>';
    return ({ inicio, pedidos, agenda, perfil, recebimentos })[t]().catch(DC.erro);
  });
})();

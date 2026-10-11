/* DebCare · app do profissional de saúde */
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

  const precisaCoren = () => DC.ESPEC[pro.especialidade] && DC.ESPEC[pro.especialidade].coren;
  const pendencias = () => {
    const L = [];
    if (!pro.especialidade || !pro.titulo || !pro.valor_hora) L.push(['#perfil', 'Complete seu perfil: especialidade, título e valor por hora']);
    if (precisaCoren() && !pro.coren) L.push(['#perfil', 'Informe seu COREN']);
    if (!priv.doc_identidade) L.push(['#perfil', 'Envie seus documentos para ganhar o selo DebCare']);
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
            <div class="row">${pro.publicado ? '<span class="tag t-green">PERFIL NO CATÁLOGO</span>' : '<span class="tag t-amber">PERFIL NÃO PUBLICADO</span>'}${pro.verificado ? '<span class="selo">✓ Selo DebCare</span>' : ''}</div></div>
          <div class="card col"><h2>Seus valores</h2>
            <div class="list small">${Object.entries({ valor_hora: 'Por hora', valor_12h: 'Plantão 12h', valor_24h: 'Plantão 24h' }).map(([k, n]) => `<div class="li"><span class="grow">${n}</span><b>${pro[k] ? brl(pro[k], 2) : '—'}</b></div>`).join('')}</div>
            <p class="small mute">Você define o seu valor e recebe ele inteiro. A taxa da plataforma é somada por cima no preço do contratante.</p><a class="btn btn-ghost btn-sm" href="#perfil">Ajustar valores</a></div>
        </div>
      </div>`;
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
  async function agenda() {
    const [y, mo] = mesRef.split('-').map(Number);
    const ini = `${mesRef}-01`, fimD = new Date(Date.UTC(y, mo, 0)).getUTCDate(), fim = `${mesRef}-${String(fimD).padStart(2, '0')}`;
    const { data, error } = await sb.from('agenda').select('dia,status').eq('pro_id', me.id).gte('dia', ini).lte('dia', fim);
    if (error) throw error;
    const st = Object.fromEntries((data || []).map((d) => [d.dia, d.status]));
    const first = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay();
    const nomeMes = new Date(Date.UTC(y, mo - 1, 15)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const cells = [];
    for (let i = 0; i < first; i++) cells.push('<span></span>');
    for (let d = 1; d <= fimD; d++) {
      const dia = `${mesRef}-${String(d).padStart(2, '0')}`; const s = st[dia] || 'vazio';
      cells.push(`<button type="button" class="d-${s}" data-d="${dia}" ${s === 'alocado' || dia < DC.hoje() ? 'disabled' : ''} aria-label="${d}, ${s === 'vazio' ? 'sem marcação' : s}">${d}</button>`);
    }
    app.innerHTML = `
      <div class="head"><div><h1>Agenda</h1><p>Toque no dia para marcar disponível, parcial ou folga. Dias contratados ficam como ocupados. Dias de folga bloqueiam pedidos.</p></div></div>
      <div class="card col" style="max-width:640px">
        <div class="row"><button class="btn btn-sm btn-ghost" id="ant" aria-label="Mês anterior">←</button><h2 class="grow" style="text-align:center;text-transform:capitalize">${esc(nomeMes)}</h2><button class="btn btn-sm btn-ghost" id="prox" aria-label="Próximo mês">→</button></div>
        <div class="cal">${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((x) => `<span class="dw">${x}</span>`).join('')}${cells.join('')}</div>
        <div class="leg"><span><i class="d-livre"></i>Disponível</span><span><i class="d-parcial"></i>Parcial</span><span><i class="d-off"></i>Folga</span><span><i class="d-alocado"></i>Ocupado</span></div>
        <div class="row"><button class="btn btn-sm btn-ghost" id="todos">Marcar o mês todo como disponível</button></div>
      </div>`;
    const ciclo = { vazio: 'livre', livre: 'parcial', parcial: 'off', off: 'livre' };
    $$('[data-d]').forEach((b) => (b.onclick = async () => {
      const atual = (b.className.match(/d-(\w+)/) || [])[1] || 'vazio'; const novo = ciclo[atual] || 'livre';
      b.className = 'd-' + novo;
      const { error: e } = await sb.from('agenda').upsert({ pro_id: me.id, dia: b.dataset.d, status: novo });
      if (e) { DC.erro(e); b.className = 'd-' + atual; }
    }));
    $('#ant').onclick = () => { const d = new Date(Date.UTC(y, mo - 2, 1)); mesRef = d.toISOString().slice(0, 7); agenda(); };
    $('#prox').onclick = () => { const d = new Date(Date.UTC(y, mo, 1)); mesRef = d.toISOString().slice(0, 7); agenda(); };
    $('#todos').onclick = () => DC.busy($('#todos'), async () => {
      const rows = [];
      for (let d = 1; d <= fimD; d++) { const dia = `${mesRef}-${String(d).padStart(2, '0')}`; if (dia >= DC.hoje() && st[dia] !== 'alocado' && st[dia] !== 'off') rows.push({ pro_id: me.id, dia, status: 'livre' }); }
      if (rows.length) { const { error: e } = await sb.from('agenda').upsert(rows); if (e) throw e; } agenda();
    });
  }

  // ------------------------------------------------------------------ perfil e valores
  async function perfil() {
    const hab = new Set(pro.habilidades || []);
    app.innerHTML = `
      <div class="head"><div><h1>Perfil e valores</h1><p>É o que as famílias veem no catálogo. Você define quanto quer ganhar.</p></div>
        <div class="row">${pro.publicado ? '<span class="tag t-green">NO CATÁLOGO</span>' : '<span class="tag t-amber">NÃO PUBLICADO</span>'}${pro.verificado ? '<span class="selo">✓ Selo DebCare</span>' : ''}</div></div>
      <div class="split"><div class="main"><div class="card col">
        <label class="f">Nome completo<input class="in" id="pn" value="${esc(pro.nome)}" maxlength="80"></label>
        <div class="col" style="gap:6px"><b class="small">Você é</b><div class="grid2" id="es">${Object.entries(DC.ESPEC).map(([k, v]) => `<button type="button" class="opt ${pro.especialidade === k ? 'on' : ''}" data-e="${k}"><b>${v.nome}</b><span>${v.dica}</span></button>`).join('')}</div></div>
        <div class="grid2" id="corenBox"><label class="f">COREN<input class="in" id="co" value="${esc(pro.coren || '')}" maxlength="30" placeholder="ex.: 123.456-TE"></label><label class="f">UF do COREN<input class="in" id="cuf" value="${esc(pro.coren_uf || '')}" maxlength="2"></label></div>
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
        <div class="col" style="gap:6px"><b class="small">Cuidados que você faz</b><div class="chips" id="hb">${DC.HABIL.map((h) => `<button type="button" class="chip ${hab.has(h) ? '' : 'off'}" data-h="${esc(h)}">${esc(h)}</button>`).join('')}</div></div>
      </div></div>
      <div class="side">
        <div class="card col"><h2>Quanto você quer ganhar</h2><p class="small mute">Seu valor chega inteiro para você. A taxa da plataforma é somada por cima no preço que o contratante vê.</p>
          <label class="f">Por hora (obrigatório)<input class="in" type="number" id="vh" min="1" step="0.01" value="${pro.valor_hora ?? ''}"></label>
          <label class="f">Plantão de 12h (opcional)<input class="in" type="number" id="v12" min="1" step="0.01" value="${pro.valor_12h ?? ''}"></label>
          <label class="f">Plantão de 24h (opcional)<input class="in" type="number" id="v24" min="1" step="0.01" value="${pro.valor_24h ?? ''}"></label></div>
        <div class="card col"><h2>Documentos</h2><p class="small mute">Só você e a central DebCare veem. Com eles conferidos, você ganha o selo DebCare e aparece primeiro.</p>
          <label class="f">CPF<input class="in" id="cpf" inputmode="numeric" value="${esc(priv.cpf || '')}"></label>
          ${[['doc_identidade', 'Documento com foto (RG ou CNH)'], ['doc_coren', 'Carteira do COREN'], ['doc_antecedentes', 'Certidão de antecedentes criminais']].map(([k, n]) => `<div class="row"><span class="grow small">${n}<br>${priv[k] ? '<span class="tag t-green">ENVIADO</span>' : '<span class="tag t-gray">PENDENTE</span>'}</span><label class="btn btn-sm btn-ghost" for="f_${k}">${priv[k] ? 'Trocar' : 'Enviar'}</label><input type="file" id="f_${k}" data-doc="${k}" accept="application/pdf,image/*" class="sr"></div>`).join('')}
          <button class="btn btn-ghost btn-sm" id="salvaCpf">Salvar CPF</button></div>
      </div></div>
      <div class="row"><button class="btn" id="salva">Salvar perfil</button>${pro.publicado ? '<button class="btn btn-ghost" id="pub">Tirar do catálogo</button>' : '<button class="btn btn-green" id="pub">Salvar e publicar no catálogo</button>'}</div>`;
    let esp = pro.especialidade;
    const corenVis = () => $('#corenBox').classList.toggle('hide', !(DC.ESPEC[esp] && DC.ESPEC[esp].coren));
    $$('#es [data-e]').forEach((b) => (b.onclick = () => { esp = b.dataset.e; $$('#es [data-e]').forEach((x) => x.classList.toggle('on', x === b)); corenVis(); }));
    corenVis();
    $$('#hb [data-h]').forEach((b) => (b.onclick = () => b.classList.toggle('off')));
    const num = (s) => { const v = +$(s).value; return v > 0 ? Math.round(v * 100) / 100 : null; };
    const coleta = () => ({ nome: $('#pn').value.trim(), especialidade: esp || null, titulo: $('#pt').value.trim(), resumo: $('#pr').value.trim(),
      coren: $('#co').value.trim() || null, coren_uf: $('#cuf').value.trim().toUpperCase() || null, experiencia_anos: $('#px').value === '' ? null : +$('#px').value,
      genero: $('#pg').value || null, cidade: $('#pc').value.trim() || null, uf: $('#pu').value.trim().toUpperCase() || null, regioes: $('#prg').value.trim(),
      atende: $$('[data-at]').filter((c) => c.checked).map((c) => c.dataset.at), habilidades: $$('#hb [data-h]').filter((b) => !b.classList.contains('off')).map((b) => b.dataset.h),
      valor_hora: num('#vh'), valor_12h: num('#v12'), valor_24h: num('#v24') });
    const salvar = async (extra) => {
      const row = Object.assign(coleta(), extra || {});
      if (row.publicado) {
        if (!row.especialidade || !row.titulo || !row.valor_hora) throw new Error('Para publicar, escolha a especialidade e preencha título e valor por hora');
        if (DC.ESPEC[row.especialidade].coren && !row.coren) throw new Error('Para enfermagem, informe o COREN');
        if (!row.atende.length) throw new Error('Marque onde você atende');
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
    app.innerHTML = `<div class="head"><div><h1>Recebimentos</h1><p>Os pagamentos caem direto na sua conta Mercado Pago, com o seu valor inteiro.</p></div></div>
      <div class="split"><div class="main">
        <div class="card col"><h2>Atendimentos pagos</h2>${L.length ? `<div class="list">${L.map(linha).join('')}</div>` : '<p class="small mute">Nenhum pagamento ainda.</p>'}</div>
      </div><div class="side">
        <div class="card col"><h2>Conta de recebimento</h2>
          ${me.mpConectado ? '<div class="banner ok">Conta Mercado Pago conectada. Os pagamentos caem nela e você saca para o seu banco quando quiser.</div>'
            : '<p class="small">Conecte uma conta Mercado Pago (é grátis) para receber os pagamentos dos atendimentos. Do Mercado Pago você transfere para o seu banco.</p><button class="btn btn-dark" id="mp">Conectar Mercado Pago</button>'}</div>
        <div class="card col"><h2>Por mês</h2>${Object.keys(porMes).length ? `<div class="list small">${Object.entries(porMes).map(([k, v]) => `<div class="li"><span class="grow">${k.split('-').reverse().join('/')}</span><b>${brl(v, 2)}</b></div>`).join('')}</div>` : '<p class="small mute">—</p>'}</div>
        <div class="card col"><h2>Senha</h2><button class="btn btn-ghost btn-sm" id="sn">Trocar senha</button></div>
      </div></div>`;
    liga(recebimentos);
    if ($('#mp')) $('#mp').onclick = () => DC.busy($('#mp'), async () => { const r = await DC.api('/api/mp-conectar'); location.href = r.url; });
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
    ({ inicio, pedidos, agenda, perfil, recebimentos })[t]().catch(DC.erro);
  });
})();

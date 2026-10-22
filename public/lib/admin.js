/* Saúde Pra Você · painel de gestão (central Saúde Pra Você e Mind) */
(async function () {
  const { $, $$, sb, esc, brl } = DC;
  const me = await DC.boot('admin'); if (!me) return;
  if (!me.isAdmin) { location.replace(DC.home(me.role)); return; }
  DC.topo(me, [['visao', 'Visão geral'], ['central', 'Central'], ['contratacoes', 'Contratações'], ['profissionais', 'Profissionais'], ['contratantes', 'Contratantes'], ['financeiro', 'Financeiro'], ['campanhas', 'Campanhas'], ['config', 'Taxas e central']], 'Central');
  const app = $('#app');
  const mesAtual = DC.hoje().slice(0, 7);
  let filtroStatus = '';
  const um = (x) => (Array.isArray(x) ? x[0] : x) || {};
  const refDe = (iso) => new Date(new Date(iso).getTime() - 3 * 3600e3).toISOString().slice(0, 7);
  const mesNome = (k) => { const t = new Date(k + '-15T12:00:00Z').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }); return t[0].toUpperCase() + t.slice(1); };

  async function dinheiro() {
    const [pg, rp] = await Promise.all([
      sb.from('pagamentos').select('id,valor_total,taxa,debcare,mind,status,mp_payment_id,updated_at,contratacoes(id,codigo,cliente_nome,pro_nome,especialidade,modalidade,inicio,fim)').eq('status', 'approved').order('updated_at', { ascending: false }),
      sb.from('repasses_mind').select('*').order('pago_em', { ascending: false }),
    ]);
    const P = pg.data || [], R = rp.data || [];
    const meses = {};
    const novo = () => ({ total: 0, debcare: 0, mind: 0, pro: 0, n: 0, repassado: 0, P: [], R: [] });
    P.forEach((p) => { const k = refDe(p.updated_at); const x = meses[k] ||= novo(); x.total += +p.valor_total; x.debcare += +p.debcare; x.mind += +p.mind; x.pro += +p.valor_total - +p.taxa; x.n++; x.P.push(p); });
    R.forEach((r) => { const x = meses[r.referencia] ||= novo(); x.repassado += +r.valor; x.R.push(r); });
    const devido = Object.values(meses).reduce((s, x) => s + x.mind - x.repassado, 0);
    return { meses, R, devido: Math.round(devido * 100) / 100 };
  }
  const alertaMind = (devido, link = true) => devido > 0.009 ? `<div class="banner alerta row" style="justify-content:space-between"><span><b>A Saúde Pra Você deve ${brl(devido, 2)} à Mind</b> (10% dos atendimentos pagos). Registre o repasse quando pagar. O MindSaaS mostra o mesmo alerta.</span>${link ? '<a class="btn btn-sm" href="#financeiro">Ver repasses</a>' : ''}</div>` : '';


  // ------------------------------------------------------------------ convites pelo WhatsApp
  const CONVITE = {
    pro: (nome, link) => `Olá${nome ? ', ' + nome : ''}! Aqui é da Saúde Pra Você. Estamos convidando enfermeiros, técnicos de enfermagem, cuidadores e acompanhantes hospitalares para o nosso app.\n\nNele você monta o seu perfil, define o seu próprio valor, organiza a sua agenda e recebe pedidos de famílias da sua região. O pagamento é feito pelo app e cai direto na sua conta Mercado Pago.\n\nO cadastro é grátis: ${link}`,
    cliente: (nome, link) => `Olá${nome ? ', ' + nome : ''}! Aqui é da Saúde Pra Você. Convidamos você a conhecer o nosso app para contratar enfermeiros, técnicos de enfermagem, cuidadores e acompanhantes hospitalares de confiança.\n\nVocê vê o perfil, as avaliações, os valores e a agenda de cada profissional (enfermagem com COREN conferido), conversa pelo app e paga com segurança por Pix ou cartão. Se não encontrar quem precisa, a nossa central procura para você.\n\nO cadastro é grátis: ${link}`,
  };
  function convidar(tipo) {
    const link = `${location.origin}/entrar.html?como=${tipo}&criar=1`;
    const m = DC.modal(`<h2>Convidar ${tipo === 'pro' ? 'profissional' : 'contratante'}</h2>
      <p class="small mute">Digite o celular, confira a mensagem e envie pelo WhatsApp. O link já abre o cadastro como ${tipo === 'pro' ? 'profissional' : 'contratante'}.</p>
      <div class="grid2"><label class="f">Celular com DDD<input class="in" id="cvTel" inputmode="tel" placeholder="(16) 99999-0000" autocomplete="off"></label>
        <label class="f">Nome (opcional)<input class="in" id="cvNome" maxlength="60" placeholder="ex.: Maria"></label></div>
      <label class="f">Mensagem<textarea class="in" id="cvMsg" maxlength="1500" style="min-height:190px"></textarea></label>
      <div class="acts"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-green" id="cvOk">Enviar pelo WhatsApp</button></div>`, { wide: true });
    let editada = false;
    const msg = $('#cvMsg', m.el);
    const monta = () => { if (!editada) msg.value = CONVITE[tipo]($('#cvNome', m.el).value.trim().split(' ')[0], link); };
    monta();
    msg.oninput = () => { editada = true; };
    $('#cvNome', m.el).addEventListener('input', monta); $('#cvNome', m.el).addEventListener('change', monta);
    $('#cvOk', m.el).onclick = () => {
      monta();
      const d = DC.tel($('#cvTel', m.el).value);
      if (!d) return DC.erro(new Error('Celular inválido: use DDD + número'));
      if (!msg.value.trim()) return DC.erro(new Error('Escreva a mensagem'));
      window.open(DC.wa(d, msg.value.trim()), '_blank', 'noopener');
      m.close(); DC.toast('WhatsApp aberto com a mensagem. É só tocar em enviar.');
    };
  }
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-convite]'); if (b) convidar(b.dataset.convite); });

  // mensagens de boas-vindas (WhatsApp) para quem acabou de se cadastrar
  DC.msgBoasVindasPro = (nome) => `Olá${nome ? ', ' + nome : ''}! Seja muito bem-vindo(a) à *Saúde Pra Você* 💚\n\nQue bom ter você com a gente! Preparamos um vídeo de 1 minuto explicando como tudo funciona:\n🎬 ${location.origin}/boas-vindas.html\n\nEm resumo:\n✅ Você define o *seu próprio valor* (a taxa da plataforma não sai do seu bolso)\n✅ Escolhe os pedidos que aceita, sugere outra data ou negocia o valor pelo chat\n✅ Recebe pelo app, direto na sua conta Mercado Pago\n✅ Pode fazer atendimentos avulsos, contrato fixo com clínicas ou vaga CLT\n\n*Para aparecer no catálogo:*\n1️⃣ Coloque sua foto, especialidade e experiência\n2️⃣ Defina seus valores (técnico(a) e enfermeiro(a) informam o COREN)\n3️⃣ Conecte o Mercado Pago em Recebimentos\n4️⃣ Envie seus documentos e ganhe o selo verificado\n\nQualquer dúvida, é só responder esta mensagem.\n\n🤝 *Indique a Saúde Pra Você!*\nConhece colegas cuidadores, técnicos ou enfermeiros? Mande para eles: ${location.origin}/profissional.html\nConhece uma família ou clínica que precisa de cuidado? Mande para ela: ${location.origin}/contratante.html`;
  DC.msgBoasVindasCli = (nome) => `Olá${nome ? ', ' + nome : ''}! Seja muito bem-vindo(a) à *Saúde Pra Você* 💚\n\nAqui você encontra cuidadores, técnicos de enfermagem, enfermeiros e acompanhantes hospitalares da região, com perfil, experiência e valor à vista.\n\n📖 Veja como funciona: ${location.origin}/contratante.html\n\n✅ Escolha o profissional no catálogo e o período\n✅ Pague pelo app com Pix ou cartão, com segurança\n✅ Não achou quem precisa? Faça um pedido e a nossa central encontra para você\n\nQualquer dúvida, é só responder esta mensagem.\n\n🤝 *Indique a Saúde Pra Você!* Conhece uma família ou clínica que precisa de cuidado? Mande: ${location.origin}/contratante.html\nConhece um profissional de saúde? Mande: ${location.origin}/profissional.html`;

  // ------------------------------------------------------------------ visão geral
  async function visao() {
    const [pr, pf, ne, ct, din, bvq] = await Promise.all([
      sb.from('pros').select('user_id,nome,especialidade,publicado,verificado,coren,coren_status,valor_hora,created_at'),
      sb.from('profiles').select('id,nome,role,telefone,email,created_at').order('created_at', { ascending: false }),
      sb.from('necessidades').select('id,codigo,status,especialidade,cliente_nome,cidade,inicio,created_at').order('created_at', { ascending: false }),
      sb.from('contratacoes').select('id,codigo,status,cliente_nome,pro_nome,especialidade,modalidade,inicio,fim,proposta,created_at,updated_at,contratacao_cliente(total),contratacao_split(pro,debcare,mind)').order('created_at', { ascending: false }).limit(1000),
      dinheiro(),
      sb.from('boas_vindas').select('user_id,whatsapp_status'),
    ]);
    const BVm = Object.fromEntries(((bvq && bvq.data) || []).map((b) => [b.user_id, b.whatsapp_status]));
    const pros = pr.data || [], P = pf.data || [], N = ne.data || [], C = ct.data || [];
    const m = din.meses[mesAtual] || { total: 0, debcare: 0, mind: 0, n: 0 };
    const tot = Object.values(din.meses).reduce((a, x) => ({ total: a.total + x.total, debcare: a.debcare + x.debcare, mind: a.mind + x.mind, n: a.n + x.n }), { total: 0, debcare: 0, mind: 0, n: 0 });
    const abertas = N.filter((n) => ['aberta', 'em_busca'].includes(n.status));
    const clientes = P.filter((p) => p.role === 'cliente');
    const val = (c) => +um(c.contratacao_cliente).total || 0;
    const conta = (st) => C.filter((c) => c.status === st);
    const h24 = Date.now() - 864e5, d30 = Date.now() - 30 * 864e5;
    const corenFila = pros.filter((p) => DC.ESPEC[p.especialidade] && DC.ESPEC[p.especialidade].coren && p.coren && p.coren_status === 'pendente');
    const semResposta = conta('solicitado').filter((c) => new Date(c.created_at) < h24 && !c.proposta);
    const semPagar = conta('aceito');
    const propostas = C.filter((c) => c.proposta && ['solicitado', 'aceito'].includes(c.status));
    const recusados = conta('recusado').filter((c) => new Date(c.updated_at) > d30);
    const semValor = pros.filter((p) => !p.publicado && p.especialidade);
    const at = [
      [abertas.length, `pedido(s) na central esperando profissional`, 'central', 'red'],
      [corenFila.length, 'COREN aguardando conferência', 'profissionais', 'amber'],
      [semResposta.length, 'pedido(s) sem resposta do profissional há mais de 24h', 'contratacoes:solicitado', 'amber'],
      [recusados.length, 'pedido(s) recusado(s) nos últimos 30 dias: recomende outro profissional ou outra data', 'contratacoes:recusado', 'amber'],
      [semPagar.length, 'pedido(s) aceito(s) aguardando o pagamento do contratante', 'contratacoes:aceito', 'blue'],
      [propostas.length, 'nova(s) data(s) sugerida(s) aguardando o contratante', 'contratacoes', 'blue'],
      [semValor.length, 'profissional(is) com perfil começado e fora do catálogo', 'profissionais', 'gray'],
    ].filter((x) => x[0] > 0);
    const porEsp = Object.entries(DC.ESPEC).map(([k, v]) => [v.nome, pros.filter((p) => p.especialidade === k).length, pros.filter((p) => p.especialidade === k && p.publicado).length, abertas.filter((n) => n.especialidade === k).length]);
    const pagas = C.filter((c) => ['confirmado', 'concluido'].includes(c.status));
    const ticket = pagas.length ? pagas.reduce((t, c) => t + val(c), 0) / pagas.length : 0;
    const conv = C.length ? Math.round(pagas.length / C.length * 100) : 0;
    const novos30 = P.filter((p) => new Date(p.created_at) > d30);
    const dt = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const PAPEL = { pro: 'Profissional', cliente: 'Contratante', admin: 'Gestão' };

    app.innerHTML = `<div class="head"><div><h1>Visão geral</h1><p>${mesNome(mesAtual)} · ${C.length} contratação(ões) no total · ${P.length} conta(s)</p></div><div class="row"><button class="btn btn-sm" data-convite="cliente">📲 Convidar contratante</button><button class="btn btn-sm btn-green" data-convite="pro">📲 Convidar profissional</button></div></div>
      ${alertaMind(din.devido)}
      <div class="card col"><h2>Novos cadastros</h2>${P.length ? `<div class="list small">${P.slice(0, 8).map((p) => { const bv = BVm[p.id]; const feito = ['enviado', 'manual'].includes(bv);
          return `<div class="li"><button type="button" class="grow linha" style="all:unset;cursor:pointer;flex:1" data-conta="${p.id}" data-role="${p.role || ''}"><b>${esc(p.nome)}</b><br><span class="mute">${esc(PAPEL[p.role] || 'Sem perfil ainda')} · ${esc(DC.telBonito(p.telefone))} · ${dt(p.created_at)}</span></button>
            ${['pro', 'cliente'].includes(p.role) && p.telefone ? `${feito ? '<span class="tag t-green">Boas-vindas enviadas</span>' : ''}<button class="btn btn-sm ${feito ? 'btn-ghost' : 'btn-green'}" data-bvdar="${p.id}">👋 ${feito ? 'Mandar de novo' : 'Dar as boas-vindas'}</button>` : ''}</div>`; }).join('')}</div>` : '<p class="small mute">Ninguém ainda.</p>'}</div>
      <div class="card col"><h2>Precisa de atenção</h2>${at.length ? `<div class="list">${at.map(([n, t, go, cor]) => `<button type="button" class="li linha" data-ir="${go}"><span class="tag t-${cor}" style="min-width:34px;text-align:center">${n}</span><span class="grow">${t}</span><span class="mute">Abrir →</span></button>`).join('')}</div>` : '<p class="small mute">Tudo em dia. Nenhuma pendência agora.</p>'}</div>
      <div class="grid2">
        <div class="card kpi go" data-go="financeiro"><span class="small mute">Pago pelos contratantes no mês</span><div class="v">${brl(m.total, 2)}</div><span class="small mute">${m.n} pagamento(s) · total geral ${brl(tot.total, 2)}</span></div>
        <div class="card kpi go" data-go="financeiro"><span class="small mute">Saúde Pra Você no mês (15%)</span><div class="v">${brl(m.debcare, 2)}</div><span class="small mute">total geral ${brl(tot.debcare, 2)} · pelo split do Mercado Pago</span></div>
        <div class="card kpi go" data-go="financeiro"><span class="small mute">Mind no mês (10%)</span><div class="v">${brl(m.mind, 2)}</div><span class="small mute">a repassar agora: ${brl(Math.max(din.devido, 0), 2)}</span></div>
        <div class="card kpi go" data-go="contratacoes"><span class="small mute">Ticket médio</span><div class="v">${brl(ticket, 2)}</div><span class="small mute">${pagas.length} paga(s) · conversão ${conv}% dos pedidos</span></div>
        <div class="card kpi go" data-go="profissionais"><span class="small mute">Profissionais</span><div class="v">${pros.length}</div><span class="small mute">${pros.filter((p) => p.publicado).length} no catálogo · ${pros.filter((p) => p.verificado).length} com selo · ${corenFila.length} COREN a conferir</span></div>
        <div class="card kpi go" data-go="contratantes"><span class="small mute">Contratantes</span><div class="v">${clientes.length}</div><span class="small mute">${new Set(pagas.map((c) => c.cliente_nome)).size} já pagaram · ${novos30.filter((p) => p.role === 'cliente').length} novo(s) em 30 dias</span></div>
        <div class="card kpi go" data-go="central"><span class="small mute">Pedidos na central</span><div class="v">${abertas.length}</div><span class="small mute">${N.length} no total · ${N.filter((n) => n.status === 'atendida').length} atendido(s)</span></div>
      </div>
      <div class="card col"><h2>Funil de contratações</h2><div class="grid2">${Object.keys(DC.STATUS).map((st) => { const L = conta(st); return `<button type="button" class="row go linha" data-fst="${st}"><span class="grow">${DC.stTag(st)}</span><span style="text-align:right"><b>${L.length}</b><br><span class="tiny mute">${brl(L.reduce((t, c) => t + val(c), 0), 2)}</span></span></button>`; }).join('')}</div></div>
      <div class="split"><div class="main">
        <div class="card col"><h2>Últimas contratações</h2>${C.length ? `<div class="list small">${C.slice(0, 8).map((c) => `<button type="button" class="li linha" data-abre="${c.id}"><span class="grow"><b>#${c.codigo}</b> ${esc(c.cliente_nome)} → ${esc(c.pro_nome)}<br><span class="mute">${esc(DC.espec(c.especialidade))} · ${DC.periodo(c)} · pedido em ${dt(c.created_at)}</span></span><span style="text-align:right">${DC.stTag(c.status, c.tipo)}<br><b>${brl(val(c), 2)}</b></span></button>`).join('')}</div>` : '<p class="small mute">Nenhuma contratação ainda.</p>'}</div>
        <div class="card col"><h2>Pedidos na central</h2>${abertas.length ? `<div class="list small">${abertas.slice(0, 6).map((n) => `<button type="button" class="li linha" data-ir="central"><span class="grow"><b>#${n.codigo}</b> ${esc(n.cliente_nome)} · ${esc(DC.espec(n.especialidade))}<br><span class="mute">${esc(n.cidade || '')}${n.inicio ? ' · início ' + DC.data(n.inicio) : ''} · aberto em ${dt(n.created_at)}</span></span><span class="tag t-amber">${n.status === 'em_busca' ? 'EM BUSCA' : 'ABERTO'}</span></button>`).join('')}</div>` : '<p class="small mute">Nenhum pedido aberto.</p>'}</div>
      </div><div class="side">
        <div class="card col"><h2>Profissionais por tipo</h2><div class="list small">${porEsp.map(([n, t, pub, ped]) => `<div class="li"><span class="grow">${esc(n)}</span><span style="text-align:right"><b>${pub}</b> no catálogo de ${t}${ped ? `<br><span class="tag t-amber">${ped} pedido(s) na central</span>` : ''}</span></div>`).join('')}</div></div>
      </div></div>`;
    $$('[data-go]').forEach((b) => (b.onclick = () => { location.hash = b.dataset.go; }));
    const irPara = (go) => { const [tab, st] = go.split(':'); if (st) filtroStatus = st; if (location.hash === '#' + tab) ({ contratacoes, profissionais, central })[tab](); else location.hash = tab; };
    $$('[data-ir]').forEach((b) => (b.onclick = () => irPara(b.dataset.ir)));
    $$('[data-fst]').forEach((b) => (b.onclick = () => irPara('contratacoes:' + b.dataset.fst)));
    $$('[data-abre]').forEach((b) => (b.onclick = () => DC.abrirContratacao(b.dataset.abre, 'admin', visao)));
    $$('[data-bvdar]').forEach((b) => (b.onclick = async () => {
      const p = P.find((y) => y.id === b.dataset.bvdar); const nome = (p.nome || '').trim().split(/\s+/)[0];
      window.open(DC.wa(p.telefone, p.role === 'pro' ? DC.msgBoasVindasPro(nome) : DC.msgBoasVindasCli(nome)), '_blank', 'noopener');
      if (p.role === 'pro') { await DC.api('/api/boas-vindas', { acao: 'manual', user_id: p.id }).catch(() => null); setTimeout(visao, 800); }
    }));
    $$('[data-conta]').forEach((b) => (b.onclick = async () => {
      const id = b.dataset.conta, role = b.dataset.role;
      if (role === 'pro') {
        const [{ data: p }, { data: x }] = await Promise.all([sb.from('pros').select('*').eq('user_id', id).maybeSingle(), sb.from('pro_privado').select('*').eq('user_id', id).maybeSingle()]);
        detalhePro(p, x || {}, (P.find((y) => y.id === id) || {}).telefone);
      } else detalheCli(P.find((y) => y.id === id));
    }));
  }


  // ------------------------------------------------------------------ central (necessidades)
  async function central() {
    const [nq, pq] = await Promise.all([
      sb.from('necessidades').select('*').order('created_at', { ascending: false }).limit(300),
      sb.from('profiles').select('id,telefone').eq('role', 'cliente'),
    ]);
    if (nq.error) throw nq.error;
    const TEL = Object.fromEntries((pq.data || []).map((p) => [p.id, p.telefone]));
    const N = nq.data || [];
    const ativa = (n) => ['aberta', 'em_busca'].includes(n.status);
    const card = (n) => `<div class="card col ${n.status === 'aberta' ? 'alerta' : ''}">
      <div class="row"><b>#${n.codigo} · ${esc(DC.espec(n.especialidade))}</b>${DC.necTag(n.status)}${n.tipo === 'fixo' ? `<span class="tag t-blue">🏥 Contrato fixo · ${n.meses || '?'} ${n.meses === 1 ? 'mês' : 'meses'}${n.empresa_nome ? ' · ' + esc(n.empresa_nome) : ''}</span>` : ''}<span class="small mute right">${new Date(n.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div>
      <div class="grid2 small">
        <div><span class="tiny mute">CONTRATANTE</span><br><b>${esc(n.cliente_nome)}</b> · ${esc(DC.telBonito(TEL[n.cliente_id]))}</div>
        <div><span class="tiny mute">PACIENTE</span><br><b>${esc(n.paciente_nome)}</b>${n.paciente_idade != null ? ', ' + n.paciente_idade + ' anos' : ''}</div>
        <div><span class="tiny mute">QUANDO</span><br>${n.inicio ? DC.data(n.inicio) : '—'}${n.fim ? ' a ' + DC.data(n.fim) : ''} · ${{ dia: 'diurno', noite: 'noturno', '24h': '24 horas', horas: 'algumas horas' }[n.turno]}</div>
        <div><span class="tiny mute">ONDE</span><br>${esc(DC.LOCAL[n.local_tipo])} · ${esc([n.endereco, n.cidade].filter(Boolean).join(', '))}</div>
      </div>
      ${n.cuidados ? `<p class="small" style="white-space:pre-wrap"><b>Cuidados:</b> ${esc(n.cuidados)}</p>` : ''}
      ${n.observacoes ? `<p class="small" style="white-space:pre-wrap"><b>Obs.:</b> ${esc(n.observacoes)}</p>` : ''}
      <p class="small mute">${n.genero_pref ? 'Prefere profissional ' + (n.genero_pref === 'feminino' ? 'mulher' : 'homem') + ' · ' : ''}${n.orcamento ? 'Orçamento ' + brl(n.orcamento) : 'Sem orçamento informado'}</p>
      <div class="col" style="gap:8px;border-top:1px solid var(--line);padding-top:12px"><b class="small">Conversa com ${esc(n.cliente_nome.split(' ')[0])}</b><div data-chat="${n.id}"></div></div>
      <label class="f">Nota da central (o contratante vê)<input class="in" data-nota="${n.id}" value="${esc(n.nota_central)}" maxlength="300" placeholder="ex.: Estamos falando com 2 cuidadoras da região"></label>
      <div class="row">${ativa(n) ? `<button class="btn btn-sm" data-ind="${n.id}">Indicar profissional</button>` : ''}
        ${TEL[n.cliente_id] ? `<a class="btn btn-sm btn-ghost" href="${esc(DC.wa(TEL[n.cliente_id], 'Olá, ' + n.cliente_nome.split(' ')[0] + '! Aqui é da nossa central, sobre o seu pedido #' + n.codigo + '.'))}" target="_blank" rel="noopener">WhatsApp do contratante</a>` : ''}
        <select class="in" data-st="${n.id}" style="width:auto;min-height:36px">${Object.entries(DC.NEC).map(([k, v]) => `<option value="${k}" ${n.status === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></div></div>`;
    app.innerHTML = `<div class="head"><div><h1>Central</h1><p>Pedidos de quem não encontrou no catálogo. Indique um profissional: o pedido vai para ele aceitar e o contratante paga pelo app.</p></div></div>
      ${N.filter(ativa).map(card).join('') || '<div class="card empty"><b>Nenhum pedido esperando</b>Quando um contratante pedir ajuda, aparece aqui.</div>'}
      ${N.some((n) => !ativa(n)) ? `<div class="card col"><h2>Histórico</h2><div class="list">${N.filter((n) => !ativa(n)).map((n) => `<div class="li small"><span class="grow">#${n.codigo} · ${esc(n.cliente_nome)} · ${esc(DC.espec(n.especialidade))}</span>${DC.necTag(n.status)}</div>`).join('')}</div></div>` : ''}`;
    $$('[data-nota]').forEach((i) => (i.onchange = async () => { const { error } = await sb.from('necessidades').update({ nota_central: i.value.trim() }).eq('id', i.dataset.nota); if (error) DC.erro(error); else DC.toast('Nota salva'); }));
    $$('[data-st]').forEach((s) => (s.onchange = async () => { const { error } = await sb.from('necessidades').update({ status: s.value }).eq('id', s.dataset.st); if (error) DC.erro(error); else { DC.toast('Status atualizado'); central(); } }));
    $$('[data-ind]').forEach((b) => (b.onclick = () => indicar(N.find((n) => n.id === b.dataset.ind))));
    $$('[data-chat]').forEach((el) => DC.chatNec(el, el.dataset.chat, true));
  }
  async function indicar(n) {
    const [{ data: P }, din] = await Promise.all([sb.from('pros').select('*').eq('publicado', true).order('verificado', { ascending: false }), Promise.resolve(null)]);
    const tx = { d: +(DC.cfg.taxa_debcare ?? 15), m: +(DC.cfg.taxa_mind ?? 10) };
    // só quem pode ser contratado: perfil completo (especialidade e valor por hora) e, na enfermagem, COREN conferido — as mesmas regras do catálogo
    const completo = (p) => p.especialidade && DC.ESPEC[p.especialidade] && +p.valor_hora > 0 && (!DC.ESPEC[p.especialidade].coren || p.coren_status === 'ativo');
    const L = (P || []).filter(completo).sort((a, z) => (z.especialidade === n.especialidade) - (a.especialidade === n.especialidade));
    const st = { pro: null, mod: n.turno === '24h' ? 'plantao24' : 'hora', semana: [0, 1, 2, 3, 4, 5, 6] };
    const m = DC.modal(`<h2>Indicar profissional · pedido #${n.codigo}</h2><p class="small mute">${esc(n.cliente_nome)} · ${esc(DC.espec(n.especialidade))} · ${esc(n.cidade || '')}</p>
      ${n.tipo === 'fixo' ? `<div class="banner info">🏥 <b>Contrato fixo</b>${n.empresa_nome ? ' de ' + esc(n.empresa_nome) : ''}${n.meses ? ' por ' + n.meses + (n.meses === 1 ? ' mês' : ' meses') : ''}: vai ao profissional como contrato fixo, com pagamento em parcelas mensais.</div>` : ''}
      <label class="f">Profissional<select class="in" id="pp"><option value="">Escolha</option>${L.map((p) => { const semCoren = DC.ESPEC[p.especialidade] && DC.ESPEC[p.especialidade].coren && p.coren_status !== 'ativo'; return `<option value="${p.user_id}" ${semCoren ? 'disabled' : ''}>${esc(p.nome)} · ${esc(DC.espec(p.especialidade))}${p.cidade ? ' · ' + esc(p.cidade) : ''}${p.verificado ? ' ✓' : ''} · ${brl(p.valor_hora, 2)}/h${semCoren ? ' · COREN a conferir' : ''}</option>`; }).join('')}</select></label>
      <div class="seg" id="md">${Object.entries(DC.MODAL).map(([k, v]) => `<button type="button" data-m="${k}" class="${k === st.mod ? 'on' : ''}">${v.nome}</button>`).join('')}</div>
      <div class="grid2">
        <label class="f">Primeiro dia<input class="in" type="date" id="ini" value="${n.inicio && n.inicio >= DC.hoje() ? n.inicio : DC.hoje()}" min="${DC.hoje()}"></label>
        <label class="f">Último dia<input class="in" type="date" id="fim" value="${n.fim && n.fim >= DC.hoje() ? n.fim : (n.inicio && n.inicio >= DC.hoje() ? n.inicio : DC.hoje())}" min="${DC.hoje()}"></label>
        <label class="f">Horário<input class="in" type="time" id="hor" value="${n.turno === 'noite' ? '19:00' : '07:00'}"></label>
        <label class="f" id="hdL">Horas por dia<input class="in" type="number" id="hd" min="1" max="24" value="${n.horas_dia || 12}"></label>
      </div>
      <div class="sem" id="sem">${DC.SEMANA.map((d, i) => `<button type="button" data-d="${i}" class="on">${d}</button>`).join('')}</div>
      <div class="grid2" style="grid-template-columns:1fr 200px"><label class="f">Endereço do atendimento${n.endereco ? '' : '<small style="color:var(--red)">o contratante não informou: preencha ou combine com ele</small>'}<input class="in" id="ien" maxlength="300" value="${esc(n.endereco || '')}" placeholder="rua, número, bairro · ou hospital, quarto"></label>
        <label class="f">Cidade<input class="in" id="ici" maxlength="80" value="${esc(n.cidade || '')}"></label></div>
      <div class="card flat" id="prev"></div>
      <div class="acts"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn" id="env">Enviar ao profissional</button></div>`, { wide: true, semFoco: true });
    const draw = () => {
      $('#hdL', m.el).classList.toggle('hide', st.mod !== 'hora');
      const p = L.find((x) => x.user_id === $('#pp', m.el).value);
      const campo = { hora: 'valor_hora', plantao12: 'valor_12h', plantao24: 'valor_24h' }[st.mod];
      const dias = DC.dias($('#ini', m.el).value, $('#fim', m.el).value, st.semana);
      if (!p) { $('#prev', m.el).innerHTML = '<span class="small mute">Escolha o profissional para ver os valores.</span>'; return; }
      if (!p[campo]) { $('#prev', m.el).innerHTML = '<span class="small">Este profissional não tem valor para essa modalidade.</span>'; return; }
      const q = st.mod === 'hora' ? dias.length * (+$('#hd', m.el).value || 0) : dias.length;
      const pro = +p[campo] * q, cli = Math.round(+p[campo] * (1 + (tx.d + tx.m) / 100) * 100) / 100 * q;
      $('#prev', m.el).innerHTML = `<div class="grid2 small"><div>Contratante paga<br><b>${brl(cli, 2)}</b></div><div>Profissional recebe<br><b>${brl(pro, 2)}</b></div><div>Saúde Pra Você<br><b>${brl(pro * tx.d / 100, 2)}</b></div><div>Mind<br><b>${brl(cli - pro - pro * tx.d / 100, 2)}</b></div></div><span class="tiny mute">${dias.length} dia(s) · ${q} ${st.mod === 'hora' ? 'horas' : 'plantões'}</span>`;
    };
    $$('#md button', m.el).forEach((b) => (b.onclick = () => { st.mod = b.dataset.m; $$('#md button', m.el).forEach((x) => x.classList.toggle('on', x === b)); draw(); }));
    $$('#sem button', m.el).forEach((b) => (b.onclick = () => { const d = +b.dataset.d; st.semana = st.semana.includes(d) ? st.semana.filter((x) => x !== d) : [...st.semana, d]; b.classList.toggle('on'); draw(); }));
    ['#pp', '#ini', '#fim', '#hd'].forEach((s) => ($(s, m.el).oninput = draw)); $('#pp', m.el).onchange = draw;
    draw();
    $('#env', m.el).onclick = () => DC.busy($('#env', m.el), async () => {
      if (!$('#pp', m.el).value) throw new Error('Escolha o profissional');
      if (!$('#ien', m.el).value.trim()) throw new Error('Informe o endereço do atendimento');
      const r = await DC.api('/api/contratar', { acao: 'indicar', necessidade_id: n.id, pro_id: $('#pp', m.el).value, modalidade: st.mod, inicio: $('#ini', m.el).value, fim: $('#fim', m.el).value,
        horario: $('#hor', m.el).value, horas_dia: +$('#hd', m.el).value, dias_semana: st.semana, endereco: $('#ien', m.el).value.trim(), cidade: $('#ici', m.el).value.trim() });
      m.close(); DC.toast(`Enviado ao profissional · contratante pagará ${brl(r.total_cliente, 2)}`); central();
    });
  }

  // ------------------------------------------------------------------ contratações
  async function contratacoes() {
    const { data, error } = await sb.from('contratacoes').select('*,contratacao_split(pro,debcare,mind),contratacao_cliente(total)').order('updated_at', { ascending: false }).limit(500);
    if (error) throw error;
    let fs = filtroStatus; filtroStatus = '';
    app.innerHTML = `<div class="head"><div><h1>Contratações</h1><p>Todas as contratações com a divisão de valores. O contratante e o profissional não veem esta divisão.</p></div>
      <select class="in" id="fs" style="width:auto"><option value="">Todos os status</option>${Object.entries(DC.STATUS).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select></div>
      <div class="card"><div class="tbl-box"><table class="tbl"><thead><tr><th>#</th><th>Contratante → profissional</th><th>Período</th><th>Contratante paga</th><th>Profissional</th><th>Saúde Pra Você</th><th>Mind</th><th>Status</th><th></th></tr></thead><tbody id="tb"></tbody></table></div></div>`;
    const draw = () => {
      $('#tb').innerHTML = (data || []).filter((c) => !fs || c.status === fs).map((c) => { const s = um(c.contratacao_split), v = um(c.contratacao_cliente); return `<tr class="go" data-row="${c.id}" title="Duplo clique para ver tudo">
        <td class="small">${c.codigo}</td><td><b>${esc(c.cliente_nome)}</b> → ${esc(c.pro_nome)}<br><span class="small mute">${esc(DC.espec(c.especialidade))} · ${esc(DC.MODAL[c.modalidade].nome)}${c.origem === 'central' ? ' · central' : ''}</span>${c.tipo !== 'avulso' ? `<br><span class="tag t-blue">${c.tipo === 'clt' ? '👔 Vaga CLT' : 'Contrato fixo'}${c.empresa_nome ? ' · ' + esc(c.empresa_nome) : ''}</span>` : ''}</td>
        <td class="small">${DC.periodo(c)}<br>${esc(DC.qtdTxt(c))}</td><td><b>${brl(v.total, 2)}</b></td><td>${brl(s.pro, 2)}</td><td>${brl(s.debcare, 2)}</td><td>${brl(s.mind, 2)}</td>
        <td>${DC.stTag(c.status, c.tipo)}</td><td><button class="btn btn-sm btn-ghost" data-c="${c.id}">Abrir</button></td></tr>`; }).join('') || '<tr><td colspan="9" class="mute">Nenhuma contratação.</td></tr>';
      $$('[data-c]').forEach((b) => (b.onclick = () => DC.abrirContratacao(b.dataset.c, 'admin', contratacoes)));
      $$('[data-row]').forEach((r) => (r.ondblclick = () => DC.abrirContratacao(r.dataset.row, 'admin', contratacoes)));
    };
    $('#fs').value = fs;
    $('#fs').onchange = (e) => { fs = e.target.value; draw(); };
    draw();
  }

  // ------------------------------------------------------------------ profissionais
  async function profissionais() {
    // o que falta para o profissional aparecer no catálogo (mesmas regras da função catalogo do banco)
    const falta = (p) => [!p.especialidade && 'especialidade', !p.valor_hora && 'valor por hora', DC.ESPEC[p.especialidade] && DC.ESPEC[p.especialidade].coren && p.coren_status !== 'ativo' && 'COREN conferido'].filter(Boolean);
    const [{ data, error }, pv, pf] = await Promise.all([sb.from('pros').select('*').order('created_at', { ascending: false }), sb.from('pro_privado').select('*'), sb.from('profiles').select('id,telefone').eq('role', 'pro')]);
    if (error) throw error;
    const PV = Object.fromEntries((pv.data || []).map((x) => [x.user_id, x]));
    const TEL = Object.fromEntries((pf.data || []).map((x) => [x.id, x.telefone]));
    app.innerHTML = `<div class="head"><div><h1>Profissionais</h1><p>Técnicos e enfermeiros só aparecem no catálogo depois que a central confere o COREN no Cofen. Clique em "Consultar no Cofen", busque pelo número/UF e marque o resultado.</p></div><div class="row"><button class="btn btn-sm btn-green" data-convite="pro">📲 Convidar profissional</button><input class="in" id="q" placeholder="Buscar" style="max-width:280px" aria-label="Buscar profissionais"></div></div>
      ${(() => { const n = (data || []).filter((p) => DC.ESPEC[p.especialidade] && DC.ESPEC[p.especialidade].coren && p.coren && p.coren_status === 'pendente').length; return n ? `<div class="banner warn">${n} COREN aguardando conferência.</div>` : ''; })()}
      <div class="card"><div class="tbl-box"><table class="tbl"><thead><tr><th>Profissional</th><th>Valores (dele)</th><th>COREN</th><th>Documentos</th><th>Catálogo</th><th>Selo</th><th></th></tr></thead><tbody id="tb"></tbody></table></div></div>`;
    const docs = (u) => { const x = PV[u] || {}; return [['doc_identidade', 'Identidade'], ['doc_coren', 'COREN'], ['doc_antecedentes', 'Antecedentes']].map(([k, n]) => x[k] ? `<button class="link small" data-doc="${esc(x[k])}">${n}</button>` : `<span class="tiny mute">${n} —</span>`).join('<br>') + (x.cpf ? `<br><span class="tiny">CPF ${esc(x.cpf)}</span>` : ''); };
    const corenCel = (p) => {
      if (!(DC.ESPEC[p.especialidade] && DC.ESPEC[p.especialidade].coren)) return p.coren ? esc(p.coren) + (p.coren_uf ? '/' + esc(p.coren_uf) : '') : '<span class="mute">não se aplica</span>';
      if (!p.coren) return '<span class="tag t-red">SEM COREN</span>';
      const tag = p.coren_status === 'ativo' ? `<span class="tag t-green">ATIVO</span>${p.coren_conferido_em ? '<br><span class="tiny mute">conferido ' + DC.data(p.coren_conferido_em) + '</span>' : ''}` : p.coren_status === 'irregular' ? '<span class="tag t-red">IRREGULAR</span>' : '<span class="tag t-amber">A CONFERIR</span>';
      return `<b>${esc(p.coren)}/${esc(p.coren_uf || '?')}</b><br>${tag}<br><button class="link small" data-cofen="${esc(p.coren)}">Consultar no Cofen</button>
        <br><button class="link small" data-cst="ativo" data-u="${p.user_id}">Ativo</button> · <button class="link small" data-cst="irregular" data-u="${p.user_id}">Irregular</button>`;
    };
    const draw = () => {
      const q = DC.norm($('#q').value);
      $('#tb').innerHTML = (data || []).filter((p) => !q || DC.norm(p.nome + p.titulo + p.cidade).includes(q)).map((p) => `<tr class="go" data-prow="${p.user_id}" title="Duplo clique para ver tudo">
        <td><b>${esc(p.nome)}</b><br><span class="small mute">${esc(DC.espec(p.especialidade))}${p.cidade ? ' · ' + esc(p.cidade) : ''} · ${esc(DC.telBonito(TEL[p.user_id]))}</span></td>
        <td class="small">${p.valor_hora ? brl(p.valor_hora, 2) + '/h' : '—'}${p.valor_12h ? '<br>' + brl(p.valor_12h, 2) + '/12h' : ''}${p.valor_24h ? '<br>' + brl(p.valor_24h, 2) + '/24h' : ''}</td>
        <td class="small">${corenCel(p)}</td><td>${docs(p.user_id)}</td>
        <td><label class="check"><input type="checkbox" data-pub="${p.user_id}" ${p.publicado ? 'checked' : ''}>Publicado</label>${falta(p).length ? `<br><span class="tag t-amber" title="Só aparece no catálogo quando estiver completo">Falta: ${esc(falta(p).join(', '))}</span>` : p.publicado ? '<br><span class="tag t-green">No catálogo</span>' : ''}</td>
        <td><label class="check"><input type="checkbox" data-ver="${p.user_id}" ${p.verificado ? 'checked' : ''}>Selo</label></td>
        <td><button class="btn btn-sm" data-ver="${p.user_id}">Ver</button> <button class="btn btn-sm btn-ghost" data-senha="${p.user_id}">Nova senha</button></td></tr>`).join('') || '<tr><td colspan="7" class="mute">Nenhum profissional.</td></tr>';
      const abre = (id) => detalhePro(data.find((x) => x.user_id === id), PV[id] || {}, TEL[id]);
      $$('[data-prow]').forEach((r) => (r.ondblclick = (e) => { if (!e.target.closest('button,input,label,a')) abre(r.dataset.prow); }));
      $$('[data-ver]').forEach((b) => (b.onclick = () => abre(b.dataset.ver)));
      $$('[data-ver]').forEach((c) => (c.onchange = async () => { const { error: e } = await sb.from('pros').update({ verificado: c.checked }).eq('user_id', c.dataset.ver); if (e) { DC.erro(e); c.checked = !c.checked; } else DC.toast(c.checked ? 'Selo verificado concedido' : 'Selo removido'); }));
      $$('[data-pub]').forEach((c) => (c.onchange = async () => { const { error: e } = await sb.from('pros').update({ publicado: c.checked }).eq('user_id', c.dataset.pub); if (e) { DC.erro(e); c.checked = !c.checked; return; } const pp = data.find((x) => x.user_id === c.dataset.pub); const f = pp ? falta(pp) : []; DC.toast(!c.checked ? 'Fora do catálogo' : f.length ? 'Marcado como publicado, mas só aparece no catálogo quando completar: ' + f.join(', ') : 'No catálogo', c.checked && f.length > 0); }));
      $$('[data-doc]').forEach((b) => (b.onclick = async () => { const { data: u, error: e } = await sb.storage.from('docs').createSignedUrl(b.dataset.doc, 300); if (e) return DC.erro(e); window.open(u.signedUrl, '_blank', 'noopener'); }));
      $$('[data-senha]').forEach((b) => (b.onclick = () => novaSenha(b, b.dataset.senha)));
      $$('[data-cofen]').forEach((b) => (b.onclick = () => { try { navigator.clipboard.writeText(b.dataset.cofen); DC.toast('Número do COREN copiado. Cole na consulta do Cofen.'); } catch (e) { /* sem área de transferência */ } window.open('https://sigen.cofen.gov.br/profissional/consultar', '_blank', 'noopener'); }));
      $$('[data-cst]').forEach((b) => (b.onclick = async () => {
        const st = b.dataset.cst, p = data.find((x) => x.user_id === b.dataset.u);
        const upd = { coren_status: st, coren_conferido_em: new Date().toISOString() };
        if (st === 'irregular') Object.assign(upd, { verificado: false });
        const { error: e } = await sb.from('pros').update(upd).eq('user_id', p.user_id);
        if (e) return DC.erro(e);
        Object.assign(p, upd); DC.toast(st === 'ativo' ? 'COREN confirmado. O profissional já pode aparecer no catálogo.' : 'COREN marcado como irregular. O profissional fica fora do catálogo.'); draw();
      }));
    };
    $('#q').oninput = draw; draw();
  }
  async function novaSenha(btn, userId) {
    if (!(await DC.confirm('Gerar uma senha nova para esta pessoa?', 'Gerar senha'))) return;
    DC.busy(btn, async () => {
      const r = await DC.api('/api/senha', { user_id: userId });
      DC.modal(`<h2>Senha nova de ${esc(r.nome.split(' ')[0])}</h2><p class="price">${esc(r.senha)}</p><p class="small mute">Envie pelo WhatsApp e peça para trocar depois em Conta.</p>
        <div class="acts"><button class="btn btn-ghost" data-close>Fechar</button><a class="btn btn-green" target="_blank" rel="noopener" href="${esc(DC.wa(r.telefone, `Olá, ${r.nome.split(' ')[0]}! Sua senha nova da Saúde Pra Você é ${r.senha}. Entre com seu celular e essa senha e troque por uma sua.`))}">Enviar no WhatsApp</a></div>`, { semFoco: true });
    });
  }

  // ------------------------------------------------------------------ contratantes
  async function contratantes() {
    const [{ data, error }, ct, ne] = await Promise.all([sb.from('profiles').select('*').eq('role', 'cliente').order('created_at', { ascending: false }), sb.from('contratacoes').select('cliente_id,status'), sb.from('necessidades').select('cliente_id')]);
    if (error) throw error;
    const n = (L, id, f) => (L || []).filter((x) => x.cliente_id === id && (!f || f(x))).length;
    app.innerHTML = `<div class="head"><div><h1>Contratantes</h1></div><button class="btn btn-sm" data-convite="cliente">📲 Convidar contratante</button></div><div class="card"><div class="tbl-box"><table class="tbl"><thead><tr><th>Contratante</th><th>Celular</th><th>Contratações</th><th>Pagas</th><th>Pedidos à central</th><th>Desde</th><th></th></tr></thead><tbody>
      ${(data || []).map((p) => `<tr class="go" data-crow="${p.id}" title="Duplo clique para ver tudo"><td><b>${esc(p.nome)}</b>${p.email ? `<br><span class="small mute">${esc(p.email)}</span>` : ''}</td><td class="small"><a href="${esc(DC.wa(p.telefone))}" target="_blank" rel="noopener">${esc(DC.telBonito(p.telefone))}</a></td>
        <td>${n(ct.data, p.id)}</td><td>${n(ct.data, p.id, (x) => ['confirmado', 'concluido'].includes(x.status))}</td><td>${n(ne.data, p.id)}</td><td class="small">${DC.data(p.created_at)}</td>
        <td><button class="btn btn-sm" data-cver="${p.id}">Ver</button> <button class="btn btn-sm btn-ghost" data-senha="${p.id}">Nova senha</button></td></tr>`).join('') || '<tr><td colspan="7" class="mute">Nenhum contratante ainda.</td></tr>'}</tbody></table></div></div>`;
    $$('[data-senha]').forEach((b) => (b.onclick = () => novaSenha(b, b.dataset.senha)));
    const abre = (id) => detalheCli(data.find((x) => x.id === id));
    $$('[data-crow]').forEach((r) => (r.ondblclick = (e) => { if (!e.target.closest('button,a')) abre(r.dataset.crow); }));
    $$('[data-cver]').forEach((b) => (b.onclick = () => abre(b.dataset.cver)));
  }

  // ------------------------------------------------------------------ detalhes (profissional e contratante)
  const dl = (L) => `<div class="dl">${L.filter((x) => x && x[1] !== undefined && x[1] !== null && x[1] !== '').map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
  const listaCt = (L, quem) => L.length ? `<div class="list small">${L.map((c) => { const s = um(c.contratacao_split), v = um(c.contratacao_cliente); return `<button class="li linha" data-dc="${c.id}"><span class="grow"><b>#${c.codigo}</b> · ${esc(quem === 'pro' ? c.cliente_nome : c.pro_nome)} · ${DC.periodo(c)}<br><span class="mute">${esc(DC.MODAL[c.modalidade].nome)} · ${esc(DC.qtdTxt(c))}</span></span><span style="text-align:right">${DC.stTag(c.status, c.tipo)}<br><b>${brl(v.total, 2)}</b><br><span class="tiny mute">pro ${brl(s.pro, 2)} · SPV ${brl(s.debcare, 2)} · Mind ${brl(s.mind, 2)}</span></span></button>`; }).join('')}</div>` : '<p class="small mute">Nenhuma contratação.</p>';
  const ligaCt = (m) => $$('[data-dc]').forEach((b) => (b.onclick = () => { if (m && m.close) m.close(); else document.querySelector('.scrim') && document.querySelector('.scrim').remove(); DC.abrirContratacao(b.dataset.dc, 'admin'); }));
  const somaPagas = (L) => L.filter((c) => ['confirmado', 'concluido'].includes(c.status)).reduce((t, c) => t + +um(c.contratacao_cliente).total || 0, 0);

  async function detalhePro(p, x, tel) {
    if (!p) return;
    const [ct, av] = await Promise.all([
      sb.from('contratacoes').select('*,contratacao_split(pro,debcare,mind),contratacao_cliente(total)').eq('pro_id', p.user_id).order('inicio', { ascending: false }),
      sb.from('avaliacoes').select('nota,comentario,created_at').eq('pro_id', p.user_id).order('created_at', { ascending: false }).limit(20),
    ]);
    const C = ct.data || [], A = av.data || [];
    const preco = (v) => (v ? `${brl(v, 2)} → contratante paga ${brl(Math.round(v * (1 + ((+(DC.cfg.taxa_debcare ?? 15)) + (+(DC.cfg.taxa_mind ?? 10))) / 100) * 100) / 100, 2)}` : '');
    const docs = [['doc_identidade', 'Identidade'], ['doc_coren', 'Carteira do COREN'], ['doc_antecedentes', 'Antecedentes']].map(([k, n]) => x[k] ? `<button class="btn btn-sm btn-ghost" data-doc2="${esc(x[k])}">${n}</button>` : `<span class="tag t-gray">${n}: pendente</span>`).join(' ');
    const m = DC.modal(`<h2>${esc(p.nome)}</h2>
      <div class="row">${p.publicado ? '<span class="tag t-green">NO CATÁLOGO</span>' : '<span class="tag t-amber">FORA DO CATÁLOGO</span>'}${p.verificado ? '<span class="selo">✓ Selo</span>' : ''}${DC.ESPEC[p.especialidade] && DC.ESPEC[p.especialidade].coren ? (p.coren_status === 'ativo' ? '<span class="tag t-green">COREN ATIVO</span>' : p.coren_status === 'irregular' ? '<span class="tag t-red">COREN IRREGULAR</span>' : '<span class="tag t-amber">COREN A CONFERIR</span>') : ''}</div>
      ${dl([['Especialidade', esc(DC.espec(p.especialidade))], ['Celular', `<a href="${esc(DC.wa(tel))}" target="_blank" rel="noopener">${esc(DC.telBonito(tel))}</a>`], ['CPF', esc(x.cpf || '')], ['COREN', p.coren ? esc(p.coren + '/' + (p.coren_uf || '?')) : ''],
        ['Cidade', esc([p.cidade, p.uf].filter(Boolean).join('/'))], ['Atende em', esc((p.atende || []).map((t) => DC.LOCAL[t] || t).join(', '))], ['Regiões', esc(p.regioes || '')], ['Experiência', p.experiencia_anos != null ? p.experiencia_anos + ' ano(s)' : ''],
        ['Gênero', esc(p.genero || '')], ['Por hora (dele)', preco(p.valor_hora)], ['Plantão 12h (dele)', preco(p.valor_12h)], ['Plantão 24h (dele)', preco(p.valor_24h)],
        ['Avaliação', p.n_avaliacoes ? `${(+p.rating).toFixed(1)} ★ (${p.n_avaliacoes})` : 'sem avaliações'], ['Contratações', `${C.length} · ${C.filter((c) => ['confirmado', 'concluido'].includes(c.status)).length} paga(s) · ${brl(somaPagas(C), 2)}`], ['Cadastro', DC.data(p.created_at)]])}
      ${p.titulo ? `<p><b>${esc(p.titulo)}</b></p>` : ''}${p.resumo ? `<p class="small">${esc(p.resumo)}</p>` : ''}
      ${(p.habilidades || []).length ? `<div class="chips">${p.habilidades.map((h) => `<span class="chip">${esc(h)}</span>`).join('')}</div>` : ''}
      <h3>Documentos</h3><div class="row">${docs}</div>
      <h3>Contratações</h3>${listaCt(C, 'pro')}
      ${A.length ? `<h3>Avaliações</h3><div class="list small">${A.map((a) => `<div class="li"><span class="grow">${'★'.repeat(a.nota)}${'☆'.repeat(5 - a.nota)} ${esc(a.comentario)}</span><span class="mute">${DC.data(a.created_at)}</span></div>`).join('')}</div>` : ''}
      <div class="acts"><button class="btn btn-ghost" data-close>Fechar</button></div>`, { wide: true });
    $$('[data-doc2]').forEach((b) => (b.onclick = async () => { const { data: u, error: e } = await sb.storage.from('docs').createSignedUrl(b.dataset.doc2, 300); if (e) return DC.erro(e); window.open(u.signedUrl, '_blank', 'noopener'); }));
    ligaCt(m);
  }

  async function detalheCli(p) {
    if (!p) return;
    const [ct, ne] = await Promise.all([
      sb.from('contratacoes').select('*,contratacao_split(pro,debcare,mind),contratacao_cliente(total)').eq('cliente_id', p.id).order('inicio', { ascending: false }),
      sb.from('necessidades').select('*').eq('cliente_id', p.id).order('created_at', { ascending: false }),
    ]);
    const C = ct.data || [], N = ne.data || [];
    const m = DC.modal(`<h2>${esc(p.nome)}</h2>
      ${dl([['Celular', `<a href="${esc(DC.wa(p.telefone))}" target="_blank" rel="noopener">${esc(DC.telBonito(p.telefone))}</a>`], ['E-mail', esc(p.email || '')], ['Cliente desde', DC.data(p.created_at)],
        ['Contratações', `${C.length} · ${C.filter((c) => ['confirmado', 'concluido'].includes(c.status)).length} paga(s)`], ['Total pago', brl(somaPagas(C), 2)], ['Pedidos à central', String(N.length)]])}
      <h3>Contratações</h3>${listaCt(C, 'cli')}
      <h3>Pedidos à central</h3>${N.length ? `<div class="list small">${N.map((n) => `<div class="li"><span class="grow"><b>#${n.codigo}</b> · ${esc(DC.espec(n.especialidade))} · ${esc(n.paciente_nome || '')}${n.cidade ? ' · ' + esc(n.cidade) : ''}<br><span class="mute">${n.inicio ? DC.data(n.inicio) : ''}${n.fim && n.fim !== n.inicio ? ' a ' + DC.data(n.fim) : ''} · ${esc(n.cuidados.slice(0, 140))}</span></span><span class="tag ${n.status === 'atendida' ? 't-green' : n.status === 'cancelada' ? 't-gray' : 't-amber'}">${esc(n.status.replace('_', ' ').toUpperCase())}</span></div>`).join('')}</div>` : '<p class="small mute">Nenhum pedido.</p>'}
      <div class="acts"><button class="btn btn-ghost" data-close>Fechar</button></div>`, { wide: true });
    ligaCt(m);
  }

  // ------------------------------------------------------------------ financeiro e repasse à Mind
  async function financeiro() {
    const { meses, R, devido } = await dinheiro();
    const K = Object.keys(meses).sort().reverse();
    app.innerHTML = `<div class="head"><div><h1>Financeiro</h1><p>O contratante paga ao profissional pelo Mercado Pago; 25% (Saúde Pra Você 15% + Mind 10%) caem na conta da Saúde Pra Você pelo split. A Saúde Pra Você repassa os 10% da Mind.</p></div>
      <button class="btn" id="rep">Registrar repasse à Mind</button></div>
      ${alertaMind(devido, false) || '<div class="banner ok">Nada a repassar à Mind agora.</div>'}
      <div class="card"><div class="tbl-box"><table class="tbl"><thead><tr><th>Mês</th><th>Pagamentos</th><th>Contratantes pagaram</th><th>Profissionais</th><th>Saúde Pra Você</th><th>Mind (devido)</th><th>Repassado</th><th>A repassar</th></tr></thead><tbody>
        ${K.map((k) => { const x = meses[k], f = x.mind - x.repassado; return `<tr class="go" data-mes="${k}" title="Toque para ver os pagamentos"><td><span class="seta" id="s-${k}">▸</span> ${mesNome(k)}</td><td>${x.n}</td><td>${brl(x.total, 2)}</td><td>${brl(x.pro, 2)}</td><td>${brl(x.debcare, 2)}</td><td>${brl(x.mind, 2)}</td><td>${brl(x.repassado, 2)}</td><td>${f > 0.009 ? `<b style="color:var(--red)">${brl(f, 2)}</b>` : '<span class="tag t-green">EM DIA</span>'}</td></tr>
          <tr class="hide det-mes" id="d-${k}"><td colspan="8">${detalheMes(x)}</td></tr>`; }).join('') || '<tr><td colspan="8" class="mute">Nenhum pagamento aprovado ainda.</td></tr>'}</tbody></table></div><p class="tiny mute" style="margin-top:8px">Toque num mês para ver cada pagamento.</p></div>
      <div class="card col"><h2>Repasses feitos à Mind</h2>${R.length ? `<div class="list">${R.map((r) => `<div class="li small"><span class="grow"><b>${brl(r.valor, 2)}</b> · referência ${esc(r.referencia.split('-').reverse().join('/'))}${r.nota ? ' · ' + esc(r.nota) : ''}</span><span class="mute">${DC.data(r.pago_em)}</span></div>`).join('')}</div>` : '<p class="small mute">Nenhum repasse registrado.</p>'}</div>`;
    $$('[data-mes]').forEach((tr) => (tr.onclick = () => { const k = tr.dataset.mes; const d = $('#d-' + k); d.classList.toggle('hide'); $('#s-' + k).textContent = d.classList.contains('hide') ? '▸' : '▾'; }));
    $$('[data-pc]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); DC.abrirContratacao(b.dataset.pc, 'admin', financeiro); }));
    $('#rep').onclick = () => {
      const pend = K.filter((k) => meses[k].mind - meses[k].repassado > 0.009);
      const k0 = pend[pend.length - 1] || mesAtual;
      const m = DC.modal(`<h2>Registrar repasse à Mind</h2>
        <label class="f">Mês de referência<input class="in" type="month" id="rf" value="${k0}"></label>
        <label class="f">Valor<input class="in" type="number" id="rv" min="0.01" step="0.01" value="${meses[k0] ? (meses[k0].mind - meses[k0].repassado).toFixed(2) : ''}"></label>
        <label class="f">Data do pagamento<input class="in" type="date" id="rd" value="${DC.hoje()}"></label>
        <label class="f">Observação<input class="in" id="rn" maxlength="200" placeholder="ex.: Pix para a MindFy Tech"></label>
        <div class="acts"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn" id="ok">Registrar</button></div>`);
      $('#rf', m.el).onchange = (e) => { const x = meses[e.target.value]; $('#rv', m.el).value = x ? Math.max(0, x.mind - x.repassado).toFixed(2) : ''; };
      $('#ok', m.el).onclick = () => DC.busy($('#ok', m.el), async () => {
        const v = +$('#rv', m.el).value; if (!(v > 0)) throw new Error('Informe o valor');
        const { error } = await sb.from('repasses_mind').insert({ referencia: $('#rf', m.el).value, valor: v, pago_em: $('#rd', m.el).value, nota: $('#rn', m.el).value.trim(), created_by: me.id });
        if (error) throw error; m.close(); DC.toast('Repasse registrado. O alerta no MindSaaS é atualizado.'); financeiro();
      });
    };
  }

  function detalheMes(x) {
    const dh = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    return `<div class="tbl-box"><table class="tbl small"><thead><tr><th>Data</th><th>Atendimento</th><th>Contratante pagou</th><th>Profissional</th><th>Saúde Pra Você</th><th>Mind</th></tr></thead><tbody>
      ${x.P.map((p) => { const c = p.contratacoes || {}; return `<tr><td>${dh(p.updated_at)}</td><td><button class="link" data-pc="${c.id}">#${c.codigo ?? ''}</button> ${esc(c.cliente_nome || '')} → ${esc(c.pro_nome || '')}<br><span class="tiny mute">${esc(DC.espec(c.especialidade))}${c.modalidade ? ' · ' + esc(DC.MODAL[c.modalidade].nome) : ''}${c.inicio ? ' · ' + DC.periodo(c) : ''}${p.mp_payment_id ? ' · MP ' + esc(p.mp_payment_id) : ''}</span></td>
        <td>${brl(p.valor_total, 2)}</td><td>${brl(+p.valor_total - +p.taxa, 2)}</td><td>${brl(p.debcare, 2)}</td><td>${brl(p.mind, 2)}</td></tr>`; }).join('') || '<tr><td colspan="6" class="mute">Nenhum pagamento neste mês.</td></tr>'}
      ${x.R.map((r) => `<tr style="background:#F1FAF6"><td>${DC.data(r.pago_em)}</td><td colspan="4">Repasse à Mind registrado${r.nota ? ' · ' + esc(r.nota) : ''}</td><td><b style="color:var(--green)">− ${brl(r.valor, 2)}</b></td></tr>`).join('')}
    </tbody></table></div>`;
  }

  // ------------------------------------------------------------------ taxas e central
  async function config() {
    const { data } = await sb.from('config').select('key,value');
    const C = Object.fromEntries((data || []).map((x) => [x.key, x.value]));
    app.innerHTML = `<div class="head"><div><h1>Taxas e central</h1><p>As taxas são somadas por cima do valor do profissional e valem para os próximos pedidos.</p></div></div>
      <div class="grid2" style="max-width:900px">
        <div class="card col"><h2>Saúde Pra Você</h2><label class="f">Taxa Saúde Pra Você (%)<input class="in" id="td" type="number" min="0" max="100" step="0.5" value="${+C.taxa_debcare}"></label></div>
        <div class="card col"><h2>Mind (gestora da plataforma)</h2><label class="f">Taxa Mind (%)<input class="in" id="tm" type="number" min="0" max="100" step="0.5" value="${+C.taxa_mind}"></label></div>
        <div class="card col"><h2>Exemplo</h2><p class="small" id="ex"></p></div>
        <div class="card col"><h2>👔 Vaga CLT</h2><label class="f">Taxa Saúde Pra Você sobre 1 salário (%)<small>A empresa paga uma única vez, quando o contrato é assinado; a taxa Mind acima é somada por cima</small><input class="in" id="tc" type="number" min="0" max="100" step="0.5" value="${+(C.taxa_clt ?? 20)}"></label><p class="small" id="exc"></p></div>
        <div class="card col"><h2>Central</h2>
          <label class="f">WhatsApp da central<small>aparece para contratantes e no "esqueci a senha"</small><input class="in" id="cw" value="${esc(DC.telBonito(C.central_whatsapp || ''))}" placeholder="(16) 99999-0000"></label>
          <label class="f">E-mail da central<small>recebe aviso de novos pedidos (opcional)</small><input class="in" id="ce" type="email" value="${esc(C.central_email || '')}"></label></div>
        <div class="card col"><h2>Equipe com acesso ao painel</h2><p class="small mute">Celulares com DDD, um por linha. Viram administradores ao criar a conta.</p><textarea class="in" id="adm">${esc((C.admins || []).map(DC.telBonito).join('\n'))}</textarea></div>
      </div>
      <button class="btn" id="sv" style="align-self:flex-start">Salvar</button>`;
    const ex = () => { const d = +$('#td').value || 0, m = +$('#tm').value || 0; $('#ex').innerHTML = `Profissional pede <b>R$ 100</b> → contratante vê <b>${brl(100 * (1 + (d + m) / 100), 2)}</b> · Saúde Pra Você ${brl(d, 2)} · Mind ${brl(m, 2)}`; };
    const exc = () => { const c = +$('#tc').value || 0, m = +$('#tm').value || 0; $('#exc').innerHTML = `Salário de <b>R$ 3.000</b> → empresa paga <b>${brl(3000 * (c + m) / 100, 2)}</b> · Saúde Pra Você ${brl(3000 * c / 100, 2)} · Mind ${brl(3000 * m / 100, 2)}`; };
    $('#td').oninput = ex; $('#tm').oninput = () => { ex(); exc(); }; $('#tc').oninput = exc; ex(); exc();
    $('#sv').onclick = () => DC.busy($('#sv'), async () => {
      const adm = $('#adm').value.split(/\n|,|;/).map((x) => DC.tel(x)).filter(Boolean);
      if (!adm.length) throw new Error('Mantenha ao menos um celular da equipe');
      const cw = $('#cw').value.trim() ? DC.tel($('#cw').value) : '';
      if (cw === null) throw new Error('WhatsApp da central inválido');
      const vals = [['taxa_debcare', +$('#td').value], ['taxa_mind', +$('#tm').value], ['taxa_clt', +$('#tc').value], ['central_whatsapp', cw], ['central_email', $('#ce').value.trim()], ['admins', adm]];
      for (const [k, v] of vals) {
        const { error } = await sb.from('config').upsert({ key: k, value: v, updated_at: new Date().toISOString() }); if (error) throw error;
      }
      DC.cfg = Object.fromEntries(vals); DC.toast('Configurações salvas');
    });
  }


  // ------------------------------------------------------------------ campanhas de convite por e-mail
  // textos com {cidade}: viram a cidade da campanha escolhida (o nome da campanha começa pela cidade, ex.: "Ribeirão Preto · profissionais")
  const CAMP_TXT = { assunto: 'Convite: receba pedidos de famílias de {cidade} pela Saúde Pra Você',
    corpo: 'Olá, {nome}!\n\nSomos a Saúde Pra Você, um app de {cidade} e região que liga famílias e clínicas a enfermeiros, técnicos de enfermagem, cuidadores e fisioterapeutas.\n\nVocê monta o seu perfil, define o seu próprio valor e a sua agenda, e recebe pedidos com pagamento garantido pelo app, direto na sua conta Mercado Pago. Clínicas também podem propor contrato fixo ou vaga CLT.\n\nO cadastro é grátis e leva 3 minutos.' };
  const WA_TXT = {
    grupo: '👩‍⚕️ *Cuidadores, técnicos de enfermagem, enfermeiros e fisioterapeutas de {cidade}!*\n\nChegou a *Saúde Pra Você*, o app de {cidade} que liga famílias e clínicas a profissionais de saúde.\n\n✅ Você monta o seu perfil e define o *seu próprio valor*\n✅ Organiza a sua agenda\n✅ Recebe pedidos de famílias e clínicas da região\n✅ Pagamento garantido pelo app, direto na sua conta Mercado Pago\n✅ Clínicas também oferecem contrato fixo e vagas CLT\n\nCadastro grátis em 3 minutos 👉 https://saudepravoce.com/profissional.html',
    status: 'Profissional de saúde em {cidade}? 👩‍⚕️ Cadastre-se grátis na Saúde Pra Você, defina o seu valor e receba pedidos de famílias e clínicas da região 👉 saudepravoce.com/profissional.html',
    ind: 'Olá, {nome}! Tudo bem? Aqui é da Saúde Pra Você, um app de {cidade} que liga famílias e clínicas a cuidadores, técnicos de enfermagem, enfermeiros e fisioterapeutas.\n\nNo app você define o seu próprio valor e a sua agenda, e recebe pedidos com pagamento garantido. O cadastro é grátis e leva 3 minutos:' };
  let campAtual = null;
  async function campanhas() {
    const [{ data, error }, st, bvr, bst] = await Promise.all([
      sb.from('campanha_contatos').select('*').order('created_at').limit(2000),
      fetch('/api/campanha').then((r) => r.json()).catch(() => ({})),
      sb.from('boas_vindas').select('*, profiles(nome, telefone, email)').order('created_at', { ascending: false }).limit(30),
      fetch('/api/boas-vindas').then((r) => r.json()).catch(() => ({})),
    ]);
    const BV = (bvr && bvr.data) || [];
    if (error) throw error;
    const L = data || [];
    const nomes = [...new Set(L.map((c) => c.campanha))];
    if (!campAtual || !nomes.includes(campAtual)) campAtual = nomes.find((x) => L.some((c) => c.campanha === x && c.status === 'pendente')) || nomes[nomes.length - 1] || 'Franca · profissionais';
    const CT = L.filter((c) => c.campanha === campAtual);
    const C = CT.filter((c) => c.canal !== 'whatsapp'), W = CT.filter((c) => c.canal === 'whatsapp');
    const n = (s) => C.filter((c) => c.status === s).length;
    const cidade = (campAtual.split('·')[0] || '').trim() || 'Franca';
    const comCidade = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v).replace(/\{cidade\}/g, cidade)]));
    const chaveTxt = 'dc_camp_txt:' + campAtual;
    let txt = comCidade(CAMP_TXT); try { txt = Object.assign(txt, JSON.parse(localStorage.getItem(chaveTxt) || (cidade === 'Franca' ? localStorage.getItem('dc_camp_txt') : '') || '{}')); } catch (e) {}
    const WA = comCidade(WA_TXT);
    const img = cidade === 'Ribeirão Preto' ? 'ribeirao-preto' : 'franca';
    const BVST = { pendente: ['Pendente', 't-amber'], enviando: ['Enviando', 't-blue'], enviado: ['Enviado', 't-green'], manual: ['Enviado à mão', 't-green'], erro: ['Erro', 't-red'], sem_email: ['Sem e-mail', 't-gray'] };
    const ST = { pendente: ['Pendente', 't-amber'], enviado: ['Enviado', 't-blue'], erro: ['Erro', 't-red'], descadastrado: ['Descadastrou', 't-gray'], cadastrou: ['Cadastrou', 't-green'] };
    app.innerHTML = `<div class="head"><div><h1>Campanhas</h1><p>Convites por e-mail enviados pelo app como <b>convite@saudepravoce.com</b>, com link de descadastro (LGPD).</p></div>
        ${nomes.length > 1 ? `<select class="in" id="cpSel" style="width:auto">${nomes.map((x) => `<option ${x === campAtual ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>` : ''}</div>
      ${st.email ? '' : '<div class="banner">⚠️ O envio de e-mails do app ainda não está ativo: falta configurar o Resend com o domínio saudepravoce.com. Você já pode montar a lista e o texto; o botão de enviar funciona assim que o Resend estiver ligado.</div>'}
      <div class="card col"><h2>🎬 Boas-vindas para novos profissionais</h2>
        <p class="small mute">Quem se cadastra como profissional recebe o <a href="/boas-vindas.html" target="_blank" rel="noopener">vídeo de boas-vindas</a> por e-mail na hora${bst.whatsapp ? ' e pelo WhatsApp oficial' : ''}. ${bst.whatsapp ? '' : '<b>O WhatsApp automático ainda não está ligado</b> (precisa da API oficial do WhatsApp com o modelo de mensagem aprovado). Até lá, toque em "Mandar no WhatsApp": a mensagem abre pronta com o link do vídeo.'}</p>
        <div class="tbl-box"><table class="tbl small"><thead><tr><th>Profissional</th><th>Cadastro</th><th>WhatsApp</th><th>E-mail</th><th></th></tr></thead><tbody>
          ${BV.map((b) => { const pf = b.profiles || {}; const t = (s) => { const x = BVST[s] || [s, 't-gray']; return `<span class="tag ${x[1]}">${x[0]}</span>`; };
            return `<tr><td><b>${esc(pf.nome || '')}</b><br><span class="mute">${esc(DC.telBonito(pf.telefone || ''))}</span></td><td>${DC.data(b.created_at)}</td><td>${t(b.whatsapp_status)}${b.whatsapp_erro ? `<br><span class="tiny mute">${esc(b.whatsapp_erro)}</span>` : ''}</td><td>${t(b.email_status)}</td>
              <td class="row">${pf.telefone ? `<button class="btn btn-sm btn-green" data-bvwa="${b.user_id}">${['enviado', 'manual'].includes(b.whatsapp_status) ? 'Mandar de novo' : 'Mandar no WhatsApp'}</button>` : ''}${(bst.whatsapp || bst.email) && (b.whatsapp_status === 'erro' || b.email_status === 'erro') ? `<button class="btn btn-sm btn-ghost" data-bvre="${b.user_id}">Tentar de novo</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="5" class="mute">Nenhum profissional novo ainda.</td></tr>'}
        </tbody></table></div></div>
      <div class="grid2">
        <div class="card kpi"><span class="small mute">${esc(campAtual)}</span><div class="v">${C.length}</div><span class="small mute">contatos</span></div>
        <div class="card kpi"><span class="small mute">Pendentes</span><div class="v">${n('pendente')}</div><span class="small mute">${n('enviado')} enviados · ${n('erro')} com erro</span></div>
        <div class="card kpi"><span class="small mute">Clicaram no convite</span><div class="v">${C.filter((c) => c.clicou_em).length}</div><span class="small mute">${n('descadastrado')} descadastrados</span></div>
      </div>
      <div class="card col"><h2>Texto do convite</h2>
        <label class="f">Assunto<input class="in" id="cpAs" maxlength="150" value="${esc(txt.assunto)}"></label>
        <label class="f">Mensagem<small>{nome} vira o primeiro nome da pessoa. O botão "Quero me cadastrar grátis" e o link de descadastro entram sozinhos no fim.</small><textarea class="in" id="cpCo" maxlength="4000" style="min-height:200px">${esc(txt.corpo)}</textarea></label>
        <label class="f">Respostas vão para (opcional)<input class="in" id="cpRe" type="email" placeholder="ex.: seu e-mail · em branco = sem resposta por e-mail" value="${esc(txt.responder || '')}"></label>
        <div class="row"><button class="btn btn-ghost" id="cpPrev">Ver como fica</button><button class="btn btn-green" id="cpEnv" ${n('pendente') ? '' : 'disabled'}>Enviar para ${n('pendente')} pendente(s)</button></div></div>
      <div class="card col"><h2>Contatos</h2>
        <div class="tbl-box"><table class="tbl small"><thead><tr><th>Nome</th><th>Cargo · onde trabalha</th><th>E-mail</th><th>Situação</th><th></th></tr></thead><tbody>
          ${C.map((c) => `<tr><td><b>${esc(c.nome)}</b>${c.nota ? `<br><span class="tag t-amber">${esc(c.nota)}</span>` : ''}</td><td>${esc(c.cargo)}${c.empresa ? '<br><span class="mute">' + esc(c.empresa) + '</span>' : ''}</td><td>${esc(c.email)}</td>
            <td><span class="tag ${ST[c.status][1]}">${ST[c.status][0]}</span>${c.clicou_em ? '<br><span class="tag t-green">Clicou</span>' : ''}</td>
            <td>${c.status === 'pendente' ? `<button class="btn btn-sm btn-ghost" data-cprm="${c.id}" title="Tirar da campanha">Tirar</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="mute">Nenhum contato ainda.</td></tr>'}
        </tbody></table></div>
        <details><summary class="small"><b>Adicionar contatos</b></summary><div class="col" style="margin-top:10px">
          <label class="f">Um por linha: nome; e-mail; cargo; onde trabalha<textarea class="in" id="cpAdd" style="min-height:100px" placeholder="Maria Souza; maria@gmail.com; Cuidadora; Particular"></textarea></label>
          <label class="f">Campanha<input class="in" id="cpNome" value="${esc(campAtual)}" maxlength="80"></label>
          <button class="btn btn-sm" id="cpAddOk">Adicionar</button></div></details></div>
      <div class="card col"><h2>💬 Campanha por WhatsApp</h2>
        <p class="small mute">O WhatsApp não permite disparo automático em massa de um número comum (o número é bloqueado). Por isso a campanha é feita em dois caminhos seguros: <b>grupos e Status</b> (um post alcança muita gente) e <b>contatos individuais</b>, um toque por pessoa, com a mensagem já pronta e o link de cadastro rastreado.</p>
        <h3>1. Grupos de ${esc(cidade)} e Status</h3>
        <label class="f">Mensagem para grupos (cuidadores, enfermagem, fisioterapia de ${esc(cidade)})<textarea class="in" id="waGrupo" style="min-height:170px">${esc(WA.grupo)}</textarea></label>
        <div class="row"><button class="btn btn-sm" data-copia="waGrupo">Copiar mensagem</button><a class="btn btn-sm btn-green" id="waGrupoAbre" target="_blank" rel="noopener">Abrir no WhatsApp e escolher o grupo</a><a class="btn btn-sm btn-ghost" href="/campanha/convite-${img}.png" download="convite-saude-pra-voce-${img}.png">Baixar imagem · ${esc(cidade)}</a></div>
        <label class="f">Texto para o Status<textarea class="in" id="waStatus" style="min-height:90px">${esc(WA.status)}</textarea></label>
        <div class="row"><button class="btn btn-sm" data-copia="waStatus">Copiar texto do Status</button></div>
        <h3>2. Contatos individuais</h3>
        <label class="f">Mensagem individual<small>{nome} vira o primeiro nome. O link de cadastro rastreado entra no fim.</small><textarea class="in" id="waInd" style="min-height:150px">${esc(WA.ind)}</textarea></label>
        <div class="tbl-box"><table class="tbl small"><thead><tr><th>Nome</th><th>Celular</th><th>Cargo</th><th>Situação</th><th></th></tr></thead><tbody>
          ${W.map((c) => `<tr><td><b>${esc(c.nome)}</b></td><td>${esc(DC.telBonito(c.telefone))}</td><td>${esc(c.cargo)}</td><td><span class="tag ${ST[c.status][1]}">${ST[c.status][0]}</span>${c.clicou_em ? '<br><span class="tag t-green">Clicou</span>' : ''}</td>
            <td class="row">${c.status !== 'descadastrado' ? `<button class="btn btn-sm btn-green" data-waabre="${c.id}">${c.status === 'enviado' ? 'Abrir de novo' : 'Abrir WhatsApp'}</button><button class="btn btn-sm btn-ghost" data-wasai="${c.id}" title="A pessoa pediu para não receber">Pediu SAIR</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="mute">Nenhum contato de WhatsApp ainda. Adicione abaixo.</td></tr>'}
        </tbody></table></div>
        <details><summary class="small"><b>Adicionar contatos de WhatsApp</b></summary><div class="col" style="margin-top:10px">
          <label class="f">Um por linha: nome; celular com DDD; cargo<textarea class="in" id="waAdd" style="min-height:100px" placeholder="Maria Souza; (16) 99999-0000; Cuidadora"></textarea></label>
          <button class="btn btn-sm" id="waAddOk">Adicionar</button></div></details></div>`;
    const guarda = () => { try { localStorage.setItem(chaveTxt, JSON.stringify({ assunto: $('#cpAs').value, corpo: $('#cpCo').value, responder: $('#cpRe').value })); } catch (e) {} };
    ['#cpAs', '#cpCo', '#cpRe'].forEach((s) => ($(s).oninput = guarda));
    $$('[data-bvwa]').forEach((b) => (b.onclick = async () => {
      const r = BV.find((x) => x.user_id === b.dataset.bvwa); const pf = r.profiles || {}; const nome = (pf.nome || '').trim().split(/\s+/)[0];
      const txt = DC.msgBoasVindasPro(nome);
      window.open(DC.wa(pf.telefone, txt), '_blank', 'noopener');
      await DC.api('/api/boas-vindas', { acao: 'manual', user_id: r.user_id }).catch(() => null); setTimeout(campanhas, 800);
    }));
    $$('[data-bvre]').forEach((b) => (b.onclick = () => DC.busy(b, async () => { await DC.api('/api/boas-vindas', { acao: 'enviar', user_id: b.dataset.bvre }); DC.toast('Enviado de novo'); campanhas(); })));
    if ($('#cpSel')) $('#cpSel').onchange = (e) => { campAtual = e.target.value; campanhas(); };
    $('#cpPrev').onclick = () => DC.busy($('#cpPrev'), async () => {
      const r = await DC.api('/api/campanha', { acao: 'previa', corpo: $('#cpCo').value, nome: (C[0] && C[0].nome) || 'Maria', cidade: (C[0] && C[0].cidade) || cidade });
      const m = DC.modal(`<h2>${esc($('#cpAs').value)}</h2><p class="small mute">De: Saúde Pra Você &lt;convite@saudepravoce.com&gt;</p><iframe id="cpIf" style="width:100%;height:520px;border:1px solid var(--line);border-radius:12px;background:#fff"></iframe><div class="acts"><button class="btn" data-close>Fechar</button></div>`, { wide: true });
      $('#cpIf', m.el).srcdoc = r.html;
    });
    $$('[data-cprm]').forEach((b) => (b.onclick = () => DC.busy(b, async () => { const { error: e } = await sb.from('campanha_contatos').delete().eq('id', b.dataset.cprm); if (e) throw e; campanhas(); })));
    $('#cpAddOk').onclick = () => DC.busy($('#cpAddOk'), async () => {
      const camp = $('#cpNome').value.trim() || campAtual;
      const rows = $('#cpAdd').value.split('\n').map((l) => l.split(/[;\t]/).map((x) => x.trim())).filter((x) => x[1] && /^\S+@\S+\.\S+$/.test(x[1]))
        .map(([nome, email, cargo, empresa]) => ({ campanha: camp, nome: nome || '', email: email.toLowerCase(), cargo: cargo || '', empresa: empresa || '', cidade: (camp.split('·')[0] || '').trim(), origem: 'manual' }));
      if (!rows.length) throw new Error('Nenhuma linha com e-mail válido');
      const { error: e } = await sb.from('campanha_contatos').upsert(rows, { onConflict: 'campanha,email', ignoreDuplicates: true });
      if (e) throw e; campAtual = camp; DC.toast(rows.length + ' contato(s) adicionados'); campanhas();
    });
    const linkCad = (tk) => `${location.origin}/api/campanha?ir=${tk}`;
    const upWa = () => { $('#waGrupoAbre').href = DC.wa('', $('#waGrupo').value); };
    upWa(); $('#waGrupo').oninput = upWa;
    $$('[data-copia]').forEach((b) => (b.onclick = async () => { try { await navigator.clipboard.writeText($('#' + b.dataset.copia).value); DC.toast('Copiado. É só colar no WhatsApp.'); } catch (e) { DC.toast('Selecione o texto e copie manualmente', true); } }));
    $$('[data-waabre]').forEach((b) => (b.onclick = async () => {
      const c = W.find((x) => x.id === b.dataset.waabre); const primeiro = (c.nome || '').split(' ')[0];
      const txt = $('#waInd').value.replace(/\{nome\}/g, primeiro).replace(/Olá, !/g, 'Olá!') + '\n\n👉 ' + linkCad(c.token) + '\n\n(Se não quiser receber mensagens nossas, responda SAIR.)';
      window.open(DC.wa(c.telefone, txt), '_blank', 'noopener');
      if (c.status === 'pendente') { await sb.from('campanha_contatos').update({ status: 'enviado', enviado_em: new Date().toISOString() }).eq('id', c.id); setTimeout(campanhas, 800); }
    }));
    $$('[data-wasai]').forEach((b) => (b.onclick = () => DC.busy(b, async () => { const { error: e } = await sb.from('campanha_contatos').update({ status: 'descadastrado' }).eq('id', b.dataset.wasai); if (e) throw e; DC.toast('Marcado: não enviar mais'); campanhas(); })));
    $('#waAddOk').onclick = () => DC.busy($('#waAddOk'), async () => {
      const rows = $('#waAdd').value.split('\n').map((l) => l.split(/[;\t]/).map((x) => x.trim())).map(([nome, cel, cargo]) => ({ nome, tel: DC.tel(cel || ''), cargo }))
        .filter((x) => x.tel).map((x) => ({ campanha: campAtual, canal: 'whatsapp', nome: x.nome || '', telefone: x.tel, cargo: x.cargo || '', cidade, origem: 'manual' }));
      if (!rows.length) throw new Error('Nenhuma linha com celular válido (DDD + número)');
      const { error: e } = await sb.from('campanha_contatos').upsert(rows, { onConflict: 'campanha,telefone', ignoreDuplicates: true });
      if (e) throw e; DC.toast(rows.length + ' contato(s) de WhatsApp adicionados'); campanhas();
    });
    $('#cpEnv').onclick = () => DC.busy($('#cpEnv'), async () => {
      guarda();
      if (!(await DC.confirm(`Enviar o convite agora para ${n('pendente')} pessoa(s) da campanha "${campAtual}"? Não dá para desfazer.`, 'Enviar agora'))) return;
      let tot = 0, err = 0, r;
      do {
        r = await DC.api('/api/campanha', { acao: 'enviar', campanha: campAtual, assunto: $('#cpAs').value, corpo: $('#cpCo').value, responder: $('#cpRe').value.trim() || null });
        tot += r.enviados; err += r.erros;
        $('#cpEnv').textContent = `Enviando… ${tot} enviados`;
      } while (r.restam > 0 && r.enviados + r.erros > 0);
      DC.toast(`${tot} convite(s) enviados${err ? ' · ' + err + ' com erro' : ''}`, err > 0); campanhas();
    });
  }

  // abas: iniciadas por último, depois de todas as funções existirem
  DC.tabs(['visao', 'central', 'contratacoes', 'profissionais', 'contratantes', 'financeiro', 'campanhas', 'config'], (t) => {
    app.innerHTML = '<div class="empty"><span class="spin"></span></div>';
    return ({ visao, central, contratacoes, profissionais, contratantes, financeiro, campanhas, config })[t]().catch(DC.erro);
  });
})();

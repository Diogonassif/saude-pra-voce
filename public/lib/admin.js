/* DebCare · painel de gestão (central DebCare e Mind) */
(async function () {
  const { $, $$, sb, esc, brl } = DC;
  const me = await DC.boot('admin'); if (!me) return;
  if (!me.isAdmin) { location.replace(DC.home(me.role)); return; }
  DC.topo(me, [['visao', 'Visão geral'], ['central', 'Central'], ['contratacoes', 'Contratações'], ['profissionais', 'Profissionais'], ['contratantes', 'Contratantes'], ['financeiro', 'Financeiro'], ['config', 'Taxas e central']], 'Central');
  const app = $('#app');
  const mesAtual = DC.hoje().slice(0, 7);
  const um = (x) => (Array.isArray(x) ? x[0] : x) || {};
  const refDe = (iso) => new Date(new Date(iso).getTime() - 3 * 3600e3).toISOString().slice(0, 7);
  const mesNome = (k) => { const t = new Date(k + '-15T12:00:00Z').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }); return t[0].toUpperCase() + t.slice(1); };

  async function dinheiro() {
    const [pg, rp] = await Promise.all([
      sb.from('pagamentos').select('valor_total,taxa,debcare,mind,status,updated_at').eq('status', 'approved'),
      sb.from('repasses_mind').select('*').order('pago_em', { ascending: false }),
    ]);
    const P = pg.data || [], R = rp.data || [];
    const meses = {};
    P.forEach((p) => { const k = refDe(p.updated_at); const x = meses[k] ||= { total: 0, debcare: 0, mind: 0, pro: 0, n: 0, repassado: 0 }; x.total += +p.valor_total; x.debcare += +p.debcare; x.mind += +p.mind; x.pro += +p.valor_total - +p.taxa; x.n++; });
    R.forEach((r) => { const x = meses[r.referencia] ||= { total: 0, debcare: 0, mind: 0, pro: 0, n: 0, repassado: 0 }; x.repassado += +r.valor; });
    const devido = Object.values(meses).reduce((s, x) => s + x.mind - x.repassado, 0);
    return { meses, R, devido: Math.round(devido * 100) / 100 };
  }
  const alertaMind = (devido, link = true) => devido > 0.009 ? `<div class="banner alerta row" style="justify-content:space-between"><span><b>A DebCare deve ${brl(devido, 2)} à Mind</b> (10% dos atendimentos pagos). Registre o repasse quando pagar. O MindSaaS mostra o mesmo alerta.</span>${link ? '<a class="btn btn-sm" href="#financeiro">Ver repasses</a>' : ''}</div>` : '';

  // ------------------------------------------------------------------ visão geral
  async function visao() {
    const [pr, cl, ne, ct, din] = await Promise.all([
      sb.from('pros').select('user_id,publicado,verificado'),
      sb.from('profiles').select('id').eq('role', 'cliente'),
      sb.from('necessidades').select('id,status'),
      sb.from('contratacoes').select('id,status'),
      dinheiro(),
    ]);
    const pros = pr.data || [], C = ct.data || [], m = din.meses[mesAtual] || { total: 0, debcare: 0, mind: 0, n: 0 };
    const abertas = (ne.data || []).filter((n) => ['aberta', 'em_busca'].includes(n.status)).length;
    const conta = (s) => C.filter((c) => c.status === s).length;
    app.innerHTML = `<div class="head"><div><h1>Visão geral</h1><p>${mesNome(mesAtual)}</p></div></div>
      ${alertaMind(din.devido)}
      ${abertas ? `<a class="banner row" href="#central" style="text-decoration:none;justify-content:space-between"><span><b>${abertas} pedido(s) na central</b> esperando um profissional.</span><span>Abrir →</span></a>` : ''}
      <div class="grid2">
        <div class="card kpi"><span class="small mute">Pago pelos contratantes no mês</span><div class="v">${brl(m.total, 2)}</div><span class="small mute">${m.n} pagamento(s)</span></div>
        <div class="card kpi"><span class="small mute">DebCare no mês (15%)</span><div class="v">${brl(m.debcare, 2)}</div><span class="small mute">entra pelo split do Mercado Pago</span></div>
        <div class="card kpi"><span class="small mute">Mind no mês (10%)</span><div class="v">${brl(m.mind, 2)}</div><span class="small mute">a repassar pela DebCare</span></div>
        <div class="card kpi"><span class="small mute">Profissionais</span><div class="v">${pros.length}</div><span class="small mute">${pros.filter((p) => p.publicado).length} no catálogo · ${pros.filter((p) => p.publicado && !p.verificado).length} sem selo</span></div>
        <div class="card kpi"><span class="small mute">Contratantes</span><div class="v">${(cl.data || []).length}</div></div>
        <div class="card kpi"><span class="small mute">Pedidos na central</span><div class="v">${abertas}</div></div>
      </div>
      <div class="card col"><h2>Funil de contratações</h2><div class="grid2">${Object.keys(DC.STATUS).map((s) => `<div class="row"><span class="grow">${DC.stTag(s)}</span><b>${conta(s)}</b></div>`).join('')}</div></div>`;
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
      <div class="row"><b>#${n.codigo} · ${esc(DC.espec(n.especialidade))}</b>${DC.necTag(n.status)}<span class="small mute right">${new Date(n.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div>
      <div class="grid2 small">
        <div><span class="tiny mute">CONTRATANTE</span><br><b>${esc(n.cliente_nome)}</b> · ${esc(DC.telBonito(TEL[n.cliente_id]))}</div>
        <div><span class="tiny mute">PACIENTE</span><br><b>${esc(n.paciente_nome)}</b>${n.paciente_idade != null ? ', ' + n.paciente_idade + ' anos' : ''}</div>
        <div><span class="tiny mute">QUANDO</span><br>${n.inicio ? DC.data(n.inicio) : '—'}${n.fim ? ' a ' + DC.data(n.fim) : ''} · ${{ dia: 'diurno', noite: 'noturno', '24h': '24 horas', horas: 'algumas horas' }[n.turno]}</div>
        <div><span class="tiny mute">ONDE</span><br>${esc(DC.LOCAL[n.local_tipo])} · ${esc([n.endereco, n.cidade].filter(Boolean).join(', '))}</div>
      </div>
      ${n.cuidados ? `<p class="small" style="white-space:pre-wrap"><b>Cuidados:</b> ${esc(n.cuidados)}</p>` : ''}
      ${n.observacoes ? `<p class="small" style="white-space:pre-wrap"><b>Obs.:</b> ${esc(n.observacoes)}</p>` : ''}
      <p class="small mute">${n.genero_pref ? 'Prefere profissional ' + (n.genero_pref === 'feminino' ? 'mulher' : 'homem') + ' · ' : ''}${n.orcamento ? 'Orçamento ' + brl(n.orcamento) : 'Sem orçamento informado'}</p>
      <label class="f">Nota da central (o contratante vê)<input class="in" data-nota="${n.id}" value="${esc(n.nota_central)}" maxlength="300" placeholder="ex.: Estamos falando com 2 cuidadoras da região"></label>
      <div class="row">${ativa(n) ? `<button class="btn btn-sm" data-ind="${n.id}">Indicar profissional</button>` : ''}
        ${TEL[n.cliente_id] ? `<a class="btn btn-sm btn-ghost" href="${esc(DC.wa(TEL[n.cliente_id], 'Olá, ' + n.cliente_nome.split(' ')[0] + '! Aqui é da central DebCare, sobre o seu pedido #' + n.codigo + '.'))}" target="_blank" rel="noopener">WhatsApp do contratante</a>` : ''}
        <select class="in" data-st="${n.id}" style="width:auto;min-height:36px">${Object.entries(DC.NEC).map(([k, v]) => `<option value="${k}" ${n.status === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></div></div>`;
    app.innerHTML = `<div class="head"><div><h1>Central</h1><p>Pedidos de quem não encontrou no catálogo. Indique um profissional: o pedido vai para ele aceitar e o contratante paga pelo app.</p></div></div>
      ${N.filter(ativa).map(card).join('') || '<div class="card empty"><b>Nenhum pedido esperando</b>Quando um contratante pedir ajuda, aparece aqui.</div>'}
      ${N.some((n) => !ativa(n)) ? `<div class="card col"><h2>Histórico</h2><div class="list">${N.filter((n) => !ativa(n)).map((n) => `<div class="li small"><span class="grow">#${n.codigo} · ${esc(n.cliente_nome)} · ${esc(DC.espec(n.especialidade))}</span>${DC.necTag(n.status)}</div>`).join('')}</div></div>` : ''}`;
    $$('[data-nota]').forEach((i) => (i.onchange = async () => { const { error } = await sb.from('necessidades').update({ nota_central: i.value.trim() }).eq('id', i.dataset.nota); if (error) DC.erro(error); else DC.toast('Nota salva'); }));
    $$('[data-st]').forEach((s) => (s.onchange = async () => { const { error } = await sb.from('necessidades').update({ status: s.value }).eq('id', s.dataset.st); if (error) DC.erro(error); else { DC.toast('Status atualizado'); central(); } }));
    $$('[data-ind]').forEach((b) => (b.onclick = () => indicar(N.find((n) => n.id === b.dataset.ind))));
  }
  async function indicar(n) {
    const [{ data: P }, din] = await Promise.all([sb.from('pros').select('*').eq('publicado', true).order('verificado', { ascending: false }), Promise.resolve(null)]);
    const tx = { d: +(DC.cfg.taxa_debcare ?? 15), m: +(DC.cfg.taxa_mind ?? 10) };
    const L = (P || []).sort((a, z) => (z.especialidade === n.especialidade) - (a.especialidade === n.especialidade));
    const st = { pro: null, mod: n.turno === '24h' ? 'plantao24' : 'hora', semana: [0, 1, 2, 3, 4, 5, 6] };
    const m = DC.modal(`<h2>Indicar profissional · pedido #${n.codigo}</h2><p class="small mute">${esc(n.cliente_nome)} · ${esc(DC.espec(n.especialidade))} · ${esc(n.cidade || '')}</p>
      <label class="f">Profissional<select class="in" id="pp"><option value="">Escolha</option>${L.map((p) => `<option value="${p.user_id}">${esc(p.nome)} · ${esc(DC.espec(p.especialidade))}${p.cidade ? ' · ' + esc(p.cidade) : ''}${p.verificado ? ' ✓' : ''} · ${brl(p.valor_hora, 2)}/h</option>`).join('')}</select></label>
      <div class="seg" id="md">${Object.entries(DC.MODAL).map(([k, v]) => `<button type="button" data-m="${k}" class="${k === st.mod ? 'on' : ''}">${v.nome}</button>`).join('')}</div>
      <div class="grid2">
        <label class="f">Primeiro dia<input class="in" type="date" id="ini" value="${n.inicio && n.inicio >= DC.hoje() ? n.inicio : DC.hoje()}" min="${DC.hoje()}"></label>
        <label class="f">Último dia<input class="in" type="date" id="fim" value="${n.fim && n.fim >= DC.hoje() ? n.fim : (n.inicio && n.inicio >= DC.hoje() ? n.inicio : DC.hoje())}" min="${DC.hoje()}"></label>
        <label class="f">Horário<input class="in" type="time" id="hor" value="${n.turno === 'noite' ? '19:00' : '07:00'}"></label>
        <label class="f" id="hdL">Horas por dia<input class="in" type="number" id="hd" min="1" max="24" value="${n.horas_dia || 12}"></label>
      </div>
      <div class="sem" id="sem">${DC.SEMANA.map((d, i) => `<button type="button" data-d="${i}" class="on">${d}</button>`).join('')}</div>
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
      $('#prev', m.el).innerHTML = `<div class="grid2 small"><div>Contratante paga<br><b>${brl(cli, 2)}</b></div><div>Profissional recebe<br><b>${brl(pro, 2)}</b></div><div>DebCare<br><b>${brl(pro * tx.d / 100, 2)}</b></div><div>Mind<br><b>${brl(cli - pro - pro * tx.d / 100, 2)}</b></div></div><span class="tiny mute">${dias.length} dia(s) · ${q} ${st.mod === 'hora' ? 'horas' : 'plantões'}</span>`;
    };
    $$('#md button', m.el).forEach((b) => (b.onclick = () => { st.mod = b.dataset.m; $$('#md button', m.el).forEach((x) => x.classList.toggle('on', x === b)); draw(); }));
    $$('#sem button', m.el).forEach((b) => (b.onclick = () => { const d = +b.dataset.d; st.semana = st.semana.includes(d) ? st.semana.filter((x) => x !== d) : [...st.semana, d]; b.classList.toggle('on'); draw(); }));
    ['#pp', '#ini', '#fim', '#hd'].forEach((s) => ($(s, m.el).oninput = draw)); $('#pp', m.el).onchange = draw;
    draw();
    $('#env', m.el).onclick = () => DC.busy($('#env', m.el), async () => {
      if (!$('#pp', m.el).value) throw new Error('Escolha o profissional');
      const r = await DC.api('/api/contratar', { acao: 'indicar', necessidade_id: n.id, pro_id: $('#pp', m.el).value, modalidade: st.mod, inicio: $('#ini', m.el).value, fim: $('#fim', m.el).value,
        horario: $('#hor', m.el).value, horas_dia: +$('#hd', m.el).value, dias_semana: st.semana });
      m.close(); DC.toast(`Enviado ao profissional · contratante pagará ${brl(r.total_cliente, 2)}`); central();
    });
  }

  // ------------------------------------------------------------------ contratações
  async function contratacoes() {
    const { data, error } = await sb.from('contratacoes').select('*,contratacao_split(pro,debcare,mind),contratacao_cliente(total)').order('updated_at', { ascending: false }).limit(500);
    if (error) throw error;
    let fs = '';
    app.innerHTML = `<div class="head"><div><h1>Contratações</h1><p>Todas as contratações com a divisão de valores. O contratante e o profissional não veem esta divisão.</p></div>
      <select class="in" id="fs" style="width:auto"><option value="">Todos os status</option>${Object.entries(DC.STATUS).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select></div>
      <div class="card"><div class="tbl-box"><table class="tbl"><thead><tr><th>#</th><th>Contratante → profissional</th><th>Período</th><th>Contratante paga</th><th>Profissional</th><th>DebCare</th><th>Mind</th><th>Status</th><th></th></tr></thead><tbody id="tb"></tbody></table></div></div>`;
    const draw = () => {
      $('#tb').innerHTML = (data || []).filter((c) => !fs || c.status === fs).map((c) => { const s = um(c.contratacao_split), v = um(c.contratacao_cliente); return `<tr>
        <td class="small">${c.codigo}</td><td><b>${esc(c.cliente_nome)}</b> → ${esc(c.pro_nome)}<br><span class="small mute">${esc(DC.espec(c.especialidade))} · ${esc(DC.MODAL[c.modalidade].nome)}${c.origem === 'central' ? ' · central' : ''}</span></td>
        <td class="small">${DC.periodo(c)}<br>${esc(DC.qtdTxt(c))}</td><td><b>${brl(v.total, 2)}</b></td><td>${brl(s.pro, 2)}</td><td>${brl(s.debcare, 2)}</td><td>${brl(s.mind, 2)}</td>
        <td>${DC.stTag(c.status)}</td><td><button class="btn btn-sm btn-ghost" data-c="${c.id}">Abrir</button></td></tr>`; }).join('') || '<tr><td colspan="9" class="mute">Nenhuma contratação.</td></tr>';
      $$('[data-c]').forEach((b) => (b.onclick = () => DC.abrirContratacao(b.dataset.c, 'admin', contratacoes)));
    };
    $('#fs').onchange = (e) => { fs = e.target.value; draw(); };
    draw();
  }

  // ------------------------------------------------------------------ profissionais
  async function profissionais() {
    const [{ data, error }, pv, pf] = await Promise.all([sb.from('pros').select('*').order('created_at', { ascending: false }), sb.from('pro_privado').select('*'), sb.from('profiles').select('id,telefone').eq('role', 'pro')]);
    if (error) throw error;
    const PV = Object.fromEntries((pv.data || []).map((x) => [x.user_id, x]));
    const TEL = Object.fromEntries((pf.data || []).map((x) => [x.id, x.telefone]));
    app.innerHTML = `<div class="head"><div><h1>Profissionais</h1><p>Confira documentos e o COREN no site do conselho antes de dar o selo DebCare.</p></div><input class="in" id="q" placeholder="Buscar" style="max-width:280px" aria-label="Buscar profissionais"></div>
      <div class="card"><div class="tbl-box"><table class="tbl"><thead><tr><th>Profissional</th><th>Valores (dele)</th><th>COREN</th><th>Documentos</th><th>Catálogo</th><th>Selo</th><th></th></tr></thead><tbody id="tb"></tbody></table></div></div>`;
    const docs = (u) => { const x = PV[u] || {}; return [['doc_identidade', 'Identidade'], ['doc_coren', 'COREN'], ['doc_antecedentes', 'Antecedentes']].map(([k, n]) => x[k] ? `<button class="link small" data-doc="${esc(x[k])}">${n}</button>` : `<span class="tiny mute">${n} —</span>`).join('<br>') + (x.cpf ? `<br><span class="tiny">CPF ${esc(x.cpf)}</span>` : ''); };
    const draw = () => {
      const q = DC.norm($('#q').value);
      $('#tb').innerHTML = (data || []).filter((p) => !q || DC.norm(p.nome + p.titulo + p.cidade).includes(q)).map((p) => `<tr>
        <td><b>${esc(p.nome)}</b><br><span class="small mute">${esc(DC.espec(p.especialidade))}${p.cidade ? ' · ' + esc(p.cidade) : ''} · ${esc(DC.telBonito(TEL[p.user_id]))}</span></td>
        <td class="small">${p.valor_hora ? brl(p.valor_hora, 2) + '/h' : '—'}${p.valor_12h ? '<br>' + brl(p.valor_12h, 2) + '/12h' : ''}${p.valor_24h ? '<br>' + brl(p.valor_24h, 2) + '/24h' : ''}</td>
        <td class="small">${esc(p.coren || '—')}${p.coren_uf ? '/' + esc(p.coren_uf) : ''}</td><td>${docs(p.user_id)}</td>
        <td><label class="check"><input type="checkbox" data-pub="${p.user_id}" ${p.publicado ? 'checked' : ''}>Publicado</label></td>
        <td><label class="check"><input type="checkbox" data-ver="${p.user_id}" ${p.verificado ? 'checked' : ''}>Selo</label></td>
        <td><button class="btn btn-sm btn-ghost" data-senha="${p.user_id}">Nova senha</button></td></tr>`).join('') || '<tr><td colspan="7" class="mute">Nenhum profissional.</td></tr>';
      $$('[data-ver]').forEach((c) => (c.onchange = async () => { const { error: e } = await sb.from('pros').update({ verificado: c.checked }).eq('user_id', c.dataset.ver); if (e) { DC.erro(e); c.checked = !c.checked; } else DC.toast(c.checked ? 'Selo DebCare concedido' : 'Selo removido'); }));
      $$('[data-pub]').forEach((c) => (c.onchange = async () => { const { error: e } = await sb.from('pros').update({ publicado: c.checked }).eq('user_id', c.dataset.pub); if (e) { DC.erro(e); c.checked = !c.checked; } else DC.toast(c.checked ? 'No catálogo' : 'Fora do catálogo'); }));
      $$('[data-doc]').forEach((b) => (b.onclick = async () => { const { data: u, error: e } = await sb.storage.from('docs').createSignedUrl(b.dataset.doc, 300); if (e) return DC.erro(e); window.open(u.signedUrl, '_blank', 'noopener'); }));
      $$('[data-senha]').forEach((b) => (b.onclick = () => novaSenha(b, b.dataset.senha)));
    };
    $('#q').oninput = draw; draw();
  }
  async function novaSenha(btn, userId) {
    if (!(await DC.confirm('Gerar uma senha nova para esta pessoa?', 'Gerar senha'))) return;
    DC.busy(btn, async () => {
      const r = await DC.api('/api/senha', { user_id: userId });
      DC.modal(`<h2>Senha nova de ${esc(r.nome.split(' ')[0])}</h2><p class="price">${esc(r.senha)}</p><p class="small mute">Envie pelo WhatsApp e peça para trocar depois em Conta.</p>
        <div class="acts"><button class="btn btn-ghost" data-close>Fechar</button><a class="btn btn-green" target="_blank" rel="noopener" href="${esc(DC.wa(r.telefone, `Olá, ${r.nome.split(' ')[0]}! Sua senha nova do DebCare é ${r.senha}. Entre com seu celular e essa senha e troque por uma sua.`))}">Enviar no WhatsApp</a></div>`, { semFoco: true });
    });
  }

  // ------------------------------------------------------------------ contratantes
  async function contratantes() {
    const [{ data, error }, ct, ne] = await Promise.all([sb.from('profiles').select('*').eq('role', 'cliente').order('created_at', { ascending: false }), sb.from('contratacoes').select('cliente_id,status'), sb.from('necessidades').select('cliente_id')]);
    if (error) throw error;
    const n = (L, id, f) => (L || []).filter((x) => x.cliente_id === id && (!f || f(x))).length;
    app.innerHTML = `<div class="head"><div><h1>Contratantes</h1></div></div><div class="card"><div class="tbl-box"><table class="tbl"><thead><tr><th>Contratante</th><th>Celular</th><th>Contratações</th><th>Pagas</th><th>Pedidos à central</th><th>Desde</th><th></th></tr></thead><tbody>
      ${(data || []).map((p) => `<tr><td><b>${esc(p.nome)}</b>${p.email ? `<br><span class="small mute">${esc(p.email)}</span>` : ''}</td><td class="small"><a href="${esc(DC.wa(p.telefone))}" target="_blank" rel="noopener">${esc(DC.telBonito(p.telefone))}</a></td>
        <td>${n(ct.data, p.id)}</td><td>${n(ct.data, p.id, (x) => ['confirmado', 'concluido'].includes(x.status))}</td><td>${n(ne.data, p.id)}</td><td class="small">${DC.data(p.created_at)}</td>
        <td><button class="btn btn-sm btn-ghost" data-senha="${p.id}">Nova senha</button></td></tr>`).join('') || '<tr><td colspan="7" class="mute">Nenhum contratante ainda.</td></tr>'}</tbody></table></div></div>`;
    $$('[data-senha]').forEach((b) => (b.onclick = () => novaSenha(b, b.dataset.senha)));
  }

  // ------------------------------------------------------------------ financeiro e repasse à Mind
  async function financeiro() {
    const { meses, R, devido } = await dinheiro();
    const K = Object.keys(meses).sort().reverse();
    app.innerHTML = `<div class="head"><div><h1>Financeiro</h1><p>O contratante paga ao profissional pelo Mercado Pago; 25% (DebCare 15% + Mind 10%) caem na conta da DebCare pelo split. A DebCare repassa os 10% da Mind.</p></div>
      <button class="btn" id="rep">Registrar repasse à Mind</button></div>
      ${alertaMind(devido, false) || '<div class="banner ok">Nada a repassar à Mind agora.</div>'}
      <div class="card"><div class="tbl-box"><table class="tbl"><thead><tr><th>Mês</th><th>Pagamentos</th><th>Contratantes pagaram</th><th>Profissionais</th><th>DebCare</th><th>Mind (devido)</th><th>Repassado</th><th>A repassar</th></tr></thead><tbody>
        ${K.map((k) => { const x = meses[k], f = x.mind - x.repassado; return `<tr><td>${mesNome(k)}</td><td>${x.n}</td><td>${brl(x.total, 2)}</td><td>${brl(x.pro, 2)}</td><td>${brl(x.debcare, 2)}</td><td>${brl(x.mind, 2)}</td><td>${brl(x.repassado, 2)}</td><td>${f > 0.009 ? `<b style="color:var(--red)">${brl(f, 2)}</b>` : '<span class="tag t-green">EM DIA</span>'}</td></tr>`; }).join('') || '<tr><td colspan="8" class="mute">Nenhum pagamento aprovado ainda.</td></tr>'}</tbody></table></div></div>
      <div class="card col"><h2>Repasses feitos à Mind</h2>${R.length ? `<div class="list">${R.map((r) => `<div class="li small"><span class="grow"><b>${brl(r.valor, 2)}</b> · referência ${esc(r.referencia.split('-').reverse().join('/'))}${r.nota ? ' · ' + esc(r.nota) : ''}</span><span class="mute">${DC.data(r.pago_em)}</span></div>`).join('')}</div>` : '<p class="small mute">Nenhum repasse registrado.</p>'}</div>`;
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

  // ------------------------------------------------------------------ taxas e central
  async function config() {
    const { data } = await sb.from('config').select('key,value');
    const C = Object.fromEntries((data || []).map((x) => [x.key, x.value]));
    app.innerHTML = `<div class="head"><div><h1>Taxas e central</h1><p>As taxas são somadas por cima do valor do profissional e valem para os próximos pedidos.</p></div></div>
      <div class="grid2" style="max-width:900px">
        <div class="card col"><h2>DebCare</h2><label class="f">Taxa DebCare (%)<input class="in" id="td" type="number" min="0" max="100" step="0.5" value="${+C.taxa_debcare}"></label></div>
        <div class="card col"><h2>Mind (gestora da plataforma)</h2><label class="f">Taxa Mind (%)<input class="in" id="tm" type="number" min="0" max="100" step="0.5" value="${+C.taxa_mind}"></label></div>
        <div class="card col"><h2>Exemplo</h2><p class="small" id="ex"></p></div>
        <div class="card col"><h2>Central</h2>
          <label class="f">WhatsApp da central<small>aparece para contratantes e no "esqueci a senha"</small><input class="in" id="cw" value="${esc(DC.telBonito(C.central_whatsapp || ''))}" placeholder="(16) 99999-0000"></label>
          <label class="f">E-mail da central<small>recebe aviso de novos pedidos (opcional)</small><input class="in" id="ce" type="email" value="${esc(C.central_email || '')}"></label></div>
        <div class="card col"><h2>Equipe com acesso ao painel</h2><p class="small mute">Celulares com DDD, um por linha. Viram administradores ao criar a conta.</p><textarea class="in" id="adm">${esc((C.admins || []).map(DC.telBonito).join('\n'))}</textarea></div>
      </div>
      <button class="btn" id="sv" style="align-self:flex-start">Salvar</button>`;
    const ex = () => { const d = +$('#td').value || 0, m = +$('#tm').value || 0; $('#ex').innerHTML = `Profissional pede <b>R$ 100</b> → contratante vê <b>${brl(100 * (1 + (d + m) / 100), 2)}</b> · DebCare ${brl(d, 2)} · Mind ${brl(m, 2)}`; };
    $('#td').oninput = ex; $('#tm').oninput = ex; ex();
    $('#sv').onclick = () => DC.busy($('#sv'), async () => {
      const adm = $('#adm').value.split(/\n|,|;/).map((x) => DC.tel(x)).filter(Boolean);
      if (!adm.length) throw new Error('Mantenha ao menos um celular da equipe');
      const cw = $('#cw').value.trim() ? DC.tel($('#cw').value) : '';
      if (cw === null) throw new Error('WhatsApp da central inválido');
      const vals = [['taxa_debcare', +$('#td').value], ['taxa_mind', +$('#tm').value], ['central_whatsapp', cw], ['central_email', $('#ce').value.trim()], ['admins', adm]];
      for (const [k, v] of vals) {
        const { error } = await sb.from('config').upsert({ key: k, value: v, updated_at: new Date().toISOString() }); if (error) throw error;
      }
      DC.cfg = Object.fromEntries(vals); DC.toast('Configurações salvas');
    });
  }

  // abas: iniciadas por último, depois de todas as funções existirem
  DC.tabs(['visao', 'central', 'contratacoes', 'profissionais', 'contratantes', 'financeiro', 'config'], (t) => {
    app.innerHTML = '<div class="empty"><span class="spin"></span></div>';
    ({ visao, central, contratacoes, profissionais, contratantes, financeiro, config })[t]().catch(DC.erro);
  });
})();

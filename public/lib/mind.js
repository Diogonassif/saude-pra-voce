/* Saúde Pra Você · Painel Mind: o gestor da Mind entra no app como qualquer perfil e acompanha o repasse */
(async function () {
  const { $, $$, sb, esc, brl } = DC;
  const me = await DC.boot('mind'); if (!me) return;
  DC.topo(me, [['painel', 'Painel']], 'Mind');
  const app = $('#app');

  const perfis = [
    ['/cliente.html', 'Contratante', 'Catálogo, contratar um profissional, pagar, pedir à central e acompanhar as contratações.', 'Ver como contratante'],
    ['/pro.html', 'Profissional de saúde', 'Perfil e valores, COREN, pedidos, agenda e recebimentos. Usa o seu perfil de profissional de teste.', 'Ver como profissional'],
    ['/admin.html', 'Gestão (Central)', 'Visão geral, pedidos da central, contratações, profissionais, COREN, financeiro e taxas.', 'Entrar na gestão'],
  ];

  async function painel() {
    const [pg, rp, pr, cl, ct] = await Promise.all([
      sb.from('pagamentos').select('id,valor_total,taxa,debcare,mind,status,mp_payment_id,updated_at,contratacoes(id,codigo,cliente_nome,pro_nome,especialidade,inicio,fim)').eq('status', 'approved').order('updated_at', { ascending: false }),
      sb.from('repasses_mind').select('valor,pago_em,referencia,nota').order('pago_em', { ascending: false }),
      sb.from('pros').select('user_id,publicado,especialidade,coren,coren_status'),
      sb.from('profiles').select('id').eq('role', 'cliente'),
      sb.from('contratacoes').select('id,status'),
    ]);
    const P = pg.data || [], R = rp.data || [], pros = pr.data || [], C = ct.data || [];
    const mindTotal = P.reduce((s, p) => s + +p.mind, 0), repassado = R.reduce((s, r) => s + +r.valor, 0);
    const devido = Math.round((mindTotal - repassado) * 100) / 100;
    const corenFila = pros.filter((p) => DC.ESPEC[p.especialidade] && DC.ESPEC[p.especialidade].coren && p.coren && p.coren_status === 'pendente').length;

    app.innerHTML = `<div class="head"><div><h1>Painel Mind</h1><p>Olá, ${esc((me.nome || '').split(' ')[0])}. Entre no app como qualquer perfil. Em todas as telas o botão <b>Mind</b>, no topo, traz você de volta.</p></div></div>
      <div class="grid2">${perfis.map(([href, nome, txt, bt]) => `<div class="card col"><h2>${nome}</h2><p class="small mute grow">${txt}</p><a class="btn btn-block" href="${href}">${bt}</a></div>`).join('')}</div>
      ${extrato(P, R, devido)}
      <div class="grid2">
        <div class="card kpi go" data-ext="1" title="Toque para ver os lançamentos"><span class="small mute">Mind: total dos 10%</span><div class="v">${brl(mindTotal, 2)}</div><span class="small mute">${P.length} pagamento(s) aprovado(s)</span></div>
        <div class="card kpi go" data-ext="1" title="Toque para ver os lançamentos"><span class="small mute">Já repassado à Mind</span><div class="v">${brl(repassado, 2)}</div><span class="small mute">${R.length ? 'último em ' + DC.data(R[0].pago_em) : 'nenhum repasse ainda'}</span></div>
        <div class="card kpi go" data-href="/admin.html#profissionais" title="Toque para ver os profissionais"><span class="small mute">Profissionais</span><div class="v">${pros.length}</div><span class="small mute">${pros.filter((p) => p.publicado).length} publicado(s) · ${corenFila} COREN a conferir</span></div>
        <div class="card kpi go" data-href="/admin.html#contratantes" title="Toque para ver os contratantes"><span class="small mute">Contratantes</span><div class="v">${(cl.data || []).length}</div><span class="small mute">${C.length} contratação(ões) · ${C.filter((c) => ['confirmado', 'concluido'].includes(c.status)).length} paga(s)</span></div>
      </div>
      <div class="card col"><h2>Links</h2><div class="list small">
        ${[['Site', 'https://saudepravoce.com/'], ['Página para contratantes', '/contratante.html'], ['Página para profissionais', '/profissional.html'],
           ['Vercel (publicação)', 'https://vercel.com/diogo-3765/saude-pra-voce'], ['Supabase (banco)', 'https://supabase.com/dashboard/project/daqmpctkcilfzweqdthh'], ['GitHub (código)', 'https://github.com/Diogonassif/saude-pra-voce']]
          .map(([n, u]) => `<div class="li"><span class="grow">${n}</span><a href="${u}" target="_blank" rel="noopener">abrir</a></div>`).join('')}
      </div></div>`;
    $$('[data-ext]').forEach((b) => (b.onclick = () => { const d = $('details.extrato'); if (d) { d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }));
    $$('[data-href]').forEach((b) => (b.onclick = () => { location.href = b.dataset.href; }));
  }

  // extrato expansível: cada atendimento pago (10% da Mind), os repasses registrados e o saldo, por mês
  function extrato(P, R, devido) {
    const ref = (iso) => new Date(new Date(iso).getTime() - 3 * 3600e3).toISOString().slice(0, 7);
    const mesNome = (k) => { const t = new Date(k + '-15T12:00:00Z').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }); return t[0].toUpperCase() + t.slice(1); };
    const dh = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    const meses = {};
    P.forEach((p) => { (meses[ref(p.updated_at)] ||= { P: [], R: [] }).P.push(p); });
    R.forEach((r) => { (meses[r.referencia] ||= { P: [], R: [] }).R.push(r); });
    const K = Object.keys(meses).sort().reverse();
    const titulo = devido > 0.009 ? `<b>A Saúde Pra Você deve ${brl(devido, 2)} à Mind</b> (10% dos atendimentos pagos, menos os repasses registrados).` : '<b>Nada pendente de repasse à Mind.</b>';
    if (!K.length) return `<div class="banner ok">${titulo}</div>`;
    return `<details class="banner ${devido > 0.009 ? 'alerta' : 'ok'} extrato"><summary>${titulo} <span class="abre"><span class="a1">Ver lançamentos</span><span class="a2">Fechar lançamentos</span></span></summary>
      ${K.map((k) => { const x = meses[k]; const dev = x.P.reduce((t, p) => t + +p.mind, 0), pago = x.R.reduce((t, r) => t + +r.valor, 0), saldo = Math.round((dev - pago) * 100) / 100;
        return `<div class="ext-mes"><div class="row" style="justify-content:space-between"><b>${mesNome(k)}</b><span class="small">Mind ${brl(dev, 2)} · repassado ${brl(pago, 2)} · ${saldo > 0.009 ? `<b style="color:var(--red)">a pagar ${brl(saldo, 2)}</b>` : '<span class="tag t-green">EM DIA</span>'}</span></div>
          <div class="tbl-box"><table class="tbl small"><thead><tr><th>Data do pagamento</th><th>Atendimento</th><th>Contratante pagou</th><th>Saúde Pra Você (15%)</th><th>Mind (10%)</th></tr></thead><tbody>
            ${x.P.map((p) => { const c = p.contratacoes || {}; return `<tr><td>${dh(p.updated_at)}</td><td>#${esc(c.codigo ?? '')} ${esc(c.cliente_nome || '')} → ${esc(c.pro_nome || '')}<br><span class="tiny mute">${esc(DC.espec(c.especialidade))}${c.inicio ? ' · ' + DC.periodo(c) : ''}${p.mp_payment_id ? ' · MP ' + esc(p.mp_payment_id) : ''}</span></td><td>${brl(p.valor_total, 2)}</td><td>${brl(p.debcare, 2)}</td><td><b>${brl(p.mind, 2)}</b></td></tr>`; }).join('') || '<tr><td colspan="5" class="mute">Nenhum atendimento pago neste mês.</td></tr>'}
            ${x.R.map((r) => `<tr class="rep"><td>${DC.data(r.pago_em)}</td><td colspan="3">Repasse registrado pela Saúde Pra Você${r.nota ? ' · ' + esc(r.nota) : ''}</td><td><b style="color:var(--green)">− ${brl(r.valor, 2)}</b></td></tr>`).join('')}
          </tbody></table></div></div>`; }).join('')}
      <p class="tiny mute">O repasse é registrado pela Saúde Pra Você na Gestão → Financeiro → "Registrar repasse à Mind".</p></details>`;
  }

  DC.tabs(['painel'], painel);
})();

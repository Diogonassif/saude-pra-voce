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
      sb.from('pagamentos').select('valor_total,mind,status').eq('status', 'approved'),
      sb.from('repasses_mind').select('valor,pago_em').order('pago_em', { ascending: false }),
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
      ${devido > 0.009 ? `<div class="banner alerta"><b>A Saúde Pra Você deve ${brl(devido, 2)} à Mind</b> (10% dos atendimentos pagos, menos os repasses registrados).</div>` : '<div class="banner ok">Nada pendente de repasse à Mind.</div>'}
      <div class="grid2">
        <div class="card kpi"><span class="small mute">Mind: total dos 10%</span><div class="v">${brl(mindTotal, 2)}</div><span class="small mute">${P.length} pagamento(s) aprovado(s)</span></div>
        <div class="card kpi"><span class="small mute">Já repassado à Mind</span><div class="v">${brl(repassado, 2)}</div><span class="small mute">${R.length ? 'último em ' + DC.data(R[0].pago_em) : 'nenhum repasse ainda'}</span></div>
        <div class="card kpi"><span class="small mute">Profissionais</span><div class="v">${pros.length}</div><span class="small mute">${pros.filter((p) => p.publicado).length} publicado(s) · ${corenFila} COREN a conferir</span></div>
        <div class="card kpi"><span class="small mute">Contratantes</span><div class="v">${(cl.data || []).length}</div><span class="small mute">${C.length} contratação(ões) · ${C.filter((c) => ['confirmado', 'concluido'].includes(c.status)).length} paga(s)</span></div>
      </div>
      <div class="card col"><h2>Links</h2><div class="list small">
        ${[['Site', 'https://saude-pra-voce.vercel.app/'], ['Página para contratantes', '/contratante.html'], ['Página para profissionais', '/profissional.html'],
           ['Vercel (publicação)', 'https://vercel.com/diogo-3765/saude-pra-voce'], ['Supabase (banco)', 'https://supabase.com/dashboard/project/daqmpctkcilfzweqdthh'], ['GitHub (código)', 'https://github.com/Diogonassif/saude-pra-voce']]
          .map(([n, u]) => `<div class="li"><span class="grow">${n}</span><a href="${u}" target="_blank" rel="noopener">abrir</a></div>`).join('')}
      </div></div>`;
  }

  DC.tabs(['painel'], painel);
})();

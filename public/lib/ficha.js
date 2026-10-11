/* Saúde Pra Você · ficha da contratação (usada pelo contratante, pelo profissional e pela central) */
(function () {
  const { $, $$, sb, esc, brl } = DC;

  DC.abrirContratacao = async function (id, papel, recarregar) {
    let canal = null;
    const m = DC.modal('<div class="empty"><span class="spin"></span></div>', { wide: true, semFoco: true,
      onClose: () => { if (canal) sb.removeChannel(canal); if (recarregar) recarregar(); } });

    async function carregar() {
      const [cq, vq, sq, mq, aq] = await Promise.all([
        sb.from('contratacoes').select('*').eq('id', id).single(),
        papel === 'pro' ? sb.from('contratacao_pro').select('*').eq('contratacao_id', id).maybeSingle()
          : sb.from('contratacao_cliente').select('*').eq('contratacao_id', id).maybeSingle(),
        papel === 'admin' ? sb.from('contratacao_split').select('*').eq('contratacao_id', id).maybeSingle() : Promise.resolve({ data: null }),
        sb.from('mensagens').select('*').eq('contratacao_id', id).order('created_at').limit(500),
        sb.from('avaliacoes').select('*').eq('contratacao_id', id).maybeSingle(),
      ]);
      if (cq.error) throw cq.error;
      const c = cq.data;
      const contato = ['confirmado', 'concluido'].includes(c.status) && papel !== 'admin' ? (await sb.rpc('contato', { c: id })).data : null;
      return { c, v: vq.data, sp: sq.data, msgs: mq.data || [], av: aq.data, contato };
    }

    async function render() {
      let d; try { d = await carregar(); } catch (e) { m.el.innerHTML = `<p>${esc(e.message)}</p><div class="acts"><button class="btn" data-close>Fechar</button></div>`; return; }
      const { c, v, sp, msgs, av, contato } = d;
      const eu = DC.me.id;
      const souPro = papel === 'pro', souCli = papel === 'cliente', souAdm = papel === 'admin';
      const pago = ['confirmado', 'concluido'].includes(c.status);
      const outro = souPro ? c.cliente_nome : c.pro_nome;
      const un = DC.MODAL[c.modalidade].un;
      const semana = (c.dias_semana || []).length === 7 ? 'todos os dias' : (c.dias_semana || []).map((x) => DC.SEMANA[x]).join(', ');
      const ende = pago || souCli || souAdm ? c.endereco : (c.cidade || 'Endereço completo aparece depois do pagamento');

      let valores = '';
      if (souCli && v) valores = `<div class="resumo-total"><span class="small mute">Total do atendimento</span><span class="price">${brl(v.total, 2)}</span><span class="small mute">${brl(v.valor_unit, 2)}${un} · ${esc(DC.qtdTxt(c))}</span></div>`;
      if (souPro && v) valores = `<div class="resumo-total"><span class="small mute">Você recebe</span><span class="price">${brl(v.total, 2)}</span><span class="small mute">${brl(v.valor_unit, 2)}${un} · ${esc(DC.qtdTxt(c))}</span></div>`;
      if (souAdm && v && sp) valores = `<div class="grid2">
          <div class="card flat"><span class="small mute">Contratante paga</span><div class="price">${brl(v.total, 2)}</div><span class="tiny mute">${esc(DC.qtdTxt(c))}</span></div>
          <div class="card flat"><span class="small mute">Profissional recebe</span><div class="price">${brl(sp.pro, 2)}</div></div>
          <div class="card flat"><span class="small mute">Saúde Pra Você (${+sp.taxa_debcare_pct}%)</span><div class="price">${brl(sp.debcare, 2)}</div></div>
          <div class="card flat"><span class="small mute">Mind (${+sp.taxa_mind_pct}%)</span><div class="price">${brl(sp.mind, 2)}</div></div></div>`;

      let aviso = '';
      if (souCli && c.status === 'solicitado') aviso = `<div class="banner info">Pedido enviado para ${esc(c.pro_nome.split(' ')[0])}. Assim que aceitar, você paga aqui pelo app e o atendimento fica confirmado.</div>`;
      if (souCli && c.status === 'aceito') aviso = `<div class="banner ok"><b>${esc(c.pro_nome.split(' ')[0])} aceitou!</b> Pague pelo app (Pix ou cartão) para confirmar. O contato aparece aqui depois do pagamento.</div>`;
      if (souPro && c.status === 'solicitado') aviso = `<div class="banner">Confira os cuidados, as datas e o local. Ao aceitar, o contratante paga pelo app e os dias entram na sua agenda.</div>`;
      if (souPro && c.status === 'aceito') aviso = '<div class="banner info">Você aceitou. Aguardando o pagamento do contratante.</div>';
      if (c.status === 'recusado' || c.status === 'cancelado') aviso = `<div class="banner">${c.status === 'recusado' ? 'O profissional não pôde atender.' : 'Cancelado.'}${c.motivo ? ' Motivo: ' + esc(c.motivo) : ''}</div>`;
      if (pago && contato) aviso += `<div class="banner ok row" style="justify-content:space-between"><span>${souPro ? 'Contratante' : 'Profissional'}: <b>${esc(outro)}</b> · ${esc(DC.telBonito(contato))}</span><a class="btn btn-sm btn-green" href="${esc(DC.wa(contato, 'Olá! Sou ' + DC.me.nome.split(' ')[0] + ', do atendimento Saúde Pra Você #' + c.codigo + '.'))}" target="_blank" rel="noopener">WhatsApp</a></div>`;

      const fimPassou = c.fim <= DC.hoje();
      const avaliar = souCli && c.status === 'concluido' && !av
        ? `<form class="card flat col" id="avf"><h3>Como foi o atendimento de ${esc(c.pro_nome.split(' ')[0])}?</h3><div class="row" id="st">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="btn btn-sm btn-ghost" data-n="${n}" aria-label="${n} estrela(s)">${'★'.repeat(n)}</button>`).join('')}</div><textarea class="in" id="avc" maxlength="1000" placeholder="Conte como foi (aparece no perfil do profissional, sem o seu nome)"></textarea><button class="btn" id="avs" type="button" disabled>Enviar avaliação</button></form>` : '';

      m.el.innerHTML = `
        <div class="row"><span class="small mute">#${c.codigo}</span>${DC.stTag(c.status)}${c.origem === 'central' ? '<span class="tag t-blue">Indicado pela central</span>' : ''}<button class="btn btn-sm btn-ghost right" data-close aria-label="Fechar">✕</button></div>
        <h2>${esc(DC.espec(c.especialidade))} · ${esc(DC.MODAL[c.modalidade].nome.toLowerCase())}</h2>
        <p class="small mute">${souPro ? 'Contratante' : 'Profissional'}: <b>${esc(outro)}</b></p>
        ${aviso}
        <div class="grid2">
          <div class="col" style="gap:4px"><span class="tiny mute">QUANDO</span><b>${DC.periodo(c)}${c.horario ? ' · a partir das ' + c.horario.slice(0, 5) : ''}</b><span class="small">${esc(semana)} · ${esc(DC.qtdTxt(c))}</span></div>
          <div class="col" style="gap:4px"><span class="tiny mute">ONDE</span><b>${esc(DC.LOCAL[c.local_tipo])}</b><span class="small">${esc(ende)}</span></div>
          <div class="col" style="gap:4px"><span class="tiny mute">QUEM RECEBE O CUIDADO</span><b>${esc(c.paciente_nome)}${c.paciente_idade != null ? ', ' + c.paciente_idade + ' anos' : ''}</b>${c.cuidados ? `<span class="small" style="white-space:pre-wrap">${esc(c.cuidados)}</span>` : ''}</div>
          ${c.notas ? `<div class="col" style="gap:4px"><span class="tiny mute">OBSERVAÇÕES</span><span class="small" style="white-space:pre-wrap">${esc(c.notas)}</span></div>` : ''}
        </div>
        ${valores}
        ${avaliar}
        ${av ? `<p class="small">Avaliação: <span class="stars">${'★'.repeat(av.nota)}</span> ${esc(av.comentario)}</p>` : ''}
        <div class="row">
          ${souCli && c.status === 'aceito' ? '<button class="btn btn-green" id="pagar">Pagar e confirmar</button>' : ''}
          ${souPro && c.status === 'solicitado' ? '<button class="btn btn-green" id="aceitar">Aceitar pedido</button>' : ''}
          ${souPro && ['solicitado', 'aceito'].includes(c.status) ? '<button class="btn btn-red" id="recusar">Não posso atender</button>' : ''}
          ${(souCli && ['solicitado', 'aceito'].includes(c.status)) || (souAdm && ['solicitado', 'aceito', 'confirmado'].includes(c.status)) ? '<button class="btn btn-red" id="cancelar">Cancelar</button>' : ''}
          ${c.status === 'confirmado' && (souCli || souAdm || (souPro && fimPassou)) ? '<button class="btn btn-ghost" id="concluir">Marcar como concluído</button>' : ''}
        </div>
        <div class="col" style="border-top:1px solid var(--line);padding-top:14px"><h3>Conversa</h3>
          ${pago ? '' : '<p class="tiny mute">Telefones, e-mails e links ficam ocultos até o pagamento. Combine tudo por aqui com segurança.</p>'}
          <div class="chat" id="chat">${msgs.length ? '' : '<p class="small mute" id="semmsg">Nenhuma mensagem ainda.</p>'}</div>
          ${['recusado', 'cancelado'].includes(c.status) ? '' : '<form class="row" id="cf"><label class="sr" for="ct">Mensagem</label><input class="in grow" id="ct" maxlength="4000" placeholder="Escreva uma mensagem" autocomplete="off"><button class="btn" type="submit">Enviar</button></form>'}
        </div>`;

      const chat = $('#chat', m.el);
      const bolha = (x) => `<div data-mid="${x.id}" class="bub ${x.autor === eu ? 'out' : 'in'}">${esc(x.texto)}<small>${new Date(x.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small></div>`;
      const poe = (x) => { if (chat.querySelector(`[data-mid="${x.id}"]`)) return; const s = $('#semmsg', m.el); if (s) s.remove(); chat.insertAdjacentHTML('beforeend', bolha(x)); chat.scrollTop = chat.scrollHeight; };
      msgs.forEach(poe);
      if (canal) sb.removeChannel(canal);
      canal = sb.channel('ctr-' + id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens', filter: 'contratacao_id=eq.' + id }, (ev) => poe(ev.new)).subscribe();
      const cf = $('#cf', m.el);
      if (cf) cf.onsubmit = async (e) => {
        e.preventDefault(); const t = $('#ct', m.el).value.trim(); if (!t) return;
        $('#ct', m.el).value = '';
        const { data, error } = await sb.from('mensagens').insert({ contratacao_id: id, autor: eu, texto: t }).select().single();
        if (error) return DC.erro(error);
        poe(data);
      };

      const act = (sel, fn) => { const b = $(sel, m.el); if (b) b.onclick = () => DC.busy(b, fn); };
      const motivo = '<label class="f">Motivo (opcional)<textarea class="in" maxlength="300" style="min-height:70px"></textarea></label>';
      act('#aceitar', async () => { if (!(await DC.confirm('Aceitar este pedido?', 'Aceitar'))) return; await DC.api('/api/contratar', { acao: 'aceitar', id }); DC.toast('Pedido aceito. Avisamos o contratante.'); render(); });
      act('#recusar', async () => { const r = await DC.confirm('Recusar este pedido?', 'Recusar', motivo); if (!r) return; await DC.api('/api/contratar', { acao: 'recusar', id, motivo: r.valor }); DC.toast('Pedido recusado'); render(); });
      act('#cancelar', async () => { const r = await DC.confirm('Cancelar esta contratação?', 'Cancelar', motivo); if (!r) return; await DC.api('/api/contratar', { acao: 'cancelar', id, motivo: r.valor }); DC.toast('Cancelado'); render(); });
      act('#concluir', async () => { if (!(await DC.confirm('Marcar o atendimento como concluído?', 'Concluir'))) return; await DC.api('/api/contratar', { acao: 'concluir', id }); DC.toast('Atendimento concluído'); render(); });
      act('#pagar', async () => { const r = await DC.api('/api/pagar', { contratacao_id: id }); location.href = r.url; });
      let nota = 0;
      $$('#st [data-n]', m.el).forEach((b) => (b.onclick = () => { nota = +b.dataset.n; $$('#st [data-n]', m.el).forEach((x) => x.classList.toggle('btn-ghost', +x.dataset.n !== nota)); $('#avs', m.el).disabled = false; }));
      act('#avs', async () => {
        const { error } = await sb.from('avaliacoes').insert({ contratacao_id: id, cliente_id: eu, pro_id: c.pro_id, nota, comentario: $('#avc', m.el).value.trim() });
        if (error) throw error; DC.toast('Obrigado pela avaliação'); render();
      });
    }
    render();
  };
})();

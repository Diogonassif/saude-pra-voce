/* Saúde Pra Você · ficha da contratação (usada pelo contratante, pelo profissional e pela central) */
(function () {
  const { $, $$, sb, esc, brl } = DC;

  DC.abrirContratacao = async function (id, papel, recarregar) {
    let canal = null;
    const m = DC.modal('<div class="empty"><span class="spin"></span></div>', { wide: true, semFoco: true,
      onClose: () => { if (canal) sb.removeChannel(canal); if (recarregar) recarregar(); } });

    async function carregar() {
      const [cq, vq, sq, mq, aq, xq] = await Promise.all([
        sb.from('contratacoes').select('*').eq('id', id).single(),
        papel === 'pro' ? sb.from('contratacao_pro').select('*').eq('contratacao_id', id).maybeSingle()
          : sb.from('contratacao_cliente').select('*').eq('contratacao_id', id).maybeSingle(),
        papel === 'admin' ? sb.from('contratacao_split').select('*').eq('contratacao_id', id).maybeSingle() : Promise.resolve({ data: null }),
        sb.from('mensagens').select('*').eq('contratacao_id', id).order('created_at').limit(500),
        sb.from('avaliacoes').select('*').eq('contratacao_id', id).maybeSingle(),
        sb.from('contratacao_parcelas').select('*').eq('contratacao_id', id).order('n'),
      ]);
      if (cq.error) throw cq.error;
      const c = cq.data;
      const contato = ['confirmado', 'concluido'].includes(c.status) && papel !== 'admin' ? (await sb.rpc('contato', { c: id })).data : null;
      return { c, v: vq.data, sp: sq.data, msgs: mq.data || [], av: aq.data, contato, P: (xq && xq.data) || [] };
    }

    async function render() {
      let d; try { d = await carregar(); } catch (e) { m.el.innerHTML = `<p>${esc(e.message)}</p><div class="acts"><button class="btn" data-close>Fechar</button></div>`; return; }
      const { c, v, sp, msgs, av, contato, P } = d;
      const fixo = c.tipo === 'fixo', clt = c.tipo === 'clt';
      const V = c.clt || {};
      const qP = P.map((x) => +x.quantidade);
      const valParc = (tot, i) => DC.alocar(tot, qP, i);
      const prox = P.findIndex((x) => x.status !== 'pago');
      const eu = DC.me.id;
      const souPro = papel === 'pro', souCli = papel === 'cliente', souAdm = papel === 'admin';
      const pago = ['confirmado', 'concluido'].includes(c.status);
      const outro = souPro ? c.cliente_nome : c.pro_nome;
      const un = DC.MODAL[c.modalidade].un;
      const semana = (c.dias_semana || []).length === 7 ? 'todos os dias' : (c.dias_semana || []).map((x) => DC.SEMANA[x]).join(', ');
      const ende = pago || souCli || souAdm ? c.endereco : (c.cidade || 'Endereço completo aparece depois do pagamento');

      let valores = '';
      if (souCli && v) valores = `<div class="resumo-total"><span class="small mute">${fixo ? 'Total do contrato' : 'Total do atendimento'}</span><span class="price">${brl(v.total, 2)}</span><span class="small mute">${brl(v.valor_unit, 2)}${un} · ${esc(DC.qtdTxt(c))}</span></div>`;
      if (souPro && v) valores = `<div class="resumo-total"><span class="small mute">${fixo ? 'Você recebe no contrato todo' : 'Você recebe'}</span><span class="price">${brl(v.total, 2)}</span><span class="small mute">${brl(v.valor_unit, 2)}${un} · ${esc(DC.qtdTxt(c))}</span></div>`;
      if (souAdm && v && sp) valores = `<div class="grid2">
          <div class="card flat"><span class="small mute">Contratante paga</span><div class="price">${brl(v.total, 2)}</div><span class="tiny mute">${esc(DC.qtdTxt(c))}</span></div>
          <div class="card flat"><span class="small mute">Profissional recebe</span><div class="price">${brl(sp.pro, 2)}</div></div>
          <div class="card flat"><span class="small mute">Saúde Pra Você (${+sp.taxa_debcare_pct}%)</span><div class="price">${brl(sp.debcare, 2)}</div></div>
          <div class="card flat"><span class="small mute">Mind (${+sp.taxa_mind_pct}%)</span><div class="price">${brl(sp.mind, 2)}</div></div></div>`;

      let aviso = '';
      if (souCli && c.status === 'solicitado') aviso = `<div class="banner info">Pedido enviado para ${esc(c.pro_nome.split(' ')[0])}. Assim que aceitar, você paga aqui pelo app e o atendimento fica confirmado.</div>`;
      if (souCli && c.status === 'aceito') aviso = fixo && P.length
        ? `<div class="banner ok"><b>${esc(c.pro_nome.split(' ')[0])} aceitou o contrato!</b> Pague a 1ª parcela (${brl(valParc(v ? v.total : 0, 0), 2)}) para confirmar. As próximas são pagas mês a mês, aqui pelo app.</div>`
        : `<div class="banner ok"><b>${esc(c.pro_nome.split(' ')[0])} aceitou!</b> Pague pelo app (Pix ou cartão) para confirmar. O contato aparece aqui depois do pagamento.</div>`;
      if (fixo && souCli && c.status === 'confirmado' && prox >= 0) { const pr0 = P[prox]; const atras = pr0.vence_em && pr0.vence_em <= DC.hoje(); aviso += `<div class="banner ${atras ? '' : 'info'}">${atras ? '⚠️ ' : ''}Próxima parcela: <b>${pr0.n}/${P.length}</b> (${DC.mesTxt(pr0.inicio)}) · ${brl(valParc(v ? v.total : 0, prox), 2)}${pr0.vence_em ? ' · vence em ' + DC.data(pr0.vence_em) : ''}.</div>`; }
      if (souPro && c.status === 'solicitado') aviso = `<div class="banner">Confira os cuidados, as datas e o local. Ao aceitar, o contratante paga pelo app e os dias entram na sua agenda.</div>`;
      if (souPro && c.status === 'aceito') aviso = '<div class="banner info">Você aceitou. Aguardando o pagamento do contratante.</div>';
      if (c.status === 'recusado' || c.status === 'cancelado') aviso = `<div class="banner">${c.status === 'recusado' ? 'O profissional não pôde atender.' : 'Cancelado.'}${c.motivo ? ' Motivo: ' + esc(c.motivo) : ''}</div>`;
      const pr = c.proposta;
      if (pr) {
        const quando = `<b>${DC.data(pr.inicio)}${pr.fim && pr.fim !== pr.inicio ? ' a ' + DC.data(pr.fim) : ''}</b>${pr.horario ? ' a partir das ' + String(pr.horario).slice(0, 5) : ''}`;
        const quem = pr.por === 'pro' ? esc(c.pro_nome.split(' ')[0]) : 'A nossa central';
        if (souCli) aviso += `<div class="banner info col" style="gap:8px"><span><b>${quem} sugeriu outra data:</b> ${quando}.${pr.total_cliente != null ? ' Novo total: <b>' + brl(pr.total_cliente, 2) + '</b>.' : ''}${pr.nota ? '<br>' + esc(pr.nota) : ''}</span>
          <span class="row"><button class="btn btn-sm btn-green" id="aceitarData">Aceitar nova data</button><button class="btn btn-sm btn-ghost" id="recusarData">Manter a data original</button></span></div>`;
        else aviso += `<div class="banner info">Nova data sugerida (${quando}). Aguardando o contratante responder.</div>`;
      }
      const pv = c.proposta_valor;
      if (pv && !souAdm) {
        const minha = (pv.por === 'cliente') === souCli;
        const quem = pv.por === 'cliente' ? esc(c.cliente_nome.split(' ')[0]) : esc(c.pro_nome.split(' ')[0]);
        const novo = v && v.proposta_total != null ? (souCli ? `novo total <b>${brl(v.proposta_total, 2)}</b> (hoje ${brl(v.total, 2)})` : `você receberia <b>${brl(v.proposta_total, 2)}</b> (hoje ${brl(v.total, 2)})`) : '';
        aviso += minha
          ? `<div class="banner info">💰 Você propôs um novo valor: ${novo}. Aguardando ${souCli ? 'o profissional' : 'o contratante'} responder.</div>`
          : `<div class="banner info col" style="gap:8px"><span>💰 <b>${quem} propôs um novo valor:</b> ${novo}.${pv.nota ? '<br>“' + esc(pv.nota) + '”' : ''}</span>
            <span class="row"><button class="btn btn-sm btn-green" id="aceitarValor">Aceitar valor</button><button class="btn btn-sm btn-ghost" id="contraValor">Fazer contraproposta</button><button class="btn btn-sm btn-ghost" id="recusarValor">Recusar</button></span></div>`;
      }
      if (pv && souAdm) aviso += `<div class="banner info">💰 Negociação de valor em andamento (proposta ${pv.por === 'cliente' ? 'do contratante' : 'do profissional'}).</div>`;
      if (pago && contato) aviso += `<div class="banner ok row" style="justify-content:space-between"><span>${souPro ? 'Contratante' : 'Profissional'}: <b>${esc(outro)}</b> · ${esc(DC.telBonito(contato))}</span><a class="btn btn-sm btn-green" href="${esc(DC.wa(contato, 'Olá! Sou ' + DC.me.nome.split(' ')[0] + ', do atendimento Saúde Pra Você #' + c.codigo + '.'))}" target="_blank" rel="noopener">WhatsApp</a></div>`;

      if (clt) {
        const emp = esc(c.empresa_nome || c.cliente_nome), pn = esc(c.pro_nome.split(' ')[0]);
        aviso = ({
          solicitado: souPro ? `<div class="banner info">👔 <b>${emp}</b> tem interesse em contratar você com carteira assinada (CLT). Veja a vaga e responda: se tiver interesse, o seu contato é liberado para a empresa.</div>`
            : `<div class="banner info">Proposta de emprego enviada para ${pn}. Quando ${pn} responder que tem interesse, o contato aparece aqui.</div>`,
          confirmado: `<div class="banner ok">✅ ${souPro ? 'Você confirmou interesse na vaga.' : pn + ' tem interesse na vaga!'} Combinem a entrevista e a admissão pelo contato abaixo ou pela conversa.</div>`,
          concluido: '<div class="banner ok">Contratação CLT concluída. Boa parceria!</div>',
          recusado: `<div class="banner">${souPro ? 'Você respondeu que não tem interesse.' : pn + ' não tem interesse nesta vaga agora.'}${c.motivo ? ' Motivo: ' + esc(c.motivo) : ''}</div>`,
          cancelado: '<div class="banner">Proposta cancelada.</div>',
        })[c.status] || '';
        if (pago && contato) aviso += `<div class="banner ok row" style="justify-content:space-between"><span>${souPro ? 'Empresa' : 'Profissional'}: <b>${esc(outro)}</b> · ${esc(DC.telBonito(contato))}</span><a class="btn btn-sm btn-green" href="${esc(DC.wa(contato, 'Olá! Sou ' + DC.me.nome.split(' ')[0] + ', sobre a vaga CLT #' + c.codigo + ' da Saúde Pra Você.'))}" target="_blank" rel="noopener">WhatsApp</a></div>`;
      }
      const cnpjF = (x) => String(x || '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
      const cltDet = clt ? `<div class="card flat col" style="gap:10px"><h3>👔 Vaga CLT · ${esc(V.cargo || DC.espec(c.especialidade))}</h3>
          <div class="grid2">
            <div class="col" style="gap:4px"><span class="tiny mute">EMPRESA</span><b>${esc(c.empresa_nome || '')}</b>${c.empresa_cnpj ? `<span class="small">CNPJ ${esc(cnpjF(c.empresa_cnpj))}</span>` : ''}</div>
            <div class="col" style="gap:4px"><span class="tiny mute">JORNADA</span><b>${esc(V.jornada || '')}</b><span class="small">Início previsto: ${DC.data(c.inicio)}</span></div>
            <div class="col" style="gap:4px"><span class="tiny mute">SALÁRIO</span><b>${V.salario ? brl(V.salario, 2) + ' / mês' : 'A combinar'}</b>${V.beneficios ? `<span class="small">Benefícios: ${esc(V.beneficios)}</span>` : ''}</div>
            <div class="col" style="gap:4px"><span class="tiny mute">ONDE</span><b>${esc(DC.LOCAL[c.local_tipo])}</b><span class="small">${esc([c.endereco, c.cidade].filter(Boolean).join(', '))}</span></div>
            ${c.notas ? `<div class="col" style="gap:4px"><span class="tiny mute">OBSERVAÇÕES</span><span class="small" style="white-space:pre-wrap">${esc(c.notas)}</span></div>` : ''}
          </div><p class="tiny mute">Contratação direta entre a empresa e o profissional, com carteira assinada. O app só aproxima vocês: não há pagamento pela Saúde Pra Você.</p></div>` : '';
      const cltBtns = clt ? `<div class="row">
          ${souPro && c.status === 'solicitado' ? '<button class="btn btn-green" id="aceitar">Tenho interesse</button><button class="btn btn-ghost" id="recusar">Não tenho interesse</button>' : ''}
          ${(souCli || souAdm) && c.status === 'solicitado' ? '<button class="btn btn-red" id="cancelar">Cancelar proposta</button>' : ''}
          ${(souCli || souAdm) && c.status === 'confirmado' ? '<button class="btn btn-green" id="concluir">Marcar como contratado</button><button class="btn btn-ghost" id="cancelar">Não deu certo</button>' : ''}
        </div>` : '';
      const fimPassou = c.fim <= DC.hoje();
      const avaliar = !clt && souCli && c.status === 'concluido' && !av
        ? `<form class="card flat col" id="avf"><h3>Como foi o atendimento de ${esc(c.pro_nome.split(' ')[0])}?</h3><div class="row" id="st">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="btn btn-sm btn-ghost" data-n="${n}" aria-label="${n} estrela(s)">${'★'.repeat(n)}</button>`).join('')}</div><textarea class="in" id="avc" maxlength="1000" placeholder="Conte como foi (aparece no perfil do profissional, sem o seu nome)"></textarea><button class="btn" id="avs" type="button" disabled>Enviar avaliação</button></form>` : '';

      m.el.innerHTML = `
        <div class="row"><span class="small mute">#${c.codigo}</span>${DC.stTag(c.status, c.tipo)}${c.origem === 'central' ? '<span class="tag t-blue">Indicado pela central</span>' : ''}${fixo ? '<span class="tag t-blue">🏥 Contrato fixo</span>' : ''}${clt ? '<span class="tag t-blue">👔 Vaga CLT</span>' : ''}<button class="btn btn-sm btn-ghost right" data-close aria-label="Fechar">✕</button></div>
        <h2>${clt ? 'Proposta de emprego · ' + esc(V.cargo || DC.espec(c.especialidade)) : esc(DC.espec(c.especialidade)) + ' · ' + esc(DC.MODAL[c.modalidade].nome.toLowerCase())}</h2>
        <div class="row" style="flex-wrap:nowrap">${souAdm ? DC.av(c.cliente_nome, DC.foto(c.cliente_id)) + DC.av(c.pro_nome, DC.foto(c.pro_id)) : DC.av(outro, DC.foto(souPro ? c.cliente_id : c.pro_id), 'lg')}<p class="small mute">${souAdm ? `Contratante: <b>${esc(c.cliente_nome)}</b> · Profissional: <b>${esc(c.pro_nome)}</b>` : `${souPro ? 'Contratante' : 'Profissional'}: <b>${esc(outro)}</b>`}</p></div>
        ${aviso}
        ${cltDet}
        <div class="grid2 ${clt ? 'hide' : ''}">
          <div class="col" style="gap:4px"><span class="tiny mute">QUANDO</span><b>${DC.periodo(c)}${c.horario ? ' · a partir das ' + c.horario.slice(0, 5) : ''}</b><span class="small">${esc(semana)} · ${esc(DC.qtdTxt(c))}</span></div>
          <div class="col" style="gap:4px"><span class="tiny mute">ONDE</span><b>${esc(DC.LOCAL[c.local_tipo])}</b><span class="small">${esc(ende)}</span></div>
          <div class="col" style="gap:4px"><span class="tiny mute">${fixo ? 'QUEM SERÁ ATENDIDO' : 'QUEM RECEBE O CUIDADO'}</span><b>${esc(c.paciente_nome)}${c.paciente_idade != null ? ', ' + c.paciente_idade + ' anos' : ''}</b>${c.cuidados ? `<span class="small" style="white-space:pre-wrap">${esc(c.cuidados)}</span>` : ''}</div>
          ${c.notas ? `<div class="col" style="gap:4px"><span class="tiny mute">OBSERVAÇÕES</span><span class="small" style="white-space:pre-wrap">${esc(c.notas)}</span></div>` : ''}
        </div>
        ${clt ? '' : valores}
        ${fixo ? `<div class="card flat col" style="gap:8px"><div class="row"><h3>🏥 Contrato fixo${c.empresa_nome ? ' · ' + esc(c.empresa_nome) : ''}</h3>${c.empresa_cnpj ? `<span class="small mute right">CNPJ ${esc(c.empresa_cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5'))}</span>` : ''}</div>
          ${P.length ? `<div class="tbl-box"><table class="tbl small"><thead><tr><th>Parcela</th><th>Mês</th><th class="hide-m">Dias</th><th>${souPro ? 'Você recebe' : souAdm ? 'Contratante paga' : 'Valor'}</th>${souAdm && sp ? '<th>Profissional</th>' : ''}<th>Situação</th></tr></thead><tbody>
            ${P.map((x, i) => `<tr><td>${x.n}/${P.length}</td><td>${DC.mesTxt(x.inicio)}<br><span class="tiny mute">${DC.dataCurta(x.inicio)} a ${DC.dataCurta(x.fim)}</span></td><td class="hide-m">${x.dias}</td><td><b>${v ? brl(valParc(v.total, i), 2) : '—'}</b></td>${souAdm && sp ? `<td>${brl(valParc(sp.pro, i), 2)}</td>` : ''}
              <td>${x.status === 'pago' ? `<span class="tag t-green">PAGA ${x.pago_em ? DC.dataCurta(x.pago_em) : ''}</span>` : i === prox && ['aceito', 'confirmado'].includes(c.status) ? `<span class="tag t-amber">${x.vence_em ? 'VENCE ' + DC.dataCurta(x.vence_em) : 'PAGAR PARA CONFIRMAR'}</span>` : `<span class="tag t-gray">${x.vence_em ? 'VENCE ' + DC.dataCurta(x.vence_em) : 'A PAGAR'}</span>`}</td></tr>`).join('')}
          </tbody></table></div>` : '<p class="small mute">As parcelas aparecem aqui.</p>'}
          <p class="tiny mute">${souPro ? 'Cada parcela paga cai na sua conta Mercado Pago. Os dias do contrato ficam reservados na sua agenda depois da 1ª parcela.' : 'Cada parcela cobre um mês do contrato, proporcional aos dias de atendimento. O pagamento é pelo app (Pix ou cartão).'}</p></div>` : ''}
        ${avaliar}
        ${av ? `<p class="small">Avaliação: <span class="stars">${'★'.repeat(av.nota)}</span> ${esc(av.comentario)}</p>` : ''}
        ${cltBtns}
        <div class="row ${clt ? 'hide' : ''}">
          ${souCli && c.status === 'aceito' ? `<button class="btn btn-green" id="pagar" ${pv ? 'disabled title="Responda a proposta de valor antes"' : ''}>${fixo && P.length ? 'Pagar 1ª parcela e confirmar' : 'Pagar e confirmar'}</button>` : ''}
          ${fixo && souCli && c.status === 'confirmado' && prox >= 0 ? `<button class="btn btn-green" id="pagar">Pagar parcela ${P[prox].n}/${P.length} · ${brl(valParc(v ? v.total : 0, prox), 2)}</button>` : ''}
          ${(souCli || souPro) && ['solicitado', 'aceito'].includes(c.status) ? `<button class="btn btn-ghost" id="proporValor">💰 ${souCli ? 'Propor outro valor' : 'Propor meu valor'}</button>` : ''}
          ${souCli && ['solicitado', 'aceito'].includes(c.status) && DC.editarPedido ? '<button class="btn btn-ghost" id="editar">Editar pedido</button>' : ''}
          ${souPro && c.status === 'solicitado' ? '<button class="btn btn-green" id="aceitar">Aceitar pedido</button>' : ''}
          ${(souPro && ['solicitado', 'aceito'].includes(c.status)) || (souAdm && ['solicitado', 'aceito', 'recusado'].includes(c.status)) ? '<button class="btn btn-ghost" id="proporData">Sugerir outra data</button>' : ''}
          ${souAdm && ['solicitado', 'aceito', 'recusado'].includes(c.status) ? '<button class="btn btn-ghost" id="trocarPro">Recomendar outro profissional</button>' : ''}
          ${souPro && ['solicitado', 'aceito'].includes(c.status) ? '<button class="btn btn-red" id="recusar">Não posso atender</button>' : ''}
          ${(souCli && ['solicitado', 'aceito'].includes(c.status)) || (souAdm && ['solicitado', 'aceito', 'confirmado'].includes(c.status)) ? '<button class="btn btn-red" id="cancelar">Cancelar</button>' : ''}
          ${c.status === 'confirmado' && (souCli || souAdm || (souPro && fimPassou)) ? '<button class="btn btn-ghost" id="concluir">Marcar como concluído</button>' : ''}
        </div>
        <div class="col" style="border-top:1px solid var(--line);padding-top:14px"><h3>Conversa</h3>
          ${pago ? '' : clt ? '<p class="tiny mute">Telefones, e-mails e links ficam ocultos até o profissional confirmar interesse.</p>' : `<p class="tiny mute">Telefones, e-mails e links ficam ocultos até o pagamento. Combine tudo por aqui com segurança${['solicitado', 'aceito'].includes(c.status) && !souAdm ? ', inclusive o valor: use “💰 Propor' + (souCli ? ' outro valor' : ' meu valor') + '”' : ''}.</p>`}
          <div class="chat" id="chat">${msgs.length ? '' : '<p class="small mute" id="semmsg">Nenhuma mensagem ainda.</p>'}</div>
          ${['recusado', 'cancelado'].includes(c.status) ? '' : '<form class="row" id="cf"><label class="sr" for="ct">Mensagem</label><input class="in grow" id="ct" maxlength="4000" placeholder="Escreva uma mensagem" autocomplete="off"><button class="btn" type="submit">Enviar</button></form>'}
        </div>`;

      const chat = $('#chat', m.el);
      const bolha = (x) => x.tipo && x.tipo !== 'texto' ? `<div data-mid="${x.id}" class="bub sis">${esc(x.texto)}<small>${new Date(x.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small></div>` : `<div data-mid="${x.id}" class="bub ${x.autor === eu ? 'out' : 'in'}">${esc(x.texto)}<small>${new Date(x.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small></div>`;
      const poe = (x) => { if (chat.querySelector(`[data-mid="${x.id}"]`)) return; const s = $('#semmsg', m.el); if (s) s.remove(); chat.insertAdjacentHTML('beforeend', bolha(x)); chat.scrollTop = chat.scrollHeight; };
      msgs.forEach(poe);
      if (canal) sb.removeChannel(canal);
      canal = sb.channel('ctr-' + id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens', filter: 'contratacao_id=eq.' + id }, (ev) => { if (ev.new.tipo && ev.new.tipo !== 'texto' && ev.new.autor !== eu) render(); else poe(ev.new); }).subscribe();
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
      act('#aceitar', async () => { if (!(await DC.confirm(clt ? 'Confirmar interesse na vaga? O seu contato será liberado para a empresa.' : 'Aceitar este pedido?', clt ? 'Tenho interesse' : 'Aceitar'))) return; await DC.api('/api/contratar', { acao: 'aceitar', id }); DC.toast(clt ? 'Interesse enviado. O contato da empresa já aparece aqui.' : 'Pedido aceito. Avisamos o contratante.'); render(); });
      act('#recusar', async () => { const r = await DC.confirm(clt ? 'Responder que não tem interesse na vaga?' : 'Recusar este pedido?', clt ? 'Não tenho interesse' : 'Recusar', motivo); if (!r) return; await DC.api('/api/contratar', { acao: 'recusar', id, motivo: r.valor }); DC.toast('Pedido recusado'); render(); });
      act('#cancelar', async () => { const r = await DC.confirm('Cancelar esta contratação?', 'Cancelar', motivo); if (!r) return; await DC.api('/api/contratar', { acao: 'cancelar', id, motivo: r.valor }); DC.toast('Cancelado'); render(); });
      act('#concluir', async () => { if (!(await DC.confirm(clt ? 'Marcar que o profissional foi contratado?' : 'Marcar o atendimento como concluído?', clt ? 'Contratado' : 'Concluir'))) return; await DC.api('/api/contratar', { acao: 'concluir', id }); DC.toast(clt ? 'Contratação registrada. Boa parceria!' : 'Atendimento concluído'); render(); });
      act('#editar', async () => { m.close(); await DC.editarPedido(c, () => DC.abrirContratacao(id, papel, recarregar)); });
      act('#aceitarData', async () => { const r = await DC.api('/api/contratar', { acao: 'aceitar_data', id }); DC.toast(r.status === 'aceito' ? 'Nova data aceita. Agora é só pagar para confirmar.' : 'Nova data aceita. Avisamos o profissional.'); render(); });
      act('#recusarData', async () => { await DC.api('/api/contratar', { acao: 'recusar_data', id }); DC.toast('Mantivemos a data original'); render(); });
      act('#proporData', async () => proporData(c));
      act('#proporValor', async () => proporValor(c, v, souCli));
      act('#contraValor', async () => proporValor(c, v, souCli));
      act('#aceitarValor', async () => { if (!(await DC.confirm('Aceitar o novo valor?', 'Aceitar'))) return; await DC.api('/api/contratar', { acao: 'aceitar_valor', id }); DC.toast(souCli ? 'Valor aceito. Agora é só pagar para confirmar.' : 'Valor aceito. O pedido está aceito; aguarde o pagamento.'); render(); });
      act('#recusarValor', async () => { await DC.api('/api/contratar', { acao: 'recusar_valor', id }); DC.toast('Proposta recusada'); render(); });
      act('#trocarPro', async () => trocarPro(c));
      act('#pagar', async () => { const r = await DC.api('/api/pagar', { contratacao_id: id }); location.href = r.url; });
      let nota = 0;
      $$('#st [data-n]', m.el).forEach((b) => (b.onclick = () => { nota = +b.dataset.n; $$('#st [data-n]', m.el).forEach((x) => x.classList.toggle('btn-ghost', +x.dataset.n !== nota)); $('#avs', m.el).disabled = false; }));
      act('#avs', async () => {
        const { error } = await sb.from('avaliacoes').insert({ contratacao_id: id, cliente_id: eu, pro_id: c.pro_id, nota, comentario: $('#avc', m.el).value.trim() });
        if (error) throw error; DC.toast('Obrigado pela avaliação'); render();
      });
    }
    function proporValor(c, v, souCli) {
      const atual = v ? +v.total : 0;
      const mm = DC.modal(`<h2>${souCli ? 'Propor outro valor' : 'Propor meu valor'}</h2>
        <p class="small mute">${souCli ? `Hoje o total do atendimento é <b>${brl(atual, 2)}</b> (${esc(DC.qtdTxt(c))}). Diga quanto você gostaria de pagar no total. O profissional aceita ou recusa.` : `Hoje você recebe <b>${brl(atual, 2)}</b> por este atendimento (${esc(DC.qtdTxt(c))}). Diga quanto quer receber no total. O contratante aceita ou recusa.`}</p>
        <label class="f">${souCli ? 'Total que você quer pagar (R$)' : 'Total que você quer receber (R$)'}<input class="in" type="number" id="pvV" min="1" step="0.01" inputmode="decimal" value="${atual ? atual.toFixed(2) : ''}"></label>
        <label class="f">Recado (opcional)<textarea class="in" id="pvN" maxlength="300" style="min-height:70px" placeholder="${souCli ? 'ex.: Consigo pagar esse valor se for de segunda a sexta' : 'ex.: Para esse período, consigo fazer por esse valor'}"></textarea></label>
        <div class="acts"><button class="btn btn-ghost" data-close>Voltar</button><button class="btn" id="pvOk">Enviar proposta</button></div>`);
      $('#pvOk', mm.el).onclick = () => DC.busy($('#pvOk', mm.el), async () => {
        const val = +$('#pvV', mm.el).value; if (!(val > 0)) throw new Error('Informe o valor');
        const r = await DC.api('/api/contratar', { acao: 'propor_valor', id, valor: val, nota: $('#pvN', mm.el).value });
        mm.close(); DC.toast('Proposta enviada' + (r.total_cliente != null ? ' · total ' + brl(r.total_cliente, 2) : r.total_pro != null ? ' · você receberia ' + brl(r.total_pro, 2) : '')); render();
      });
    }
    function proporData(c) {
      const h = DC.hoje();
      const mm = DC.modal(`<h2>Sugerir outra data</h2><p class="small mute">O contratante recebe a sugestão e aceita ou mantém a data original. O valor é recalculado para o novo período.</p>
        <div class="grid2"><label class="f">Início<input class="in" type="date" id="pdI" min="${h}" value="${c.inicio >= h ? c.inicio : h}"></label><label class="f">Fim<input class="in" type="date" id="pdF" min="${h}" value="${c.fim >= h ? c.fim : h}"></label>
          <label class="f">A partir das<input class="in" type="time" id="pdH" value="${c.horario ? c.horario.slice(0, 5) : ''}"></label></div>
        <label class="f">Recado (opcional)<textarea class="in" id="pdN" maxlength="300" style="min-height:70px" placeholder="ex.: Nesse dia não consigo, mas posso a partir de quinta"></textarea></label>
        <div class="acts"><button class="btn btn-ghost" data-close>Voltar</button><button class="btn" id="pdOk">Enviar sugestão</button></div>`);
      $('#pdOk', mm.el).onclick = () => DC.busy($('#pdOk', mm.el), async () => {
        const r = await DC.api('/api/contratar', { acao: 'propor_data', id, inicio: $('#pdI', mm.el).value, fim: $('#pdF', mm.el).value || $('#pdI', mm.el).value, horario: $('#pdH', mm.el).value, nota: $('#pdN', mm.el).value });
        mm.close(); DC.toast('Sugestão enviada ao contratante · novo total ' + brl(r.total_cliente, 2)); render();
      });
    }

    async function trocarPro(c) {
      const [{ data: pros }, { data: ag }] = await Promise.all([
        sb.from('pros').select('user_id,nome,especialidade,cidade,uf,publicado,verificado,coren_status,rating,n_avaliacoes,valor_hora,valor_12h,valor_24h').eq('publicado', true).neq('user_id', c.pro_id),
        sb.from('agenda').select('pro_id,dia,status').gte('dia', c.inicio).lte('dia', c.fim).in('status', ['off', 'alocado']),
      ]);
      const campo = DC.MODAL[c.modalidade].campo.replace('preco', 'valor');
      const tx = 1 + ((+(DC.cfg.taxa_debcare ?? 15)) + (+(DC.cfg.taxa_mind ?? 10))) / 100;
      const L = (pros || []).filter((p) => +p[campo] > 0 && (!DC.ESPEC[p.especialidade].coren || p.coren_status === 'ativo'))
        .map((p) => ({ p, ocupado: (ag || []).some((a) => a.pro_id === p.user_id), mesma: p.especialidade === c.especialidade }))
        .sort((a, b) => (b.mesma - a.mesma) || (a.ocupado - b.ocupado) || ((+b.p.rating || 0) - (+a.p.rating || 0)));
      const mm = DC.modal(`<h2>Recomendar outro profissional</h2><p class="small mute">Criamos um pedido novo com os mesmos dados (${DC.periodo(c)} · ${esc(DC.qtdTxt(c))}) para o profissional escolhido${c.status === 'recusado' ? '' : ' e cancelamos este'}. O contratante é avisado.</p>
        ${L.length ? `<div class="list small">${L.map(({ p, ocupado, mesma }) => { const unit = Math.round(+p[campo] * tx * 100) / 100; return `<div class="li"><span class="grow"><b>${esc(p.nome)}</b>${p.verificado ? ' <span class="selo">✓ Selo</span>' : ''}<br><span class="mute">${esc(DC.espec(p.especialidade))}${mesma ? '' : ' (outra especialidade)'}${p.cidade ? ' · ' + esc(p.cidade) : ''}${p.n_avaliacoes ? ' · ' + (+p.rating).toFixed(1) + ' ★' : ''} · contratante paga ${brl(unit, 2)}${esc(DC.MODAL[c.modalidade].un)}</span>${ocupado ? '<br><span class="tag t-red">Indisponível em algum dia do período</span>' : ''}</span><button class="btn btn-sm" data-indica="${p.user_id}" ${ocupado ? 'disabled' : ''}>Indicar</button></div>`; }).join('')}</div>`
          : '<p class="small mute">Nenhum outro profissional publicado atende nessa modalidade.</p>'}
        <div class="acts"><button class="btn btn-ghost" data-close>Voltar</button></div>`, { wide: true });
      $$('[data-indica]', mm.el).forEach((b) => (b.onclick = () => DC.busy(b, async () => {
        const r = await DC.api('/api/contratar', { acao: 'trocar_pro', id, pro_id: b.dataset.indica });
        mm.close(); DC.toast(`Pedido #${r.codigo} enviado ao novo profissional`); render();
      })));
    }

    render();
  };
})();

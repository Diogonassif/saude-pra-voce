// Contratações: criar pelo catálogo, indicação da central, aceitar, recusar, cancelar, concluir e avisos.
// Toda conta de dinheiro é feita aqui (valor do profissional + 15% Saúde Pra Você + 10% Mind, somados por cima).
import { send, readJson, who, admin, one, isUuid, money, brl, fail, handler, appUrl, sendEmail, shell, escH,
  emailDe, emailCentral, MODAL, taxas, calcular, diasDoPeriodo, partesMensais } from './_lib.js';

const dataOk = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? s : null);
const horaOk = (s) => (/^\d{2}:\d{2}$/.test(String(s || '')) ? s : null);
const hoje = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const txt = (s, n) => String(s || '').trim().slice(0, n);
const LOCAIS = ['residencia', 'hospital', 'clinica', 'outro'];
const ESPEC = { enfermeiro: 'Enfermeiro(a)', tecnico: 'Técnico(a) de enfermagem', cuidador: 'Cuidador(a)', acompanhante: 'Acompanhante hospitalar' };
const resumo = (c) => `${c.tipo === 'fixo' ? 'Contrato fixo' + (c.empresa_nome ? ' (' + c.empresa_nome + ')' : '') + ' · ' : ''}${ESPEC[c.especialidade] || 'Atendimento'} · ${c.inicio.split('-').reverse().join('/')}${c.fim !== c.inicio ? ' a ' + c.fim.split('-').reverse().join('/') : ''}`;

async function carregar(id) {
  if (!isUuid(id)) throw fail(400, 'Contratação inválida');
  const c = await one(`contratacoes?id=eq.${id}&select=*`);
  if (!c) throw fail(404, 'Contratação não encontrada');
  return c;
}

// valida e monta os dados de um pedido (usado ao criar e ao editar)
async function planejarPedido(b, clienteId, baseFixa) {
  if (!isUuid(b.pro_id)) throw fail(400, 'Escolha um profissional');
  const pro = await one(`pros?user_id=eq.${b.pro_id}&select=user_id,nome,especialidade,publicado,coren_status,valor_hora,valor_12h,valor_24h`);
  if (!pro || !pro.publicado) throw fail(404, 'Este profissional não está disponível agora');
  if (['tecnico', 'enfermeiro'].includes(pro.especialidade) && pro.coren_status !== 'ativo') throw fail(409, 'O COREN deste profissional ainda não foi conferido pela central');
  if (pro.user_id === clienteId) throw fail(400, 'Você não pode contratar a si mesmo');
  const modalidade = MODAL[b.modalidade] ? b.modalidade : 'hora';
  const base = baseFixa > 0 ? +baseFixa : +pro[MODAL[modalidade].campo];
  if (!(base > 0)) throw fail(400, 'Este profissional não atende nessa modalidade');
  const inicio = dataOk(b.inicio), fim = dataOk(b.fim) || inicio;
  if (!inicio) throw fail(400, 'Informe a data de início');
  if (inicio < hoje()) throw fail(400, 'A data de início já passou');
  if (fim < inicio) throw fail(400, 'O fim precisa ser depois do início');
  const tipo = b.tipo === 'fixo' ? 'fixo' : 'avulso';
  if (tipo === 'avulso' && (new Date(fim) - new Date(inicio)) / 864e5 > 180) throw fail(400, 'Atendimento avulso vai até 6 meses. Para períodos maiores, escolha contrato fixo.');
  if (tipo === 'fixo' && (new Date(fim) - new Date(inicio)) / 864e5 > 366) throw fail(400, 'Contrato fixo vai até 12 meses por vez');
  const empresa = txt(b.empresa_nome, 120), cnpj = String(b.empresa_cnpj || '').replace(/\D/g, '');
  if (tipo === 'fixo' && !empresa) throw fail(400, 'Informe o nome da clínica ou empresa do contrato');
  if (cnpj && cnpj.length !== 14) throw fail(400, 'CNPJ inválido: são 14 números');
  const semana = Array.isArray(b.dias_semana) && b.dias_semana.length
    ? [...new Set(b.dias_semana.map(Number).filter((n) => n >= 0 && n <= 6))] : [0, 1, 2, 3, 4, 5, 6];
  const dias = diasDoPeriodo(inicio, fim, semana);
  if (!dias.length) throw fail(400, 'Nenhum dia do período cai nos dias da semana escolhidos');
  const horasDia = modalidade === 'hora' ? Math.round(+b.horas_dia || 0) : modalidade === 'plantao12' ? 12 : 24;
  if (modalidade === 'hora' && !(horasDia >= 1 && horasDia <= 24)) throw fail(400, 'Informe de 1 a 24 horas por dia');
  const quantidade = modalidade === 'hora' ? dias.length * horasDia : dias.length;
  if (!txt(b.paciente_nome, 120)) throw fail(400, 'Informe quem vai receber o cuidado');
  if (!txt(b.endereco, 300)) throw fail(400, 'Informe o endereço do atendimento');

  // agenda: dias marcados como indisponíveis ou já contratados bloqueiam o pedido
  const ag = await admin(`agenda?pro_id=eq.${pro.user_id}&dia=gte.${inicio}&dia=lte.${fim}&status=in.(off,alocado)&select=dia,status&order=dia`);
  const choque = (ag || []).find((a) => dias.includes(a.dia));
  if (choque) throw fail(409, `${pro.nome.split(' ')[0]} não está disponível em ${choque.dia.split('-').reverse().join('/')}. Escolha outras datas ou outro profissional.`);

  const idade = b.paciente_idade === '' || b.paciente_idade == null ? null : Math.round(+b.paciente_idade);
  const row = {
    pro_id: pro.user_id, pro_nome: pro.nome, especialidade: pro.especialidade, modalidade,
    inicio, fim, horario: horaOk(b.horario), horas_dia: horasDia, dias_semana: semana, dias: dias.length, quantidade,
    local_tipo: LOCAIS.includes(b.local_tipo) ? b.local_tipo : 'residencia', endereco: txt(b.endereco, 300), cidade: txt(b.cidade, 80) || null,
    paciente_nome: txt(b.paciente_nome, 120), paciente_idade: idade >= 0 && idade <= 120 ? idade : null,
    cuidados: txt(b.cuidados, 3000), notas: txt(b.notas, 2000),
    tipo, empresa_nome: tipo === 'fixo' ? empresa : null, empresa_cnpj: tipo === 'fixo' && cnpj ? cnpj : null,
  };
  const t = await taxas();
  return { row, t, v: calcular(base, quantidade, t) };
}

// contrato fixo: refaz as parcelas mensais (só antes de qualquer pagamento)
async function gerarParcelas(id) {
  const c = await one(`contratacoes?id=eq.${id}&select=*`);
  if (!c) return;
  const pagas = await admin(`contratacao_parcelas?contratacao_id=eq.${id}&status=eq.pago&select=n`);
  if ((pagas || []).length) return;
  await admin(`contratacao_parcelas?contratacao_id=eq.${id}`, { method: 'DELETE' });
  if (c.tipo !== 'fixo') return;
  const partes = partesMensais(c);
  if (partes.length) await admin('contratacao_parcelas', { method: 'POST', body: partes.map((x) => Object.assign({ contratacao_id: id }, x)) });
}

// monta e grava uma contratação (usado pelo contratante no catálogo e pela central ao indicar)
async function criarContratacao(b, clienteId, origem, necessidadeId) {
  const { row: r0, t, v } = await planejarPedido(b, clienteId);
  const cli = await one(`profiles?id=eq.${clienteId}&select=nome`);
  const row = Object.assign(r0, { cliente_id: clienteId, cliente_nome: (cli && cli.nome) || '', necessidade_id: necessidadeId || null, origem, status: 'solicitado' });
  const [c] = await admin('contratacoes', { method: 'POST', prefer: 'return=representation', body: row });
  await Promise.all([
    admin('contratacao_pro', { method: 'POST', body: { contratacao_id: c.id, valor_unit: v.unitPro, total: v.pro } }),
    admin('contratacao_cliente', { method: 'POST', body: { contratacao_id: c.id, valor_unit: v.unitCli, total: v.cliente } }),
    admin('contratacao_split', { method: 'POST', body: { contratacao_id: c.id, taxa_debcare_pct: t.debcare, taxa_mind_pct: t.mind, pro: v.pro, debcare: v.debcare, mind: v.mind } }),
  ]);
  if (c.tipo === 'fixo') await gerarParcelas(c.id);
  return { c, v };
}

// recalcula dias, quantidade e valores de uma contratação para um novo período (mesmo profissional e modalidade)
async function replanejar(c, inicio, fim, horario) {
  inicio = dataOk(inicio); fim = dataOk(fim) || inicio;
  if (!inicio) throw fail(400, 'Informe a nova data de início');
  if (inicio < hoje()) throw fail(400, 'A nova data já passou');
  if (fim < inicio) throw fail(400, 'O fim precisa ser depois do início');
  if ((new Date(fim) - new Date(inicio)) / 864e5 > (c.tipo === 'fixo' ? 366 : 180)) throw fail(400, c.tipo === 'fixo' ? 'Contrato fixo vai até 12 meses' : 'No máximo 6 meses por vez');
  const pro = await one(`pros?user_id=eq.${c.pro_id}&select=user_id,nome,${MODAL[c.modalidade].campo}`);
  const neg = await one(`contratacao_split?contratacao_id=eq.${c.id}&select=base_negociada`);
  const base = neg && +neg.base_negociada > 0 ? +neg.base_negociada : pro ? +pro[MODAL[c.modalidade].campo] : 0;
  if (!(base > 0)) throw fail(409, 'O profissional não tem mais valor para esta modalidade');
  const dias = diasDoPeriodo(inicio, fim, c.dias_semana && c.dias_semana.length ? c.dias_semana : [0, 1, 2, 3, 4, 5, 6]);
  if (!dias.length) throw fail(400, 'Nenhum dia do novo período cai nos dias da semana do pedido');
  const ag = await admin(`agenda?pro_id=eq.${c.pro_id}&dia=gte.${inicio}&dia=lte.${fim}&status=in.(off,alocado)&select=dia&order=dia`);
  const choque = (ag || []).find((a) => dias.includes(a.dia));
  if (choque) throw fail(409, `${pro.nome.split(' ')[0]} não está disponível em ${choque.dia.split('-').reverse().join('/')}`);
  const quantidade = c.modalidade === 'hora' ? dias.length * c.horas_dia : dias.length;
  const t = await taxas();
  const v = calcular(base, quantidade, t);
  return { inicio, fim, horario: horaOk(horario) || c.horario, dias: dias.length, quantidade, v, t };
}

export default handler(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'use POST' });
  const me = await who(req);
  const b = await readJson(req);
  const url = appUrl(req);
  const agora = () => new Date().toISOString();

  // ------------------------------------------------------------ criar (contratante, pelo catálogo)
  if (b.acao === 'criar') {
    if (me.role !== 'cliente' && !me.isAdmin) throw fail(403, 'Entre como contratante para contratar');
    const { c, v } = await criarContratacao(b, me.id, 'catalogo', null);
    sendEmail({ to: await emailDe(c.pro_id), subject: `Novo pedido: ${resumo(c)}`,
      html: shell('Você recebeu um pedido', `<p><b>${escH(c.cliente_nome)}</b> quer contratar você: ${escH(resumo(c))}.</p><p>Você recebe <b>${brl(v.pro)}</b>.</p>`,
        { url: url + '/pro.html#pedidos', label: 'Ver e responder' }) });
    return send(res, 200, { ok: true, id: c.id, codigo: c.codigo, total: v.cliente });
  }

  // ------------------------------------------------------------ central: indicar profissional para uma necessidade
  if (b.acao === 'indicar') {
    if (!me.isAdmin) throw fail(403, 'Só a central');
    if (!isUuid(b.necessidade_id)) throw fail(400, 'Necessidade inválida');
    const n = await one(`necessidades?id=eq.${b.necessidade_id}&select=*`);
    if (!n || ['cancelada', 'atendida'].includes(n.status)) throw fail(409, 'Esta necessidade não está mais aberta');
    const { c, v } = await criarContratacao(Object.assign({
      paciente_nome: n.paciente_nome, paciente_idade: n.paciente_idade, cuidados: n.cuidados, local_tipo: n.local_tipo,
      endereco: n.endereco, cidade: n.cidade, inicio: n.inicio, fim: n.fim, horas_dia: n.horas_dia,
      tipo: n.tipo, empresa_nome: n.empresa_nome,
    }, b), n.cliente_id, 'central', n.id);
    await admin(`necessidades?id=eq.${n.id}`, { method: 'PATCH', body: { status: 'em_busca', updated_at: agora(),
      endereco: n.endereco || c.endereco || null, cidade: n.cidade || c.cidade || null } });
    sendEmail({ to: await emailDe(c.pro_id), subject: `A nossa central indicou você: ${resumo(c)}`,
      html: shell('Novo pedido pela central', `<p>${escH(resumo(c))} · você recebe <b>${brl(v.pro)}</b>.</p>`, { url: url + '/pro.html#pedidos', label: 'Ver e responder' }) });
    return send(res, 200, { ok: true, id: c.id, total_cliente: v.cliente, total_pro: v.pro });
  }

  // ------------------------------------------------------------ aviso de nova necessidade para a central
  if (b.acao === 'avisar_necessidade') {
    if (!isUuid(b.id)) throw fail(400, 'Necessidade inválida');
    const n = await one(`necessidades?id=eq.${b.id}&select=*`);
    if (!n || n.cliente_id !== me.id) throw fail(403, 'Sem acesso');
    sendEmail({ to: await emailCentral(), subject: `Nova necessidade #${n.codigo}: ${ESPEC[n.especialidade] || 'atendimento'}`,
      html: shell('Nova necessidade para a central', `<p><b>${escH(n.cliente_nome)}</b> não encontrou no catálogo e pediu ajuda.</p><p>${escH(ESPEC[n.especialidade] || '')} · ${escH(n.cidade || '')}${n.inicio ? ' · início ' + n.inicio.split('-').reverse().join('/') : ''}</p>`,
        { url: url + '/admin.html#central', label: 'Abrir na central' }) });
    return send(res, 200, { ok: true });
  }

  const c = await carregar(b.id);
  const ehPro = c.pro_id === me.id, ehCli = c.cliente_id === me.id;

  // ------------------------------------------------------------ aceitar (profissional)
  if (b.acao === 'aceitar') {
    if (!ehPro) throw fail(403, 'Só o profissional aceita o pedido');
    if (c.status !== 'solicitado') throw fail(409, 'Este pedido não está aguardando resposta');
    await admin(`contratacoes?id=eq.${c.id}`, { method: 'PATCH', body: { status: 'aceito', aceito_em: agora(), updated_at: agora() } });
    sendEmail({ to: await emailDe(c.cliente_id), subject: `${c.pro_nome.split(' ')[0]} aceitou: pague para confirmar`,
      html: shell('Pedido aceito', `<p><b>${escH(c.pro_nome)}</b> aceitou ${escH(resumo(c))}. Pague pelo app para confirmar.</p>`, { url: url + '/cliente.html#contratacoes', label: 'Pagar e confirmar' }) });
    return send(res, 200, { ok: true });
  }

  // ------------------------------------------------------------ recusar (profissional)
  if (b.acao === 'recusar') {
    if (!ehPro) throw fail(403, 'Só o profissional recusa o pedido');
    if (!['solicitado', 'aceito'].includes(c.status)) throw fail(409, 'Este pedido não pode mais ser recusado');
    await admin(`contratacoes?id=eq.${c.id}`, { method: 'PATCH', body: { status: 'recusado', motivo: txt(b.motivo, 300), updated_at: agora() } });
    if (c.necessidade_id) await admin(`necessidades?id=eq.${c.necessidade_id}&status=neq.cancelada`, { method: 'PATCH', body: { status: 'aberta', updated_at: agora() } });
    sendEmail({ to: await emailDe(c.cliente_id), subject: 'Pedido não aceito · Saúde Pra Você',
      html: shell('O profissional não pode atender', `<p>${escH(resumo(c))}. Escolha outro profissional no catálogo ou peça ajuda à central.</p>`, { url: url + '/cliente.html#catalogo', label: 'Ver catálogo' }) });
    return send(res, 200, { ok: true });
  }

  // ------------------------------------------------------------ cancelar (contratante antes de pagar; central a qualquer momento)
  if (b.acao === 'cancelar') {
    if (!(ehCli || me.isAdmin)) throw fail(403, 'Sem acesso');
    const pode = me.isAdmin ? ['solicitado', 'aceito', 'confirmado'] : ['solicitado', 'aceito'];
    if (!pode.includes(c.status)) throw fail(409, c.status === 'confirmado' ? 'Atendimento já pago: fale com a central para cancelar e reembolsar' : 'Esta contratação não pode ser cancelada');
    await admin(`contratacoes?id=eq.${c.id}`, { method: 'PATCH', body: { status: 'cancelado', motivo: txt(b.motivo, 300), updated_at: agora() } });
    if (c.status === 'confirmado') await admin(`agenda?pro_id=eq.${c.pro_id}&dia=gte.${c.inicio}&dia=lte.${c.fim}&status=eq.alocado`, { method: 'DELETE' });
    sendEmail({ to: await emailDe(c.pro_id), subject: 'Pedido cancelado · Saúde Pra Você', html: shell('Pedido cancelado', `<p>${escH(resumo(c))} foi cancelado.</p>`) });
    return send(res, 200, { ok: true });
  }

  // ------------------------------------------------------------ concluir (contratante, central, ou profissional depois do fim)
  if (b.acao === 'concluir') {
    const proPode = ehPro && c.fim <= hoje();
    if (!(ehCli || me.isAdmin || proPode)) throw fail(403, ehPro ? 'Você pode concluir a partir do último dia' : 'Sem acesso');
    if (c.status !== 'confirmado') throw fail(409, 'Só atendimentos pagos podem ser concluídos');
    await admin(`contratacoes?id=eq.${c.id}`, { method: 'PATCH', body: { status: 'concluido', concluido_em: agora(), updated_at: agora() } });
    if (!ehCli) sendEmail({ to: await emailDe(c.cliente_id), subject: 'Atendimento concluído · avalie', html: shell('Atendimento concluído', `<p>Conte como foi com ${escH(c.pro_nome.split(' ')[0])}. Sua avaliação ajuda outras famílias.</p>`, { url: url + '/cliente.html#contratacoes', label: 'Avaliar' }) });
    return send(res, 200, { ok: true });
  }

  // ------------------------------------------------------------ editar o pedido (contratante, antes de pagar)
  if (b.acao === 'editar') {
    if (!(ehCli || me.isAdmin)) throw fail(403, 'Só o contratante edita o pedido');
    if (!['solicitado', 'aceito'].includes(c.status)) throw fail(409, 'Depois do pagamento, fale com a central para mudar o atendimento');
    const neg = await one(`contratacao_split?contratacao_id=eq.${c.id}&select=base_negociada`);
    const mesmaModal = (MODAL[b.modalidade] ? b.modalidade : 'hora') === c.modalidade;
    const { row, t, v } = await planejarPedido(Object.assign({ tipo: c.tipo, empresa_nome: c.empresa_nome, empresa_cnpj: c.empresa_cnpj }, b, { pro_id: c.pro_id }), c.cliente_id, mesmaModal && neg ? neg.base_negociada : null);
    const mudou = [...['modalidade', 'inicio', 'fim'].filter((k) => String(row[k]) !== String(c[k])), ...['horas_dia', 'quantidade'].filter((k) => +row[k] !== +c[k]),
      ...((row.horario || '') !== (c.horario ? c.horario.slice(0, 5) : '') ? ['horario'] : []),
      ...(JSON.stringify([...row.dias_semana].sort()) !== JSON.stringify([...(c.dias_semana || [])].sort()) ? ['dias_semana'] : [])];
    const mudouAgenda = mudou.length > 0;
    const volta = mudouAgenda && c.status === 'aceito';
    delete row.pro_id; delete row.pro_nome; delete row.especialidade;
    await admin(`contratacoes?id=eq.${c.id}`, { method: 'PATCH', body: Object.assign(row, { proposta: null, proposta_valor: null, updated_at: agora() }, volta ? { status: 'solicitado', aceito_em: null } : {}) });
    await Promise.all([
      admin(`contratacao_pro?contratacao_id=eq.${c.id}`, { method: 'PATCH', body: { valor_unit: v.unitPro, total: v.pro } }),
      admin(`contratacao_cliente?contratacao_id=eq.${c.id}`, { method: 'PATCH', body: { valor_unit: v.unitCli, total: v.cliente } }),
      admin(`contratacao_split?contratacao_id=eq.${c.id}`, { method: 'PATCH', body: { taxa_debcare_pct: t.debcare, taxa_mind_pct: t.mind, pro: v.pro, debcare: v.debcare, mind: v.mind, proposta_base: null, base_negociada: mesmaModal && neg ? neg.base_negociada : null } }),
      admin(`contratacao_pro?contratacao_id=eq.${c.id}`, { method: 'PATCH', body: { proposta_total: null } }),
      admin(`contratacao_cliente?contratacao_id=eq.${c.id}`, { method: 'PATCH', body: { proposta_total: null } }),
    ]);
    await gerarParcelas(c.id);
    sendEmail({ to: await emailDe(c.pro_id), subject: `Pedido #${c.codigo} alterado pelo contratante`,
      html: shell('Pedido alterado', `<p>${escH(c.cliente_nome)} alterou o pedido #${c.codigo}${mudouAgenda ? ' (datas ou horários)' : ''}. Você recebe <b>${brl(v.pro)}</b>.${volta ? ' Confira e aceite de novo.' : ''}</p>`,
        { url: url + '/pro.html#pedidos', label: 'Ver pedido' }) });
    return send(res, 200, { ok: true, status: volta ? 'solicitado' : c.status, total_cliente: v.cliente, voltou: volta, mudou });
  }

  // ------------------------------------------------------------ sugerir outra data (profissional ou central)
  if (b.acao === 'propor_data') {
    if (!(ehPro || me.isAdmin)) throw fail(403, 'Só o profissional ou a central sugerem outra data');
    if (!['solicitado', 'aceito', 'recusado'].includes(c.status)) throw fail(409, 'Esta contratação não aceita mudança de data');
    const plano = await replanejar(c, b.inicio, b.fim, b.horario);   // valida datas e agenda já agora
    const proposta = { por: ehPro ? 'pro' : 'central', inicio: plano.inicio, fim: plano.fim, horario: plano.horario, nota: txt(b.nota, 300), em: agora(),
      total_cliente: plano.v.cliente };
    const body = { proposta, updated_at: agora() };
    if (c.status === 'recusado') { body.status = 'solicitado'; body.motivo = ''; }
    await admin(`contratacoes?id=eq.${c.id}`, { method: 'PATCH', body });
    const dt = (d) => d.split('-').reverse().join('/');
    sendEmail({ to: await emailDe(c.cliente_id), subject: `Nova data sugerida para o seu atendimento #${c.codigo}`,
      html: shell('Sugestão de nova data', `<p>${ehPro ? escH(c.pro_nome.split(' ')[0]) : 'A nossa central'} sugeriu <b>${dt(plano.inicio)}${plano.fim !== plano.inicio ? ' a ' + dt(plano.fim) : ''}</b>${plano.horario ? ' a partir das ' + plano.horario.slice(0, 5) : ''}. Novo total: <b>${brl(plano.v.cliente)}</b>.</p>${proposta.nota ? '<p>' + escH(proposta.nota) + '</p>' : ''}`,
        { url: url + '/cliente.html#contratacoes', label: 'Aceitar ou recusar' }) });
    return send(res, 200, { ok: true, total_cliente: plano.v.cliente });
  }

  // ------------------------------------------------------------ contratante responde à nova data
  if (b.acao === 'aceitar_data' || b.acao === 'recusar_data') {
    if (!(ehCli || me.isAdmin)) throw fail(403, 'Só o contratante responde à nova data');
    const p = c.proposta;
    if (!p) throw fail(409, 'Não há nova data para responder');
    if (b.acao === 'recusar_data') {
      await admin(`contratacoes?id=eq.${c.id}`, { method: 'PATCH', body: { proposta: null, updated_at: agora() } });
      sendEmail({ to: await emailDe(c.pro_id), subject: `Nova data não aceita · #${c.codigo}`, html: shell('Nova data não aceita', `<p>${escH(c.cliente_nome)} preferiu manter o pedido original.</p>`) });
      return send(res, 200, { ok: true });
    }
    if (!['solicitado', 'aceito'].includes(c.status)) throw fail(409, 'Esta contratação não aceita mudança de data');
    const plano = await replanejar(c, p.inicio, p.fim, p.horario);
    await admin(`contratacoes?id=eq.${c.id}`, { method: 'PATCH', body: {
      inicio: plano.inicio, fim: plano.fim, horario: plano.horario, dias: plano.dias, quantidade: plano.quantidade, proposta: null,
      status: p.por === 'pro' ? 'aceito' : 'solicitado', aceito_em: p.por === 'pro' ? agora() : null, updated_at: agora() } });
    await Promise.all([
      admin(`contratacao_pro?contratacao_id=eq.${c.id}`, { method: 'PATCH', body: { valor_unit: plano.v.unitPro, total: plano.v.pro } }),
      admin(`contratacao_cliente?contratacao_id=eq.${c.id}`, { method: 'PATCH', body: { valor_unit: plano.v.unitCli, total: plano.v.cliente } }),
      admin(`contratacao_split?contratacao_id=eq.${c.id}`, { method: 'PATCH', body: { taxa_debcare_pct: plano.t.debcare, taxa_mind_pct: plano.t.mind, pro: plano.v.pro, debcare: plano.v.debcare, mind: plano.v.mind } }),
    ]);
    await gerarParcelas(c.id);
    sendEmail({ to: await emailDe(c.pro_id), subject: `Nova data aceita · #${c.codigo}`,
      html: shell('Nova data aceita', `<p>${escH(c.cliente_nome)} aceitou a nova data. ${p.por === 'pro' ? 'Agora é só aguardar o pagamento.' : 'Confira e responda ao pedido.'}</p>`, { url: url + '/pro.html#pedidos', label: 'Ver pedido' }) });
    return send(res, 200, { ok: true, status: p.por === 'pro' ? 'aceito' : 'solicitado', total_cliente: plano.v.cliente });
  }


  // ------------------------------------------------------------ negociação de valor no chat (antes do pagamento)
  // o contratante propõe quanto quer pagar no total; o profissional propõe quanto quer receber no total.
  // a outra parte aceita ou recusa (e pode mandar outra proposta). Ao aceitar, os valores do pedido são refeitos.
  if (b.acao === 'propor_valor') {
    if (!(ehCli || ehPro)) throw fail(403, 'Só o contratante ou o profissional negociam o valor');
    if (!['solicitado', 'aceito'].includes(c.status)) throw fail(409, 'Depois do pagamento o valor não muda mais');
    const valor = money(+String(b.valor ?? '').replace(',', '.'));
    if (!(valor > 0)) throw fail(400, 'Informe um valor maior que zero');
    const t = await taxas();
    const fator = 1 + (t.debcare + t.mind) / 100;
    const q = +c.quantidade;
    const base = money((ehCli ? valor / fator : valor) / q);
    if (!(base >= 0.01)) throw fail(400, 'Valor muito baixo para este atendimento');
    const atual = await one(`contratacao_split?contratacao_id=eq.${c.id}&select=pro`);
    if (atual && base * q > +atual.pro * 5) throw fail(400, 'Valor muito acima do atual: confira os números');
    const v = calcular(base, q, t);
    await Promise.all([
      admin(`contratacoes?id=eq.${c.id}`, { method: 'PATCH', body: { proposta_valor: { por: ehCli ? 'cliente' : 'pro', em: agora(), nota: txt(b.nota, 300) }, updated_at: agora() } }),
      admin(`contratacao_cliente?contratacao_id=eq.${c.id}`, { method: 'PATCH', body: { proposta_total: v.cliente } }),
      admin(`contratacao_pro?contratacao_id=eq.${c.id}`, { method: 'PATCH', body: { proposta_total: v.pro } }),
      admin(`contratacao_split?contratacao_id=eq.${c.id}`, { method: 'PATCH', body: { proposta_base: base } }),
    ]);
    await admin('mensagens', { method: 'POST', body: { contratacao_id: c.id, autor: me.id, tipo: 'proposta',
      texto: `💰 ${ehCli ? 'O contratante' : 'O profissional'} propôs um novo valor para o atendimento.${txt(b.nota, 300) ? ' "' + txt(b.nota, 300) + '"' : ''}` } });
    const outro = ehCli ? c.pro_id : c.cliente_id;
    sendEmail({ to: await emailDe(outro), subject: `Nova proposta de valor · #${c.codigo}`,
      html: shell('Proposta de valor', `<p>${escH(ehCli ? c.cliente_nome : c.pro_nome)} propôs um novo valor: ${ehCli ? `você receberia <b>${brl(v.pro)}</b>` : `o total ficaria <b>${brl(v.cliente)}</b>`}.</p>`,
        { url: url + (ehCli ? '/pro.html#pedidos' : '/cliente.html#contratacoes'), label: 'Aceitar ou recusar' }) });
    return send(res, 200, { ok: true, total_cliente: ehCli ? v.cliente : undefined, total_pro: ehPro ? v.pro : undefined });
  }

  if (b.acao === 'aceitar_valor' || b.acao === 'recusar_valor') {
    const p = c.proposta_valor;
    if (!p) throw fail(409, 'Não há proposta de valor em aberto');
    const respondePro = p.por === 'cliente';
    if (respondePro ? !ehPro : !ehCli) throw fail(403, `Quem responde é ${respondePro ? 'o profissional' : 'o contratante'}`);
    const limpar = () => Promise.all([
      admin(`contratacao_cliente?contratacao_id=eq.${c.id}`, { method: 'PATCH', body: { proposta_total: null } }),
      admin(`contratacao_pro?contratacao_id=eq.${c.id}`, { method: 'PATCH', body: { proposta_total: null } }),
    ]);
    const outro = ehCli ? c.pro_id : c.cliente_id;
    if (b.acao === 'recusar_valor') {
      await admin(`contratacoes?id=eq.${c.id}`, { method: 'PATCH', body: { proposta_valor: null, updated_at: agora() } });
      await admin(`contratacao_split?contratacao_id=eq.${c.id}`, { method: 'PATCH', body: { proposta_base: null } });
      await limpar();
      await admin('mensagens', { method: 'POST', body: { contratacao_id: c.id, autor: me.id, tipo: 'recusada', texto: '❌ Proposta de valor recusada. O valor anterior continua valendo.' } });
      sendEmail({ to: await emailDe(outro), subject: `Proposta de valor recusada · #${c.codigo}`, html: shell('Proposta recusada', '<p>A proposta de valor não foi aceita. Vocês podem continuar conversando pelo app.</p>') });
      return send(res, 200, { ok: true });
    }
    if (!['solicitado', 'aceito'].includes(c.status)) throw fail(409, 'Depois do pagamento o valor não muda mais');
    const sp = await one(`contratacao_split?contratacao_id=eq.${c.id}&select=proposta_base`);
    if (!sp || !(+sp.proposta_base > 0)) throw fail(409, 'Proposta não encontrada');
    const t = await taxas();
    const v = calcular(+sp.proposta_base, +c.quantidade, t);
    // quem aceita (ou quem propôs) sendo o profissional, o pedido fica aceito e pronto para pagar
    const body = { proposta_valor: null, updated_at: agora() };
    if (c.status === 'solicitado') { body.status = 'aceito'; body.aceito_em = agora(); }
    await admin(`contratacoes?id=eq.${c.id}`, { method: 'PATCH', body });
    await Promise.all([
      admin(`contratacao_pro?contratacao_id=eq.${c.id}`, { method: 'PATCH', body: { valor_unit: v.unitPro, total: v.pro, proposta_total: null } }),
      admin(`contratacao_cliente?contratacao_id=eq.${c.id}`, { method: 'PATCH', body: { valor_unit: v.unitCli, total: v.cliente, proposta_total: null } }),
      admin(`contratacao_split?contratacao_id=eq.${c.id}`, { method: 'PATCH', body: { taxa_debcare_pct: t.debcare, taxa_mind_pct: t.mind, pro: v.pro, debcare: v.debcare, mind: v.mind, proposta_base: null, base_negociada: +sp.proposta_base } }),
    ]);
    await admin('mensagens', { method: 'POST', body: { contratacao_id: c.id, autor: me.id, tipo: 'aceita',
      texto: `✅ Proposta de valor aceita. ${body.status === 'aceito' || c.status === 'aceito' ? 'O pedido está aceito e pronto para o pagamento.' : ''}` } });
    sendEmail({ to: await emailDe(outro), subject: `Proposta de valor aceita · #${c.codigo}`,
      html: shell('Valor combinado', `<p>A proposta de valor foi aceita. ${ehPro ? `Novo total: <b>${brl(v.cliente)}</b>. Pague pelo app para confirmar.` : `Você recebe <b>${brl(v.pro)}</b>. Agora é aguardar o pagamento.`}</p>`,
        { url: url + (ehPro ? '/cliente.html#contratacoes' : '/pro.html#pedidos'), label: 'Ver pedido' }) });
    return send(res, 200, { ok: true, status: 'aceito', total_cliente: ehCli ? v.cliente : undefined, total_pro: ehPro ? v.pro : undefined });
  }

  // ------------------------------------------------------------ central recomenda outro profissional
  if (b.acao === 'trocar_pro') {
    if (!me.isAdmin) throw fail(403, 'Só a central');
    if (!['solicitado', 'aceito', 'recusado'].includes(c.status)) throw fail(409, 'Esta contratação não pode mais trocar de profissional');
    if (b.pro_id === c.pro_id) throw fail(400, 'Escolha um profissional diferente');
    const { c: nova, v } = await criarContratacao({
      pro_id: b.pro_id, modalidade: c.modalidade, inicio: dataOk(b.inicio) || c.inicio, fim: dataOk(b.fim) || c.fim, horario: b.horario || c.horario,
      dias_semana: c.dias_semana, horas_dia: c.horas_dia, local_tipo: c.local_tipo, endereco: c.endereco, cidade: c.cidade,
      paciente_nome: c.paciente_nome, paciente_idade: c.paciente_idade, cuidados: c.cuidados, notas: c.notas,
      tipo: c.tipo, empresa_nome: c.empresa_nome, empresa_cnpj: c.empresa_cnpj,
    }, c.cliente_id, 'central', c.necessidade_id);
    if (c.status !== 'recusado') await admin(`contratacoes?id=eq.${c.id}`, { method: 'PATCH', body: { status: 'cancelado', motivo: `Substituído pela central pelo pedido #${nova.codigo}`, updated_at: agora() } });
    if (c.necessidade_id) await admin(`necessidades?id=eq.${c.necessidade_id}&status=neq.cancelada`, { method: 'PATCH', body: { status: 'em_busca', updated_at: agora() } });
    sendEmail({ to: await emailDe(nova.pro_id), subject: `A nossa central indicou você: ${resumo(nova)}`,
      html: shell('Novo pedido pela central', `<p>${escH(resumo(nova))} · você recebe <b>${brl(v.pro)}</b>.</p>`, { url: url + '/pro.html#pedidos', label: 'Ver e responder' }) });
    sendEmail({ to: await emailDe(c.cliente_id), subject: `Indicamos outro profissional · #${nova.codigo}`,
      html: shell('Outro profissional para você', `<p>${escH(nova.pro_nome.split(' ')[0])} recebeu o seu pedido (${escH(resumo(nova))}). Total: <b>${brl(v.cliente)}</b>. Avisamos quando aceitar.</p>`, { url: url + '/cliente.html#contratacoes', label: 'Acompanhar' }) });
    return send(res, 200, { ok: true, id: nova.id, codigo: nova.codigo, total_cliente: v.cliente });
  }

  throw fail(400, 'Ação desconhecida');
});

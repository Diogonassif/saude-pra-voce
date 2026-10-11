// Contratações: criar pelo catálogo, indicação da central, aceitar, recusar, cancelar, concluir e avisos.
// Toda conta de dinheiro é feita aqui (valor do profissional + 15% Saúde Pra Você + 10% Mind, somados por cima).
import { send, readJson, who, admin, one, isUuid, money, brl, fail, handler, appUrl, sendEmail, shell, escH,
  emailDe, emailCentral, MODAL, taxas, calcular, diasDoPeriodo } from './_lib.js';

const dataOk = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? s : null);
const horaOk = (s) => (/^\d{2}:\d{2}$/.test(String(s || '')) ? s : null);
const hoje = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const txt = (s, n) => String(s || '').trim().slice(0, n);
const LOCAIS = ['residencia', 'hospital', 'clinica', 'outro'];
const ESPEC = { enfermeiro: 'Enfermeiro(a)', tecnico: 'Técnico(a) de enfermagem', cuidador: 'Cuidador(a)', acompanhante: 'Acompanhante hospitalar' };
const resumo = (c) => `${ESPEC[c.especialidade] || 'Atendimento'} · ${c.inicio.split('-').reverse().join('/')}${c.fim !== c.inicio ? ' a ' + c.fim.split('-').reverse().join('/') : ''}`;

async function carregar(id) {
  if (!isUuid(id)) throw fail(400, 'Contratação inválida');
  const c = await one(`contratacoes?id=eq.${id}&select=*`);
  if (!c) throw fail(404, 'Contratação não encontrada');
  return c;
}

// monta e grava uma contratação (usado pelo contratante no catálogo e pela central ao indicar)
async function criarContratacao(b, clienteId, origem, necessidadeId) {
  if (!isUuid(b.pro_id)) throw fail(400, 'Escolha um profissional');
  const pro = await one(`pros?user_id=eq.${b.pro_id}&select=user_id,nome,especialidade,publicado,coren_status,valor_hora,valor_12h,valor_24h`);
  if (!pro || !pro.publicado) throw fail(404, 'Este profissional não está disponível agora');
  if (['tecnico', 'enfermeiro'].includes(pro.especialidade) && pro.coren_status !== 'ativo') throw fail(409, 'O COREN deste profissional ainda não foi conferido pela central');
  if (pro.user_id === clienteId) throw fail(400, 'Você não pode contratar a si mesmo');
  const modalidade = MODAL[b.modalidade] ? b.modalidade : 'hora';
  const base = +pro[MODAL[modalidade].campo];
  if (!(base > 0)) throw fail(400, 'Este profissional não atende nessa modalidade');
  const inicio = dataOk(b.inicio), fim = dataOk(b.fim) || inicio;
  if (!inicio) throw fail(400, 'Informe a data de início');
  if (inicio < hoje()) throw fail(400, 'A data de início já passou');
  if (fim < inicio) throw fail(400, 'O fim precisa ser depois do início');
  if ((new Date(fim) - new Date(inicio)) / 864e5 > 180) throw fail(400, 'Contrate no máximo 6 meses por vez');
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

  const cli = await one(`profiles?id=eq.${clienteId}&select=nome`);
  const idade = b.paciente_idade === '' || b.paciente_idade == null ? null : Math.round(+b.paciente_idade);
  const row = {
    cliente_id: clienteId, pro_id: pro.user_id, cliente_nome: (cli && cli.nome) || '', pro_nome: pro.nome,
    necessidade_id: necessidadeId || null, origem, especialidade: pro.especialidade, modalidade,
    inicio, fim, horario: horaOk(b.horario), horas_dia: horasDia, dias_semana: semana, dias: dias.length, quantidade,
    local_tipo: LOCAIS.includes(b.local_tipo) ? b.local_tipo : 'residencia', endereco: txt(b.endereco, 300), cidade: txt(b.cidade, 80) || null,
    paciente_nome: txt(b.paciente_nome, 120), paciente_idade: idade >= 0 && idade <= 120 ? idade : null,
    cuidados: txt(b.cuidados, 3000), notas: txt(b.notas, 2000), status: 'solicitado',
  };
  const [c] = await admin('contratacoes', { method: 'POST', prefer: 'return=representation', body: row });
  const t = await taxas();
  const v = calcular(base, quantidade, t);
  await Promise.all([
    admin('contratacao_pro', { method: 'POST', body: { contratacao_id: c.id, valor_unit: v.unitPro, total: v.pro } }),
    admin('contratacao_cliente', { method: 'POST', body: { contratacao_id: c.id, valor_unit: v.unitCli, total: v.cliente } }),
    admin('contratacao_split', { method: 'POST', body: { contratacao_id: c.id, taxa_debcare_pct: t.debcare, taxa_mind_pct: t.mind, pro: v.pro, debcare: v.debcare, mind: v.mind } }),
  ]);
  return { c, v };
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
    }, b), n.cliente_id, 'central', n.id);
    await admin(`necessidades?id=eq.${n.id}`, { method: 'PATCH', body: { status: 'em_busca', updated_at: agora() } });
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

  throw fail(400, 'Ação desconhecida');
});

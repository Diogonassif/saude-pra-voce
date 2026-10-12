import re
V='/tmp/claude-0/-home-claude/e239fc87-4221-565e-b778-5002a824e59c/scratchpad/videos/'
MIND='''<svg viewBox="2.52 0.69 397.64 87.07" aria-label="MindFy Tech">'''+re.search(r'<title>Mindfy Tech</title>(.*)</svg>', open(V+'mind.svg').read(), re.S).group(1)+'</svg>'
ICON='<svg viewBox="0 0 64 64" width="92" height="92"><rect x="1" y="1" width="62" height="62" rx="15" fill="#0E2B36" stroke="rgba(255,255,255,.25)" stroke-width="2"/><path d="M32 50C18 41 12 33 12 25c0-6.5 5-11 10.8-11 4.2 0 7.4 2.4 9.2 5.6C33.8 16.4 37 14 41.2 14 47 14 52 18.5 52 25c0 8-6 16-20 25z" fill="#2BB59A"/><path d="M32 25v12M26 31h12" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/></svg>'
def page(total, aud, blobs, scenes):
    return f'''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><link rel="stylesheet" href="engine.css"></head>
<body data-total="{total}"><div id="stage">{blobs}
<div class="top">{ICON}<span class="wm">Saúde <b>Pra Você</b></span><span class="aud">{aud}</span></div>
{scenes}
<div class="seal">Solution by {MIND}</div><div class="ilus">Imagens ilustrativas</div><div class="bar"><i></i></div>
</div><script src="engine.js"></script></body></html>'''
import sys

# ===================================================== PROFISSIONAL (84s)
PRO = '''
<section class="scene" data-s="0" data-e="7">
  <div class="kicker" data-in="0.3">Cuidador · Técnico · Enfermeiro · Acompanhante</div>
  <h1 data-in="0.8">Você cuida.</h1>
  <h1 data-in="1.8"><em>Você define<br>quanto vale.</em></h1>
  <p class="lead" data-in="3.2">A Saúde Pra Você é o app onde o profissional de saúde é <b>dono do próprio serviço</b>.</p>
</section>

<section class="scene" data-s="7" data-e="17">
  <div class="kicker" data-in="0.2">Comece em 5 minutos</div>
  <h2 data-in="0.5">Monte seu perfil <em>do seu jeito</em>.</h2>
  <div class="steps">
    <div class="step" data-in="1.4" data-fx="left"><div class="no">1</div><div><b>Crie a conta com o celular</b><small>Grátis. Sem mensalidade.</small></div></div>
    <div class="step" data-in="2.6" data-fx="left"><div class="no">2</div><div><b>Escolha sua especialidade</b><small>Cuidador, técnico, enfermeiro ou acompanhante</small></div></div>
    <div class="step" data-in="3.8" data-fx="left"><div class="no">3</div><div><b>Conte sua experiência</b><small>Anos de trabalho, cuidados que você faz, regiões que atende</small></div></div>
    <div class="step" data-in="5.0" data-fx="left"><div class="no">4</div><div><b>Defina seus valores e publique</b><small>Pronto: você aparece no catálogo</small></div></div>
  </div>
</section>

<section class="scene" data-s="17" data-e="28">
  <div class="kicker" data-in="0.2">Você é o dono do seu serviço</div>
  <h2 data-in="0.5">Você coloca o <em>seu preço</em>: o seu valor de mercado.</h2>
  <div class="phone" data-in="1.4" data-fx="pop">
    <div class="ph-h">Quanto você quer ganhar</div>
    <div class="fld"><span>Por hora</span><b data-type="2.6" data-speed="0.22">R$ 45</b></div>
    <div class="fld"><span>Plantão de 12h</span><b data-type="4.2" data-speed="0.22">R$ 380</b></div>
    <div class="fld"><span>Plantão de 24h</span><b data-type="5.8" data-speed="0.22">R$ 650</b></div>
    <div class="btn g" style="width:100%;margin-top:6px" data-in="7.6" data-fx="pop">Publicar no catálogo</div>
  </div>
  <p class="lead" data-in="8.4" style="font-size:36px;text-align:center">Mude seus valores quando quiser.</p>
</section>

<section class="scene" data-s="28" data-e="38">
  <div class="kicker" data-in="0.2">Sem desconto no seu valor</div>
  <h2 data-in="0.5">A taxa da plataforma <em>não sai do seu bolso</em>.</h2>
  <div class="card" data-in="1.5" data-fx="pop">
    <div class="linha" data-in="2.3"><span>Você definiu (plantão 12h)</span><span>R$ 380</span></div>
    <div class="linha m" data-in="3.4"><span>Taxa da plataforma, somada por cima</span><span>+ R$ 95</span></div>
    <div class="linha m" data-in="4.5"><span>A família vê e paga</span><span>R$ 475</span></div>
    <div class="linha t" data-in="5.6"><span>Você recebe</span><span style="color:#1F8F78" data-count="380" data-at="5.8" data-d="1.6">R$ 0</span></div>
  </div>
  <p class="lead" data-in="7.4" style="font-size:32px">Tarifas do Mercado Pago seguem as condições da sua conta.</p>
</section>

<section class="scene" data-s="38" data-e="48">
  <div class="kicker" data-in="0.2">Novos contratantes</div>
  <h2 data-in="0.5">Famílias da sua região <em>encontram você</em>.</h2>
  <div class="notif" data-in="1.6" data-fx="drop">
    <div class="ic"><svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#7FE0C8" stroke-width="2.4" stroke-linecap="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg></div>
    <div><div class="t">Novo pedido · agora</div><div class="m">3 plantões de 12h · você recebe R$ 1.140</div></div>
  </div>
  <div class="card" data-in="3.2" data-fx="pop">
    <div style="font-size:30px;font-weight:800;color:#5E7C84">VOCÊ VÊ TUDO ANTES DE ACEITAR</div>
    <div class="det">
      <div data-in="4.0"><span>Quando</span><b>Sex a dom · 19h às 7h</b></div>
      <div data-in="4.6"><span>Onde</span><b>Residência · Franca/SP</b></div>
      <div data-in="5.2"><span>Quem recebe o cuidado</span><b>Sr. Antônio, 82 anos</b></div>
      <div data-in="5.8"><span>Cuidados</span><b>Medicação, banho, mudança de posição</b></div>
    </div>
  </div>
</section>

<section class="scene" data-s="48" data-e="57">
  <div class="kicker" data-in="0.2">Você decide</div>
  <h2 data-in="0.5">Aceite, sugira <em>outra data</em> ou recuse.</h2>
  <div class="row" data-in="1.5"><div class="btn g" style="flex:1">Aceitar</div><div class="btn o" style="flex:1">Outra data</div></div>
  <div style="display:flex;flex-direction:column;gap:20px">
    <div class="bub out" data-in="3.0" data-fx="right">Nessa sexta não consigo. Posso de sábado a segunda?</div>
    <div class="bub in" data-in="4.6" data-fx="left">Pode sim! Aceitei a nova data.</div>
  </div>
  <p class="lead" data-in="6.0" style="font-size:36px">A família aceita a nova data pelo app e o valor é recalculado sozinho.</p>
</section>

<section class="scene" data-s="57" data-e="66">
  <div class="kicker" data-in="0.2">Sua agenda, suas folgas</div>
  <h2 data-in="0.5">Você controla <em>quando trabalha</em>.</h2>
  <div class="card" data-in="1.4" data-fx="pop">
    <div class="cal">
      <span class="h">Seg</span><span class="h">Ter</span><span class="h">Qua</span><span class="h">Qui</span><span class="h">Sex</span><span class="h">Sáb</span><span class="h">Dom</span>
      <span>12</span><span class="x">13</span><span class="x">14</span><span class="x">15</span><span>16</span><span>17</span><span class="o">18</span>
      <span>19</span><span>20</span><span>21</span><span>22</span><span>23</span><span>24</span><span class="o">25</span>
      <span class="o">26</span><span class="o">27</span><span class="o">28</span><span class="o">29</span><span class="o">30</span><span>31</span><span class="o">1</span>
    </div>
  </div>
  <div class="lista">
    <div class="item" data-in="2.6" data-fx="left" style="font-size:38px"><div class="ck">✓</div><div>Bloqueie férias e viagens<small>Ninguém pede nesses dias</small></div></div>
    <div class="item" data-in="3.8" data-fx="left" style="font-size:38px"><div class="ck">✓</div><div>Folga fixa todo domingo<small>Ou nos dias que você escolher</small></div></div>
    <div class="item" data-in="5.0" data-fx="left" style="font-size:38px"><div class="ck">✓</div><div>Atendimentos pagos entram sozinhos<small>Dias ocupados ficam marcados</small></div></div>
  </div>
</section>

<section class="scene" data-s="66" data-e="74">
  <div class="kicker" data-in="0.2">Pagamento garantido</div>
  <h2 data-in="0.5">A família paga <em>pelo app</em>. Você recebe na sua conta.</h2>
  <div class="flow" data-in="1.6">
    <div class="fb">Família<small>Pix ou cartão</small></div><div class="ar">→</div>
    <div class="fb">Mercado Pago<small>pagamento seguro</small></div><div class="ar">→</div>
    <div class="fb" style="background:#7FE0C8">Sua conta<small style="color:#0E2B36">seu valor</small></div>
  </div>
  <div class="lista">
    <div class="item" data-in="3.2" data-fx="left" style="font-size:38px"><div class="ck">✓</div><div>Sem cobrar ninguém, sem dinheiro na mão</div></div>
    <div class="item" data-in="4.2" data-fx="left" style="font-size:38px"><div class="ck">✓</div><div>Contato liberado depois do pagamento</div></div>
    <div class="item" data-in="5.2" data-fx="left" style="font-size:38px"><div class="ck">✓</div><div>Recebimentos de cada mês no app</div></div>
  </div>
</section>

<section class="scene" data-s="74" data-e="80">
  <div class="kicker" data-in="0.2">Mais confiança, mais pedidos</div>
  <h2 data-in="0.5">Ganhe o <em>selo verificado</em>.</h2>
  <div class="card" data-in="1.4" data-fx="pop">
    <div class="pro"><div class="av">AR</div><div><div class="n">Ana R. <span class="selo">✓ Selo verificado</span></div><div class="s">Técnica de enfermagem · COREN conferido</div></div></div>
    <div class="chips" style="margin-top:26px"><span class="chip">Curativos</span><span class="chip">Pós-operatório</span><span class="chip">Idosos</span></div>
  </div>
  <p class="lead" data-in="2.8" style="font-size:36px">Documentos e COREN conferidos pela nossa central. Avaliações das famílias aparecem no seu perfil.</p>
</section>

<section class="scene cta" data-s="80" data-e="88" data-last="1">
  <h1 data-in="0.3" style="font-size:104px">Seu trabalho,<br><em>seu valor.</em></h1>
  <p class="lead" data-in="1.2">Crie seu perfil grátis e comece a receber pedidos.</p>
  <div class="url" data-in="2.0" data-fx="pop">saudepravoce.com</div>
  <div class="chips" data-in="3.0" style="justify-content:center"><span class="chip">Cuidador(a)</span><span class="chip">Técnico(a)</span><span class="chip">Enfermeiro(a)</span><span class="chip">Acompanhante</span></div>
</section>
'''

# ===================================================== CONTRATANTE (86s)
CLI = '''
<section class="scene" data-s="0" data-e="7">
  <div class="kicker" data-in="0.3">Em casa ou no hospital</div>
  <h1 data-in="0.8">Cuidado de confiança</h1>
  <h1 data-in="1.8"><em>para quem<br>você ama.</em></h1>
  <p class="lead" data-in="3.2">Contrate cuidadores, técnicos de enfermagem, enfermeiros e acompanhantes hospitalares pelo app.</p>
</section>

<section class="scene" data-s="7" data-e="17">
  <div class="kicker" data-in="0.2">Como funciona</div>
  <h2 data-in="0.5">Contratar em <em>4 passos</em>.</h2>
  <div class="steps">
    <div class="step" data-in="1.4" data-fx="left"><div class="no">1</div><div><b>Escolha o profissional</b><small>Veja perfil, experiência e preço</small></div></div>
    <div class="step" data-in="2.6" data-fx="left"><div class="no">2</div><div><b>Diga quando e onde</b><small>Dias, horários, casa ou hospital</small></div></div>
    <div class="step" data-in="3.8" data-fx="left"><div class="no">3</div><div><b>O profissional aceita</b><small>Você acompanha tudo pelo app</small></div></div>
    <div class="step" data-in="5.0" data-fx="left"><div class="no">4</div><div><b>Pague pelo app e pronto</b><small>Pix ou cartão, com segurança</small></div></div>
  </div>
</section>

<section class="scene" data-s="17" data-e="27">
  <div class="kicker" data-in="0.2">Você escolhe</div>
  <h2 data-in="0.5">Profissionais da sua região, <em>lado a lado</em>.</h2>
  <div class="chips" data-in="1.2"><span class="chip" data-on="1.8">Cuidador(a)</span><span class="chip">Técnico(a)</span><span class="chip">Enfermeiro(a)</span><span class="chip">Acompanhante</span></div>
  <div class="card" data-in="2.2" data-fx="right">
    <div class="pro"><div class="av">MC</div><div><div class="n">Márcia C. <span class="selo">✓ Selo verificado</span></div><div class="s">Cuidadora · 10 anos · idosos e Alzheimer</div></div></div>
    <div class="precos"><div><span>Por hora</span><b>R$ 50</b></div><div><span>Plantão 12h</span><b>R$ 450</b></div><div><span>Plantão 24h</span><b>R$ 800</b></div></div>
  </div>
  <div class="card" data-in="3.6" data-fx="right">
    <div class="pro"><div class="av" style="background:#FDF0CF;color:#7A4E00">RT</div><div><div class="n">Rafael T. <span class="selo">✓ Selo verificado</span></div><div class="s">Técnico de enfermagem · COREN conferido</div></div></div>
  </div>
</section>

<section class="scene" data-s="27" data-e="36">
  <div class="kicker" data-in="0.2">Conheça antes de contratar</div>
  <h2 data-in="0.5">Veja o perfil <em>completo</em>.</h2>
  <div class="card" data-in="1.4" data-fx="pop">
    <div class="pro"><div class="av">MC</div><div><div class="n">Márcia C.</div><div class="s">Cuidadora · 10 anos de experiência</div></div></div>
    <div style="font-size:24px;letter-spacing:1.5px;color:#5E7C84;font-weight:800;margin-top:28px" data-in="2.4">CUIDADOS QUE FAZ</div>
    <div class="chips" style="margin-top:12px" data-in="2.6"><span class="chip">Higiene e banho</span><span class="chip">Medicação</span><span class="chip">Alzheimer</span><span class="chip">Acamados</span><span class="chip">Alimentação</span></div>
    <div style="font-size:24px;letter-spacing:1.5px;color:#5E7C84;font-weight:800;margin-top:28px" data-in="3.8">AGENDA DAS PRÓXIMAS SEMANAS</div>
    <div class="cal" style="margin-top:12px" data-in="4.0"><span>13</span><span class="x">14</span><span class="x">15</span><span>16</span><span>17</span><span class="o">18</span><span>19</span></div>
  </div>
  <p class="lead" data-in="5.4" style="font-size:36px">E as avaliações de outras famílias que já contrataram.</p>
</section>

<section class="scene" data-s="36" data-e="46">
  <div class="kicker" data-in="0.2">Do seu jeito</div>
  <h2 data-in="0.5">Algumas horas, plantões ou <em>semanas inteiras</em>.</h2>
  <div class="phone" data-in="1.4" data-fx="pop" style="display:flex;flex-direction:column;gap:24px">
    <div class="seg"><div data-on="2.4">Por hora</div><div data-on="99">Plantão 12h</div><div>Plantão 24h</div></div>
    <div style="font-size:28px;font-weight:700;color:#5E7C84">Dias da semana</div>
    <div class="seg" style="gap:10px"><div data-on="3.4">Seg</div><div data-on="3.7">Ter</div><div data-on="4.0">Qua</div><div data-on="4.3">Qui</div><div data-on="4.6">Sex</div><div>Sáb</div><div>Dom</div></div>
    <div style="font-size:28px;font-weight:700;color:#5E7C84">Horas por dia · horário</div>
    <div class="seg"><div data-on="5.4">6 horas</div><div data-on="5.8">a partir das 8h</div></div>
    <div style="font-size:28px;font-weight:700;color:#5E7C84">Onde</div>
    <div class="seg"><div data-on="6.8">Residência</div><div>Hospital</div><div>Clínica</div></div>
  </div>
</section>

<section class="scene" data-s="46" data-e="55">
  <div class="kicker" data-in="0.2">Sem surpresa</div>
  <h2 data-in="0.5">O <em>preço final</em> aparece antes de você pedir.</h2>
  <div class="card" data-in="1.4" data-fx="pop">
    <div class="linha" data-in="2.2"><span>Plantão de 12h</span><span>R$ 450</span></div>
    <div class="linha m" data-in="3.0"><span>3 noites (sex, sáb e dom)</span><span>× 3</span></div>
    <div class="tot" style="margin-top:20px" data-in="3.8"><span>Total a pagar pelo app</span><b data-count="1350" data-at="4.0" data-d="1.6" data-dec="2">R$ 0,00</b></div>
  </div>
  <p class="lead" data-in="6.2"><b>Você só paga depois que o profissional aceitar.</b> Pix ou cartão.</p>
</section>

<section class="scene" data-s="55" data-e="63">
  <div class="kicker" data-in="0.2">Flexível até o fim</div>
  <h2 data-in="0.5">Mudou algo? <em>Edite o pedido</em> antes de pagar.</h2>
  <div class="lista">
    <div class="item" data-in="1.6" data-fx="left"><div class="ck">✓</div><div>Troque datas, horários e cuidados<small>O valor é recalculado na hora</small></div></div>
    <div class="item" data-in="2.8" data-fx="left"><div class="ck">✓</div><div>O profissional pode sugerir outra data<small>Você aceita ou mantém a original</small></div></div>
    <div class="item" data-in="4.0" data-fx="left"><div class="ck">✓</div><div>Converse pelo app com segurança<small>O contato aparece depois do pagamento</small></div></div>
  </div>
</section>

<section class="scene" data-s="63" data-e="72">
  <div class="kicker" data-in="0.2">Confiança em cada etapa</div>
  <h2 data-in="0.5">Segurança para você e para <em>quem você ama</em>.</h2>
  <div class="lista">
    <div class="item" data-in="1.4" data-fx="left"><div class="ck">✓</div><div>COREN conferido pela nossa central<small>Para técnicos e enfermeiros</small></div></div>
    <div class="item" data-in="2.4" data-fx="left"><div class="ck">✓</div><div>Selo verificado e documentos<small>Identidade e antecedentes</small></div></div>
    <div class="item" data-in="3.4" data-fx="left"><div class="ck">✓</div><div>Pagamento seguro pelo app<small>Nada de dinheiro na mão</small></div></div>
    <div class="item" data-in="4.4" data-fx="left"><div class="ck">✓</div><div>Avaliações de outras famílias<small>Escolha com quem já foi bem avaliado</small></div></div>
  </div>
</section>

<section class="scene" data-s="72" data-e="79">
  <div class="kicker" data-in="0.2">Não achou?</div>
  <h2 data-in="0.5">A nossa <em>central encontra</em> para você.</h2>
  <div style="display:flex;flex-direction:column;gap:22px">
    <div class="bub out" data-in="1.6" data-fx="right">Preciso de acompanhante à noite no hospital, a partir de sexta.</div>
    <div class="bub in" data-in="3.4" data-fx="left">Encontramos! A Joana está disponível. Confirme no app e pronto.</div>
  </div>
  <p class="lead" data-in="4.8" style="font-size:36px">Casos urgentes ou cuidados específicos: conte do que precisa.</p>
</section>

<section class="scene cta" data-s="79" data-e="87" data-last="1">
  <h1 data-in="0.3" style="font-size:104px">Contrate com<br><em>tranquilidade.</em></h1>
  <p class="lead" data-in="1.2">Crie sua conta grátis e veja quem está disponível perto de você.</p>
  <div class="url" data-in="2.0" data-fx="pop">saudepravoce.com</div>
</section>
'''
BP = '<div class="blob" style="width:700px;height:700px;background:#2BB59A;right:-260px;top:280px"></div><div class="blob" style="width:600px;height:600px;background:#F6D27A;left:-300px;bottom:200px;opacity:.12"></div>'
BC = '<div class="blob" style="width:700px;height:700px;background:#2BB59A;left:-280px;top:360px"></div><div class="blob" style="width:600px;height:600px;background:#7FE0C8;right:-260px;bottom:260px;opacity:.15"></div>'
open(V+'pro2.html','w').write(page(88, 'para profissionais', BP, PRO))
open(V+'cli2.html','w').write(page(87, 'para famílias', BC, CLI))
print('built')

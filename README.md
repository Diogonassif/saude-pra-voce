# DebCare

Contratação de profissionais de saúde e cuidado: **cuidadores, técnicos de enfermagem, enfermeiros e acompanhantes hospitalares**. Mesma base do ITMindMatch (páginas estáticas em `public/`, funções da Vercel em `api/`, banco e login no Supabase), com gestão da MindFy Tech.

## Como funciona

1. **Profissional** cria conta (celular + senha), escolhe a especialidade e define o valor dele: por hora (obrigatório) e, se quiser, plantão de 12h e de 24h. Envia documentos (identidade, COREN, antecedentes) para o selo DebCare e conecta o Mercado Pago.
2. **Contratante** escolhe no catálogo, define o período (dias, dias da semana, horário, horas por dia ou plantões) e vê o total na hora. Envia o pedido.
3. O profissional **aceita**. O contratante **paga pelo app** (Pix ou cartão, Mercado Pago). Pago, os dias entram na agenda do profissional e o contato de cada um aparece para o outro.
4. **Não achou no catálogo?** O contratante descreve a necessidade e ela cai na **Central** (painel). A central indica um profissional; o pedido segue o mesmo fluxo (aceite → pagamento).

## Regras de dinheiro

- Preço ao contratante = valor do profissional **+ 15% DebCare + 10% Mind** (soma simples). R$ 100/h → R$ 125/h.
- O pagamento cai na conta Mercado Pago do profissional; os 25% vão como `marketplace_fee` para a conta da **DebCare** (dona da aplicação de marketplace).
- A DebCare repassa os 10% da Mind. O painel mostra o saldo a repassar por mês e registra os repasses; o **MindSaaS** mostra o alerta "Cobrar a DebCare" lendo `mindsaas.debcare_cobranca()`.
- Quem vê o quê: o contratante só vê o preço final; o profissional só vê o valor dele; a divisão só o painel vê. Garantido por RLS (`contratacao_cliente`, `contratacao_pro`, `contratacao_split`, função `catalogo()`), não só pela tela.
- Taxas editáveis no painel (Taxas e central). Toda conta é feita no servidor (`api/contratar.js`).

## Telas

| Página | Quem usa | O que tem |
|---|---|---|
| `/` | todos | apresentação, prévia do catálogo |
| `/contratante.html`, `/profissional.html` | divulgação | um link para cada público |
| `/entrar.html` | todos | celular + senha, criar conta, escolher papel |
| `/cliente.html` | contratante | catálogo com filtros, contratar com período e total, minhas contratações, pedir à central, conta |
| `/pro.html` | profissional | início, pedidos, agenda, perfil e valores, documentos, recebimentos |
| `/admin.html` | central DebCare e Mind | visão geral, central (necessidades), contratações com divisão, profissionais (selo, documentos, nova senha), contratantes, financeiro e repasse à Mind, taxas |

Privacidade: chat com telefone, e-mail e links ocultos até o pagamento; endereço completo e contato só depois do pagamento; avisos sem dados do paciente.

## Variáveis de ambiente (Vercel)

| Variável | Obrigatória | O que é |
|---|---|---|
| `SUPABASE_URL` | sim | URL do projeto Supabase do DebCare |
| `SUPABASE_ANON_KEY` | sim | chave publicável |
| `SUPABASE_SERVICE_ROLE_KEY` | sim | chave secreta |
| `APP_URL` | sim | `https://xn--saudeparavoc-zeb.com` (saudeparavocê.com) |
| `APP_SECRET` | sim | segredo aleatório (estado do OAuth do Mercado Pago) |
| `MP_CLIENT_ID`, `MP_CLIENT_SECRET` | para receber | aplicação de marketplace **na conta Mercado Pago da DebCare** |
| `MINDSAAS_KEY` | para o MindSaaS | chave da rota `GET /api/mindsaas` (header `x-api-key`) |
| `RESEND_API_KEY`, `EMAIL_FROM` | opcional | avisos por e-mail para quem cadastrou e-mail e para a central |

`public/lib/config.js` recebe a URL e a chave publicável do Supabase.

## Domínio

**saudeparavocê.com** (com acento). Na internet ele é escrito em punycode: `xn--saudeparavoc-zeb.com`, e é esse que vai no Vercel, no DNS, no `APP_URL`, na URL de retorno do Supabase e na Redirect URI do Mercado Pago. O navegador mostra a versão com acento.

- Vercel → Domains: `xn--saudeparavoc-zeb.com` e `www.xn--saudeparavoc-zeb.com` (www redireciona para o principal).
- DNS no registrador: A `@` → 76.76.21.21; CNAME `www` → cname.vercel-dns.com.
- Recomendado: registrar também `saudeparavoce.com` (sem acento), porque muita gente digita sem o ê, e redirecionar para o principal.

## Supabase

- Migração única em `supabase/migrations/`.
- Authentication → URL Configuration: Site URL `https://xn--saudeparavoc-zeb.com`; Redirect URLs incluem `https://xn--saudeparavoc-zeb.com/**`.
- Authentication → Providers → Email: **desligar "Confirm email"** (o login é celular + senha com e-mail técnico `<dígitos>@tel.debcare.app`).
- API → Exposed schemas: incluir `mindsaas` (para a rota do MindSaaS).
- Equipe do painel: celulares em `config.admins` (painel → Taxas e central). Quem tiver o celular na lista vira administrador.

## Mercado Pago

- Aplicação de marketplace criada na conta da DebCare. Redirect URI: `APP_URL/api/mp-conectar`.
- Webhook por cobrança: `APP_URL/api/mp-webhook?pg=<id>`; o status é sempre conferido na API do Mercado Pago com o token do profissional.

## Testes

Testado localmente com Postgres 16 + PostgREST + as funções reais e Mercado Pago simulado: 32 verificações ponta a ponta (cadastro, catálogo com 25% somados, contratação de 3 plantões com divisão 1500/1200/180/120, RLS de preço e divisão, chat mascarado, aceite, pagamento com split de R$ 300, agenda, avaliação, bloqueio de folga, pedido à central e indicação, alerta e repasse à Mind, rota do MindSaaS).

## Marca

`marca/`: ícone e logo (fundo claro e escuro) em SVG e PNG. Ícones do app em `public/icons/`, imagem de compartilhamento em `public/og.png`.

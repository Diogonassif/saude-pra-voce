# DESIGN_IDENTITY.md — Identidade visual e padrões de design da MindFy Tech (Mind)

> Versão de 14/10/2026. Fonte: o "Padrão dos APPs" (P-001, P-002, P-003), o arquivo `lib/mind-padrao.css` (versão `2026-10-13.1`) e os estilos já existentes nos apps da Mind (branch `teste`).
> Objetivo: qualquer interface nova ou adaptada para a Mind deve seguir este documento sem redefinir padrões.
> Quando algo **ainda não foi definido**, está escrito "não definido". Não preencha essas lacunas por conta própria: pergunte ao Nassif.

---

## 1. Regras de ouro

1. **Todo app da Mind segue o "Padrão dos APPs"** e todo app novo já nasce nele. Uma mudança num item do padrão vale para **todos** os apps.
2. **Cada app só muda duas coisas: a cor principal e o logo.** Fonte, cantos, tela de entrada, cores de status, rodapé e componentes são iguais em todos.
3. **O modelo de referência é o My Job IT.** Na dúvida sobre como algo deve parecer, copie o My Job IT.
4. **Fonte única: Plus Jakarta Sans.**
5. **Cantos entre 10 e 16 px** (pílulas e chips são a exceção, com 999 px).
6. **Assinatura "Solution by MindFy Tech"** no pé das telas de entrada (e nas imagens de compartilhamento/OG).
7. **Teste antes de Produção.** Toda mudança visual vai primeiro para o ambiente de Teste do app (branch `teste`, banco Supabase de teste, selo vermelho "AMBIENTE DE TESTE"). Só vai para `main` depois da aprovação do Nassif.
8. Cada repositório tem `PADRAO-APPS.md` com a lista P-001, P-002, P-003… Ao adaptar um app, atualize esse arquivo.

---

## 2. Itens do Padrão dos APPs

| Código | Desde | Item | Situação |
|---|---|---|---|
| P-001 | 12/10/2026 | Botão de olho (mostrar/esconder) em **todo** campo de senha | Em vigor em todos os apps com senha |
| P-002 | 12/10/2026 | Faixa "Ver como" no topo para trocar de perfil (modelo My Job IT) | Em vigor nos apps com mais de um perfil |
| P-003 | 13/10/2026 | Visual e navegação únicos (modelo My Job IT). Etapa 1 = tela de entrada | Etapa 1 aplicada nos testes, aguardando aprovação. Etapa 2 (topo e menu das telas internas) ainda não especificada |

### P-001 · Olho na senha
- Todo `input[type=password]` ganha um botão de olho à direita.
- HTML puro: `lib/mind-padrao.js` (versão `2026-10-12.1`), que aplica o olho em todo campo de senha, inclusive os criados depois (MutationObserver). React: componente `SenhaInput`.
- Botão de **42 × 42 px**, `aria-label` dinâmico "Mostrar senha" / "Esconder senha" (também em `title`).
- Ao enviar o formulário, a senha volta a ficar oculta.
- Classes de CSS: `.mp-pw` (contêiner) e `.mp-eye` (botão).

### P-002 · Faixa "Ver como"
- Só aparece para a **conta Mind (admin)**. Apps de um perfil só não mostram a faixa.
- Fica **fixa no topo de todas as telas**, acima do menu.
- Rótulo visível **"Ver como"**, seguido dos botões de perfil: **perfis de cliente primeiro, "Painel Mind" por último**.
- Perfil atual **destacado** (cor de destaque do app) e marcado com `aria-current="page"`.
- Abre os **dados reais** do perfil, sem novo login. A **demonstração** com dados de exemplo fica separada (cartão "Demonstração" no Painel Mind).
- Faixa **escura** (cor escura da marca do app).
- Nomes por app:

| App | Botões, na ordem |
|---|---|
| My Job IT | Empresa · Profissional · Painel Mind |
| VIP Motoristas | Passageiro · Motorista · Painel Mind |
| AeroDriver | Passageiro · Motorista · Painel Mind |
| Saúde Pra Você | Contratante · Profissional · Gestão · Painel Mind |
| Meu Processo | Advogado · Cliente · Painel Mind |

### P-003 · Visual único (etapa 1: tela de entrada)
Detalhado nas seções 3 a 6.

---

## 3. Paleta canônica (tokens `--mp-*` de `lib/mind-padrao.css`)

Este arquivo é **igual em todos os apps** e não deve ser editado dentro de um app. Cada app só redefine `--mp-cor`, `--mp-cor-ink`, `--mp-fundo-1` e `--mp-fundo-2` (antes de carregar o arquivo ou no `<body style>`).

| Token | HEX | Uso |
|---|---|---|
| `--mp-cor` | `#2D5BD8` (padrão; cada app troca) | Cor principal: botões, links, foco, destaque |
| `--mp-cor-ink` | `#FFFFFF` | Texto sobre a cor principal |
| `--mp-fundo-1` | `#1C3168` (padrão; cada app troca) | Cor clara do fundo escuro da entrada |
| `--mp-fundo-2` | `#0A1122` (padrão; cada app troca) | Cor escura do fundo escuro da entrada |
| `--mp-ink` | `#14203A` | Texto principal |
| `--mp-mute` | `#5A6684` | Texto secundário, termos, dicas |
| `--mp-line` | `#DDE2EA` | Bordas e campos |
| `--mp-sunk` | `#F4F6FA` | Áreas rebaixadas |
| `--mp-ok` / `--mp-ok-bg` | `#1E8A4E` / `#E2F4E9` | Sucesso |
| `--mp-warn` / `--mp-warn-bg` | `#A5650E` / `#FCF0DA` | Atenção |
| `--mp-err` / `--mp-err-bg` | `#C2362F` / `#FBE6E4` | Erro |
| `--mp-info` / `--mp-info-bg` | `#2D5BD8` / `#E5ECFC` | Informação |
| `--mp-raio` | `16px` | Cartões |
| `--mp-raio-sm` | `10px` | Botões e campos |

Cores fixas da tela de entrada:

| Uso | HEX |
|---|---|
| Frase (lead) sobre o fundo escuro | `#C9D4EE` |
| Rodapé "Solution by MindFy Tech" | `#9FB0D3` (link `#C9D4EE`) |
| Cartão | `#FFFFFF` |
| Selo "AMBIENTE DE TESTE" (todos os apps) | `#C2362F` |

**Cores de status são as mesmas em todos os apps** (ok/warn/err/info acima). Pílulas de status: `.mp-pill.ok`, `.warn`, `.err`, `.info` (texto na cor forte, fundo na cor `-bg`).

---

## 4. Cor de cada app

Cada app mantém a cor e o logo dele. Valores confirmados no código:

| App | `--mp-cor` | `--mp-fundo-1` → `--mp-fundo-2` | Outras cores da marca do app |
|---|---|---|---|
| My Job IT | `#2D5BD8` (= padrão) | `#1C3168` → `#0A1122` (fundo atual: `#1C3168` → `#0C1530` → `#0A1122`) | Navy `#14203A`; "Job" `#7EA0FF`; "IT" `#6FE3A0`; losango `#3FA46A` |
| MindSales | `#3A6BFF` | `#1F3A8A` → `#0B1433` | Marca do painel `#3A5DAA` (diverge de `--mp-cor`; ver seção 12) |
| MindFin Pro | `#2E8B5A` | `#14453A` → `#07161A` | "Pro" no logo da entrada `#5CCB8C`; marca do painel `#3A5DAA` |
| MindFin App | não usa `--mp-*` | entrada `#0B1117` | Accent `#2E6A88` (claro) / `#6FB0D0` (escuro) |
| AeroDriver | não usa `--mp-*` | fundo `--ink` `#13212E` | Destaque âmbar `#F2A93B`; "Driver" `#C27C12` |
| VIP Motoristas | não usa `--mp-*` | fundo `--ink` `#13212E` | Destaque verde `#3FA46A` (token se chama `--amber`); "Motoristas" `#3A5DAA` / `#9DB8FF` no escuro |
| Saúde Pra Você | não usa `--mp-*` | `#17495A` → `#0E2B36` → `#08202A` | Principal verde-petróleo `#17705F`; coração `#2BB59A`; "Pra Você" `#1F9C84` / `#6FE0C6` no escuro |
| Meu Processo | não usa `--mp-*` | `#24395F` → `#15233B` → `#0C1628` | Principal `#2B4C9B`; navy `#15233B`; dourado `#F2C14E` |

> Para os apps que ainda não usam `--mp-*`, os valores de `--mp-cor` / `--mp-fundo` **ainda não foram definidos**. Ao adaptar, proponha-os a partir das cores acima e peça aprovação.

### Marca MindFy Tech (assinatura de todos os apps)

| Elemento | HEX |
|---|---|
| Texto "Mind" sobre claro | `#13212E` (no MindSales: `#1E2D52`) |
| Texto sobre escuro | `#FFFFFF` |
| Losango verde | `#3FA46A` |
| "tech" sobre claro | `#3A5DAA` |
| "tech" sobre escuro | `#9DB8FF` |

- Arquivo de referência: `mindfin-pro/marca/logo-mindfy-tech.svg` (no Project). Em React: componente `MindLogo`.
- Texto da assinatura: **"Solution by MindFy Tech"**.

---

## 5. Tipografia

| Item | Valor |
|---|---|
| Família | **Plus Jakarta Sans** (Google Fonts, pesos 400, 500, 600, 700, 800) |
| Pilha de fallback | `"Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif` |
| Corpo | 15 px, line-height 1.45 |
| Logo em texto (entrada) | 28 px, peso 800, letter-spacing −0.01em; logo em imagem com 34 px de altura |
| Título do cartão (h2) | 18 px, peso 800 |
| Rótulo de campo | 13 px, peso 700 |
| Texto do campo | 15 px, peso 500 |
| Botão | 15 px, peso 800 |
| Link de ação | peso 800, na cor `--mp-cor` |
| Dica / termos / rodapé | 12–12,5 px |
| Monoespaçada (códigos, `#ids`) | JetBrains Mono 500/700 (usada no My Job IT) |

Escala do modelo (My Job IT, telas internas): h1 28 px/800 (24 px no celular), h2 18 px/700, h3 15 px/700, corpo 15 px/1.45. Título de landing: `clamp(38px, 6vw, 72px)`.

---

## 6. Tela de entrada (P-003, etapa 1)

Estrutura obrigatória, de cima para baixo:

1. **Fundo escuro na cor do app**: `radial-gradient(900px 700px at 70% 10%, var(--mp-fundo-1) 0%, var(--mp-fundo-2) 70%)`, tela inteira, conteúdo centralizado.
2. **Logo** centralizado.
3. **Frase curta** do app, centralizada, em `#C9D4EE`.
4. **Cartão branco** com:
   - título ("Entrar", "Criar conta" ou "Nova senha");
   - campos com **rótulo em cima**;
   - **botão largo** (largura total);
   - link **"Esqueci a senha"**;
   - **"Primeira vez aqui? Criar conta"** (no cadastro vira "Já tem conta? Entrar"). Não usar abas Entrar/Criar conta;
   - **termos no pé do cartão**: "Ao continuar você aceita os Termos de uso e a Política de privacidade."
5. Fora do cartão, embaixo: **"Solution by MindFy Tech"**.

Medidas (de `mind-padrao.css`):

| Elemento | Medidas |
|---|---|
| `body.mp-login` | padding 24 px 16 px; min-height 100vh |
| `.mp-box` (coluna) | largura máx. 440 px; espaço entre blocos 18 px |
| `.mp-card` | padding 22 px; espaço interno 14 px; raio 16 px; sombra `0 18px 50px rgba(0,0,0,.28)` |
| Campo `.mp-f input` | altura mín. 46 px; padding 11 × 13 px; borda 1,5 px `--mp-line`; raio 10 px; fundo branco |
| Foco do campo | `outline: 2px solid var(--mp-cor)`, offset 1 px, borda transparente |
| Botão `.mp-btn` | largura 100%; altura mín. 46 px; sem borda; raio 10 px; fundo `--mp-cor`; texto `--mp-cor-ink` |
| Hover do botão | `filter: brightness(1.06)` |
| Botão desabilitado | opacidade 0,6 |
| Botão secundário `.mp-btn2` | largura 100%; altura mín. 44 px; borda 1,5 px `--mp-line`; fundo branco; texto `--mp-ink`; peso 700; 14 px |
| Mensagem `.mp-msg` | 14 px/700; `.ok` = `--mp-ok`, `.err` = `--mp-err`; some quando vazia |
| Checkbox `.mp-chk` | 13 px/500, cor `--mp-mute` |
| Foco de botões e links | `outline: 2px solid var(--mp-cor)`, offset 2 px |

Classes disponíveis: `mp-login`, `mp-box`, `mp-logo`, `mp-lead`, `mp-card`, `mp-f`, `mp-in`, `mp-chk`, `mp-btn`, `mp-btn2`, `mp-link`, `mp-c`, `mp-termos`, `mp-hint`, `mp-msg`, `mp-rodape`, `mp-pill`.

Em apps React (AeroDriver, VIP Motoristas, MindFin App) o padrão foi aplicado com classes locais equivalentes (`.mp-entrar`, `.mp-topo`, `.mp-lead`, `.mp-card`, `.mp-termos`, `.mp-rodape`), com os mesmos valores de cartão e sombra.

Exceções aceitas até agora:
- **Apps com login por celular (código SMS):** o cartão branco contém o login por telefone; "Esqueci a senha" não se aplica.
- **MindFin App:** o fundo animado com telas reais do app foi **mantido** atrás do cartão.
- **VIP Motoristas:** a tela de escolha passageiro/motorista com vídeos continua igual; só o passo "Entrar" virou cartão branco.

---

## 7. Componentes das telas internas (padrão observado no modelo My Job IT)

A etapa 2 do P-003 (topo e menu iguais em todos os apps) **ainda não foi especificada**. Até lá, siga o modelo My Job IT, que já é compartilhado por Saúde Pra Você e Meu Processo:

| Componente | Padrão |
|---|---|
| Topo | Barra **fixa (sticky)** em azul-marinho da marca, com logo, abas, faixa "Ver como" (só Mind), "Sair" e avatar. Links do topo em `#C9D2E6`; aba ativa com fundo `rgba(255,255,255,.14)`. No celular (≤640 px), o menu vira uma faixa com rolagem horizontal |
| Abas | Links por `#hash`; segmentado `.seg` (fundo `#EEF1F6`, raios 12/9 px) |
| Botão | `.btn`: altura mín. 44 px, raio 12 px, peso 700, cor principal. Variantes `-ghost` (branco com borda), `-dark`, `-green`, `-red` (contorno), `-sm` (36 px, raio 10 px), `-block` |
| Campo | `label.f` com rótulo em cima (13 px/700) e `<small>` de ajuda; `.in` com altura mín. 44 px, raio 10 px, borda `#DDE2EA`; foco com anel `0 0 0 3px rgba(<cor principal>, .15)` |
| Cartão | Branco, borda `#E3E7EF`, raio 14–16 px, sombra `0 1px 2px rgba(20,32,58,.06), 0 8px 24px rgba(20,32,58,.06)`; variantes `.flat`, `.dark`, `.kpi` |
| Etiquetas | Raio 6 px, texto escuro sobre fundo claro do mesmo tom (ex.: verde `#2F7A4F`/`#E3F4EA`, azul `#2D5BD8`/`#E6ECFB`, cinza `#5A6478`/`#EEF1F6`, âmbar `#7A4E00`/`#FDF0CF`, vermelho `#9B2C2C`/`#FDE2E2`, navy branco/`#14203A`) |
| Faixas de aviso | Padrão `#FDF0CF`/`#6B4A00`; info `#E6ECFB`/`#1E3FA0`; ok `#E3F4EA`/`#1F5F3B` |
| Chips e pílulas | Raio 999 px, `aria-pressed` quando selecionáveis |
| Toast | Pílula fixa embaixo, centralizada, fundo navy (erro em vermelho), raio 12 px, sombra `0 12px 30px rgba(0,0,0,.3)`, some em 3,2 s (erro 5,2 s), `role="status"` |
| Modal | Fundo escurecido (`.scrim`, ex.: `rgba(11,19,36,.55)`) + folha `.sheet` com raio 18 px e sombra `0 30px 80px rgba(0,0,0,.35)`; vem de baixo no celular; fecha com Esc e clique fora; foca o primeiro campo; `role="dialog"` + `aria-modal` |
| Tabela | `.tbl` dentro de caixa com rolagem horizontal; divisórias `#EEF1F6` |
| Lista vazia | Bloco `.empty` com texto explicativo |
| Ícones | SVG de linha desenhados no código (traço 2 px), `aria-hidden` quando decorativos |
| Celular (só na `main` do My Job IT) | Até 6 abas viram **barra inferior fixa** com ícone + rótulo curto, respeitando `env(safe-area-inset-bottom)` |
| Nova versão (só na `main` do My Job IT) | Aviso fixo "Há uma versão nova… Atualizar agora", checado a cada 5 min e ao voltar para a aba |

Apps de planilha (MindFin Pro e MindSales) têm um padrão próprio de **campo editável amarelo**: fundo `#FFF6D9`, borda 1,5 px `#E2B93B`, raio 10 px. É uma escolha consciente para mostrar "aqui você digita".

---

## 8. Espaçamento, bordas, sombras e profundidade

| Tema | Padrão |
|---|---|
| Margem lateral no celular | 16 px |
| Espaço entre blocos | 14 px dentro de cartões; 18 px entre blocos da tela de entrada |
| Padding de cartão | 16–22 px (entrada 22 px) |
| Bordas | 1 px em cartões; 1,5 px em campos e botões com contorno |
| Raios | 6 px etiquetas · 10 px campos e botões pequenos · 12 px botões e segmentados · 14–16 px cartões · 18 px modais · 999 px pílulas, chips e avatar |
| Profundidade | Plana e suave: cartões com sombra de duas camadas bem leve. Sombra forte só em elementos flutuantes: cartão da entrada `0 18px 50px rgba(0,0,0,.28)`, modal `0 30px 80px rgba(0,0,0,.35)`, toast `0 12px 30px rgba(0,0,0,.3)` |
| Contraste de camadas | Página em cinza-azulado claro (`#F4F6FA`), cartões brancos, topo e cartões de destaque em azul-marinho |

---

## 9. Gradientes, animações e efeitos

| Efeito | Onde | Valor |
|---|---|---|
| Fundo radial escuro | Entrada e landings | `radial-gradient(900px 700px at 70% 10%, fundo-1 0%, fundo-2 70%)` |
| Topo de e-mails / heros de site | MindFin Pro (site) | `linear-gradient(160deg, #0A1430, #1B3270)`, destaque `#3FD08A` |
| Selos de plano (só na `main` do My Job IT) | Plano pago | `#6FE3A0` → `#7EA0FF`; tag PRO `#FFE08A` → `#FFC24B` |
| Fundo animado | Entrada do MindFin App | Telas reais do app animadas atrás do cartão |
| Desenho de fundo | AeroDriver e VIP Motoristas | `DarkBg`: pista com rota tracejada e ponto de destaque |
| Hover de botão principal | Entrada | `brightness(1.06)` |
| Movimento reduzido | MindFin App, MindSales | `prefers-reduced-motion` desliga animações e transições. **Manter isso em toda animação nova** |

Fora disso, **não há padrão definido** de duração ou curva de transição. Não invente animações chamativas.

---

## 10. UX e acessibilidade (obrigatório)

- **Rótulo visível em cima de cada campo**, ligado ao campo (`<label>`). Quando não há rótulo visível, usar `aria-label` ou a classe `.sr` (só leitor de tela).
- **`autocomplete` correto** (email, current-password, new-password, name).
- **Áreas de toque:** botões e campos com no mínimo 44 px (46 px na entrada); olho da senha 42 px; botões pequenos 36 px no mínimo.
- **Campos com fonte de 16 px no celular** (evita zoom no iOS).
- **Foco visível** em tudo que é clicável (contorno de 2 px na cor principal).
- **ARIA:** `role="dialog"` + `aria-modal` nos modais, `role="status"` em toasts e mensagens, `aria-pressed` em chips e segmentados, `aria-selected` em abas, `aria-current` no perfil atual do "Ver como", `aria-hidden` em ícones decorativos.
- **Teclado:** Esc fecha modais.
- **Responsivo e mobile-first:** sem rolagem lateral; tabelas largas rolam dentro da própria caixa; `viewport-fit=cover` e `env(safe-area-inset-*)`.
- **PWA** nos apps de uso no celular: manifest standalone, ícones normal e maskable, cartão "Instale o app" com passos para iPhone e Android.
- **Linguagem simples**, em português do Brasil. Mensagens de erro que dizem o que fazer.
- **Botões nunca ficam presos:** toda chamada tem tempo limite e libera o botão em caso de erro.
- **Idiomas PT/EN/ES** e **tema claro/escuro**: fazem parte da intenção do P-003, mas **ainda não foram especificados** como padrão. Hoje só o MindSales tem PT/EN/ES e só o MindFin App tem tema escuro (segue o sistema).

---

## 11. Decisões e preferências do Nassif (manter)

- Visual **moderno, limpo e sóbrio**. Nos botões de destaque do site, ele pediu para trocar verde/laranja fortes pela paleta azul suave do próprio site, e botões menores.
- **Simplificar** sempre que possível: menos abas e menos botões repetidos; agrupar funções em telas que já existem em vez de criar abas novas.
- **"Ver como" acima do menu**, no topo.
- Rótulos claros e diretos. Exemplo aprovado no site: "Entre e Navegue pelo app" no lugar de "Ver demo".
- **Não reproduzir logos de terceiros** (ex.: SAP). Use o nome em texto, num selo estilizado.
- O **preço para o cliente aparece fechado**, sem quebrar taxas, nas telas de cliente (decisão de produto que afeta a UI dos apps com split, como o VIP Motoristas).
- **Selo vermelho "AMBIENTE DE TESTE"** (`#C2362F`) sempre visível no ambiente de teste.
- **"Solution by MindFy Tech"** nas entradas, nas imagens de compartilhamento (OG/WhatsApp) e nos vídeos.

---

## 12. O que evitar

- Fontes diferentes de Plus Jakarta Sans em telas novas.
- Cantos fora de 10–16 px (exceto pílulas 999 px; modais hoje usam 18 px).
- Cores de status próprias de cada app. Use `--mp-ok/warn/err/info`.
- Editar `lib/mind-padrao.css` dentro de um app. Defina só `--mp-cor` e os fundos.
- Abas "Entrar | Criar conta" na tela de entrada (use o link "Primeira vez aqui? Criar conta").
- `--mp-cor` diferente da cor da marca do próprio app (hoje acontece no MindSales: `#3A6BFF` na entrada × `#3A5DAA` no painel).
- Mostrar a faixa "Ver como" para quem não é da Mind.
- Faixa "Ver como" clara (deve ser escura).
- `window.alert` / `window.confirm` nativos em telas novas. Use modal ou toast.
- Cores vibrantes e botões grandes demais em áreas de marketing.
- Logos de terceiros desenhados ou copiados.
- Animações sem respeitar `prefers-reduced-motion`.
- Mudança visual direto em produção.

---

## 13. Onde cada app está hoje (para saber o que adaptar)

| App | Fonte atual | Usa `mind-padrao.css` | P-001 | P-002 | P-003 entrada |
|---|---|---|---|---|---|
| My Job IT (`mindmatch`) | Plus Jakarta Sans | Arquivo existe, não carregado | Sim | Sim (falta rótulo visível "Ver como" e cartão "Demonstração") | Quase: falta "Esqueci a senha" e "Solution by MindFy Tech" |
| MindSales | Sora + Manrope (entrada: Plus Jakarta Sans) | Só na entrada | Sim | Não definido para este app | Sim |
| MindFin Pro | Sora + Manrope (entrada: Plus Jakarta Sans) | Só na entrada | Sim | Não definido para este app | Sim |
| MindFin App (`financial-pro`) | Bricolage Grotesque + Figtree | Não (React) | Sim | Não se aplica (um perfil) | Parcial |
| AeroDriver | Sora + IBM Plex Sans | Não (React) | Não se aplica (login por SMS) | Sim | Parcial |
| VIP Motoristas | Sora + IBM Plex Sans | Não (React) | Sim | Sim | Parcial |
| Saúde Pra Você | Figtree | Arquivo existe, não carregado | Sim | Sim (rótulo "Modo gestor · ver o app como") | Parcial: falta "Solution by MindFy Tech" |
| Meu Processo | Figtree + Fraunces | Arquivo existe, não carregado | Sim | Parcial (faixa clara; advogado também vê) | Parcial |

Para adaptar um app ao padrão: carregar `lib/mind-padrao.css` na entrada (HTML) ou replicar os mesmos valores (React), definir `--mp-cor` e os fundos, trocar a fonte para Plus Jakarta Sans, alinhar as cores de status, completar os textos da entrada e registrar tudo no `PADRAO-APPS.md`, sempre na branch `teste`.

---

## 14. Ainda não definido

- Etapa 2 do P-003: topo, menu e abas iguais em todas as telas internas (prevista: barra com logo, perfil, idioma e Sair, e abas iguais).
- Valores de `--mp-cor` / `--mp-fundo` para MindFin App, AeroDriver, VIP Motoristas, Saúde Pra Você e Meu Processo.
- Tema escuro como padrão de todos os apps.
- Idiomas PT/EN/ES como padrão de todos os apps.
- Durações e curvas de transição.
- Se MindSales e MindFin Pro terão faixa "Ver como" (eles têm papéis internos dono/admin/membro/leitura, não perfis de app).

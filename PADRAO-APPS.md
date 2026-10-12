# Padrão dos Apps · MindFy Tech

Todo app da Mind segue estes itens. Todo app novo já nasce com eles.
Quando um item muda, a mudança é copiada para todos os apps.

| Código | Desde | Item |
|---|---|---|
| P-001 | 2026-10-12 | Botão de olho em todo campo de senha (mostrar/esconder). HTML: `mind-padrao.js`. React: `SenhaInput`. |
| P-002 | 2026-10-12 | Troca de perfil "Ver como" no topo (modelo My Job It). |

## P-002 · Troca de perfil ("Ver como")

- **Quem vê:** só a conta da Mind (admin). Usuário comum nunca vê.
- **Onde:** no topo da tela, fixo, em todas as telas do app (inclusive quando a Mind está usando o app como outro perfil).
- **Como é:** rótulo "Ver como" + botões lado a lado, um por perfil do app, sempre na mesma ordem:
  primeiro os perfis de cliente/usuário e por último **Painel Mind**. O perfil atual fica destacado.
- **O que faz:** abre o app de verdade naquele perfil (dados reais), sem sair da conta. A demonstração com dados de exemplo é separada (cartão "Demonstração" no Painel Mind).
- **Visual:** faixa escura da marca; botões com cantos arredondados; o atual com a cor de destaque do app.
- **Nome dos perfis por app:**
  - My Job It: Empresa · Profissional · Painel Mind (modelo original)
  - VIP Motoristas e AeroDriver: Passageiro · Motorista · Painel Mind
  - Saúde Pra Você: Contratante · Profissional · Gestão (central) · Painel Mind
  - Meu Processo: Advogado · Cliente · Painel Mind (ao tocar, escolhe qual escritório ou cliente ver)
  - Apps de um perfil só: não mostram a faixa.

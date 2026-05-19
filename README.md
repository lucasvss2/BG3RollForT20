# T20 Theme Overhaul

Módulo para [Foundry VTT](https://foundryvtt.com) com melhorias visuais e mecânicas para o sistema **Tormenta20** (`tormenta20`).

Depende apenas de [socketlib](https://foundryvtt.com/packages/socketlib) para coordenação cliente↔GM. O Foundry instala automaticamente ao adicionar o módulo.

---

## Instalação

### Via Foundry VTT (recomendado)

1. Abra o Foundry VTT e vá em **Gerenciar Módulos → Instalar Módulo**.
2. Cole o link abaixo no campo **URL do Manifesto** e clique em **Instalar**:

```
https://raw.githubusercontent.com/lucasvss2/T20ThemeOverhaul/master/module.json
```

### Instalação manual

1. Baixe o ZIP da [última release](https://github.com/lucasvss2/T20ThemeOverhaul/releases/latest).
2. Extraia na pasta `Data/modules/` do seu Foundry VTT.
3. Ative o módulo em **Gerenciar Módulos**.

---

## Funcionalidades

### Tema visual escuro (BG3-inspired)

Redesign completo das fichas do Tormenta20 com paleta escura e dourada inspirada em Baldur's Gate 3.

#### Ficha de Personagem (Jogador)

- Fundo escuro em todas as abas com tipografia `Cinzel` nos títulos
- **Barras de vitalidade** para PV, PM e Defesa com segmentos separados para PV/PM temporários (barra mais escura sobreposta)
- Inputs e selects com borda dourada sutil e fundo semitransparente
- Abas estilizadas com destaque ativo dourado
- Janelas de edição de itens, poderes e magias com tema consistente

#### Ficha Ameaça (NPC)

- Aba de **Inventário**: containers de moeda com fundo escuro (sem pergaminho), separadores de coluna com bordas douradas sutis, headers de seção com gradiente
- Aba de **Perícias**: linhas uniformemente escuras sem alternância pergaminho/parchment do sistema base
- Aba de **Efeitos**: botão de criar em linha (`+` e texto lado a lado)

#### Base (Personagem de suporte)

- Header com blocos de atributo (`Segurança`, `Porte`, `Manutenção`) de altura automática — sem corte de conteúdo
- Separadores do header substituídos por bordas douradas temáticas
- Botão de criar efeitos em linha

#### Personagem do Mestre (Simple)

- Inventário embutido na aba de atributos: mesmo tratamento visual da ficha de ameaça
- Botão de criar efeitos em linha

---

### Overlay cinemático de dados

Toda rolagem T20 interceptada exibe um overlay full-screen escuro com o resultado em destaque. O overlay fecha automaticamente após 3 segundos ou ao clicar.

| Tipo de rolagem                             | Rótulo no overlay              |
| ------------------------------------------- | ------------------------------ |
| Perícia (Acrobacia, Percepção…)             | `Teste de <Perícia>`           |
| Resistência (Fortitude / Reflexo / Vontade) | `Resistência de <Resistência>` |
| Ataque com arma / à distância               | `Ataque` + nome da arma        |
| Ataque mágico                               | `Ataque Mágico`                |
| Iniciativa                                  | `Iniciativa`                   |
| Teste de atributo (Força, Destreza…)        | `Teste de <Atributo>`          |

Acerto crítico (nat 20) aparece em dourado; falha crítica (nat 1) aparece em vermelho. Rolagens de dano não são interceptadas. Dados 3D do **Dice So Nice** aparecem sempre acima do overlay.

---

### Chat cards estilizados

Mensagens de rolagem do T20 recebem um card visual escuro com tipografia `Modesto Condensed`, gradiente dourado e resultado em destaque — identidade visual consistente com o overlay.

---

### Teste Secreto de Perícia

O GM pode solicitar um teste a qualquer jogador sem revelar a dificuldade. Suporta múltiplos alvos simultaneamente.

**Fluxo:**

1. **GM** seleciona um ou mais tokens como alvo (tecla **T**) e clica no ícone 🎲 na barra lateral esquerda.
2. Modal do GM abre: escolha a perícia, defina a CD e um bônus/penalidade opcional.
3. Cada **jogador** recebe um modal mostrando o nome da perícia e seu bônus base calculado — sem ver a CD.
4. O modal do jogador lista poderes e itens ativáveis que afetam aquela perícia específica, com custo de PM e bônus de cada um.
5. Jogador seleciona os poderes desejados, lança o teste e o PM é descontado automaticamente.
6. O resultado aparece no chat com card público e overlay cinemático.

**Resultados possíveis:**

| Resultado       | Condição   | Cor      |
| --------------- | ---------- | -------- |
| Falha Crítica   | Nat 1      | Vermelho |
| Falha           | Total < CD | Âmbar    |
| Sucesso         | Total ≥ CD | Verde    |
| Sucesso Crítico | Nat 20     | Dourado  |

---

### Aplicação Automática de Dano

Após um ataque com arma, se o total do ataque superar a DEF do alvo selecionado com **T**, o módulo abre automaticamente um prompt interativo para o jogador defensor (ou GM, para criaturas sem dono).

**Fluxo:**

1. Atacante seleciona o alvo com **T** e realiza um ataque normalmente.
2. O módulo compara o total do ataque com a DEF do alvo.
3. Se acertar: o dono do alvo (ou o GM para NPCs) recebe o prompt de dano.

**O prompt exibe:**

- Nome do alvo
- Atacante e total do ataque vs DEF
- Total do dano rolado

**Opções disponíveis:**

| Botão                   | Efeito                                                              |
| ----------------------- | ------------------------------------------------------------------- |
| Aplicar Integral        | Aplica todo o dano aos PV (PV temporário é drenado primeiro)        |
| Aplicar Metade          | Aplica metade do dano (arredondado para baixo)                      |
| Não Aplicar             | Ignora o dano (PM ainda é descontado se informado)                  |
| Forçar Rerolar Dano     | Solicita ao atacante que relance a rolagem de dano; novo prompt abre |

**Campo "Custo de Mana (PM)":**  
Se o defensor usar uma habilidade defensiva com custo de PM, basta digitar o valor no campo — o PM é descontado junto com os PV na mesma ação.

---

## Dependências

| Módulo                                                  | Tipo                                                  |
| ------------------------------------------------------- | ----------------------------------------------------- |
| [socketlib](https://foundryvtt.com/packages/socketlib) | Obrigatório — RPC GM↔jogador para os sistemas socket  |

Nenhuma outra dependência. O Foundry instala `socketlib` automaticamente ao ativar este módulo.

---

## Compatibilidade com módulos de conteúdo

Totalmente compatível com todos os módulos oficiais de conteúdo para Tormenta20:

- [Suplementos de Arton](https://github.com/mobguilherme/Suplementos-de-Arton)
- [Bestiário de Arton](https://github.com/mobguilherme/Bestiario-de-Arton)
- [Revista T20 — Duelo de Dragões](https://github.com/mobguilherme/Revista-T20-Duelo-de-Dragoes)
- [Revista T20 — Fullgor dos Deuses](https://github.com/mobguilherme/Revista-T20-Fullgor-dos-Deuses)
- [Aventura — Coração de Rubi](https://github.com/mobguilherme/Aventura-Coracao-de-Rubi)
- [Aventura — Fim dos Tempos](https://github.com/mobguilherme/Aventura-Fim-dos-Tempos)

---

## Desenvolvimento

```sh
npm install        # instala as dependências
npm run dev        # build + watch (modo desenvolvimento)
npm run build      # build de produção
npm run typecheck  # verifica tipos TypeScript
npm test           # roda os testes unitários (Vitest)
```

### Estrutura do projeto

```
src/
├── main.ts                       Ponto de entrada — hooks do ciclo de vida do Foundry
├── constants.ts                  IDs do módulo e nomes de hooks
├── parser/
│   └── t20.ts                    Parser de flavor text em português
├── integration/
│   └── index.ts                  Intercepta T20 chat messages e dispara o overlay
├── overlay/
│   └── BG3Overlay.ts             Overlay cinemático full-screen standalone
├── chat/
│   └── chatStyles.ts             Chat cards estilizados
├── dialogs/
│   └── bg3-dialog.ts             Estilização de diálogos do Foundry
├── sheet/
│   └── index.ts                  Tema visual completo de todas as fichas T20
├── hidden-test/
│   ├── index.ts                  Setup: toolbar, socket, hooks e estilos
│   ├── HiddenTestGMDialog.ts     Modal do GM (multi-alvo)
│   ├── HiddenTestPlayerDialog.ts Modal do jogador (poderes + PM)
│   ├── skills.ts                 Lista de perícias T20 + cálculo de bônus
│   └── types.ts                  Interfaces do sistema de testes secretos
├── auto-damage/
│   ├── index.ts                  Hook, socket, prompt e aplicação de HP/PM
│   └── types.ts                  Interfaces de dano automático e reroll
├── utils/
│   └── logging.ts                Utilitários de log com prefixo do módulo
└── types/
    └── global.d.ts               Tipos ambientes para Foundry VTT v13
```

### Releases

As releases são criadas automaticamente pelo GitHub Actions ao criar uma tag `vX.Y.Z`:

```sh
git tag v1.6.2
git push origin v1.6.2
```

O workflow executa typecheck, testes, build, monta o ZIP e publica a release no GitHub.

---

## Solução de problemas

| Sintoma                                       | Causa provável                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------ |
| Overlay nunca aparece                         | Sistema ativo não é `tormenta20`; verifique o console                                |
| Rolagem aparece no chat sem overlay           | Flavor text não reconhecido — abra uma issue com o texto exato                       |
| Botão de Teste Secreto não aparece            | Usuário não é GM, ou o hook de toolbar não disparou — recarregue a página            |
| Teste Secreto: "nenhum jogador ativo"         | O dono do token está offline; o modal só abre se houver um jogador conectado         |
| Prompt de dano não aparece após ataque        | Nenhum alvo selecionado com T, ou a rolagem não contém attack + damage rolls T20     |
| Dano aplicado sem prompt                      | Não ocorre — o módulo sempre aguarda confirmação antes de alterar PV                 |
| Rerolar dano não funciona                     | Atacante desconectou após o ataque; sem atacante ativo, o reroll não pode ser enviado|
| Tema visual não aplicado                      | Módulo desativado ou cache do browser — force reload com Ctrl+F5                     |

Abra o console do navegador e filtre por `[aeris-bg3-rolls-t20]` para diagnóstico.

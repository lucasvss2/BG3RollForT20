# BG3RollForT20

Módulo para [Foundry VTT](https://foundryvtt.com) que adiciona suporte ao sistema **Tormenta20** (`t20`) no [Aeris BG3 Rolls](https://foundryvtt.com/packages/aeris-bg3-rolls), habilitando a sobreposição cinemática de dados inspirada em *Baldur's Gate 3* para o RPG brasileiro.

---

## Instalação

### Via Foundry VTT (recomendado)

1. Abra o Foundry VTT e vá em **Gerenciar Módulos → Instalar Módulo**.
2. Cole o link abaixo no campo **URL do Manifesto** e clique em **Instalar**:

```
https://raw.githubusercontent.com/lucasvss2/BG3RollForT20/master/module.json
```

### Instalação manual

1. Baixe o ZIP da [última release](https://github.com/lucasvss2/BG3RollForT20/releases/latest).
2. Extraia na pasta `Data/modules/` do seu Foundry VTT.
3. Ative o módulo em **Gerenciar Módulos**.

---

## Dependências obrigatórias

Instale estes módulos antes de ativar este:

| Módulo | Instalação |
|---|---|
| [Aeris BG3 Rolls](https://foundryvtt.com/packages/aeris-bg3-rolls) | Gerenciador de pacotes do Foundry |
| [Aeris Core](https://foundryvtt.com/packages/aeris-core) | Gerenciador de pacotes do Foundry |
| [socketlib](https://foundryvtt.com/packages/socketlib) | Gerenciador de pacotes do Foundry |

**Dependência opcional:** [lib-wrapper](https://foundryvtt.com/packages/lib-wrapper) — melhora a integração (estratégia 3 do patcher), mas não é obrigatória.

---

## O que o módulo faz

O Aeris BG3 Rolls só vem com parsers para D&D 5e e Pathfinder 2e. Este módulo registra um parser em português para o sistema `t20`, fazendo a sobreposição reconhecer corretamente:

| Tipo de rolagem T20 | Rótulo na sobreposição |
|---|---|
| Perícia (Acrobacia, Percepção…) | `Teste de <Perícia>` |
| Resistência (Fortitude / Reflexo / Vontade) | `Resistência de <Resistência>` |
| Ataque com arma / à distância | `Ataque` + nome da arma |
| Ataque mágico | `Ataque Mágico` |
| Iniciativa | `Iniciativa` |
| Teste de atributo (Força, Destreza…) | `Teste de <Atributo>` |

Rolagens de **dano** não são interceptadas — aparecem normalmente no chat.

---

## Compatibilidade com módulos de conteúdo

Totalmente compatível com todos os módulos oficiais de conteúdo para Tormenta20 (eles adicionam atores, itens e regras, mas não alteram a mecânica de rolagens):

- [Suplementos de Arton](https://github.com/mobguilherme/Suplementos-de-Arton)
- [Bestiário de Arton](https://github.com/mobguilherme/Bestiario-de-Arton)
- [Revista T20 — Duelo de Dragões](https://github.com/mobguilherme/Revista-T20-Duelo-de-Dragoes)
- [Revista T20 — Fullgor dos Deuses](https://github.com/mobguilherme/Revista-T20-Fullgor-dos-Deuses)
- [Aventura — Coração de Rubi](https://github.com/mobguilherme/Aventura-Coracao-de-Rubi)
- [Aventura — Fim dos Tempos](https://github.com/mobguilherme/Aventura-Fim-dos-Tempos)

---

## Desenvolvimento

```sh
npm install        # instala as dependências de build
npm run dev        # build + watch (modo desenvolvimento)
npm run build      # build de produção → dist/main.bundle.js
npm run typecheck  # verifica tipos TypeScript sem emitir arquivos
```

### Estrutura do projeto

```
src/
├── main.ts              Ponto de entrada — hooks do ciclo de vida do Foundry
├── constants.ts         IDs do módulo e nomes de hooks
├── parser/
│   └── t20.ts           Parser de flavor text em português (todas as rolagens T20)
├── integration/
│   └── index.ts         Bridge multi-estratégia para o aeris-bg3-rolls
├── utils/
│   └── logging.ts       Helpers de console com prefixo do módulo
└── types/
    └── global.d.ts      Tipos ambientes para Foundry VTT e aeris-bg3-rolls
```

### Cadeia de integração

O módulo tenta registrar o parser T20 no aeris-bg3-rolls usando quatro estratégias em ordem de prioridade:

1. **Hook API** — escuta `aeris-bg3-rolls.ready` e chama `api.registerParser("t20", …)` se o método existir.
2. **API global** — chama `game.bg3rolls.registerParser("t20", …)` se exposto no objeto global.
3. **libWrapper** — envolve `parseRollMeta` via libWrapper para injetar o handler T20 antes da função original.
4. **Fallback `preCreateChatMessage`** — sempre instalado; dispara o hook do orchestrator (`aeris-bg3-rolls.alertChatMessage`) diretamente para qualquer rolagem T20 reconhecida.

### Releases

As releases são criadas automaticamente pelo GitHub Actions ao criar uma tag `vX.Y.Z`:

```sh
git tag v1.0.0
git push origin v1.0.0
```

O workflow builda o projeto, monta o ZIP com `module.json` + `dist/`, e publica a release no GitHub.

---

## Solução de problemas

| Sintoma | Causa provável |
|---|---|
| Sobreposição nunca aparece | aeris-bg3-rolls ou aeris-core não está ativo |
| Rolagens aparecem no chat em vez da sobreposição | O flavor text não corresponde a nenhum padrão do parser — abra uma issue com o texto exato |
| Entradas duplicadas de rolagem | Uma versão futura do aeris-bg3-rolls adicionou suporte nativo ao T20 — desative este módulo |

Ative o console do navegador e procure por `[aeris-bg3-rolls-t20]` para ver qual estratégia de integração foi selecionada.

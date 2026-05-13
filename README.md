# BG3RollForT20

Módulo para [Foundry VTT](https://foundryvtt.com) melhorias de layout para o sistema **Tormenta20** (`t20`).

Funciona de forma **totalmente independente** — nenhuma dependência obrigatória. O [Aeris BG3 Rolls](https://foundryvtt.com/packages/aeris-bg3-rolls) é recomendado mas opcional.

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

## Funcionalidades

### Overlay cinemático de dados

Toda rolagem T20 interceptada exibe um overlay full-screen escuro com o resultado em destaque, estilo BG3. O overlay fecha automaticamente após 3 segundos ou ao clicar.

| Tipo de rolagem                             | Rótulo no overlay              |
| ------------------------------------------- | ------------------------------ |
| Perícia (Acrobacia, Percepção…)             | `Teste de <Perícia>`           |
| Resistência (Fortitude / Reflexo / Vontade) | `Resistência de <Resistência>` |
| Ataque com arma / à distância               | `Ataque` + nome da arma        |
| Ataque mágico                               | `Ataque Mágico`                |
| Iniciativa                                  | `Iniciativa`                   |
| Teste de atributo (Força, Destreza…)        | `Teste de <Atributo>`          |

Acerto crítico (nat 20) aparece em dourado; falha crítica (nat 1) aparece em vermelho. Rolagens de **dano** não são interceptadas.

### Chat cards estilizados

Mensagens de rolagem do T20 recebem um card visual escuro com tipografia `Modesto Condensed`, gradiente dourado e resultado em destaque — identidade visual consistente com o overlay.

### Teste Secreto de Perícia

O GM pode solicitar um teste secreto a qualquer jogador sem revelar a dificuldade:

1. **GM** seleciona um token como alvo (tecla **T**) e clica no ícone 🎲 na barra lateral esquerda.
2. Modal do GM abre: escolha a perícia e defina a CD.
3. **Jogador** recebe um modal mostrando o nome da perícia e seu bônus base calculado — sem ver a CD.
4. Jogador clica em **Rolar Teste** e executa a rolagem.
5. O resultado aparece para todos no chat com card público e overlay cinemático.

Quatro resultados possíveis:

| Resultado       | Condição   | Cor      |
| --------------- | ---------- | -------- |
| Falha Crítica   | Nat 1      | Vermelho |
| Falha           | Total < CD | Âmbar    |
| Sucesso         | Total ≥ CD | Verde    |
| Sucesso Crítico | Nat 20     | Dourado  |

---

## Dependências

| Módulo                                                             | Tipo                              |
| ------------------------------------------------------------------ | --------------------------------- |
| [Aeris BG3 Rolls](https://foundryvtt.com/packages/aeris-bg3-rolls) | Opcional — integração avançada    |
| [lib-wrapper](https://foundryvtt.com/packages/lib-wrapper)         | Opcional — estratégia de fallback |

Nenhuma dependência obrigatória. O módulo opera em modo standalone quando os opcionais não estão presentes.

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

O build de produção é copiado diretamente para o diretório de dados do Foundry via `FOUNDRY_OUT`:

```sh
FOUNDRY_OUT=/seu/caminho/Data/modules/aeris-bg3-rolls-t20 npm run build
```

### Estrutura do projeto

```
src/
├── main.ts                  Ponto de entrada — hooks do ciclo de vida do Foundry
├── constants.ts             IDs do módulo e nomes de hooks
├── parser/
│   └── t20.ts               Parser de flavor text em português
├── integration/
│   └── index.ts             Bridge multi-estratégia para o aeris-bg3-rolls
├── overlay/
│   └── BG3Overlay.ts        Overlay cinemático full-screen standalone
├── chat/
│   └── chatStyles.ts        Chat cards estilizados
├── dialogs/
│   └── bg3-dialog.ts        Estilização de diálogos do Foundry
├── hidden-test/
│   ├── index.ts             Setup: toolbar, socket, hooks
│   ├── HiddenTestGMDialog.ts  Modal do GM
│   ├── HiddenTestPlayerDialog.ts  Modal do jogador
│   ├── skills.ts            Lista de perícias T20 + cálculo de bônus
│   └── types.ts             Interfaces do sistema de testes secretos
└── types/
    └── global.d.ts          Tipos ambientes para Foundry VTT
```

### Cadeia de integração com aeris-bg3-rolls

Quando o Aeris BG3 Rolls está ativo, o módulo tenta registrar o parser T20 usando três estratégias em ordem:

1. **Hook `aeris-bg3-rolls.ready`** — chama `api.registerParser("t20", …)`.
2. **API global** — chama `game.bg3rolls.registerParser("t20", …)`.
3. **libWrapper** — envolve `parseRollMeta` para injetar o handler T20 antes da função original.

Em modo standalone (sem Aeris BG3 Rolls), o hook `createChatMessage` gerencia o overlay diretamente.

### Releases

As releases são criadas automaticamente pelo GitHub Actions ao criar uma tag `vX.Y.Z`:

```sh
git tag v1.3.0
git push origin v1.3.0
```

O workflow executa typecheck, testes, build, monta o ZIP e publica a release no GitHub.

---

## Solução de problemas

| Sintoma                               | Causa provável                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| Overlay nunca aparece                 | Sistema ativo não é `tormenta20`; verifique o console                                |
| Rolagem aparece no chat sem overlay   | Flavor text não reconhecido — abra uma issue com o texto exato                       |
| Botão de Teste Secreto não aparece    | Usuário não é GM, ou o hook de toolbar não disparou — recarregue a página            |
| Teste Secreto: "nenhum jogador ativo" | O dono do token está offline; o modal só abre se houver um jogador conectado         |
| Resultados duplicados                 | Uma versão do aeris-bg3-rolls adicionou suporte nativo ao T20 — desative este módulo |

Abra o console do navegador e filtre por `[aeris-bg3-rolls-t20]` para diagnóstico.

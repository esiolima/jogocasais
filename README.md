# ConectAí — atualização visual da V2

Base: branch `V2` de `esiolima/jogocasais`, commit `c121614`.
Preparado em 1º de outubro de 2026. Nenhuma mudança foi publicada no GitHub ou no Railway.

## Executar

Requer Node.js com npm. Validado com Node 24.15.0.

```sh
npm ci
npm start
```

Abra `http://localhost:3000`. Cada jogador precisa de uma aba ou aparelho próprio conectado ao mesmo servidor. Para testes automatizados: `npm test` (cerca de 30 segundos; usa a porta 3107 para testes de comunicação).

## Hospedagem

Continuam sendo utilizados Express, HTTP e WebSocket no mesmo processo/porta, `process.env.PORT`, `npm start` e o keepalive de 25 segundos. Não há etapa de build, banco novo, chave, serviço de geração externo ou nova dependência de produção. O lockfile fixa as versões instaladas. As salas continuam em memória, como na V2: reiniciar o processo encerra as partidas. Uma implantação com várias réplicas exigiria armazenamento/coordenação compartilhados, fora deste trabalho.

Não fazer push automático para uma branch associada ao Railway: isso pode disparar deploy. Revisar a atualização e obter autorização do proprietário antes de publicar.

## Experiência

- Layout de duas colunas no computador e uma coluna no celular; fundos sólidos por etapa e identidade verde, creme, amarelo e lilás.
- O mesmo camaleão acompanha início, configuração, entrada, espera, pergunta, resposta, acerto, erro, resultado e avisos. São seis poses reutilizadas com variação de cor e movimentos leves de respiração, inclinação e reação.
- Abertura de 2,6 segundos, pulável, exibida uma vez por sessão da aba. Voltar ao início não a repete. O carregamento só termina quando ilustração, catálogo e WebSocket estão prontos; após 4,5 s aparece aviso de demora e após 12 s uma opção de tentar novamente. Movimento reduzido elimina as animações e a espera cinematográfica.
- Música original e efeitos sintetizados localmente pela Web Audio API. Iniciam desligados, com controles separados, volume e preferência salva no navegador. Áudio habilitado só começa após interação. A música pausa em abas ocultas. Não há trilha nem amostra copiada de Candy Crush; a referência foi apenas o clima lúdico.
- Créditos exatos, sem duplicação, no diálogo Sobre acessível pelo cabeçalho e rodapé. O diálogo não interrompe as mensagens da partida.
- Controles existentes receberam interação por teclado, rótulos, estados acessíveis e foco preservado durante atualizações do chat. A próxima pergunta retorna ao topo, e o zoom do navegador foi liberado.

## Catálogo e geração de perguntas

Análise antes da implementação:

| Arquivo | Conteúdo | Uso |
| --- | --- | --- |
| `themes.json` | 10 temas, cada um com 25 perguntas e 8 de tensão: 330 | Dupla: escolhas EU/VOCÊ, sintonia, relacionamento, ficção, intimidade, micos, dinheiro, personalidade, viagens, convivência, situações improváveis e sorte |
| `familia.json` | 100 perguntas gerais e 10 de tensão | Grupo: votação em pessoas; histórias, traços, convívio e hipóteses; o modo tensão inclui conflitos interpessoais |
| `quiz.json` | 33 perguntas, quatro opções cada | Duelo: gostos pessoais, rotina, personalidade e relação; primeiro autodescrição, depois adivinhação |
| `questions.json` | 100 perguntas antigas | Arquivo não consumido pelo servidor da V2; mantido sem mudanças |

O tom geral é informal, brasileiro e conversacional. Dupla inclui intimidade e romance; Tensão aumenta a carga emocional. Grupo usa o mesmo catálogo para Família e Galera na V2. Duelo tem opções sem resposta universalmente correta. Foram observadas paráfrases no catálogo e algumas perguntas abertas no Grupo que não correspondem ao formato de votar em uma pessoa.

`questions/rules.js` contém situações e ações combináveis somente dentro de conjuntos revisados. São 238 candidatos possíveis antes dos filtros (180 Dupla, 30 Grupo, 28 Duelo), pertencentes a 119 famílias de intenção. Não há multiplicação cega de todos os fragmentos. No Duelo, cada conjunto de opções permanece associado à sua intenção. Novas perguntas românticas do tema Atração são limitadas ao tipo Casal. O catálogo original, inclusive seu nível de intimidade e sua mistura de Tensão, foi preservado.

`questions/service.js`:

1. Solicita candidatos ao provedor local `candidates(context)`.
2. Valida tamanho, formato e, no Duelo, quatro opções distintas.
3. Usa inicialmente até 40% de perguntas novas, limita uma variante por família e elimina repetição exata e semelhança lexical elevada.
4. Completa com o catálogo original; caso ainda haja espaço, tenta outras famílias novas aprovadas.
5. Se o provedor falhar, retornar vazio ou produzir opções inválidas, usa automaticamente o catálogo. Se não houver perguntas distintas suficientes, entrega uma partida menor, informada na sala, em vez de forçar repetições.

A comparação normaliza acentos, caixa e pontuação; ignora palavras comuns e usa sobreposição de termos. Não é uma compreensão semântica geral, e pode deixar passar equivalências sutis. Os identificadores de família barram paráfrases geradas mesmo quando usam cenários diferentes. O filtro também evita perguntas abertas incompatíveis com votação. As perguntas personalizadas pelo usuário continuam preservadas, sem substituição pelo gerador.

A pontuação segue as mesmas regras da V2, incluindo pontos por tema e bônus das perguntas de tensão quando misturadas no modo aleatório. Uma integração opcional futura pode ser feita atrás do contrato do provedor; o serviço atual é síncrono e um adaptador remoto futuro precisaria de limite de tempo/cache e manter o mesmo fallback. Nenhum adaptador remoto foi implementado.

## Correções encontradas nos testes

- A busca de sala retornava `lobby_state` no lugar de `lookup_result`, impedindo o fluxo de entrada.
- “Criar nova dupla” enviava `__new__`, mas o servidor esperava `new`.
- Uma seleção de quantidade de outro modo podia deixar o Grupo sem opção selecionada; agora é normalizada.
- Nova tentativa de iniciar uma sala já em jogo e opções fora dos limites do Duelo são ignoradas.
- Nomes, chat, textos personalizados e outros textos recebidos são escapados ao montar a interface.
- Ajustados “campeão/campeã”, título do relatório e singular de pergunta.
- Rótulos “todas” foram removidos: agora o conjunto combina perguntas novas com o catálogo, mantendo as quantidades selecionáveis originais.

## Arquivos alterados e novos

Alterados: `server.js`, `package.json`, `public/index.html`, `public/app.js`, `public/style.css`.

Novos: `.gitignore`, `package-lock.json`, `public/ui.js`, `public/boot.js`, `public/sound.js`, `public/assets/chameleon-atlas.png`, `public/assets/PROVENANCE.md`, `questions/rules.js`, `questions/service.js`, `test/generation.test.js`, `test/realtime.test.js`, `test/experience.test.js` e este `README.md`.

Os quatro arquivos JSON de catálogo não foram alterados.

## Validação e limites

12 testes automatizados passaram: 500 partidas com sementes reproduzíveis, todos os temas/tipos de dupla/tensão, rejeição de duplicatas e opções inválidas, fallback, pontuação e Ranking/Tensão em 20 rodadas, sigilo das respostas, lookup/entrada, chat, maioria, empate, pulo, resultado, abertura e controles de áudio.

Teste no navegador Chromium do aplicativo, com dois ou três jogadores em abas separadas:

- Dupla: criação personalizada com duas perguntas, entrada por código, espera, chat com caracteres HTML exibidos como texto, acerto, erro, avanço sincronizado e resultado.
- Grupo/Galera: três participantes, bloqueio de início com pessoas insuficientes, votação, resultado e relatório.
- Duelo: dez perguntas distintas, conclusão das duas fases, dez acertos para Ana e zero para Bia; resultado sincronizado 10–0.
- Sobre: redação exata dos créditos em uma única ocorrência e retorno ao jogo.
- Som: habilitar/desabilitar música e efeitos e ajustar volume por teclado.
- Abertura/carregamento observados no navegador; retorno e navegação não repetem a capa. Skip, movimento reduzido, espera por recursos, timeout e falha de imagem também cobertos por testes com ambiente simulado.
- Layouts de computador (1366×900) e celular (390×844 e 320×740); sem transbordamento horizontal nos formulários/início inspecionados. A barra de rolagem do navegador reduz a largura útil em 15 px.

Não foram testados Safari/iOS, Firefox, aparelhos físicos nem redes móveis reais. Movimento reduzido e falhas de carregamento foram testados programaticamente, não por alterações nas preferências do sistema. A qualidade percebida do som depende do aparelho e pode ser ajustada em Som. As salas e a limitação de reconexão da V2 permanecem: perder a conexão exige voltar ao início e criar/entrar em outra sala. Nenhum deploy, teste de produção após alterações ou migração de infraestrutura foi realizado.

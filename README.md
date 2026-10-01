# ConectAí — atualização visual da V2

Base: branch `V2` de `esiolima/jogocasais`, commit `c121614`.
Preparado em 1º de outubro de 2026. Nenhuma mudança foi publicada no GitHub ou no Railway.

A revisão mais recente está detalhada em [ATUALIZACAO-ANIMACAO.md](ATUALIZACAO-ANIMACAO.md): mascote articulado, troca gradual de cor, fundos por pergunta, três novas trilhas e Modo Duplas de 4 a 12 pessoas. A chamada principal passou a ser “Quem te conhece de verdade?”.

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

- Layout de duas colunas no computador e uma coluna no celular. Durante a partida, seis fundos sólidos suaves alternam a cada pergunta, com transição de 650 ms. Respostas, placar e chat não trocam a cor da rodada.
- Modo Duplas: de 4 a 12 pessoas, organizadas em 2 a 6 duplas. O servidor e a interface só permitem iniciar com ao menos duas duplas completas e sem parceiros faltando. Grupo e Duelo mantêm seus limites e regras.
- Camaleão vetorial articulado único em todas as telas: olhos que piscam e olham ao redor, cabeça, braços, pernas e cauda independentes. Acerto tem preparação, salto e amortecimento; erro tem um gesto de cabeça; espera tem batida do pé. Ao tocar/clicar no mascote, ele alterna aceno, salto, língua e dança. A pele, a barriga e os realces mudam de cor em 1,25 s conforme a pose/expressão; olhos e contornos preservam suas cores. O mascote é reaproveitado entre renderizações da mesma tela.
- Abertura de 2,6 segundos, pulável, exibida uma vez por sessão da aba. Voltar ao início não a repete. O carregamento só termina quando ilustração, catálogo e WebSocket estão prontos; após 4,5 s aparece aviso de demora e após 12 s uma opção de tentar novamente. Movimento reduzido elimina as animações e a espera cinematográfica.
- Três trilhas instrumentais originais em MP3 estéreo: Jardim de conexões (1min55, bossa leve), Passo de camaleão (1min43, marimba com balanço) e Fim de tarde (2min20, piano suave). Cada arranjo tem 48 compassos, melodias com pausas, variações, baixo, acordes e percussão. São instrumentos sintetizados durante a produção; não são gravações de instrumentistas. Os arquivos somam cerca de 5,7 MB, carregam sob demanda e não atrasam a abertura. Troca de faixa com transição de aproximadamente 700 ms. Efeitos curtos continuam na Web Audio API. Música e efeitos começam desligados, têm controle separado, volume e preferência salva; pausam em abas ocultas. Nenhuma melodia ou amostra de Candy Crush foi utilizada.
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

Novos: `.gitignore`, `package-lock.json`, `public/ui.js`, `public/boot.js`, `public/sound.js`, `public/mascot.js`, `public/motion.css`, `public/assets/music/` (três MP3 e manifesto), `public/assets/chameleon-atlas.png` (histórico), `public/assets/PROVENANCE.md`, `questions/rules.js`, `questions/service.js`, `test/generation.test.js`, `test/realtime.test.js`, `test/experience.test.js`, `tools/compose_music.py`, `ATUALIZACAO-ANIMACAO.md` e este `README.md`.

Os quatro arquivos JSON de catálogo não foram alterados.

## Validação e limites

15 testes automatizados passaram: 500 partidas com sementes reproduzíveis, todos os temas/tipos de dupla/tensão, rejeição de duplicatas e opções inválidas, fallback, pontuação e Ranking/Tensão em 20 rodadas, sigilo das respostas, lookup/entrada, chat, maioria, empate, pulo, resultado, abertura, controles de áudio, troca de trilhas, fundos por rodada e limites de 4 a 12 pessoas.

Teste no navegador Chromium do aplicativo, com dois ou três jogadores em abas separadas:

- Dupla: criação personalizada com duas perguntas, entrada por código, espera, chat com caracteres HTML exibidos como texto, acerto, erro, avanço sincronizado e resultado.
- Grupo/Galera: três participantes, bloqueio de início com pessoas insuficientes, votação, resultado e relatório.
- Duelo: dez perguntas distintas, conclusão das duas fases, dez acertos para Ana e zero para Bia; resultado sincronizado 10–0.
- Sobre: redação exata dos créditos em uma única ocorrência e retorno ao jogo.
- Som: habilitar/desabilitar música e efeitos e ajustar volume por teclado.
- Abertura/carregamento observados no navegador; retorno e navegação não repetem a capa. Skip, movimento reduzido, espera por recursos, timeout e falha de imagem também cobertos por testes com ambiente simulado.
- Layouts de computador (1366×900) e celular (390×844 e 320×740); sem transbordamento horizontal nos formulários/início inspecionados. A barra de rolagem do navegador reduz a largura útil em 15 px.

Não foram testados Safari/iOS, Firefox, aparelhos físicos nem redes móveis reais. Movimento reduzido e falhas de carregamento foram testados programaticamente, não por alterações nas preferências do sistema. A qualidade percebida do som depende do aparelho e pode ser ajustada em Som. As salas e a limitação de reconexão da V2 permanecem: perder a conexão exige voltar ao início e criar/entrar em outra sala. Nenhum deploy, teste de produção após alterações ou migração de infraestrutura foi realizado.

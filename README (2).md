# Animação, música e Modo Duplas — 1º de outubro de 2026

Esta revisão complementa a atualização visual inicial da branch V2. Não foi publicada no Railway nem enviada ao GitHub.

## Mascote

O desenho foi reconstruído em SVG editável em `public/mascot.js`, a partir das referências de identidade fornecidas: crista triangular, olhos grandes claros, barriga verde-clara, cauda enrolada e contornos escuros. A construção vetorial mais limpa substitui o atlas de poses estáticas na interface inteira, incluindo a abertura. O atlas anterior fica preservado como recurso histórico, mas não é carregado.

O primeiro GIF (Behance) orientou a articulação contínua e o movimento secundário; o segundo (Angry Birds/Giphy), a preparação e a recuperação das reações. Não foram incorporados arquivos ou personagens dessas animações ao jogo. O movimento foi programado com transformações CSS, sem geração de novos bitmaps, vídeos nem serviços em execução.

`public/motion.css` anima as articulações separadamente. A mudança gradual de cor é aplicada ao preenchimento da pele, barriga e realces, mantendo olhos e contornos intactos. A cor acompanha os estados e também as quatro brincadeiras ao tocar no personagem. Movimento reduzido desativa animações e transições, preservando a leitura estática de cada expressão. Os controles da rodada não aguardam a animação.

## Música

Os três arquivos em `public/assets/music/` são composições instrumentais originais produzidas com síntese aditiva e envelopes por instrumento, renderizadas em estéreo e convertidas para MP3 a 128 kbps. Não há amostras comerciais ou melodias de outros jogos. O script reproduzível está em `tools/compose_music.py`; Python, NumPy e imageio-ffmpeg são necessários apenas para recriar os arquivos, não para instalar ou hospedar o jogo. O arquivo `manifest.json` registra duração, andamento, tamanho, pico e nível médio de cada faixa.

Cada arranjo tem 48 compassos, seis seções com variação, baixo, vozes harmônicas, percussão discreta e reverberação curta. O reprodutor só busca a faixa quando a música é ligada, conserva a posição ao pausar e oferece uma transição curta ao trocar. Os controles de música, efeitos e volume são independentes. A música não é recurso essencial da abertura: falhas são explicadas no painel de som e não interrompem a partida.

## Regras

O nome público é **Modo Duplas**. O identificador interno `dupla` foi preservado para compatibilidade. São **4 a 12 pessoas, em 2 a 6 duplas completas**. O servidor recusa início abaixo do mínimo ou com duplas incompletas; a interface explica o que falta. Não há mudança de pontuação, sigilo das respostas ou avanço sincronizado. Grupo continua com 3 a 6 pessoas e Duelo com 2.

O teste com Esio revelou duas perguntas sobre saudade muito próximas. Foi adicionada uma normalização editorial específica, com regressão automatizada, para que essas formulações não apareçam juntas novamente. O filtro continua heurístico e não compreende toda equivalência semântica.

## Arquivos desta revisão

- Novos: `public/mascot.js`, `public/motion.css`, `public/assets/music/*.mp3`, `public/assets/music/manifest.json`, `tools/compose_music.py`, este documento.
- Atualizados: `public/index.html`, `public/boot.js`, `public/ui.js`, `public/app.js`, `public/sound.js`, `server.js`, `questions/service.js`, os três arquivos em `test/`, `README.md` e `public/assets/PROVENANCE.md`.
- Dependências de produção, configuração Railway e catálogos JSON preservados.

## Verificação

15 testes automatizados passaram: carregamento real e pulo de abertura, movimento reduzido, ausência de autoplay, troca rápida de músicas e descarte de faixas anteriores, pausa em aba oculta, independência dos controles, paletas por pergunta, 500 partidas geradas sem duplicatas detectadas, fallback e três modos via WebSocket. Os testes de Duplas agora usam pelo menos quatro jogadores, inclusive Ranking/Tensão por 20 rodadas; outro teste conecta 12 pessoas, recusa a 13ª e confere a pontuação das seis duplas.

No Chromium, quatro abas formaram duas duplas e jogaram três rodadas de teste: início bloqueado com três pessoas, liberado com quatro; acerto, erro, pulo, respostas privadas e avanço sincronizado. Foram observadas as cores verde, creme e lilás em perguntas consecutivas e as cores turquesa, dourado e rosa do personagem. As três músicas chegaram a reprodução com duração válida, sem erros de mídia; após a transição, só uma faixa permaneceu ativa. A conferência de movimento usou observação visual e transformações calculadas de cabeça e cauda. O celular foi conferido em 390 px de largura sem transbordamento horizontal.

Limitações: avaliação musical final depende de ouvir nos aparelhos do usuário; os testes técnicos verificam reprodução e controles, não substituem essa avaliação. Não houve teste físico em celulares ou Safari/iOS/Firefox. A perda da conexão e as salas em memória seguem as limitações existentes da V2. Não foi feito deploy.

# Camaleão do ConectAí

## Revisão com articulações e novas músicas

O recurso ativo agora é o desenho vetorial original definido em `../mascot.js`, animado por `../motion.css`. Foi reconstruído em código a partir das mesmas referências para separar cabeça, olhos, pupilas, cauda, braços e pernas. Não foi gerado por imagegen nesta revisão. Todas as telas usam esse mesmo desenho; o atlas abaixo está preservado como versão anterior e não é mais carregado pela interface. Os GIFs enviados pelo usuário foram consultados como referências de movimento, sem copiar seus personagens ou incorporar seus arquivos.

As novas trilhas são `music/jardim-de-conexoes.mp3`, `music/passo-de-camaleao.mp3` e `music/fim-de-tarde.mp3`. Foram compostas e sintetizadas pelo script `../../tools/compose_music.py`, com NumPy, e convertidas por FFmpeg para MP3 estéreo a 128 kbps. São arranjos originais de 48 compassos, não gravações de músicos. Não há amostras nem melodias de Candy Crush, chaves, serviços ou dependências de produção novas. `music/manifest.json` contém as medidas dos arquivos. O áudio procedural de 88 BPM descrito ao fim deste documento pertence à versão anterior.

## Histórico: atlas da primeira revisão

Arquivo consumido: `chameleon-atlas.png` — PNG RGBA transparente, 1536×1024, aproximadamente 1,75 MB. Prancha 3×2; cada célula tem 512×512 pixels. Não requer arquivos individuais: CSS seleciona a célula pelo posicionamento do fundo.

As três referências fornecidas foram examinadas. A prancha original mostrou identidade, cores, expressões e poses; o retrato ampliado confirmou contorno, crista, olhos, barriga e cauda; a terceira imagem confirmou a redação dos créditos e a grafia dos nomes. Nenhuma referência foi tratada como um conjunto de arquivos individuais já recortados.

O atlas foi criado com a ferramenta integrada imagegen, usando a prancha de personagens como referência de identidade e estilo, e salvo no projeto. A transparência foi verificada no canal alfa. Não há geração de imagem durante o jogo, chave nem serviço externo de ilustração em execução.

## Células

1. Boas-vindas, sorriso e aceno.
2. Pensativo, mão no queixo.
3. Espera, sentado.
4. Celebração, braços erguidos.
5. Decepção leve.
6. Aviso/surpresa.

`public/ui.js` associa essas poses aos dez estados do jogo. `public/style.css` aplica variações de cor, respiração, inclinação e reações por transformações CSS. Não há mistura de estilos ou dependência de um serviço de imagens. As animações não bloqueiam botões e são desativadas com movimento reduzido.

## Prompt utilizado

Create one production sprite atlas PNG for the ConectAí web game, transparent background. Reference image is character identity and style reference only, not a ready sprite. Preserve the SAME recognizable green chameleon: huge cream eyes small black pupils, triangular crest, thin irregular dark outlines, pale green belly, curled tail to viewer left, standing biped, hand-drawn 2D illustration with restrained texture. Atlas exactly 3 columns by 2 rows, six equally sized square cells, characters centered and fully inside each cell with generous transparent margins. All characters same green palette, proportions and visual scale. Row1: (1) welcome, smiling, right hand waving; (2) thinking, hand under chin, eyes looking up; (3) waiting, seated, patient gentle smile. Row2: (4) celebrating, both arms up, eyes closed in happiness; (5) mildly disappointed but kind, shoulders lowered, no tears; (6) surprised alert, eyes wide, mouth small O, one hand raised. NO text, NO cell borders, NO ground, NO shadows, NO symbols, NO background. Every cell contains exactly one complete chameleon. Square cells equal, 3x2 layout.

## Áudio

`public/sound.js` é uma composição procedural original: quatro frases em Dó maior, andamento de 88 BPM, timbres senoidal e triangular, acordes suaves e efeitos curtos. Candy Crush foi referência de atmosfera; não foram utilizados melodias ou arquivos do jogo. O áudio é produzido no navegador e não depende deste atlas.

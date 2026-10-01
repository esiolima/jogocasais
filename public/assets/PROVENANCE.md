# Camaleão do ConectAí

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

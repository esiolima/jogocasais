'use strict';

// Only combine within an editorially reviewed situation. Never cross theme fragments.
// Each action is a semantic family: alternative wording/context cannot repeat in a room.
const situations = [
  ['tema1', 'cuidado', ['Depois de um dia difícil', 'Quando os planos dão errado'], ['quem ofereceria companhia sem encher de perguntas', 'quem inventaria um pequeno ritual para animar o outro', 'quem perceberia que o outro prefere silêncio']],
  ['tema1', 'conversa', ['Numa conversa sobre o futuro', 'Ao combinar um projeto juntos'], ['quem colocaria as expectativas no papel', 'quem perguntaria o que o outro ainda não teve coragem de dizer', 'quem lembraria de comemorar as pequenas conquistas']],
  ['tema2', 'nave', ['Numa nave com o rádio quebrado', 'Numa estação espacial sem contato com a Terra'], ['quem tentaria criar um código de sinais', 'quem transformaria sucata em uma ferramenta', 'quem manteria um diário da missão']],
  ['tema2', 'magia', ['Se vocês entrassem numa biblioteca encantada', 'Se encontrassem uma cidade escondida'], ['quem procuraria pistas nos desenhos das paredes', 'quem tentaria conversar com o guardião', 'quem marcaria o caminho para conseguir voltar']],
  ['tema3', 'encontro', ['Num encontro sem usar o celular', 'Numa noite reservada só para vocês'], ['quem criaria uma playlist com músicas da história de vocês', 'quem proporia recriar a primeira foto juntos', 'quem escreveria um bilhete para o outro encontrar depois']],
  ['tema3', 'gesto', ['Se o romance virasse uma cena de filme', 'Se vocês planejassem uma surpresa a dois'], ['quem prepararia a iluminação do ambiente', 'quem ensaiaria uma declaração e esqueceria tudo na hora', 'quem guardaria uma lembrança desse momento']],
  ['tema4', 'palco', ['Durante um karaokê', 'Numa apresentação improvisada'], ['quem inventaria a letra para disfarçar um esquecimento', 'quem agradeceria os aplausos antes da música acabar', 'quem puxaria outra pessoa para dividir o mico']],
  ['tema4', 'mensagem', ['Ao gravar um áudio importante', 'Ao participar de uma chamada de vídeo'], ['quem seria interrompido por um barulho constrangedor', 'quem começaria um discurso sem perceber que está no mudo', 'quem riria do próprio erro antes de tentar de novo']],
  ['tema5', 'projeto', ['Ao vender algo feito por vocês', 'Ao organizar uma pequena feira'], ['quem calcularia os custos que ninguém lembrou', 'quem capricharia mais na apresentação do produto', 'quem guardaria o primeiro pagamento como lembrança']],
  ['tema5', 'consumo', ['Diante de uma assinatura que quase não usam', 'Ao revisar os gastos do mês'], ['quem faria as contas do custo de cada uso', 'quem proporia trocar um gasto por uma experiência juntos', 'quem perceberia uma cobrança duplicada']],
  ['tema6', 'aprender', ['Ao aprender uma habilidade nova', 'No primeiro dia de um curso'], ['quem faria perguntas que ninguém teve coragem de fazer', 'quem ensinaria aos outros o que acabou de descobrir', 'quem preferiria observar antes de tentar']],
  ['tema6', 'escuta', ['Numa conversa com opiniões muito diferentes', 'Numa reunião em que todos falam ao mesmo tempo'], ['quem pediria a palavra para a pessoa mais quieta', 'quem resumiria os pontos em comum', 'quem mudaria de ideia ao ouvir um bom exemplo']],
  ['tema7', 'passeio', ['Num passeio por uma cidade pequena', 'Numa parada inesperada durante a viagem'], ['quem descobriria um lugar perguntando na padaria', 'quem colecionaria pequenos objetos do caminho', 'quem desenharia um mapa para lembrar do passeio']],
  ['tema7', 'bagagem', ['Ao fazer a mala para um fim de semana', 'Ao preparar a mochila para uma trilha curta'], ['quem levaria um kit para todo tipo de conserto', 'quem separaria os lanches por horário', 'quem deixaria espaço para trazer lembranças']],
  ['tema8', 'casa', ['Num domingo em casa', 'Numa tarde chuvosa sem compromissos'], ['quem montaria uma cabana na sala', 'quem aproveitaria para recuperar um objeto antigo', 'quem inventaria uma receita com as sobras da geladeira']],
  ['tema8', 'rotina', ['Ao organizar um espaço compartilhado', 'Ao rearrumar a cozinha'], ['quem daria nomes engraçados às caixas', 'quem descobriria um objeto perdido há meses', 'quem separaria coisas para doar']],
  ['tema9', 'troca', ['Se vocês cuidassem de um museu por uma noite', 'Se recebessem a chave de um castelo por um dia'], ['quem criaria uma visita guiada cheia de histórias inventadas', 'quem procuraria uma passagem secreta', 'quem testaria a acústica cantando bem alto']],
  ['tema9', 'miniatura', ['Se vocês ficassem do tamanho de um lápis', 'Se o quarto virasse um cenário gigante'], ['quem transformaria uma xícara em piscina', 'quem usaria um carrinho de brinquedo como transporte', 'quem faria uma escada com objetos da mesa']],
  ['tema10', 'imprevisto', ['Se faltasse luz no meio de uma festa', 'Se a chuva interrompesse um piquenique'], ['quem começaria uma rodada de histórias para animar o pessoal', 'quem encontraria um uso inesperado para uma toalha', 'quem daria um nome engraçado ao desastre']],
  ['tema10', 'sorteio', ['Numa brincadeira com tarefas sorteadas', 'Num desafio com regras surpresa'], ['quem tentaria negociar uma segunda chance', 'quem criaria um ritual para dar sorte', 'quem guardaria o papel do sorteio como troféu']],
];

const tension = [
  ['tema1', 'limites', ['Se um combinado entre vocês fosse esquecido', 'Se uma conversa importante fosse adiada várias vezes'], ['quem cobraria uma mudança concreta', 'quem pediria um tempo antes de conversar', 'quem fingiria que está tudo bem para evitar o assunto']],
  ['tema2', 'missao', ['Se uma missão exigisse separar a dupla', 'Se o abrigo só tivesse recursos para mais um dia'], ['quem questionaria a decisão do líder', 'quem compartilharia um medo que vinha escondendo', 'quem prometeria mais do que consegue cumprir']],
  ['tema3', 'atencao', ['Se uma surpresa romântica não agradasse', 'Se um encontro especial fosse esquecido'], ['quem teria dificuldade de dizer que se decepcionou', 'quem tentaria compensar com um gesto exagerado', 'quem compararia o momento com o início da relação']],
  ['tema4', 'exposicao', ['Se uma foto constrangedora aparecesse no grupo', 'Se uma história pessoal virasse piada numa festa'], ['quem pediria para encerrar a brincadeira', 'quem riria junto mesmo se sentindo desconfortável', 'quem cobraria um pedido de desculpas em particular']],
  ['tema5', 'prioridade', ['Se o orçamento só permitisse realizar um dos planos', 'Se um gasto inesperado adiasse um sonho'], ['quem defenderia a própria prioridade até o fim', 'quem evitaria mostrar o quanto ficou frustrado', 'quem cobraria uma compensação no futuro']],
  ['tema6', 'critica', ['Ao receber uma crítica na frente de outras pessoas', 'Ao perceber que ninguém apoiou sua ideia'], ['quem tentaria provar que todos estão errados', 'quem levaria o assunto para casa', 'quem perguntaria o que pode fazer diferente']],
  ['tema7', 'roteiro', ['Se a viagem virasse uma sequência de concessões', 'Se só uma pessoa decidisse os passeios'], ['quem deixaria a insatisfação acumular', 'quem proporia passar um dia fazendo programas separados', 'quem cobraria mais participação nas escolhas']],
  ['tema8', 'divisao', ['Se uma tarefa combinada sobrasse sempre para a mesma pessoa', 'Se o espaço comum fosse ocupado sem combinar'], ['quem criaria uma regra rígida para resolver', 'quem pararia de ajudar como forma de protesto', 'quem pediria para renegociar o acordo']],
  ['tema9', 'segredo', ['Se chegasse uma proposta misteriosa para a dupla', 'Se um desconhecido oferecesse uma vantagem suspeita'], ['quem exigiria saber todos os detalhes antes de aceitar', 'quem esconderia a proposta com receio da reação do outro', 'quem aceitaria e só contaria depois']],
  ['tema10', 'risco', ['Se um palpite arriscado desse errado', 'Se uma aposta numa brincadeira custasse a vitória'], ['quem colocaria a culpa no azar', 'quem lembraria que tinha avisado', 'quem pediria revanche imediatamente']],
];

const groupScenes = [
  ['mesa', ['Num almoço em família', 'Num lanche com a galera'], ['quem criaria uma competição para escolher a sobremesa', 'quem guardaria a receita para repetir o encontro', 'quem reservaria um lugar para quem está chegando']],
  ['memoria', ['Ao abrir uma caixa de fotografias antigas', 'Ao rever um vídeo de um encontro antigo'], ['quem lembraria do que aconteceu depois daquela foto', 'quem inventaria legendas para todas as imagens', 'quem organizaria um reencontro para repetir a cena']],
  ['cooperacao', ['Ao montar uma horta comunitária', 'Ao preparar uma festa na rua'], ['quem ensinaria uma tarefa a quem nunca fez', 'quem criaria um cartaz para chamar mais gente', 'quem lembraria de agradecer a cada participante']],
  ['desafio', ['Numa caça ao tesouro em casa', 'Numa gincana no parque'], ['quem decifraria uma pista pelo detalhe mais improvável', 'quem comemoraria antes de conferir a resposta', 'quem inventaria um grito de torcida']],
  ['tensao', ['Se uma decisão do grupo fosse tomada sem consultar todos', 'Se alguém mudasse o combinado na última hora'], ['quem exigiria uma nova votação', 'quem sairia da conversa sem explicar', 'quem tentaria conversar com cada pessoa separadamente']],
];

// Options belong to the intention, not to arbitrary words from other questions.
const quizScenes = [
  ['presente', ['Você ganha uma tarde livre. O que faria primeiro', 'Sem obrigações por algumas horas, o que você escolheria'], ['Explorar um lugar novo', 'Descansar em casa', 'Encontrar alguém querido', 'Terminar um projeto pessoal']],
  ['lembranca', ['Qual lembrança você guardaria de uma viagem', 'O que você traria para lembrar de um lugar especial'], ['Uma fotografia', 'Um objeto artesanal', 'Uma receita', 'Uma história escrita']],
  ['aprender', ['O que mais ajuda você a aprender uma habilidade', 'Ao tentar algo pela primeira vez, o que funciona melhor para você'], ['Ver uma demonstração', 'Ler o passo a passo', 'Experimentar por conta própria', 'Aprender junto com alguém']],
  ['acolher', ['Depois de um dia cansativo, o que faria você se sentir acolhido', 'Quando precisa recarregar as energias, o que você prefere receber'], ['Uma conversa atenta', 'Ajuda com as tarefas', 'Um pouco de espaço', 'Um convite para se distrair']],
  ['criar', ['Se pudesse criar algo em um ateliê, o que escolheria', 'Que projeto criativo você gostaria de experimentar'], ['Uma peça de cerâmica', 'Uma história ilustrada', 'Uma música', 'Um móvel pequeno']],
  ['curiosidade', ['Qual bastidor você gostaria de conhecer', 'Se ganhasse uma visita guiada especial, qual escolheria'], ['A cozinha de um restaurante', 'Um estúdio de cinema', 'Um laboratório de pesquisa', 'O camarim de um show']],
  ['ritual', ['Qual pequeno ritual combina mais com você', 'O que você gostaria de incluir numa pausa do dia'], ['Cuidar de uma planta', 'Ouvir uma música inteira', 'Escrever algumas linhas', 'Caminhar sem olhar o celular']],
  ['decisao', ['Ao escolher entre dois planos igualmente bons, o que você faz', 'Se duas opções parecem boas, como você desempata'], ['Peço uma opinião', 'Faço uma lista de vantagens', 'Sigo minha primeira impressão', 'Sorteio e aceito o resultado']],
  ['aventura', ['Qual experiência diferente você toparia experimentar', 'Se recebesse um convite para sair da rotina, qual aceitaria'], ['Observar estrelas', 'Fazer uma aula de dança', 'Participar de uma peça', 'Cozinhar com ingredientes surpresa']],
  ['celebrar', ['Como você gostaria de celebrar uma pequena conquista', 'Qual comemoração mais combina com você'], ['Reunir poucas pessoas', 'Fazer um passeio sozinho', 'Preparar algo gostoso', 'Registrar o momento e seguir o dia']],
  ['mensagens', ['Que tipo de mensagem inesperada alegraria seu dia', 'O que você mais gosta de receber de alguém querido'], ['Uma lembrança engraçada', 'Uma música escolhida para mim', 'Um convite para conversar', 'Uma foto de um momento nosso']],
  ['tempo', ['Se pudesse dominar uma habilidade num instante, qual escolheria', 'Qual habilidade você teria mais vontade de desenvolver'], ['Falar outro idioma', 'Tocar um instrumento', 'Desenhar de observação', 'Preparar pratos elaborados']],
  ['colecao', ['Qual coleção você teria prazer em começar', 'Se ganhasse espaço para uma coleção, o que guardaria'], ['Livros com dedicatórias', 'Discos de música', 'Objetos de viagens', 'Jogos de tabuleiro']],
  ['receber', ['Ao receber uma visita em casa, no que você pensa primeiro', 'Se alguém fosse passar a tarde com você, o que prepararia'], ['Algo para comer', 'Um ambiente confortável', 'Uma atividade para fazer juntos', 'Tempo livre para conversar']],
];

function candidates(context) {
  if (context.mode === 'duelo') return quizScenes.flatMap(([family, texts, options]) => texts.map(text => ({text: text + '?', options, family: 'quiz-' + family, source: 'rules'})));
  let scenes = context.mode === 'grupo' ? groupScenes : situations;
  if (context.mode === 'dupla') scenes = scenes.concat(tension);
  return scenes.flatMap(([themeId, familyOrContexts, contextsOrActions, maybeActions]) => {
    const group = context.mode === 'grupo';
    const family = group ? themeId : familyOrContexts;
    const contexts = group ? familyOrContexts : contextsOrActions;
    const actions = group ? contextsOrActions : maybeActions;
    const isTension = group ? family === 'tensao' : tension.some(s => s[1] === family);
    if (context.tensionMode && !isTension) return [];
    if (!group && context.themeId !== 'aleatorio' && themeId !== context.themeId) return [];
    if (!group && themeId === 'tema3' && context.relationshipType !== 'casal') return [];
    return contexts.flatMap(situation => actions.map((action, i) => ({
      text: `${situation}, ${action}?`, themeId: group ? undefined : themeId,
      tension: isTension, family: `${group ? 'grupo' : themeId}-${family}-${i}`, source: 'rules',
    })));
  });
}
module.exports = { candidates };

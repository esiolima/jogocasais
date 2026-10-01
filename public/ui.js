/* ConectAí visual system. One articulated character across all screens. */
const UI = (() => {
  const credits = 'Desenvolvido por Plínio Augusto e Esio Lima. © 2026 ConectAí. Todos os direitos reservados.';
  function mascot(mood, extra = '') {
    return Mascot.html(mood, extra);
  }
  function stage(s) {
    let mood = 'create', title = 'Do seu jeito.', eyebrow = 'PREPARE A PARTIDA', text = 'Escolha as opções e convide quem vai jogar com você.';
    if (s.screen === 'home') { mood = 'welcome'; title = 'Quem te conhece de verdade?'; eyebrow = 'MENOS SCROLL. MAIS CONEXÃO.'; text = 'Um palpite, uma surpresa e muita história para contar. Bora se descobrir?'; }
    if (s.screen === 'setupDupla') { eyebrow = 'MODO DUPLAS · 4 A 12 PESSOAS'; title = 'Qual dupla tem mais sintonia?'; text = 'Formem de 2 a 6 duplas. Respondam em segredo: palpites que apontam para a mesma pessoa valem pontos para a dupla.'; }
    if (s.screen === 'setupGrupo') { title = 'Todo mundo na roda.'; text = 'De 3 a 6 pessoas. Votem em quem mais combina com cada pergunta e descubram a opinião do grupo.'; }
    if (s.screen === 'setupDuelo') { title = 'Você me conhece?'; text = 'Primeiro, cada um responde sobre si. Depois, vale adivinhar as escolhas da outra pessoa.'; }
    if (s.screen === 'join') { mood = 'choose'; eyebrow = 'JÁ TEM UM CONVITE?'; title = 'Chega mais.'; text = 'Use o código de quem criou a sala. A conexão começa aqui.'; }
    if (s.screen === 'lobby') { mood = 'wait'; eyebrow = 'SALA DE ENCONTRO'; title = 'Falta pouco!'; text = 'Compartilhe o código e espere o pessoal chegar. O chat já está liberado.'; }
    if (s.screen === 'game') {
      mood = 'question'; eyebrow = s.mode === 'duelo' ? 'DUELO · 1 × 1' : s.mode === 'grupo' ? 'FAMÍLIA / GALERA' : 'MODO DUPLAS'; title = 'Qual é seu palpite?'; text = 'Responda no seu tempo.';
      const g = s.game;
      if (s.mode === 'duelo') {
        if (s.dueloLocalIndex >= (s.dueloQuestions?.length || 0)) { mood = 'wait'; title = 'Sua parte está feita.'; text = 'Aguardando a outra pessoa terminar.'; }
        else if (s.dueloLastResult) { mood = s.dueloLastResult.correct ? 'success' : 'error'; title = s.dueloLastResult.correct ? 'Na mosca!' : 'Mais uma descoberta.'; text = 'Cada resposta conta um pouco mais.'; }
        else if (s.dueloPhase === 'setup') { mood = 'answer'; title = 'Agora é sobre você.'; text = 'Suas escolhas ficam em segredo nesta fase.'; }
      } else if (g) {
        if (g.revealed || g.allVoted) { mood = g.skipped ? 'warning' : (g.match || (g.allVoted && !g.tie)) ? 'success' : 'error'; title = g.skipped ? 'Tudo bem pular.' : mood === 'success' ? 'Deu conexão!' : 'Olha a surpresa!'; text = 'Quando todos confirmarem, a próxima pergunta aparece.'; }
        else if (g.myAnswer || g.myVote) { mood = 'answer'; title = 'Palpite guardado.'; text = 'Aguardando os outros responderem.'; }
      }
    }
    if (s.screen === 'finished') { mood = 'result'; eyebrow = 'BOAS HISTÓRIAS FICAM'; title = 'Valeu a conexão!'; text = 'O placar é só o começo da conversa.'; }
    if (s.error || s.connError) { mood = 'warning'; }
    return { mood, title, eyebrow, text };
  }
  function shell(s, content) {
    const st = stage(s);
    return `<header class="site-header"><button class="wordmark" onclick="${s.roomCode && s.screen !== 'join' && s.screen !== 'finished' ? 'actionLeave()' : 'resetToHome()'}" aria-label="ConectAí — início">Conect<span>Aí</span><i aria-hidden="true">•</i></button><div class="header-actions"><span class="connection"><span aria-hidden="true">●</span> ${s.connError ? 'Sem conexão' : 'Juntos, em tempo real'}</span><button id="sound-button" class="about-link" onclick="Sound.open()">${Sound.label()}</button><button class="about-link" onclick="UI.openAbout()">Sobre</button></div></header>
      <main class="layout" id="main"><section class="stage"><p class="eyebrow">${st.eyebrow}</p><h1 tabindex="-1">${st.title}</h1><p class="stage-copy">${st.text}</p>${mascot(st.mood)}<span class="stage-note">${s.screen === 'home' ? 'Cada resposta aproxima.' : 'ConectAí · do seu jeito, no seu tempo.'}</span></section><section class="content" aria-label="${st.eyebrow}">${content}</section></main>
      <footer class="site-footer"><span>Feito para jogar junto.</span><button class="about-link" onclick="UI.openAbout()">Sobre e créditos</button></footer>`;
  }
  let aboutOpener;
  function openAbout() {
    if (document.getElementById('about-dialog')) return;
    aboutOpener = document.activeElement;
    const dialog = document.createElement('dialog'); dialog.id = 'about-dialog';
    dialog.setAttribute('aria-labelledby', 'about-title');
    dialog.innerHTML = `<h2 id="about-title">Sobre o ConectAí</h2><p>Um jogo para descobrir afinidades entre duplas, amigos e família.</p><p>A geração de perguntas combina situações e temas revisados. O catálogo original completa cada partida, sem serviços externos de perguntas.</p><p class="credits">${credits}</p><form method="dialog"><button class="btn btn-primary">Voltar ao jogo</button></form>`;
    dialog.addEventListener('close', () => { dialog.remove(); if (aboutOpener?.isConnected) aboutOpener.focus(); else document.querySelector('.about-link')?.focus(); });
    document.body.append(dialog); dialog.showModal();
  }
  function enhance(root) {
    root.querySelectorAll('div[onclick],span[onclick]').forEach(el => {
      el.tabIndex = 0; el.setAttribute('role', el.classList.contains('switch') ? 'switch' : 'button');
      if (el.classList.contains('switch')) { el.setAttribute('aria-checked', el.classList.contains('on')); el.setAttribute('aria-label', el.parentElement.querySelector('.toggle-label').textContent.replace('?', '').trim()); }
      else if (el.matches('.chip,.gender-opt')) el.setAttribute('aria-pressed', el.classList.contains('selected'));
      if (el.classList.contains('info-icon')) el.setAttribute('aria-label', 'Como funciona ' + el.parentElement.textContent.replace('?', '').trim());
      el.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); el.click(); } };
    });
    root.querySelectorAll('input,textarea').forEach((el, index) => {
      el.id = 'field-' + index;
      const label = el.previousElementSibling;
      if (label?.matches('label')) label.htmlFor = el.id;
      else el.setAttribute('aria-label', el.placeholder || 'Mensagem');
      if (el.tagName === 'INPUT') el.maxLength = el.placeholder === 'K7P2XM' ? 6 : el.closest('.chat-panel') ? 300 : 30;
    });
    root.querySelectorAll('.error-box').forEach(el => el.setAttribute('role', 'alert'));
    root.querySelectorAll('.status-banner,.result-banner').forEach(el => el.setAttribute('role', 'status'));
    const chat = root.querySelector('.chat-messages');
    if (chat) { chat.setAttribute('role', 'log'); chat.setAttribute('aria-label', 'Conversa da partida'); chat.scrollTop = chat.scrollHeight; }
  }
  return { mascot, shell, enhance, openAbout };
})();

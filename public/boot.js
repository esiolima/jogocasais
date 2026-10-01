/* The cover lives outside #app, so server messages never restart the animation. */
const Boot = (() => {
  const cover = document.getElementById('intro');
  const status = document.getElementById('boot-status');
  const progress = document.getElementById('boot-progress');
  const ready = new Set();
  let done = false, animationDone = false, failed = false;
  let seen = false;
  try { seen = sessionStorage.getItem('conectai-intro') === 'seen'; } catch { /* private mode */ }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (seen || reduced) cover.classList.add('intro-simple');
  function finish() {
    if (done || failed || ready.size < 3 || !animationDone) return;
    done = true;
    try { sessionStorage.setItem('conectai-intro', 'seen'); } catch { /* optional */ }
    cover.hidden = true;
    document.getElementById('app').inert = false;
    document.querySelector('main h1')?.focus({ preventScroll: true });
  }
  function skip() { animationDone = true; cover.classList.add('intro-simple'); status.textContent = 'Preparando sua conexão…'; finish(); }
  function mark(name) {
    ready.add(name); progress.value = ready.size;
    status.textContent = ready.size === 3 ? 'Tudo pronto. Bora conectar!' : `${ready.size} de 3 etapas prontas · preparando o jogo…`;
    finish();
  }
  function fail(message) {
    if (done) return;
    failed = true; cover.classList.add('intro-simple'); status.textContent = message;
    document.getElementById('boot-retry').hidden = false;
  }
  document.getElementById('intro-skip').onclick = skip;
  document.getElementById('boot-retry').onclick = () => location.reload();
  setTimeout(() => { animationDone = true; finish(); }, seen || reduced ? 0 : 2600);
  setTimeout(() => { if (!done && !failed) status.textContent = 'A conexão está demorando um pouco. Continuamos preparando o jogo…'; }, 4500);
  setTimeout(() => { if (!done) fail('Não foi possível terminar o carregamento. Verifique sua conexão e tente novamente.'); }, 12000);
  const image = new Image(); image.onload = () => mark('mascot'); image.onerror = () => fail('Não conseguimos carregar o mascote. Tente novamente.'); image.src = '/assets/chameleon-atlas.png';
  return { mark, fail };
})();

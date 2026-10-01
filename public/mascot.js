/* Original vector rig, drawn for animation from the supplied chameleon references.
 * Each joint has its own pivot. No GIF decoder, canvas loop or runtime service. */
const Mascot = (() => {
  const drawing = `<svg class="chameleon" viewBox="0 0 320 340" aria-hidden="true" focusable="false">
    <ellipse class="ground" cx="167" cy="310" rx="78" ry="8"/>
    <g class="actor" stroke="#173e36" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round">
      <g class="tail"><path fill="var(--skin)" d="M151 253C128 270 115 301 73 296C31 292 18 263 27 235C37 207 72 207 85 227C101 252 72 273 59 257C51 247 60 237 66 241C60 233 45 238 47 250C50 275 85 278 111 253L140 229Z"/><path class="tail-shine" fill="none" stroke="var(--shine)" stroke-width="7" d="M127 268C103 292 61 291 41 267C28 251 37 225 53 223"/></g>
      <g class="leg leg-back"><path fill="var(--shade)" d="M204 252L214 289Q245 290 251 307Q230 316 203 308L184 283Z"/><path fill="var(--belly)" d="M235 299Q245 298 250 307L235 309ZM218 299Q228 299 233 310L216 310Z"/></g>
      <g class="body"><path fill="var(--shade)" d="M132 133L116 141L120 152L106 161L111 171L99 182L106 193L96 207L106 217L99 230L116 240L139 202Z"/>
        <path fill="var(--skin)" d="M149 118C121 151 109 187 116 239C119 270 136 283 167 285C205 288 226 263 228 233C230 187 210 154 209 129Z"/>
        <path fill="var(--belly)" stroke="none" d="M180 165C149 169 137 202 142 239C147 270 171 279 193 266C226 247 220 184 196 169Z"/>
        <path fill="none" stroke="var(--shine)" stroke-width="5" d="M137 168Q124 197 129 224"/>
        <g fill="var(--shade)" stroke="none" opacity=".38"><ellipse cx="130" cy="234" rx="3" ry="5"/><ellipse cx="134" cy="247" rx="3" ry="4"/><ellipse cx="220" cy="216" rx="3" ry="6"/></g>
      </g>
      <g class="leg leg-front"><path fill="var(--skin)" d="M148 261Q153 284 147 296Q170 298 176 309Q151 321 122 309L130 271Z"/><path fill="var(--belly)" d="M159 301Q172 300 176 309L160 312ZM137 300Q150 301 153 314L135 313Z"/></g>
      <g class="arm arm-back"><path fill="var(--shade)" d="M211 166Q226 190 227 214L235 234Q236 246 230 247L225 240Q228 253 221 253L215 242Q215 254 209 249Q204 240 207 231L201 193"/></g>
      <g class="head">
        <path fill="var(--skin)" d="M130 112Q128 77 142 32Q147 14 160 27L191 63Q215 53 222 66Q242 88 239 116Q261 143 235 163Q210 181 164 164Q128 150 130 112Z"/>
        <path fill="var(--shade)" stroke="none" d="M144 35Q130 82 135 120L144 115Q140 77 156 32Z"/>
        <path fill="none" stroke="var(--shine)" stroke-width="5" d="M151 34Q170 48 181 64"/>
        <path class="brow brow-left" fill="none" d="M141 78Q157 66 179 78"/><path class="brow brow-right" fill="none" d="M199 74Q215 62 231 76"/>
        <g class="eye eye-left"><ellipse fill="#fff9df" cx="161" cy="106" rx="27" ry="32"/><g class="pupil"><ellipse fill="#15372f" stroke="none" cx="169" cy="105" rx="7" ry="10"/><circle fill="#fff" stroke="none" cx="171" cy="102" r="2"/></g></g>
        <g class="eye eye-right"><ellipse fill="#fff9df" cx="217" cy="100" rx="23" ry="28"/><g class="pupil"><ellipse fill="#15372f" stroke="none" cx="222" cy="99" rx="6.5" ry="9"/><circle fill="#fff" stroke="none" cx="224" cy="96" r="1.8"/></g></g>
        <path class="closed-eye left" fill="none" d="M142 105Q160 118 179 104"/><path class="closed-eye right" fill="none" d="M201 100Q217 111 231 98"/>
        <g class="cheeks" fill="#e18a7c" stroke="none" opacity=".52"><ellipse cx="147" cy="140" rx="9" ry="5"/><ellipse cx="232" cy="129" rx="7" ry="4"/></g>
        <path class="mouth smile" fill="none" d="M165 146Q197 162 225 138"/>
        <g class="mouth grin"><path fill="#193e34" d="M161 140Q195 154 228 132Q217 170 189 167Q169 162 161 140Z"/><path fill="#ef8e88" stroke="none" d="M183 162Q194 149 209 159Q194 170 183 162Z"/></g>
        <ellipse class="mouth oh" fill="#193e34" cx="202" cy="151" rx="8" ry="11"/>
        <path class="mouth puzzled" fill="none" d="M177 150Q202 141 223 150"/>
        <g class="tongue"><path fill="none" stroke="#193e34" stroke-width="12" d="M221 142H283"/><path fill="none" stroke="#ed9a99" stroke-width="7" d="M221 142H283"/><ellipse fill="#ed9a99" cx="284" cy="140" rx="7" ry="5"/></g>
      </g>
      <g class="arm arm-front"><path fill="var(--skin)" d="M139 164Q121 185 122 220L117 241Q115 250 122 252L127 243Q122 258 130 259L136 247Q133 262 140 259L146 245Q146 235 139 228L151 189"/><path fill="none" stroke="var(--shine)" stroke-width="4" d="M135 183Q128 201 130 216"/></g>
    </g>
    <g class="expression-lines" stroke="#254e40" stroke-width="3.5" stroke-linecap="round"><path d="M254 60L265 48M268 83L281 80M118 54L110 40"/></g>
  </svg>`;
  function html(mood='welcome', extra='') {
    return `<button type="button" class="mascot mood-${mood} ${extra}" data-mood="${mood}" aria-label="Brincar com o camaleão" onclick="Mascot.play(this)">${drawing}</button>`;
  }
  let reaction = 0;
  function play(el) {
    if (el.dataset.play) return;
    el.dataset.play = ['wave','hop','peek','dance'][reaction++ % 4];
    if (typeof Sound !== 'undefined') Sound.cue('mascot');
    setTimeout(() => { if (el.isConnected) delete el.dataset.play; }, 1900);
  }
  function mount(root, s, previous) {
    const fresh = root.querySelector('.mascot');
    if (!fresh) return;
    // Chat/score updates must not restart a character's animation.
    const el = previous || fresh;
    if (previous) { el.className = fresh.className + (el.classList.contains('new-question') ? ' new-question' : ''); el.dataset.mood = fresh.dataset.mood; fresh.replaceWith(el); }
    const index = s.mode === 'duelo' ? s.dueloLocalIndex || 0 : s.game?.questionIndex || 0;
    const phase = s.mode === 'duelo' && s.dueloPhase === 'guess' ? (s.dueloQuestions?.length || 10) : 0;
    if (s.screen === 'game') document.body.dataset.palette = String((index + phase) % 6);
    else delete document.body.dataset.palette;
    const round = s.screen === 'game' ? `${s.roomCode}:${s.mode}:${s.dueloPhase}:${index}` : s.screen;
    if (el.dataset.round !== round) {
      el.dataset.round = round;
      el.classList.remove('new-question');
      // Restart only this bounded entrance; answers remain immediately usable.
      void el.offsetWidth;
      el.classList.add('new-question');
    }
  }
  function intro() {
    const host = document.querySelector('.intro-mascot');
    if (host) { host.innerHTML = drawing; host.dataset.mood = 'welcome'; }
  }
  intro();
  return { html, mount, play };
})();

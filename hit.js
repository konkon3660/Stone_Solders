// 전투 타격감: 효과음과 진동. 본 게임과 실험실이 같이 쓴다. 소리는 파일 없이 브라우저에서 만든다.
// 화면 쪽 움직임은 style.css의 '전투 타격감' 구간에 있다. 맞부딪히는 순간이 HIT_AT초 뒤다.
const HIT_AT = 0.36;
let hitAudio = null;
let hitSound = (() => { try { return localStorage.getItem('sound') !== 'off'; } catch { return true; } })();
function toggleSound() {
  hitSound = !hitSound;
  try { localStorage.setItem('sound', hitSound ? 'on' : 'off'); } catch {}
}
// 브라우저는 사용자가 누른 뒤에만 소리를 낸다. 클릭마다 불러 둔다.
function wakeAudio() {
  if (!hitSound) return;
  try { hitAudio ??= new AudioContext(); if (hitAudio.state === 'suspended') hitAudio.resume(); } catch { hitAudio = null; }
}
function tone(at, freq, dur, { type = 'sine', vol = 0.2, to = freq } = {}) {
  const a = hitAudio, o = a.createOscillator(), g = a.createGain(), t = a.currentTime + at;
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}
function thud(at, vol) {
  const a = hitAudio, n = Math.floor(a.sampleRate * 0.18), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3;
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime + at;
  src.buffer = buf;
  f.type = 'lowpass';
  f.frequency.value = 900;
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
  tone(at, 120, 0.25, { vol:vol * 0.9, to:45 });
}
// outcome: 'win' | 'lose' | 'draw'(둘이서 하기는 이긴 쪽이 있으면 'win'). big: 2점 이상. flips: 뒤집히거나 드러난 돌 수. wonder: 불가사의가 이김.
function playHit({ outcome, big = false, flips = 0, wonder = false }) {
  const still = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!still && globalThis.navigator?.vibrate) setTimeout(() => navigator.vibrate(outcome === 'draw' ? 25 : big ? [70, 50, 110] : 45), HIT_AT * 1000);
  if (!hitSound || !hitAudio) return;
  try {
    thud(HIT_AT, big ? 0.9 : 0.6);
    if (outcome === 'win') [523, 659, 784].forEach((f, i) => tone(HIT_AT + 0.12 + i * 0.09, f, 0.3, { type:'triangle', vol:0.16 }));
    if (outcome === 'lose') tone(HIT_AT + 0.12, 330, 0.5, { type:'sawtooth', vol:0.07, to:150 });
    if (outcome === 'draw') tone(HIT_AT + 0.08, 880, 0.25, { type:'square', vol:0.05, to:840 });
    if (wonder) [988, 1319, 1568].forEach((f, i) => tone(HIT_AT + 0.05 + i * 0.06, f, 0.5, { vol:0.08 }));
    for (let i = 0; i < Math.min(flips, 6); i++) tone(0.8 + i * 0.12, 1500, 0.05, { type:'square', vol:0.05, to:900 });
  } catch {}
}
// before와 지금 돌을 비교해 뒤집힌 돌은 ' flip', 새로 드러난 회색돌은 ' reveal'. before가 없으면 ''.
function stoneChange(before, st) {
  if (!before) return '';
  if (before.kind === 'G' && (before.color === '?' || !before.revealed) && st.revealed) return before.color !== '?' && before.color !== st.color ? ' flip' : ' reveal';
  return before.color !== st.color ? ' flip' : '';
}
// 두 상태 사이에 바뀐 돌 수.
const changedStones = (before, after) => !before ? 0 : after.players.reduce((n, pl, p) => n + pl.civs.reduce((m, civ, c) => m + civ.stones.filter((st, k) => stoneChange(before.players[p].civs[c].stones[k], st)).length, 0), 0);

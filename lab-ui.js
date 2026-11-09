// 실험실 화면: 버릴 시험판. 규칙은 lab-rules.js, 족보표는 game.js에 있다.
const app = document.getElementById('app');
const sheet = document.getElementById('table-sheet');
const LETTERS = 'ABC';
const mods = { ability:true, rush:false, fronts:false, bomb:false, capture:false, carry:false, cards:2 };
let s, mode, phase = 'start', viewer = 0, moves, fighters, pend = [], pick = null, tableTurn = 1;

const nameOf = p => mode === 'bot' ? ['나','봇'][p] : `플레이어 ${p + 1}`;
const eul = word => (word.charCodeAt(word.length - 1) - 0xAC00) % 28 ? '을' : '를';
const rankTag = rank => `<b class="rank ${rank === 1 ? 'top' : rank <= 3 ? 'high' : ''}">${rank}위</b>`;
const handLine = e => `${rankTag(e.rank)} <span class="hand-name">${e.name}</span>${e.special ? ' <span class="star">★</span>' : ''}`;
const beatText = (t, count) => { const names = TABLES[t].slice(0, count).map(row => row[2]); return `${names.join(', ')}${eul(names.at(-1))} 이긴다`; };
const artImg = (art, cls = '') => `<img class="${cls}" src="${art.file}" alt="${art.title}" loading="lazy" style="object-position:${art.pos ?? 'center'}">`;
const dot = (c, gray = false) => `<span class="dot ${c === 'B' ? 'b' : c === 'W' ? 'w' : 'g'}${gray ? ' gray' : ''}"></span>`;
const dotsOf = q => `<span class="dots">${[...q].map(c => dot(c)).join('')}</span>`;
const shapeDots = shape => { const [pattern, note] = shape.split('|'); return `<span class="dots">${pattern.replace(/\[([BW]+)\]|([BW])/g, (_, g, one) => g ? `<span class="any">${[...g].map(c => dot(c)).join('')}</span>` : dot(one))}</span>${note ? `<small class="shape-note">${note}</small>` : ''}`; };
const isHidden = (st, owner, view) => st.kind === 'G' && !st.revealed && view !== 'all' && view !== owner;
const stoneHTML = (st, owner, view) => isHidden(st, owner, view) ? '<span class="stone hidden" role="img" aria-label="공개되지 않은 회색돌">?</span>'
  : `<span class="stone ${st.color === 'B' ? 'b' : 'w'}${st.kind === 'G' ? ' from-gray' : ''}"></span>`;
const fxLine = name => s.mods.ability && abilityText(name) ? `<p class="note">능력: ${abilityText(name)}</p>` : '';
const eraTag = n => s.mods.rush ? `<small class="muted">${ERAS[n][0]}</small> ` : '';
const secretOwner = () => mode === 'bot' || ['assign', 'fight'].includes(phase) ? viewer : null;

function banTag(civ) {
  if (s.mods.fronts || s.over) return '';
  const left = civ.bannedThrough - s.turn + 1;
  return left > 0 ? `<span class="tag off">출전 제한 ${left}턴</span>` : '<span class="tag">출전 가능</span>';
}

function stockHTML(p, view, picking = []) {
  const st = { ...s.players[p].stock };
  picking.forEach(([, k]) => { st[k]--; });
  const item = (html, n) => `<span class="stock-item">${html}<b>${n}</b></span>`;
  return `<p class="stock"><span>남은 돌</span>${item(dot('B'), st.B)}${item(dot('W'), st.W)}${view === p ? item(dot('B', true), st.GB) + item(dot('W', true), st.GW) : item(dot('G'), st.GB + st.GW)}</p>`;
}

const bombLine = (stones, owner, view) => s.mods.bomb && stones.some(st => st.kind === 'G') && !stones.some(st => isHidden(st, owner, view)) && seqOfStones(s.mods, stones) !== stones.map(st => st.color).join('')
  ? `<p class="note">폭발 후 ${dotsOf(seqOfStones(s.mods, stones))}</p>` : '';

function path(owner, i, view) {
  const stones = s.players[owner].civs[i].stones;
  if (!stones.length || (view !== owner && view !== 'all')) return '';
  const steps = stones.map((_, k) => { const e = evaluate(k + 1, seqOfStones(s.mods, stones.slice(0, k + 1)), s.players[owner].cards); return `<span>${e.name}${e.special ? '★' : ''}</span>`; });
  return `<p class="path">${steps.join(' › ')}</p>`;
}

function civCard(owner, i, view) {
  const civ = s.players[owner].civs[i], banned = !s.mods.fronts && civ.bannedThrough >= s.turn && !s.over;
  let info = '';
  if (civ.stones.length && !s.over) {
    if (view === owner) { const e = handOf(s, owner, i); info = eraTag(e.age) + handLine(e) + fxLine(e.name); }
    else if (view !== null) {
      const r = handRange(s, owner, i);
      info = eraTag(civ.stones.length) + (r.best.rank === r.worst.rank ? handLine(r.best) : `가능 ${r.best.rank}~${r.worst.rank}위`);
    }
  }
  return `<article class="card ${banned ? 'banned' : ''}">
    <div class="card-head"><strong>문명 ${LETTERS[i]}</strong>${banTag(civ)}</div>
    <div class="stones">${civ.stones.map(st => stoneHTML(st, owner, view)).join('') || '<span class="empty">돌 없음</span>'}</div>
    ${bombLine(civ.stones, owner, view)}${path(owner, i, view)}
    <div class="info">${info}</div>
  </article>`;
}

function assignCard(i) {
  const v = viewer, me = s.players[v], civ = me.civs[i], rush = s.mods.rush, mine = pend.filter(m => m[0] === i);
  const queued = rush ? mine.map(m => stoneOf(m[1])) : [];
  const picks = TOKEN_KEYS.map(k => {
    const [kind, color] = TOKENS[k], left = me.stock[k] - pend.filter(m => m[1] === k && (rush || m[0] !== i)).length;
    const full = rush && (pend.length >= 3 || civ.stones.length + mine.length >= LAST_TURN);
    const stones = [...civ.stones, ...queued, stoneOf(k)], e = stones.length <= LAST_TURN ? evaluate(stones.length, seqOfStones(s.mods, stones), me.cards) : null;
    return `<button class="pick" data-act="assign" data-i="${i}" data-kind="${k}" aria-pressed="${!rush && mine[0]?.[1] === k}" ${left > 0 && !full ? '' : 'disabled'}>
      <span class="stone ${color === 'B' ? 'b' : 'w'}${kind === 'G' ? ' from-gray' : ''}"></span>
      <span class="labels"><small>${kind === 'G' ? '회색' : { B:'흑', W:'백' }[color]}</small><span class="name">${e ? eraTag(stones.length) + handLine(e) : "가득 참"}</span></span>
    </button>`;
  }).join('');
  const pending = mine.map(m => `<span class="stone pending ${TOKENS[m[1]][1] === 'B' ? 'b' : 'w'}${TOKENS[m[1]][0] === 'G' ? ' from-gray' : ''}"></span>`).join('');
  return `<article class="card">
    <div class="card-head"><strong>문명 ${LETTERS[i]}</strong>${banTag(civ)}</div>
    <div class="stones">${civ.stones.map(st => stoneHTML(st, v, v)).join('')}${pending || (civ.stones.length ? '' : '<span class="empty">돌 없음</span>')}</div>
    ${path(v, i, v)}
    <div class="picks">${picks}</div>
  </article>`;
}

function fightCard(i) {
  const v = viewer, civ = s.players[v].civs[i], e = handOf(s, v, i), legal = fightable(s, v).includes(i);
  const label = !civ.stones.length ? '돌 없음' : !legal ? '출전 제한' : pick === i ? '출전 선택됨' : '이 문명 출전';
  return `<article class="card ${pick === i ? 'selected' : legal ? '' : 'banned'}">
    <div class="card-head"><strong>문명 ${LETTERS[i]}</strong>${banTag(civ)}</div>
    <div class="stones">${civ.stones.map(st => stoneHTML(st, v, v)).join('') || '<span class="empty">돌 없음</span>'}</div>
    ${bombLine(civ.stones, v, v)}${path(v, i, v)}
    ${e ? `<div class="hand-mini">${artImg(HAND_ART[e.name], 'thumb')}<div>
      <p class="hand">${eraTag(e.age)}${handLine(e)}</p>
      <p class="muted">${e.why}</p>
      ${e.special ? `<p class="beats">${beatText(e.age, e.beats)}</p>` : fxLine(e.name)}
    </div></div>` : ''}
    <button class="fight" data-act="fight" data-i="${i}" aria-pressed="${pick === i}" ${legal ? '' : 'disabled'}>${label}</button>
  </article>`;
}

function cardsHTML(view) {
  const shown = s.shown[1 - view];
  const card = name => {
    const t = specialTurn(name), row = TABLES[t].find(r => r[2] === name);
    return `<article class="sp-card">${artImg(HAND_ART[name], 'thumb')}<div>
      <p class="hand-title"><b class="rank">돌 ${t}개</b> <strong>${name}</strong> <span class="star">★</span></p>
      <div class="hand-shape">${shapeDots(row[5])}</div>
      <p class="beats">${beatText(t, row[6] ?? 1)}</p>
    </div></article>`;
  };
  return `<h2 class="sub">내 불가사의 카드 · 상대는 모름</h2>
    <div class="sp-cards">${s.players[view].cards.map(card).join('')}</div>
    <p class="muted">${nameOf(1 - view)} 카드 ${s.mods.cards}장: ${shown.length ? `${shown.join(', ')} 공개` : '모두 비공개'}</p>`;
}

function tableHTML() {
  const t = tableTurn, me = secretOwner(), mine = me === null ? [] : s.players[me].cards;
  const row = (r, i) => `<li class="hand-row ${r[4] ? 'special' : ''}">
      ${artImg(HAND_ART[r[2]], 'thumb')}
      <div class="hand-body">
        <div class="hand-title">${rankTag(i + 1)} <strong>${r[2]}</strong>${r[4] ? ' <span class="star">★</span>' : ''}${mine.includes(r[2]) ? ' <span class="pill">내 카드</span>' : ''}</div>
        <div class="hand-shape">${r[4] ? shapeDots(r[5]) : dotsOf('B'.repeat(r[0]) + 'W'.repeat(r[1]))}</div>
        <p class="why">${r[3]}</p>
        ${r[4] ? `<p class="beats">${beatText(t, r[6] ?? 1)}</p>` : fxLine(r[2])}
      </div>
    </li>`;
  return `<div class="tabs">${Object.keys(TABLES).map(u => `<button class="tab" data-act="tableTab" data-t="${u}" aria-pressed="${Number(u) === t}" aria-label="돌 ${u}개 족보">${u}</button>`).join('')}</div>
    <div class="hand-head"><h2>${s.mods.rush ? `돌 ${t}개` : `${t}턴`} ${ERAS[t][0]}</h2><span class="points">${s.mods.rush ? '' : `승리 ${pointsFor(t)}점`}</span></div>
    <ol class="hand-list">${TABLES[t].map(row).join('')}</ol>`;
}

function historyHTML(open = false) {
  if (!s.history.length) return '';
  const hand = (b, p) => b.hands[p] ? handLine(b.hands[p]) : '없음';
  const lines = s.history.map(h => `<li>${h.turn}턴: ${h.battles.map(b => (s.over || !s.mods.fronts ? `${hand(b, 0)} 대 ${hand(b, 1)}` : '전선') + ` · <b>${b.winner === null ? '무승부' : `${nameOf(b.winner)} +${b.gain}`}</b>`).join(' / ')}</li>`).join('');
  return `<details ${open ? 'open' : ''}><summary>전투 기록 (${s.history.length}턴)</summary><ol class="history">${lines}</ol></details>`;
}

function hud(now) {
  const pips = Object.keys(TABLES).map(Number).map(t => {
    const h = s.history.find(x => x.turn === t), tag = !h ? pointsFor(t) + '점' : h.winner === null ? '무' : mode === 'hotseat' ? `P${h.winner + 1}` : h.winner === viewer ? '승' : '패';
    return `<li class="pip ${t === now ? 'now' : ''} ${h && h.winner !== null && mode !== 'hotseat' ? (h.winner === viewer ? 'win' : 'lose') : ''}">${t}턴<b>${tag}</b></li>`;
  }).join('');
  const on = MODS.filter(m => s.mods[m.id]).map(m => m.name).concat(`카드 ${s.mods.cards}장`).join(' · ');
  return `<header class="hud"><div class="score">${nameOf(0)} <b>${s.players[0].score}</b>점 : <b>${s.players[1].score}</b>점 ${nameOf(1)}</div><ol class="pips">${pips}</ol></header>
    <p class="on-mods">실험실: ${on}${s.mods.carry && s.pot ? ` · 이월 ${s.pot}점` : ''}</p>`;
}

const eraBanner = t => `<section class="era">${artImg(ERA_ART[t])}<div class="era-text"><h1>${t}/${LAST_TURN}턴 · ${ERAS[t][0]}</h1><p>${s.mods.rush ? '문명마다 돌 개수가 곧 시대다.' : ERAS[t][1]} <span class="nowrap">승리 시 ${pointsFor(t)}점.</span></p></div></section>`;
const tableButton = '<button class="only-phone" data-act="openTable">족보표</button>';
const layout = (main, bar = '') => `<div class="layout"><main>${main}${bar}</main><aside class="rail">${tableHTML()}</aside></div>`;
const foeCards = v => `<h2 class="sub">${nameOf(1 - v)} 문명</h2>${stockHTML(1 - v, v)}<div class="cards">${[0,1,2].map(i => civCard(1 - v, i, v)).join('')}</div>`;

function reason(b) {
  if (b.winner === null) return '무승부';
  const w = b.hands[b.winner], l = b.hands[1 - b.winner];
  if (!l) return '상대 문명이 없어 승리';
  if (w.age !== l.age) return '더 앞선 시대가 이김';
  if (w.special && l.rank <= w.beats) return `★ ${w.name}${eul(w.name) === '을' ? '이' : '가'} 상위 족보를 잡음`;
  return `${w.rank}위가 ${l.rank}위를 이김`;
}

function battleHTML(b, idx, view) {
  const known = p => !s.mods.fronts || p === view || s.over;
  const side = p => {
    const e = b.hands[p], art = e && known(p) && !s.mods.fronts ? artImg(HAND_ART[e.name], 'hand-art') : '';
    return `<article class="card duel-card ${b.winner === p ? 'winner' : ''}">${art}
      <div class="card-head"><strong>${nameOf(p)}${b.fighters[p] === null ? '' : ` · 문명 ${LETTERS[b.fighters[p]]}`}</strong><span class="tag">${b.winner === p ? '승리' : b.winner === null ? '무승부' : '패배'}</span></div>
      <p class="hand-big">${!e ? '출전 없음' : known(p) ? eraTag(e.age) + handLine(e) : '비공개'}</p>
      ${e && known(p) ? `${e.special ? `<p class="beats">카드 공개 · ${beatText(e.age, e.beats)}</p>` : ''}<p>${dotsOf(b.seqs[p])}</p><p class="muted">${e.why}</p>` : ''}
    </article>`;
  };
  return `${s.mods.fronts ? `<h2 class="lane">전선 ${LETTERS[idx]}${b.winner === null ? '' : ` · ${nameOf(b.winner)} +${b.gain}점`}</h2>` : `<p class="reason">${reason(b)}</p>`}
    <div class="duel">${side(0)}${side(1)}</div>
    ${b.effects.length ? `<ul class="fx">${b.effects.map(e => `<li>${nameOf(e.p)} ${e.name}: ${e.text}</li>`).join('')}</ul>` : ''}`;
}

const screens = {
  start: () => `<section class="era hero">${artImg(ERA_ART[6])}<div class="era-text"><h1>실험실</h1><p>새 규칙을 켜고 끄며 시험하는 판입니다. 마음에 드는 실험만 본 게임으로 옮깁니다.</p></div></section>
    <div class="mods">${MODS.map(m => `<button class="mod" data-act="toggle" data-id="${m.id}" aria-pressed="${mods[m.id]}"><b>${m.name}</b><small>${m.desc}</small></button>`).join('')}</div>
    <div class="panel"><strong>불가사의 카드</strong> <span class="bar" style="display:inline-flex;margin:0 0 0 10px">${[2,3,4].map(n => `<button class="tab" data-act="cards" data-n="${n}" aria-pressed="${mods.cards === n}">${n}장</button>`).join('')}</span>
      <p class="bar"><button data-act="all" data-on="1">전부 켜기</button><button data-act="all" data-on="">전부 끄기</button></p></div>
    <div class="modes">
      <button class="primary" data-act="start" data-mode="bot">봇과 시험</button>
      <button class="primary" data-act="start" data-mode="hotseat">둘이서 시험</button>
      <a class="primary" href="index.html">본 게임으로</a>
    </div>
    <p class="muted">기본 규칙은 본 게임과 같습니다: 돌 21개, 문명 3개, 일곱 턴, 불가사의 카드, 출전 제한. 봇은 켠 규칙을 모두 쓰지만 약합니다.</p>`,

  pass: () => `<div class="panel"><h1>${nameOf(viewer)} 차례</h1><p>${s.turn}/${LAST_TURN}턴 ${s.stage === 'assign' ? '돌 배치' : '문명 출전'}. 기기를 넘겨주세요. 상대는 화면을 보지 마세요.</p><p class="bar"><button class="primary" data-act="ready">준비 완료</button></p></div>`,

  assign: () => {
    const v = viewer, t = s.turn, ok = pend.length === 3;
    return `${hud(t)}${eraBanner(t)}${layout(`<h2 class="act">돌 나눠 주기</h2>
      <p class="muted">${s.mods.rush ? `돌 3개를 아무 문명에나 줍니다. ${pend.length}/3개.` : '문명마다 돌 하나씩, 색은 자유입니다.'}</p>
      ${stockHTML(v, v, pend)}
      <div class="cards mine">${[0,1,2].map(assignCard).join('')}</div>
      ${cardsHTML(v)}${foeCards(v)}${historyHTML()}`,
      `<div class="actionbar">${tableButton}${s.mods.rush ? `<button data-act="undo" ${pend.length ? '' : 'disabled'}>하나 취소</button>` : ''}<button class="primary" data-act="confirmAssign" ${ok ? '' : 'disabled'}>돌 배치 확정</button></div>`)}`;
  },

  fight: () => {
    const v = viewer, t = s.turn, none = !fightable(s, v).length;
    return `${hud(t)}${eraBanner(t)}${layout(`${foeCards(v)}<h2 class="act">출전 고르기</h2>
      <div class="cards mine">${[0,1,2].map(fightCard).join('')}</div>${cardsHTML(v)}${historyHTML()}`,
      `<div class="actionbar">${tableButton}<button class="primary" data-act="confirmFight" ${pick === null && !none ? 'disabled' : ''}>${none ? '출전할 문명 없음, 넘어가기' : '출전 확정'}</button></div>`)}`;
  },

  result: () => {
    const h = s.history.at(-1), view = mode === 'hotseat' ? null : viewer;
    const headline = h.winner === null ? '무승부' : `${nameOf(h.winner)} 승리`;
    return `${hud(h.turn)}${layout(`<p class="muted turn-label">${h.turn}/${LAST_TURN}턴 · ${ERAS[h.turn][0]}</p><h1 class="result-line">${headline}</h1>
      ${h.battles.map((b, i) => battleHTML(b, i, view)).join('')}
      <h2 class="sub">${nameOf(0)} 문명</h2><div class="cards">${[0,1,2].map(i => civCard(0, i, view)).join('')}</div>
      <h2 class="sub">${nameOf(1)} 문명</h2><div class="cards">${[0,1,2].map(i => civCard(1, i, view)).join('')}</div>${historyHTML()}`,
      `<div class="actionbar">${tableButton}<button class="primary" data-act="next">${s.over ? '최종 결과 보기' : '다음 턴'}</button></div>`)}`;
  },

  end: () => {
    const [a, b] = s.players.map(p => p.score), w = winnerOf(s);
    return `<section class="era">${artImg(ERA_ART[7])}<div class="era-text"><h1>${w === null ? '무승부' : `${nameOf(w)} 승리`}</h1><p class="score">${nameOf(0)} ${a}점 : ${b}점 ${nameOf(1)}</p></div></section>
      <p class="bar"><button class="primary" data-act="start" data-mode="${mode}">같은 실험 다시</button><button data-act="home">실험 바꾸기</button></p>
      <p class="muted">불가사의 카드 · ${[0, 1].map(p => `${nameOf(p)}: ${s.players[p].cards.join(', ')}`).join(' · ')}</p>
      <h2 class="sub">${nameOf(0)} 문명</h2><div class="cards">${[0,1,2].map(i => civCard(0, i, 'all')).join('')}</div>
      <h2 class="sub">${nameOf(1)} 문명</h2><div class="cards">${[0,1,2].map(i => civCard(1, i, 'all')).join('')}</div>${historyHTML(true)}`;
  },
};

function enterStage() {
  pend = [];
  const legal = s.stage === 'fight' ? fightable(s, viewer) : [];
  pick = legal.length === 1 ? legal[0] : null;
  tableTurn = s.turn;
  phase = s.stage;
}
function beginTurn() {
  moves = [null, null];
  fighters = [null, null];
  viewer = 0;
  if (mode === 'bot') enterStage(); else phase = 'pass';
}
function afterPlace() {
  if (s.stage !== 'fight') { phase = 'result'; return; }
  fighters = [null, null];
  viewer = 0;
  if (mode === 'bot') { fighters[1] = labBotField(s, 1) ?? 'none'; enterStage(); } else phase = 'pass';
}

const actions = {
  toggle({ id }) { mods[id] = !mods[id]; },
  cards({ n }) { mods.cards = Number(n); },
  all({ on }) { MODS.forEach(m => { mods[m.id] = !!on; }); },
  start({ mode: m }) { mode = m; s = labNewGame(mods); beginTurn(); },
  home() { phase = 'start'; },
  ready() { enterStage(); },
  assign({ i, kind }) {
    const c = Number(i);
    pend = s.mods.rush ? [...pend, [c, kind]] : [...pend.filter(m => m[0] !== c), [c, kind]];
  },
  undo() { pend = pend.slice(0, -1); },
  confirmAssign() {
    moves[viewer] = pend;
    if (mode === 'bot') moves[1] = labBotMove(s, 1);
    else if (!moves[1 - viewer]) { viewer = 1 - viewer; phase = 'pass'; return; }
    s = labPlace(s, moves);
    afterPlace();
  },
  fight({ i }) { pick = Number(i); },
  confirmFight() {
    fighters[viewer] = pick ?? 'none';
    if (fighters[1 - viewer] === null) { viewer = 1 - viewer; phase = 'pass'; return; }
    s = labFight(s, fighters.map(f => f === 'none' ? null : f));
    viewer = mode === 'bot' ? 0 : viewer;
    phase = 'result';
  },
  next() { if (s.over) phase = 'end'; else beginTurn(); },
  tableTab({ t }) { tableTurn = Number(t); },
  openTable() { sheet.showModal(); },
  closeTable() { sheet.close(); },
};

function render() {
  app.innerHTML = screens[phase]();
  if (['assign', 'fight', 'result'].includes(phase)) sheet.innerHTML = `<div class="sheet-head"><strong>족보표</strong><button data-act="closeTable">닫기</button></div><div class="sheet-body">${tableHTML()}</div>`;
}

document.addEventListener('click', e => {
  if (e.target === sheet) { sheet.close(); return; }
  const button = e.target.closest('[data-act]');
  if (!button || button.disabled) return;
  const before = phase;
  actions[button.dataset.act](button.dataset);
  render();
  if (phase !== before) window.scrollTo(0, 0);
});

render();

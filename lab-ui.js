// 실험실 화면: 버릴 시험판. 규칙은 lab-rules.js, 족보표는 game.js에 있다.
const app = document.getElementById('app');
const sheet = document.getElementById('table-sheet');
const LETTERS = 'ABC';
const mods = { exp:'none', bag:false, bomb:false, cards:2 };
let acts = [null, null], keepIdx = null;
let s, mode, phase = 'start', viewer = 0, moves, fighters, pend = [], pick = null, tableTurn = 1, opened = false;

const nameOf = p => mode === 'bot' ? ['나','봇'][p] : `플레이어 ${p + 1}`;
const eul = word => (word.charCodeAt(word.length - 1) - 0xAC00) % 28 ? '을' : '를';
const rankTag = rank => `<b class="rank ${rank === 1 ? 'top' : rank <= 3 ? 'high' : ''}">${rank}위</b>`;
const handLine = e => `${s.mods.tree ? `<b class="rank">힘 ${e.power}</b>` : rankTag(e.rank)} <span class="hand-name">${e.name}</span>${e.special ? ' <span class="star">★</span>' : ''}`;
const beatText = (t, count) => { const names = TABLES[t].slice(0, count).map(row => row[2]); return `${names.join(', ')}${eul(names.at(-1))} 이긴다`; };
const artImg = (art, cls = '') => !art ? '' : `<img class="${cls}" src="${art.file}" alt="${art.title}" loading="lazy" style="object-position:${art.pos ?? 'center'}">`;
const dot = (c, gray = false) => `<span class="dot ${c === 'B' ? 'b' : c === 'W' ? 'w' : 'g'}${gray ? ' gray' : ''}"></span>`;
const dotsOf = q => `<span class="dots">${[...q].map(c => dot(c)).join('')}</span>`;
const shapeDots = shape => { const [pattern, note] = shape.split('|'); return `<span class="dots">${pattern.replace(/\[([BW]+)\]|([BW])/g, (_, g, one) => g ? `<span class="any">${[...g].map(c => dot(c)).join('')}</span>` : dot(one))}</span>${note ? `<small class="shape-note">${note}</small>` : ''}`; };
const isHidden = (st, owner, view) => st.kind === 'G' && !st.revealed && view !== 'all' && view !== owner && st.seenBy !== view;
const stoneHTML = (st, owner, view) => isHidden(st, owner, view) ? '<span class="stone hidden" role="img" aria-label="공개되지 않은 회색돌">?</span>'
  : `<span class="stone ${st.color === 'B' ? 'b' : 'w'}${st.kind === 'G' ? ' from-gray' : ''}"></span>`;
const fxLine = (name, fx) => !isFinal(s) && abilityText(name, fx) ? `<p class="note">능력: ${abilityText(name, fx)}</p>` : '';
const eraTag = n => s.mods.tree ? '' : `<small class="muted">${ERAS[n][0]}</small> `;
const secretOwner = () => mode === 'bot' || ['prep', 'assign', 'tactic', 'fight'].includes(phase) ? viewer : null;

function banTag(civ) {
  if (s.mods.fronts || s.over || isFinal(s)) return '';
  const left = civ.bannedThrough - s.turn + 1;
  return left > 0 ? `<span class="tag off">출전 제한 ${left}턴</span>` : '<span class="tag">출전 가능</span>';
}

function stockHTML(p, view, picking = []) {
  const st = { ...s.players[p].stock };
  picking.forEach(([, k]) => { st[k]--; });
  const item = (html, n) => `<span class="stock-item">${html}<b>${n}</b></span>`;
  const row = c => item(dot('B'), c.B) + item(dot('W'), c.W) + (view === p ? item(dot('B', true), c.GB) + item(dot('W', true), c.GW) : item(dot('G'), c.GB + c.GW));
  const bag = s.players[p].bag, left = bag && Object.fromEntries(TOKEN_KEYS.map(k => [k, bag.filter(x => x === k).length]));
  return `<p class="stock"><span>${bag ? '뽑은 돌' : '남은 돌'}</span>${row(st)}${bag ? `<span>주머니</span>${row(left)}` : ''}</p>`;
}

const bombLine = (stones, owner, view) => s.mods.bomb && stones.some(st => st.kind === 'G') && !stones.some(st => isHidden(st, owner, view)) && seqOfStones(s.mods, stones) !== stones.map(st => st.color).join('')
  ? `<p class="note">폭발 후 ${dotsOf(seqOfStones(s.mods, stones))}</p>` : '';

function path(owner, i, view) {
  const stones = s.players[owner].civs[i].stones;
  if (!stones.length || (view !== owner && view !== 'all')) return '';
  const steps = stones.map((_, k) => { const e = judge(s.mods, seqOfStones(s.mods, stones.slice(0, k + 1)), s.players[owner].cards); return `<span>${e.name}${e.special ? '★' : ''}</span>`; });
  return `<p class="path">${steps.join(' › ')}</p>`;
}

function civCard(owner, i, view) {
  const civ = s.players[owner].civs[i], banned = !s.mods.fronts && civ.bannedThrough >= s.turn && !s.over && !isFinal(s);
  let info = '';
  if (civ.stones.length && !s.over) {
    if (view === owner) { const e = handOf(s, owner, i); info = eraTag(civ.stones.length) + handLine(e) + fxLine(e.name, e.fx); }
    else if (view !== null) {
      const r = handRange(s, owner, i, view), same = r.best.name === r.worst.name;
      info = eraTag(civ.stones.length) + (same ? handLine(r.best) : s.mods.tree ? `가능 힘 ${r.worst.power}~${r.best.power}` : `가능 ${r.best.rank}~${r.worst.rank}위`);
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
  const v = viewer, me = s.players[v], civ = me.civs[i], mine = pend.filter(m => m[0] === i);
  const queued = mine.map(m => stoneOf(m[1]));
  const picks = TOKEN_KEYS.map(k => {
    const [kind, color] = TOKENS[k], left = me.stock[k] - pend.filter(m => m[1] === k).length;
    const full = pend.length >= 3 || civ.stones.length + mine.length >= LAST_TURN;
    const stones = [...civ.stones, ...queued, stoneOf(k)], e = stones.length <= LAST_TURN ? judge(s.mods, seqOfStones(s.mods, stones), me.cards) : null;
    const barred = s.fx.blocked[v]?.civ === i && s.fx.blocked[v].token === k;
    return `<button class="pick" data-act="assign" data-i="${i}" data-kind="${k}" ${left > 0 && !full && !barred ? '' : 'disabled'}>
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
      <p class="hand">${eraTag(civ.stones.length)}${handLine(e)}</p>
      <p class="muted">${e.why}</p>
      ${e.special ? `<p class="beats">${beatText(e.age, e.beats)}</p>` : fxLine(e.name, e.fx)}
    </div></div>` : ''}
    <button class="fight" data-act="fight" data-i="${i}" aria-pressed="${pick === i}" ${legal ? '' : 'disabled'}>${label}</button>
  </article>`;
}

// 증강 카드 한 장.
const augCard = name => { const c = CARDS[name]; return `<article class="sp-card"><div><p class="hand-title"><b class="rank">${c.stage === 'prep' ? '준비' : '전술'}</b> <strong>${name}</strong>${c.n === 1 ? ' <span class="star">희귀</span>' : ''}</p><p class="why">${c.text}</p></div></article>`; };

// 내 손패와 상대 손패 수, 이번 턴에 공개된 카드.
function augLine(v) {
  if (!s.mods.augment) return '';
  const log = s.fx.log.map(e => `<li>${nameOf(e.p)}: ${e.text}</li>`).join('');
  return `<p class="muted">내 손패: ${s.players[v].hand.join(', ') || '없음'} · ${nameOf(1 - v)} 손패 ${s.players[1 - v].hand.length}장</p>${log ? `<ul class="fx">${log}</ul>` : ''}`;
}

// 카드 쓰기 선택창. 값은 legalUses 순번이다.
function useLabel(u) {
  let tail = u.token ? ` · 속 ${u.token === 'GB' ? '흑을 백' : '백을 흑'}으로` : '';
  if (u.card === '개종' || u.card === '역사 수정') {
    const st = s.players[viewer].civs[u.civ].stones.map(x => ({ ...x }));
    if (u.card === '개종') st[u.i].color = flipColor(st[u.i].color); else [st[u.i], st[u.j]] = [st[u.j], st[u.i]];
    tail = ` → ${judge(s.mods, seqOfStones(s.mods, st), s.players[viewer].cards).name}`;
  }
  return [u.card, useWhere(u)].filter(Boolean).join(' · ') + tail;
}
function useSelect(stage, hand) {
  const all = legalUses(s, viewer, stage, hand);
  if (!all.length) return `<p class="muted">${s.fx.used[viewer] ? '이번 턴 카드를 이미 썼습니다.' : '지금 쓸 수 있는 카드가 없습니다.'}</p>`;
  return `<h2 class="sub">카드 쓰기</h2><select id="use" aria-label="쓸 카드"><option value="">쓰지 않음</option>${all.map((u, i) => `<option value="${i}">${useLabel(u)}</option>`).join('')}</select>`;
}
const handNow = v => phase === 'prep' && keepIdx !== null ? [...s.players[v].hand, s.players[v].offer[keepIdx]] : s.players[v].hand;

const noCards = () => s.mods.shape || s.mods.tree;
function cardsHTML(view) {
  if (noCards()) return '';
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

// 테크 트리 지도: 줄은 돌 개수, 열은 갈래. 갈래 머리에 흑·백을 놓으면 갈 갈래를 적는다. marks[갈래+돌 개수] = 그 칸에 있는 내 문명 글자.
const FX_SHORT = { peek:'엿보기', break:'뒤집기', capture:'점령', score:'승점 +', lock:'출전 금지', rest:'안 쉼' };
const fxShort = fx => !fx ? '' : fx[0] === 'score' ? `승점 +${fx[1]}` : fx[1] ? `${FX_SHORT[fx[0]]} ${fx[1]}` : FX_SHORT[fx[0]];
function treeMarks(v, withPend) {
  const marks = {};
  if (v === null) return marks;
  s.players[v].civs.forEach((civ, i) => {
    const stones = [...civ.stones, ...(withPend ? pend.filter(m => m[0] === i).map(m => stoneOf(m[1])) : [])];
    if (stones.length) (marks[treeHand(seqOfStones(s.mods, stones)).lane + stones.length] ??= []).push(LETTERS[i]);
  });
  return marks;
}
function treeMap(marks) {
  const lanes = Object.keys(TREE);
  const head = lanes.map(l => `<th scope="col">${TREE[l].name}<small>${dot('B')}${TREE[TREE[l].B].name}</small><small>${dot('W')}${TREE[TREE[l].W].name}</small></th>`).join('');
  const rows = Object.keys(TABLES).map(d => `<tr><th scope="row">${d}</th>${lanes.map(l => {
    const n = TREE[l].at[d], m = marks[l + d];
    return !n ? '<td></td>' : `<td class="${m ? 'here' : ''}"${n[3] ? ` title="${n[3]}"` : ''}>${m ? `<em>${m.join(' ')}</em>` : ''}<b>${n[0]}</b><span>힘 ${n[1]}</span>${n[2] ? `<small>${fxShort(n[2])}</small>` : ''}</td>`;
  }).join('')}</tr>`).join('');
  return `<div class="tree-wrap"><table class="tree"><thead><tr><th scope="col">돌</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
    <p class="legend">첫 돌이 흑이면 군대, 백이면 학문에서 시작합니다. 그다음은 지금 갈래 머리에 적힌 대로 흑이나 백을 놓은 갈래의 한 칸 아래로 갑니다. 금색 칸의 글자가 내 문명 위치입니다. 힘이 센 쪽이 이기고, 같으면 무승부입니다.</p>`;
}

function tableHTML() {
  if (s.mods.shape) return `<div class="hand-head"><h2>모양 족보</h2></div>
    <ol class="hand-list">${SHAPES.map(([name, why, ex], i) => `<li class="hand-row"><div class="hand-body">
      <div class="hand-title">${rankTag(i + 1)} <strong>${name}</strong></div><div class="hand-shape">${dotsOf(ex)}</div><p class="why">${why}</p>
    </div></li>`).join('')}</ol>
    <p class="legend">돌을 받은 순서까지 봅니다. 위가 강하고 같은 족보끼리는 무승부. 일곱 턴 내내 같은 표입니다.</p>`;
  const t = tableTurn, me = secretOwner(), mine = me === null ? [] : s.players[me].cards;
  if (s.mods.tree) return `<div class="hand-head"><h2>테크 트리</h2></div>${treeMap(treeMarks(me, phase === 'assign'))}`;
  const tabs = `<div class="tabs">${Object.keys(TABLES).map(u => `<button class="tab" data-act="tableTab" data-t="${u}" aria-pressed="${Number(u) === t}" aria-label="돌 ${u}개 족보">${u}</button>`).join('')}</div>`;
  const row = (r, i) => `<li class="hand-row ${r[4] ? 'special' : ''}">
      ${artImg(HAND_ART[r[2]], 'thumb')}
      <div class="hand-body">
        <div class="hand-title">${rankTag(i + 1)} <strong>${r[2]}</strong>${r[4] ? ' <span class="star">★</span>' : ''}${mine.includes(r[2]) ? ' <span class="pill">내 카드</span>' : ''}</div>
        <div class="hand-shape">${r[4] ? shapeDots(r[5]) : dotsOf('B'.repeat(r[0]) + 'W'.repeat(r[1]))}</div>
        <p class="why">${r[3]}</p>
        ${r[4] ? `<p class="beats">${beatText(t, r[6] ?? 1)}</p>` : fxLine(r[2], ABILITY[r[2]])}
      </div>
    </li>`;
  return `${tabs}
    <div class="hand-head"><h2>돌 ${t}개 ${ERAS[t][0]}</h2></div>
    <ol class="hand-list">${TABLES[t].map(row).join('')}</ol>`;
}

function historyHTML(open = false) {
  if (!s.history.length) return '';
  const hand = (b, p) => b.hands[p] ? handLine(b.hands[p]) : '없음';
  const lines = s.history.map(h => `<li>${h.turn}턴: ${h.truce ? '휴전' : ''}${h.battles.map(b => (s.over || !s.mods.fronts ? `${hand(b, 0)} 대 ${hand(b, 1)}` : '전선') + ` · <b>${b.winner === null ? '무승부' : `${nameOf(b.winner)} ${b.final ? '승' : `+${b.gain}`}`}</b>`).join(' / ')}</li>`).join('');
  return `<details ${open ? 'open' : ''}><summary>전투 기록 (${s.history.length}턴)</summary><ol class="history">${lines}</ol></details>`;
}

function hud(now) {
  const pips = Object.keys(TABLES).map(Number).map(t => {
    const h = s.history.find(x => x.turn === t), tag = !h ? pointsFor(t) + '점' : h.winner === null ? '무' : mode === 'hotseat' ? `P${h.winner + 1}` : h.winner === viewer ? '승' : '패';
    return `<li class="pip ${t === now ? 'now' : ''} ${h && h.winner !== null && mode !== 'hotseat' ? (h.winner === viewer ? 'win' : 'lose') : ''}">${t}턴<b>${tag}</b></li>`;
  }).join('');
  const on = [...EXPERIMENTS, ...ADDONS].filter(m => s.mods[m.id]).map(m => m.name);
  const tags = [on.length ? on.join(' · ') : '본 게임 규칙', ...(noCards() ? [] : [`불가사의 ${s.mods.cards}장`])].join(' · ');
  return `<header class="hud"><div class="score">${nameOf(0)} <b>${s.players[0].score}</b>점 : <b>${s.players[1].score}</b>점 ${nameOf(1)}</div><ol class="pips">${pips}</ol></header>
    <p class="on-mods">실험실: ${tags}${s.pot ? ` · 이월 ${s.pot}점` : ''}</p>`;
}

const eraBanner = t => `<section class="era">${artImg(ERA_ART[t])}<div class="era-text"><h1>${t}/${LAST_TURN}턴${s.mods.tree ? '' : ` · ${ERAS[t][0]}`}</h1><p>${s.mods.tree ? '돌 하나가 테크 트리의 갈래 하나를 고른다.' : '문명마다 돌 개수가 곧 시대다.'} <span class="nowrap">승리 시 ${pointsFor(t) + s.pot}점${s.pot ? ` (이월 ${s.pot}점 포함)` : ''}.</span>${isFinal(s) ? ' 세 전선 결전.' : ''}</p></div></section>`;
const tableButton = '<button class="only-phone" data-act="openTable">족보표</button>';
const layout = (main, bar = '') => `<div class="layout"><main>${main}${bar}</main><aside class="rail">${tableHTML()}</aside></div>`;
const foeCards = v => `${augLine(v)}<h2 class="sub">${nameOf(1 - v)} 문명</h2>${stockHTML(1 - v, v)}<div class="cards">${[0,1,2].map(i => civCard(1 - v, i, v)).join('')}</div>`;
const myCards = v => `<h2 class="sub">내 문명</h2><div class="cards">${[0,1,2].map(i => civCard(v, i, v)).join('')}</div>`;

function reason(b) {
  if (b.winner === null) return '무승부';
  if (b.reversed) return '시대 역행으로 순위가 거꾸로 적용됨';
  const w = b.hands[b.winner], l = b.hands[1 - b.winner];
  if (!l) return '상대 문명이 없어 승리';
  if (s.mods.tree) return `힘 ${w.power} 대 ${l.power}로 이김`;
  if (w.age !== l.age) return '더 앞선 시대가 이김';
  if (w.special && l.rank <= w.beats) return `★ ${w.name}${eul(w.name) === '을' ? '이' : '가'} 상위 족보를 잡음`;
  return `${w.rank}위가 ${l.rank}위를 이김`;
}

function battleHTML(b, idx, view) {
  const known = p => !s.mods.fronts || p === view || s.over;
  const side = p => {
    const e = b.hands[p], art = e && known(p) && !s.mods.fronts && !b.final ? artImg(HAND_ART[e.name], 'hand-art') : '';
    return `<article class="card duel-card ${b.winner === p ? 'winner' : ''}">${art}
      <div class="card-head"><strong>${nameOf(p)}${b.fighters[p] === null ? '' : ` · 문명 ${LETTERS[b.fighters[p]]}`}</strong><span class="tag">${b.winner === p ? '승리' : b.winner === null ? '무승부' : '패배'}</span></div>
      <p class="hand-big">${!e ? '출전 없음' : known(p) ? eraTag(e.age) + handLine(e) : '비공개'}</p>
      ${e && known(p) ? `${e.special ? `<p class="beats">카드 공개 · ${beatText(e.age, e.beats)}</p>` : ''}<p>${dotsOf(b.seqs[p])}</p><p class="muted">${e.why}</p>` : ''}
    </article>`;
  };
  return `${s.mods.fronts || b.final ? `<h2 class="lane">전선 ${b.final ? idx + 1 : LETTERS[idx]}${b.winner === null || b.final ? '' : ` · ${nameOf(b.winner)} +${b.gain}점`}</h2>` : `<p class="reason">${reason(b)}</p>`}
    <div class="duel">${side(0)}${side(1)}</div>
    ${b.effects.length ? `<ul class="fx">${b.effects.map(e => `<li>${nameOf(e.p)} ${e.name}: ${e.text}</li>`).join('')}</ul>` : ''}`;
}

const JP_NAME = { B:'흑', W:'백' };
function drawCard(p) {
  const [B, W, G] = s.players[p].drawn, jp = s.players[p].jackpot;
  const bag = [...'B'.repeat(B), ...'W'.repeat(W), ...'G'.repeat(G)].sort(() => Math.random() - 0.5);
  return `<article class="card ${jp ? 'selected' : ''}">
    <div class="card-head"><strong>${nameOf(p)}</strong>${jp ? `<span class="tag jackpot">대박! ${JP_NAME[jp]} ${JACKPOT.size}개</span>` : ''}</div>
    <div class="draw-row">${bag.map((c, i) => `<span class="dot ${c.toLowerCase()}" style="animation-delay:${i * 45}ms"></span>`).join('')}</div>
    <p class="stock"><span class="stock-item">${dot('B')}<b>${B}</b></span><span class="stock-item">${dot('W')}<b>${W}</b></span><span class="stock-item">${dot('G')}<b>${G}</b></span></p>
  </article>`;
}
const permsHTML = () => `<div class="perms">${PERMS.map((o, i) => `<button class="fight" data-act="fight" data-i="${i}" aria-pressed="${pick === i}">${o.map(c => LETTERS[c]).join(' · ')}</button>`).join('')}</div>`;

const screens = {
  draw: () => `<div class="panel"><h1>돌 뽑기</h1><p>이번 판에 쓸 돌 21개를 뽑습니다. 개수는 서로 공개되고, 회색돌의 속 색은 자기만 압니다.</p>
    ${opened ? `<div class="cards">${[0, 1].map(drawCard).join('')}</div><p class="bar"><button class="primary" data-act="drawDone">게임 시작</button></p>`
      : '<p class="bar"><button class="primary" data-act="drawGo">돌 21개 뽑기</button></p>'}</div>`,

  start: () => `<section class="era hero">${artImg(ERA_ART[6])}<div class="era-text"><h1>실험실</h1><p>새 규칙을 켜고 끄며 시험하는 판입니다. 마음에 드는 실험만 본 게임으로 옮깁니다.</p></div></section>
    <h2 class="sub">실험 하나 고르기</h2>
    <div class="mods">${[{ id:'none', name:'실험 없음', desc:'본 게임 규칙 그대로 둔다.' }, ...EXPERIMENTS].map(m => `<button class="mod" data-act="exp" data-id="${m.id}" aria-pressed="${mods.exp === m.id}"><b>${m.name}</b><small>${m.desc}</small></button>`).join('')}</div>
    <h2 class="sub">같이 켤 수 있는 규칙</h2>
    <div class="mods">${ADDONS.map(m => `<button class="mod" data-act="toggle" data-id="${m.id}" aria-pressed="${mods[m.id]}"><b>${m.name}</b><small>${m.desc}</small></button>`).join('')}</div>
    <div class="panel"><strong>불가사의 카드</strong> <span class="bar" style="display:inline-flex;margin:0 0 0 10px">${[2,3,4].map(n => `<button class="tab" data-act="cards" data-n="${n}" aria-pressed="${mods.cards === n}">${n}장</button>`).join('')}</span></div>
    <div class="modes">
      <button class="primary" data-act="start" data-mode="bot">봇과 시험</button>
      <button class="primary" data-act="start" data-mode="hotseat">둘이서 시험</button>
      <a class="primary" href="index.html">본 게임으로</a>
    </div>
    <p class="muted">본 게임 규칙은 늘 켜져 있습니다: 돌 뽑기, 테크 러시, 테크 능력, 무승부 이월, 불가사의 카드, 출전 제한. 봇은 켠 규칙을 모두 쓰지만 약합니다.</p>`,

  prep: () => {
    const v = viewer, t = s.turn, me = s.players[v];
    const offers = me.offer.map((name, i) => `<button class="pick offer" data-act="keep" data-i="${i}" aria-pressed="${keepIdx === i}"><span class="labels"><small>${CARDS[name].stage === 'prep' ? '준비' : '전술'}${CARDS[name].n === 1 ? ' · 희귀' : ''}</small><span class="name">${name}</span><small>${CARDS[name].text}</small></span></button>`).join('');
    return `${hud(t)}${eraBanner(t)}${layout(`<h2 class="act">증강 카드 고르기</h2>
      <p class="muted">2장 중 1장을 손패로 가져옵니다. 손패는 3장까지, 넘치면 가장 오래된 카드를 버립니다.</p>
      <div class="picks two">${offers}</div>
      ${keepIdx === null ? '' : useSelect('prep', handNow(v))}
      ${me.hand.length ? `<h2 class="sub">손패</h2><div class="sp-cards">${me.hand.map(augCard).join('')}</div>` : ''}
      ${myCards(v)}${foeCards(v)}${historyHTML()}`,
      `<div class="actionbar">${tableButton}<button class="primary" data-act="confirmCard" ${keepIdx === null ? 'disabled' : ''}>확정</button></div>`)}`;
  },

  tactic: () => {
    const v = viewer, t = s.turn, hand = s.players[v].hand;
    return `${hud(t)}${eraBanner(t)}${layout(`<h2 class="act">전술 카드</h2>
      <p class="muted">양쪽 배치가 공개됐습니다. 이번 턴 카드를 쓰지 않았다면 전술 카드를 쓸 수 있습니다.</p>
      ${useSelect('tactic', hand)}
      ${hand.length ? `<h2 class="sub">손패</h2><div class="sp-cards">${hand.map(augCard).join('')}</div>` : ''}
      ${myCards(v)}${foeCards(v)}${historyHTML()}`,
      `<div class="actionbar">${tableButton}<button class="primary" data-act="confirmCard">확정</button></div>`)}`;
  },

  pass: () => `<div class="panel"><h1>${nameOf(viewer)} 차례</h1><p>${s.turn}/${LAST_TURN}턴 ${{ prep:'증강 카드', assign:'돌 배치', tactic:'전술 카드', fight:'문명 출전' }[s.stage]}. 기기를 넘겨주세요. 상대는 화면을 보지 마세요.</p><p class="bar"><button class="primary" data-act="ready">준비 완료</button></p></div>`,

  assign: () => {
    const v = viewer, t = s.turn, ok = pend.length === 3;
    return `${hud(t)}${eraBanner(t)}${layout(`<h2 class="act">돌 나눠 주기</h2>
      <p class="muted">${s.mods.bag ? '주머니에서 꺼낸' : ''} 돌 3개를 아무 문명에나 줍니다. ${pend.length}/3개.</p>
      ${stockHTML(v, v, pend)}
      ${s.mods.tree ? `<div class="only-phone">${treeMap(treeMarks(v, true))}</div>` : ''}
      <div class="cards mine">${[0,1,2].map(assignCard).join('')}</div>
      ${cardsHTML(v)}${foeCards(v)}${historyHTML()}`,
      `<div class="actionbar">${tableButton}<button data-act="undo" ${pend.length ? '' : 'disabled'}>하나 취소</button><button class="primary" data-act="confirmAssign" ${ok ? '' : 'disabled'}>돌 배치 확정</button></div>`)}`;
  },

  fight: () => {
    const v = viewer, t = s.turn, none = !fightable(s, v).length, final = isFinal(s);
    return `${hud(t)}${eraBanner(t)}${layout(`${foeCards(v)}<h2 class="act">${final ? '최종 결전: 전선 배치' : '출전 고르기'}</h2>
      ${final ? '<p class="muted">내 문명을 어느 전선에 보낼지 비밀로 정합니다. 상대도 순서를 숨기고 있습니다. 이긴 전선이 더 많으면 승리합니다. 버튼은 왼쪽부터 전선 1·2·3입니다.</p>' : ''}
      <div class="cards mine">${[0,1,2].map(i => final ? civCard(v, i, v) : fightCard(i)).join('')}</div>${final ? permsHTML() : ''}${cardsHTML(v)}${historyHTML()}`,
      `<div class="actionbar">${tableButton}<button class="primary" data-act="confirmFight" ${pick === null && !none ? 'disabled' : ''}>${none ? '출전할 문명 없음, 넘어가기' : final ? '전선 확정' : '출전 확정'}</button></div>`)}`;
  },

  result: () => {
    const h = s.history.at(-1), view = mode === 'hotseat' ? null : viewer;
    const headline = h.truce ? '휴전' : h.winner === null ? '무승부' : `${nameOf(h.winner)} 승리`;
    return `${hud(h.turn)}${layout(`<p class="muted turn-label">${h.turn}/${LAST_TURN}턴</p><h1 class="result-line">${headline}</h1>
      ${h.battles[0]?.final && h.winner !== null ? `<p class="reason">결전 승리 +${h.gain}점</p>` : ''}
      ${h.log.length ? `<ul class="fx">${h.log.map(e => `<li>${nameOf(e.p)}: ${e.text}</li>`).join('')}</ul>` : ''}
      ${h.battles.map((b, i) => battleHTML(b, i, view)).join('')}
      <h2 class="sub">${nameOf(0)} 문명</h2><div class="cards">${[0,1,2].map(i => civCard(0, i, view)).join('')}</div>
      <h2 class="sub">${nameOf(1)} 문명</h2><div class="cards">${[0,1,2].map(i => civCard(1, i, view)).join('')}</div>${historyHTML()}`,
      `<div class="actionbar">${tableButton}<button class="primary" data-act="next">${s.over ? '최종 결과 보기' : '다음 턴'}</button></div>`)}`;
  },

  end: () => {
    const [a, b] = s.players.map(p => p.score), w = winnerOf(s);
    return `<section class="era">${artImg(ERA_ART[7])}<div class="era-text"><h1>${w === null ? '무승부' : `${nameOf(w)} 승리`}</h1><p class="score">${nameOf(0)} ${a}점 : ${b}점 ${nameOf(1)}</p></div></section>
      <p class="bar"><button class="primary" data-act="start" data-mode="${mode}">같은 실험 다시</button><button data-act="home">실험 바꾸기</button></p>
      <p class="muted" ${noCards() ? 'hidden' : ''}>불가사의 카드 · ${[0, 1].map(p => `${nameOf(p)}: ${s.players[p].cards.join(', ')}`).join(' · ')}</p>
      <p class="muted">뽑은 돌 · ${[0, 1].map(p => `${nameOf(p)}: 흑 ${s.players[p].drawn[0]} 백 ${s.players[p].drawn[1]} 회색 ${s.players[p].drawn[2]}${s.players[p].jackpot ? ' (대박)' : ''}`).join(' · ')}</p>
      <h2 class="sub">${nameOf(0)} 문명</h2><div class="cards">${[0,1,2].map(i => civCard(0, i, 'all')).join('')}</div>
      <h2 class="sub">${nameOf(1)} 문명</h2><div class="cards">${[0,1,2].map(i => civCard(1, i, 'all')).join('')}</div>${historyHTML(true)}`;
  },
};

function enterStage() {
  pend = [];
  keepIdx = null;
  const legal = s.stage === 'fight' ? fightable(s, viewer) : [];
  pick = legal.length === 1 ? legal[0] : null;
  tableTurn = s.turn;
  phase = s.stage;
}
function beginTurn() {
  moves = [null, null];
  fighters = [null, null];
  acts = [null, null];
  viewer = 0;
  if (mode === 'bot') enterStage(); else phase = 'pass';
}
// 단계가 끝난 뒤. 턴이 넘어갔으면(세 전선, 휴전) 결과 화면, 아니면 다음 단계로.
function afterStep(turn) {
  if (s.turn !== turn) { phase = 'result'; return; }
  fighters = [null, null];
  moves = [null, null];
  acts = [null, null];
  viewer = 0;
  if (mode === 'bot') { if (s.stage === 'fight') fighters[1] = labBotField(s, 1) ?? 'none'; enterStage(); } else phase = 'pass';
}

const actions = {
  toggle({ id }) { mods[id] = !mods[id]; },
  cards({ n }) { mods.cards = Number(n); },
  exp({ id }) { mods.exp = id; },
  start({ mode: m }) { mode = m; s = labNewGame(mods); opened = false; phase = 'draw'; },
  drawGo() { opened = true; },
  drawDone() { beginTurn(); },
  home() { phase = 'start'; },
  ready() { enterStage(); },
  assign({ i, kind }) {
    const c = Number(i);
    pend = [...pend, [c, kind]];
  },
  undo() { pend = pend.slice(0, -1); },
  keep({ i }) { keepIdx = Number(i); },
  confirmCard() {
    const stage = phase, v = viewer, value = document.getElementById('use')?.value;
    const use = value ? legalUses(s, v, stage, handNow(v))[Number(value)] : null;
    acts[v] = stage === 'prep' ? { keep:s.players[v].offer[keepIdx], use } : { use };
    if (mode === 'bot') acts[1] = labBotCard(s, 1, stage);
    else if (!acts[1 - v]) { viewer = 1 - v; phase = 'pass'; return; }
    const turn = s.turn;
    s = (stage === 'prep' ? labPrep : labTactic)(s, acts);
    afterStep(turn);
  },
  confirmAssign() {
    moves[viewer] = pend;
    if (mode === 'bot') moves[1] = labBotMove(s, 1);
    else if (!moves[1 - viewer]) { viewer = 1 - viewer; phase = 'pass'; return; }
    const turn = s.turn;
    s = labPlace(s, moves);
    afterStep(turn);
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
  if (['prep', 'assign', 'tactic', 'fight', 'result'].includes(phase)) sheet.innerHTML = `<div class="sheet-head"><strong>족보표</strong><button data-act="closeTable">닫기</button></div><div class="sheet-body">${tableHTML()}</div>`;
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

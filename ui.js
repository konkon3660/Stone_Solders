// 화면. 규칙은 game.js, 온라인 연결은 net.js에 있다.
const app = document.getElementById('app');
const sheet = document.getElementById('table-sheet');
const LETTERS = 'ABC';
const COLOR_NAME = { B:'흑', W:'백' };
const TOKEN_NAME = { B:'흑돌', W:'백돌', GB:'회색돌(속은 흑)', GW:'회색돌(속은 백)' };
let s, mode, phase = 'start', viewer = 0, assigns, fighters, ui, net = null, notice = '', noticeOk = false, tableTurn = 1;

const nameOf = p => mode === 'bot' ? ['나','봇'][p] : mode === 'online' ? (p === viewer ? '나' : '상대') : `플레이어 ${p + 1}`;
const squadTitle = p => mode !== 'hotseat' && p === viewer ? '내 문명' : `${nameOf(p)} 문명`;
const comboText = (b, w) => b && w ? `흑 ${b} / 백 ${w}` : b ? `흑 ${b}` : `백 ${w}`;
const batchim = word => (word.charCodeAt(word.length - 1) - 0xAC00) % 28 !== 0;
const eul = word => batchim(word) ? '을' : '를';
const iga = word => batchim(word) ? '이' : '가';
const star = e => e.special ? ' <span class="star" aria-label="불가사의">★</span>' : '';
const rankTag = rank => `<b class="rank ${rank === 1 ? 'top' : rank <= 3 ? 'high' : ''}">${rank}위</b>`;
const handLine = e => `${rankTag(e.rank)} <span class="hand-name">${e.name}</span>${star(e)}`;
const beatText = (t, count) => { const names = TABLES[t].slice(0, count).map(row => row[2]); return `${names.join(', ')}${eul(names.at(-1))} 이긴다`; };
const artImg = (art, cls = '') => `<img class="${cls}" src="${art.file}" alt="${art.title}" loading="lazy" style="object-position:${art.pos ?? 'center'}">`;
const artCredit = art => `${art.title}, ${art.by}, ${art.year}`;
const isHidden = (st, owner, view) => st.kind === 'G' && !st.revealed && view !== 'all' && view !== owner;
// 지금 화면에 카드를 보여도 되는 플레이어. 둘이서 번갈아 할 때는 자기 차례 화면에서만.
const secretOwner = () => mode !== 'hotseat' || ['assign', 'fight'].includes(phase) ? viewer : null;
// 보는 사람이 아는 카드: 자기 카드는 전부, 상대 카드는 전투에서 드러난 것만.
const knownCards = (p, view) => view === p || view === 'all' ? s.players[p].cards : shownCards(s, p);
// 상대가 쥐었을 수 있는 카드: 둘 다 드러났으면 그 둘, 아니면 내 카드가 아닌 모든 카드.
const suspectCards = (p, view) => shownCards(s, p).length === HAND_CARDS ? shownCards(s, p) : SPECIALS.filter(n => !(s.players[view]?.cards ?? []).includes(n));

// 화면에는 글자 대신 작은 돌로 그린다. 글자는 화면 낭독용으로만 남긴다.
const dot = (c, gray = false) => `<span class="dot ${c === 'B' ? 'b' : c === 'W' ? 'w' : 'g'}${gray ? ' gray' : ''}"></span>`;
const dotsOf = (b, w) => `<span class="dots" role="img" aria-label="${comboText(b, w)}">${dot('B').repeat(b)}${dot('W').repeat(w)}</span>`;
function shapeDots(shape, b, w) {
  const [pattern, note] = shape.split('|');
  const stones = pattern.replace(/\[([BW]+)\]|([BW])/g, (_, group, one) => group ? `<span class="any" title="칸 안의 돌은 순서 무관">${[...group].map(c => dot(c)).join('')}</span>` : dot(one));
  return `<span class="dots" role="img" aria-label="${comboText(b, w)}, 순서 조건 있음">${stones}</span>${note ? `<small class="shape-note">${note}</small>` : ''}`;
}

function stoneHTML(st, owner, view) {
  if (isHidden(st, owner, view)) return '<span class="stone hidden" role="img" aria-label="공개되지 않은 회색돌">?</span>';
  const label = `${st.kind === 'G' ? '회색돌에서 나온 ' : ''}${COLOR_NAME[st.color]}돌`;
  return `<span class="stone ${st.color === 'B' ? 'b' : 'w'}${st.kind === 'G' ? ' from-gray' : ''}" role="img" aria-label="${label}"></span>`;
}

function banTag(civ) {
  const left = civ.bannedThrough - s.turn + 1;
  return left > 0 ? `<span class="tag off">출전 제한 ${left}턴</span>` : '<span class="tag">출전 가능</span>';
}

// 남은 돌. 고르는 중인 돌은 뺀다. 상대 회색돌은 속 색을 모르니 개수만 보인다.
function stockHTML(p, view, picking = []) {
  const st = { ...s.players[p].stock };
  picking.forEach(k => { if (k) st[k]--; });
  const item = (html, n, label) => `<span class="stock-item" role="img" aria-label="${label} ${n}개">${html}<b>${n}</b></span>`;
  const grays = view === p
    ? item(dot('B', true), st.GB, '속이 흑인 회색돌') + item(dot('W', true), st.GW, '속이 백인 회색돌')
    : item(dot('G'), st.G ?? st.GB + st.GW, '회색돌');
  return `<p class="stock"><span>남은 돌</span>${item(dot('B'), st.B, '흑돌')}${item(dot('W'), st.W, '백돌')}${grays}</p>`;
}

const inGame = () => ['assign', 'fight', 'waiting'].includes(phase) && !s.over;

// 이 문명이 지나온 테크: 턴마다 그때의 족보 이름. 숨은 돌이 있는 상대 문명은 그리지 않는다.
function techPath(owner, i, view) {
  const seq = colorsOf(s.players[owner].civs[i]), cards = s.players[owner].cards;
  if (!seq || (view !== owner && view !== 'all')) return '';
  const steps = [...seq].map((_, k) => { const e = evaluate(k + 1, seq.slice(0, k + 1), cards); return `<span>${e.name}${e.special ? '★' : ''}</span>`; });
  return `<p class="path" aria-label="지나온 테크">${steps.join(' › ')}</p>`;
}

// 참고용 카드. 아직 모르는 돌이 있으면 가능한 순위 범위를, 상대 문명이면 카드에 따라 가능한 불가사의도 보여 준다.
function civCard(owner, i, view) {
  const civ = s.players[owner].civs[i], banned = civ.bannedThrough >= s.turn && !s.over;
  let info = '';
  if (inGame()) {
    if (banned) info = '이번 턴 출전 불가';
    else {
      const known = view === owner ? colorsOf(civ) : publicSeq(civ), h = possibleHands(s.turn, known, knownCards(owner, view));
      info = h.best.rank === h.worst.rank ? handLine(h.best) : `가능 ${h.best.rank}~${h.worst.rank}위`;
      const sp = view === owner ? h.specials : possibleHands(s.turn, known, suspectCards(owner, view)).specials;
      if (sp.length && !(h.best.rank === h.worst.rank && h.best.special)) info += `<div class="note">${view === owner ? '' : '카드에 따라 '}★ ${sp.join(', ')}${view === owner ? ' 가능' : ''}</div>`;
    }
  }
  return `<article class="card ${banned ? 'banned' : ''}">
    <div class="card-head"><strong>문명 ${LETTERS[i]}</strong>${s.over ? '' : banTag(civ)}</div>
    <div class="stones">${civ.stones.map(st => stoneHTML(st, owner, view)).join('') || '<span class="empty">돌 없음</span>'}</div>
    ${techPath(owner, i, view)}
    <div class="info">${info}</div>
  </article>`;
}

function assignCard(i) {
  const v = viewer, me = s.players[v], civ = me.civs[i], seq = colorsOf(civ), chosen = ui.assign[i];
  const picks = TOKEN_KEYS.map(k => {
    const [kind, color] = TOKENS[k], e = evaluate(s.turn, seq + color, me.cards);
    const left = me.stock[k] - ui.assign.filter((x, j) => x === k && j !== i).length;
    return `<button class="pick" data-act="assign" data-i="${i}" data-kind="${k}" aria-pressed="${chosen === k}" ${left > 0 ? '' : 'disabled'} aria-label="문명 ${LETTERS[i]}에 ${TOKEN_NAME[k]} 주기, 남은 ${left}개: ${e.rank}위 ${e.name}${e.special ? ' 불가사의' : ''}">
      <span class="stone ${color === 'B' ? 'b' : 'w'}${kind === 'G' ? ' from-gray' : ''}"></span>
      <span class="labels"><small>${kind === 'G' ? '회색' : COLOR_NAME[color]}</small><span class="name">${handLine(e)}</span></span>
    </button>`;
  }).join('');
  const pending = chosen ? `<span class="stone pending ${TOKENS[chosen][1] === 'B' ? 'b' : 'w'}${TOKENS[chosen][0] === 'G' ? ' from-gray' : ''}" role="img" aria-label="이번 턴에 줄 돌"></span>` : '';
  return `<article class="card">
    <div class="card-head"><strong>문명 ${LETTERS[i]}</strong>${banTag(civ)}</div>
    <div class="stones">${civ.stones.map(st => stoneHTML(st, v, v)).join('')}${pending || (civ.stones.length ? '' : '<span class="empty">돌 없음</span>')}</div>
    ${techPath(v, i, v)}
    <div class="picks">${picks}</div>
  </article>`;
}

function fightCard(i) {
  const v = viewer, civ = s.players[v].civs[i], e = evaluate(s.turn, colorsOf(civ), s.players[v].cards);
  const legal = civ.bannedThrough < s.turn, onlyOne = legalFighters(s, v).length === 1;
  const label = !legal ? `출전 제한 (${civ.bannedThrough - s.turn + 1}턴)` : onlyOne ? '강제 출전' : ui.fighter === i ? '출전 선택됨' : '이 문명 출전';
  return `<article class="card ${ui.fighter === i ? 'selected' : legal ? '' : 'banned'}">
    <div class="card-head"><strong>문명 ${LETTERS[i]}</strong>${banTag(civ)}</div>
    <div class="stones">${civ.stones.map(st => stoneHTML(st, v, v)).join('')}</div>
    ${techPath(v, i, v)}
    <div class="hand-mini">${artImg(HAND_ART[e.name], 'thumb')}<div>
      <p class="hand">${handLine(e)}</p>
      <p class="muted">${e.why}</p>
      ${e.special ? `<p class="beats">${beatText(s.turn, e.beats)}</p>` : ''}
    </div></div>
    <button class="fight" data-act="fight" data-i="${i}" aria-pressed="${ui.fighter === i}" ${legal && !onlyOne ? '' : 'disabled'}>${label}</button>
  </article>`;
}

// 내 불가사의 카드. 상대는 모른다.
function cardsHTML(view) {
  const shown = shownCards(s, 1 - view), used = shownCards(s, view);
  const card = name => {
    const t = specialTurn(name), row = TABLES[t].find(r => r[2] === name), past = t < s.turn && !used.includes(name);
    return `<article class="sp-card ${past ? 'past' : ''}">${artImg(HAND_ART[name], 'thumb')}<div>
      <p class="hand-title"><b class="rank">${t}턴</b> <strong>${name}</strong> <span class="star">★</span>${used.includes(name) ? ' <span class="tag">공개됨</span>' : past ? ' <span class="tag">지나감</span>' : ''}</p>
      <div class="hand-shape">${shapeDots(row[5], row[0], row[1])}</div>
      <p class="beats">${beatText(t, row[6] ?? 1)}</p>
    </div></article>`;
  };
  return `<h2 class="sub">내 불가사의 카드 · 상대는 모름</h2>
    <div class="sp-cards">${s.players[view].cards.map(card).join('')}</div>
    <p class="muted">${nameOf(1 - view)} 카드 ${HAND_CARDS}장: ${shown.length ? `${shown.join(', ')} 공개` : '모두 비공개'}${shown.length === 1 ? ', 1장 비공개' : ''}</p>`;
}

// 이번 턴 족보표에서 각 문명이 어느 줄에 있는지.
function rowChips(t) {
  const chips = {};
  const add = (e, html) => { (chips[e.rank - 1] ??= []).push(html); };
  if (t !== s?.turn || !['assign', 'fight'].includes(phase)) return chips;
  const v = viewer, me = s.players[v];
  me.civs.forEach((civ, i) => {
    const kind = ui.assign[i], seq = phase === 'fight' ? colorsOf(civ) : kind ? colorsOf(civ) + TOKENS[kind][1] : null;
    if (seq) add(evaluate(t, seq, me.cards), `<span class="chip ${civ.bannedThrough >= t ? 'off' : ''}" title="내 문명 ${LETTERS[i]}">${LETTERS[i]}</span>`);
  });
  if (phase === 'fight') s.players[1 - v].civs.forEach((civ, i) => {
    const q = publicSeq(civ);
    if (!q.includes('?')) add(evaluate(t, q, shownCards(s, 1 - v)), `<span class="chip opp ${civ.bannedThrough >= t ? 'off' : ''}" title="상대 문명 ${LETTERS[i]}">상대 ${LETTERS[i]}</span>`);
  });
  return chips;
}

function tableHTML() {
  const t = tableTurn, chips = rowChips(t), current = s?.turn, me = s ? secretOwner() : null;
  const mine = me === null ? [] : s.players[me].cards;
  const holder = name => {
    if (mine.includes(name)) return ' <span class="pill">내 카드</span>';
    const p = s ? [0, 1].find(q => shownCards(s, q).includes(name)) : undefined;
    return p === undefined ? '' : ` <span class="pill opp">${nameOf(p)} 카드</span>`;
  };
  const row = (r, i) => `<li class="hand-row ${r[4] ? 'special' : ''} ${chips[i]?.length ? 'occupied' : ''}">
      ${artImg(HAND_ART[r[2]], 'thumb')}
      <div class="hand-body">
        <div class="hand-title">${rankTag(i + 1)} <strong>${r[2]}</strong>${r[4] ? ` <span class="star">★</span>${holder(r[2])}` : ''}${(chips[i] ?? []).join('')}</div>
        <div class="hand-shape">${r[4] ? shapeDots(r[5], r[0], r[1]) : dotsOf(r[0], r[1])}</div>
        <p class="why">${r[3]}</p>
        ${r[4] ? `<p class="beats">${beatText(t, r[6] ?? 1)}</p>` : ''}
      </div>
    </li>`;
  return `<div class="tabs" role="group" aria-label="턴별 족보표">${Object.keys(TABLES).map(u => `<button class="tab ${Number(u) === current ? 'current' : ''}" data-act="tableTab" data-t="${u}" aria-pressed="${Number(u) === t}" aria-label="${u}턴 족보">${u}</button>`).join('')}</div>
    <div class="hand-head"><h2>${t}턴 ${ERAS[t][0]}</h2><span class="points">승리 ${pointsFor(t)}점</span></div>
    <ol class="hand-list">${TABLES[t].map(row).join('')}</ol>
    <p class="legend">위에 있을수록 강하고, 같은 족보끼리는 무승부. ${t >= 3 ? `★ 불가사의는 그 카드를 가진 사람만 완성하며, 적힌 상위 족보를 이기고 나머지와는 순위대로 겨룹니다. 카드가 없으면 같은 돌도 일반 족보입니다. <span class="any">${dot('B')}${dot('W')}</span> 칸 안의 돌은 순서 무관.` : ''}${t === current ? ' <span class="chip">A</span> 내 문명 <span class="chip opp">상대 A</span> 상대 문명의 현재 자리.' : ''}</p>`;
}

function historyHTML(open = false) {
  if (!s.history.length) return '';
  const lines = s.history.map(h => {
    const result = h.winner === null ? '무승부' : `${nameOf(h.winner)} 승 +${pointsFor(h.turn)}`;
    return `<li>${h.turn}턴: ${nameOf(0)} ${LETTERS[h.fighters[0]]} ${handLine(h.hands[0])} 대 ${nameOf(1)} ${LETTERS[h.fighters[1]]} ${handLine(h.hands[1])} · <b>${result}</b></li>`;
  }).join('');
  return `<details ${open ? 'open' : ''}><summary>전투 기록 (${s.history.length}턴)</summary><ol class="history">${lines}</ol></details>`;
}

// 전투 결과의 이유: 순위 차이인지, ★ 불가사의가 상위 족보를 잡았는지.
function reasonText(h) {
  if (h.winner === null) return `같은 족보(${h.hands[0].name})라 무승부`;
  const w = h.hands[h.winner], l = h.hands[1 - h.winner];
  if (w.special && l.rank <= w.beats) return `★ ${w.name}${iga(w.name)} 상위 족보 ${l.name}${eul(l.name)} 잡음`;
  return `${w.rank}위${iga(`${w.rank}위`)} ${l.rank}위${eul(`${l.rank}위`)} 이김`;
}

function hud(now) {
  const pips = Object.keys(TABLES).map(Number).map(t => {
    const h = s.history.find(x => x.turn === t);
    const tag = !h ? pointsFor(t) + '점' : h.winner === null ? '무' : mode === 'hotseat' ? `P${h.winner + 1}` : h.winner === viewer ? '승' : '패';
    const tone = h && h.winner !== null && mode !== 'hotseat' ? (h.winner === viewer ? 'win' : 'lose') : '';
    return `<li class="pip ${t === now ? 'now' : ''} ${tone}" aria-label="${t}턴 ${h ? tag : `승리 ${pointsFor(t)}점`}">${t}턴<b>${tag}</b></li>`;
  }).join('');
  return `<header class="hud">
    <div class="score">${nameOf(0)} <b>${s.players[0].score}</b>점 : <b>${s.players[1].score}</b>점 ${nameOf(1)}</div>
    <ol class="pips">${pips}</ol>
  </header>`;
}

function eraBanner(t) {
  return `<section class="era">${artImg(ERA_ART[t])}<div class="era-text"><h1>${t}/${LAST_TURN}턴 · ${ERAS[t][0]}</h1><p>${ERAS[t][1]} <span class="nowrap">승리 시 ${pointsFor(t)}점.</span></p><cite>${artCredit(ERA_ART[t])}</cite></div></section>`;
}

const steps = now => `<ol class="steps">${['돌 배치', '문명 출전', '전투'].map((label, i) => `<li class="${i === now ? 'now' : ''}" ${i === now ? 'aria-current="step"' : ''}>${i + 1}. ${label}</li>`).join('')}</ol>`;
const tableButton = '<button class="only-phone" data-act="openTable">족보표</button>';
const layout = (main, bar = '') => `<div class="layout"><main>${main}${bar}</main><aside class="rail" aria-label="족보표">${tableHTML()}</aside></div>`;

const screens = {
  start: () => `<section class="era hero">${artImg(ERA_ART[5])}<div class="era-text">
      <h1>문명 대전</h1>
      <p>돌을 나눠 세 문명의 테크를 올리고, 석기 시대부터 정보 시대까지 겨룹니다.</p>
      <cite>${artCredit(ERA_ART[5])}</cite>
    </div></section>
    <div class="modes">
      <button class="primary" data-act="start" data-mode="bot">봇과 대전</button>
      <button class="primary" data-act="start" data-mode="hotseat">둘이서 번갈아 하기</button>
      <button class="primary" data-act="host">온라인 방 만들기</button>
    </div>
    <div class="panel join">
      <label for="join-code">받은 방 코드</label>
      <input id="join-code" maxlength="4" autocomplete="off" value="${/^#[A-Za-z0-9]{4}$/.test(location.hash) ? location.hash.slice(1).toUpperCase() : ''}">
      <button data-act="join">참가</button>
    </div>
    <details class="panel" open><summary>게임 방법</summary>
      <ol class="rules">
        <li>처음에 돌 21개를 받습니다: ${dot('B')} 흑 7, ${dot('W')} 백 7, ${dot('G')} 회색 7. 회색돌마다 속 색이 랜덤으로 정해지고 나만 압니다.</li>
        <li>★ 불가사의 카드 16장 중 2장을 비밀로 받습니다. 카드에 적힌 불가사의는 그 카드를 가진 사람만 완성할 수 있습니다.</li>
        <li>매 턴 내 문명 3개에 돌을 하나씩 줍니다. 색은 자유라서 한 턴에 흑만 3개도 됩니다. 21개를 7턴 동안 모두 씁니다.</li>
        <li>양쪽 배치가 동시에 공개됩니다. 상대 회색돌은 "?"로 보입니다. 배치를 보고 출전할 문명 하나를 비공개로 고릅니다. 출전한 문명의 회색돌은 그때 공개됩니다.</li>
        <li>족보표에서 위에 있을수록 강하고, 같은 족보끼리는 무승부입니다. ★ 불가사의는 적힌 상위 족보를 이기고 나머지와는 순위대로 겨룹니다. 전투에 쓴 카드는 공개됩니다.</li>
        <li>이긴 문명은 다음 2턴, 지거나 비긴 문명은 다음 1턴 출전할 수 없습니다.</li>
        <li>승리 점수는 1~3턴 1점, 4~6턴 2점, 7턴 3점입니다. 동점이면 마지막 전투 승자가 이깁니다.</li>
      </ol>
    </details>
    <details class="panel"><summary>그림 출처</summary>
      <ul class="credits">${[...Object.values(ERA_ART), ...Object.values(HAND_ART)].map(art => `<li>${artCredit(art)}</li>`).join('')}</ul>
      <p class="muted">모두 저작권이 끝났거나 CC0으로 풀린 자료이며 위키미디어 공용에서 가져왔습니다.</p>
    </details>`,

  lobby: () => net.role === 'host'
    ? `<div class="panel">
        <h1>온라인 방</h1>
        <p class="code">${net.code}</p>
        <p>상대에게 이 코드를 알려 주세요. 상대가 참가하면 바로 시작합니다. 이 창을 닫으면 방이 사라집니다.</p>
        <p class="bar">
          <button class="primary" data-act="copy" data-text="${net.code}">코드 복사</button>
          ${location.protocol.startsWith('http') ? `<button data-act="copy" data-text="${location.href.split('#')[0]}#${net.code}">초대 링크 복사</button>` : ''}
          <button data-act="home">취소</button>
        </p>
      </div>`
    : `<div class="panel">
        <h1>방 ${net.code}에 연결하는 중</h1>
        <p class="muted">최대 20초 걸릴 수 있습니다.</p>
        <p class="bar"><button data-act="home">취소</button></p>
      </div>`,

  waiting: () => {
    const v = viewer;
    return `${hud(s.turn)}${eraBanner(s.turn)}${steps(s.stage === 'assign' ? 0 : 1)}
      ${layout(`<p class="result-line">상대를 기다리는 중</p>
        <p class="muted">${s.stage === 'assign' ? '돌 배치를 확정했습니다. 상대가 확정하면 양쪽 배치가 공개됩니다.' : '출전 문명을 확정했습니다. 상대가 확정하면 전투합니다.'}</p>
        <h2 class="sub">${nameOf(1 - v)} 문명</h2>${stockHTML(1 - v, v)}<div class="cards">${[0,1,2].map(i => civCard(1 - v, i, v)).join('')}</div>
        <h2 class="sub">${squadTitle(v)}</h2>${stockHTML(v, v)}<div class="cards">${[0,1,2].map(i => civCard(v, i, v)).join('')}</div>
        ${historyHTML()}`, `<div class="actionbar only-phone">${tableButton}</div>`)}`;
  },

  pass: () => `<div class="panel">
    <h1>${nameOf(viewer)} 차례</h1>
    <p>${s.turn}/${LAST_TURN}턴 ${s.stage === 'assign' ? '돌 배치' : '문명 출전'}. 기기를 ${nameOf(viewer)}에게 넘겨주세요. 상대는 화면을 보지 마세요.</p>
    <p class="bar"><button class="primary" data-act="ready">준비 완료</button></p>
  </div>`,

  assign: () => {
    const v = viewer, t = s.turn, missing = ui.assign.includes(null);
    return `${hud(t)}${eraBanner(t)}${steps(0)}
      ${layout(`<h2 class="act">${squadTitle(v)}: 돌 나눠 주기</h2>
        <p class="muted">문명마다 돌 하나씩, 색은 자유입니다.</p>
        ${stockHTML(v, v, ui.assign)}
        <div class="cards mine">${[0,1,2].map(assignCard).join('')}</div>
        ${cardsHTML(v)}
        <h2 class="sub">${nameOf(1 - v)} 문명</h2>${stockHTML(1 - v, v)}
        <div class="cards">${[0,1,2].map(i => civCard(1 - v, i, v)).join('')}</div>
        ${historyHTML()}`,
      `<div class="actionbar">${tableButton}<button class="primary" data-act="confirmAssign" ${missing ? 'disabled' : ''}>돌 배치 확정</button>${missing ? '<span class="hint">문명 세 곳에 돌을 하나씩 주세요.</span>' : ''}</div>`)}`;
  },

  fight: () => {
    const v = viewer, t = s.turn, missing = ui.fighter === null;
    return `${hud(t)}${eraBanner(t)}${steps(1)}
      ${layout(`<h2 class="sub">${nameOf(1 - v)} 문명</h2>${stockHTML(1 - v, v)}
        <div class="cards">${[0,1,2].map(i => civCard(1 - v, i, v)).join('')}</div>
        <h2 class="act">${squadTitle(v)}: 출전 고르기</h2>
        <div class="cards mine">${[0,1,2].map(fightCard).join('')}</div>
        ${cardsHTML(v)}
        ${historyHTML()}`,
      `<div class="actionbar">${tableButton}<button class="primary" data-act="confirmFight" ${missing ? 'disabled' : ''}>출전 확정</button>${missing ? '<span class="hint">출전할 문명을 고르세요.</span>' : ''}</div>`)}`;
  },

  result: () => {
    const h = s.history.at(-1), view = mode === 'hotseat' ? null : viewer;
    const tone = h.winner === null || mode === 'hotseat' ? '' : h.winner === viewer ? 'win' : 'lose';
    const headline = h.winner === null ? '무승부' : `${nameOf(h.winner)} 승리 +${pointsFor(h.turn)}점`;
    const duel = p => { const e = h.hands[p], art = HAND_ART[e.name]; return `<article class="card duel-card ${h.winner === p ? 'winner' : ''}">
      ${artImg(art, 'hand-art')}
      <div class="card-head"><strong>${nameOf(p)} · 문명 ${LETTERS[h.fighters[p]]}</strong><span class="tag">${h.winner === p ? '승리' : h.winner === null ? '무승부' : '패배'}</span></div>
      <p class="hand-big">${handLine(e)}</p>
      ${e.special ? `<p class="beats">카드 공개 · ${beatText(h.turn, e.beats)}</p>` : ''}
      <div class="stones">${s.players[p].civs[h.fighters[p]].stones.map(st => stoneHTML(st, p, view)).join('')}</div>
      <p class="muted">${e.why}</p>
      <cite class="credit">${artCredit(art)}</cite>
    </article>`; };
    return `${hud(h.turn)}${steps(2)}
      ${layout(`<p class="muted turn-label">${h.turn}/${LAST_TURN}턴 · ${ERAS[h.turn][0]}</p>
        <h1 class="result-line ${tone}">${headline}</h1>
        <p class="reason">${reasonText(h)}</p>
        <div class="duel">${duel(0)}${duel(1)}</div>
        <h2 class="sub">${squadTitle(0)}</h2><div class="cards">${[0,1,2].map(i => civCard(0, i, view)).join('')}</div>
        <h2 class="sub">${nameOf(1)} 문명</h2><div class="cards">${[0,1,2].map(i => civCard(1, i, view)).join('')}</div>
        ${historyHTML()}`,
      `<div class="actionbar">${tableButton}<button class="primary" data-act="next">${s.over ? '최종 결과 보기' : '다음 턴'}</button></div>`)}`;
  },

  end: () => {
    const [a, b] = s.players.map(p => p.score), w = winnerOf(s);
    return `<section class="era">${artImg(ERA_ART[7])}<div class="era-text">
        <h1>${w === null ? '무승부' : `${nameOf(w)} 승리`}</h1>
        <p class="score">${nameOf(0)} ${a}점 : ${b}점 ${nameOf(1)}${a === b && w !== null ? ' · 동점이라 마지막 전투 승자가 이김' : ''}</p>
        <cite>${artCredit(ERA_ART[7])}</cite>
      </div></section>
      <p class="bar">${mode !== 'online' ? `<button class="primary" data-act="start" data-mode="${mode}">다시 하기</button>`
        : net?.role === 'host' ? '<button class="primary" data-act="rematch">다시 하기</button>'
        : '<span class="muted">방을 만든 쪽이 새 게임을 시작할 수 있습니다.</span>'}<button data-act="home">처음으로</button></p>
      <p class="muted">불가사의 카드 · ${[0, 1].map(p => `${nameOf(p)}: ${s.players[p].cards.join(', ')}`).join(' · ')}</p>
      <h2 class="sub">${squadTitle(0)} (전체 공개)</h2><div class="cards">${[0,1,2].map(i => civCard(0, i, 'all')).join('')}</div>
      <h2 class="sub">${nameOf(1)} 문명 (전체 공개)</h2><div class="cards">${[0,1,2].map(i => civCard(1, i, 'all')).join('')}</div>
      ${historyHTML(true)}`;
  },
};

function enterStage() {
  if (s.over) { phase = 'end'; return; }
  const legal = legalFighters(s, viewer);
  ui = { assign:[null, null, null], fighter:s.stage === 'fight' && legal.length === 1 ? legal[0] : null };
  tableTurn = s.turn;
  phase = s.stage;
}

function beginTurn() {
  assigns = [null, null];
  fighters = [null, null];
  viewer = 0;
  if (mode === 'bot') {
    assigns[1] = botAssign(s, 1);
    enterStage();
  } else phase = 'pass';
}

const actions = {
  start({ mode: m }) { leaveRoom(); mode = m; s = newGame(); beginTurn(); },
  home() { leaveRoom(); phase = 'start'; },
  host() {
    if (typeof Peer === 'undefined') { notice = '온라인 대전에는 인터넷 연결이 필요합니다.'; return; }
    openRoom();
  },
  join() {
    const code = document.getElementById('join-code').value.trim().toUpperCase();
    if (typeof Peer === 'undefined') { notice = '온라인 대전에는 인터넷 연결이 필요합니다.'; return; }
    if (!/^[A-Z0-9]{4}$/.test(code)) { notice = '방 코드 4자리를 입력하세요.'; return; }
    joinRoom(code);
  },
  rejoin() {
    const code = net.code;
    leaveRoom();
    joinRoom(code);
  },
  rematch() {
    s = newGame();
    assigns = [null, null];
    fighters = [null, null];
    sendState();
    enterStage();
  },
  copy({ text }) {
    navigator.clipboard?.writeText(text).then(() => { notice = '복사했습니다.'; noticeOk = true; render(); }).catch(() => { notice = `복사하지 못했습니다. 직접 알려 주세요: ${text}`; render(); });
  },
  ready() { enterStage(); },
  assign({ i, kind }) { ui.assign[Number(i)] = kind; },
  confirmAssign() {
    if (mode === 'online') return submitOnline('assign', ui.assign);
    assigns[viewer] = ui.assign;
    if (!assigns[1 - viewer]) { viewer = 1 - viewer; phase = 'pass'; return; }
    s = placeStones(s, assigns);
    viewer = 0;
    if (mode === 'bot') {
      fighters[1] = botFight(s, 1);
      enterStage();
    } else phase = 'pass';
  },
  fight({ i }) { ui.fighter = Number(i); },
  confirmFight() {
    if (mode === 'online') return submitOnline('fight', ui.fighter);
    fighters[viewer] = ui.fighter;
    if (fighters[1 - viewer] === null) { viewer = 1 - viewer; phase = 'pass'; return; }
    s = fightTurn(s, fighters);
    phase = 'result';
  },
  next() { if (s.over) phase = 'end'; else if (mode === 'online') enterStage(); else beginTurn(); },
  tableTab({ t }) { tableTurn = Number(t); },
  openTable() { sheet.showModal(); },
  closeTable() { sheet.close(); },
};

function renderSheet() {
  sheet.innerHTML = `<div class="sheet-head"><strong>족보표</strong><button data-act="closeTable">닫기</button></div><div class="sheet-body">${tableHTML()}</div>`;
}

// 다시 그려도 키보드 초점이 같은 버튼에 남게 한다.
function render() {
  const focused = document.activeElement?.closest?.('[data-act]')?.dataset;
  const lost = !net?.lost ? '' : net.role === 'host'
    ? `<p class="notice">상대와 연결이 끊겼습니다. 상대가 코드 ${net.code}로 다시 참가하면 이어집니다.</p>`
    : '<p class="notice">방과 연결이 끊겼습니다. <button data-act="rejoin">다시 연결</button></p>';
  app.innerHTML = (notice ? `<p class="notice ${noticeOk ? 'ok' : ''}">${notice}</p>` : '') + lost + screens[phase]();
  if (sheet.open) renderSheet(); else if (['assign', 'fight', 'waiting', 'result'].includes(phase)) renderSheet();
  if (focused) {
    const again = [...document.querySelectorAll(`[data-act="${focused.act}"]`)].find(b => b.dataset.i === focused.i && b.dataset.kind === focused.kind && b.dataset.t === focused.t);
    again?.focus({ preventScroll:true });
  }
}

document.addEventListener('click', e => {
  if (e.target === sheet) { sheet.close(); return; }
  const button = e.target.closest('[data-act]');
  if (!button || button.disabled) return;
  const before = phase;
  notice = '';
  noticeOk = false;
  actions[button.dataset.act](button.dataset);
  render();
  if (phase !== before) window.scrollTo(0, 0);
});

render();

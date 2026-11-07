// 화면. 규칙은 game.js, 온라인 연결은 net.js에 있다.
const app = document.getElementById('app');
const sheet = document.getElementById('table-sheet');
const LETTERS = 'ABC';
const COLOR_NAME = { B:'흑', W:'백' };
let s, mode, phase = 'start', viewer = 0, assigns, fighters, ui, net = null, notice = '', noticeOk = false, tableTurn = 1;

const nameOf = p => mode === 'bot' ? ['나','봇'][p] : mode === 'online' ? (p === viewer ? '나' : '상대') : `플레이어 ${p + 1}`;
const squadTitle = p => mode !== 'hotseat' && p === viewer ? '내 문명' : `${nameOf(p)} 문명`;
const comboText = (b, w) => b && w ? `흑 ${b} / 백 ${w}` : b ? `흑 ${b}` : `백 ${w}`;
const batchim = word => (word.charCodeAt(word.length - 1) - 0xAC00) % 28 !== 0;
const eul = word => batchim(word) ? '을' : '를';
const iga = word => batchim(word) ? '이' : '가';
const artImg = (art, cls = '') => `<img class="${cls}" src="${art.file}" alt="${art.title}" loading="lazy" style="object-position:${art.pos ?? 'center'}">`;
const artCredit = art => `${art.title}, ${art.by}, ${art.year}`;
const isHidden = (st, owner, view) => st.kind === 'G' && !st.revealed && view !== 'all' && view !== owner;

// 계열은 색 꼬리표로, 계열 안 순위는 꼬리표 안 숫자로 보여 준다. ★는 특수 족보.
const famPill = (family, extra = '') => `<span class="fam ${family}">${FAMILY[family]}${extra}</span>`;
const handLine = e => `${famPill(e.family, e.special ? ' ★' : ` ${e.level}위`)} <span class="hand-name">${e.name}</span>`;
const STAR_RULE = '★ 특수 족보는 다른 계열을 모두 이기고, 같은 계열 일반 족보에는 집니다.';
const cycleHTML = () => `<div class="cycle" role="img" aria-label="권력은 자유를, 자유는 균형을, 균형은 권력을 이김">
    ${famPill('P')}<span aria-hidden="true">›</span>${famPill('F')}<span aria-hidden="true">›</span>${famPill('E')}<span aria-hidden="true">›</span>${famPill('P')}
    <small>왼쪽이 오른쪽을 이김</small>
  </div>`;

// 화면에는 글자 대신 작은 돌로 그린다. 글자는 화면 낭독용으로만 남긴다.
const dot = c => `<span class="dot ${c === 'B' ? 'b' : c === 'W' ? 'w' : 'g'}"></span>`;
const dotsOf = (b, w) => `<span class="dots" role="img" aria-label="${comboText(b, w)}">${dot('B').repeat(b)}${dot('W').repeat(w)}</span>`;
function shapeDots(shape, b, w) {
  const [pattern, note] = shape.split('|');
  const stones = pattern.replace(/\[([BW]+)\]|([BW])/g, (_, group, one) => group ? `<span class="any" title="칸 안의 돌은 순서 무관">${[...group].map(dot).join('')}</span>` : dot(one));
  return `<span class="dots" role="img" aria-label="${comboText(b, w)}, 순서 조건 있음">${stones}</span>${note ? `<small class="shape-note">${note}</small>` : ''}`;
}

function stoneHTML(st, owner, view) {
  if (isHidden(st, owner, view)) return '<span class="stone hidden" role="img" aria-label="공개되지 않은 회색돌">?</span>';
  const label = `${st.kind === 'G' ? '회색돌에서 나온 ' : ''}${COLOR_NAME[st.color]}돌`;
  return `<span class="stone ${st.color === 'B' ? 'b' : 'w'}${st.kind === 'G' ? ' from-gray' : ''}" role="img" aria-label="${label}"></span>`;
}

const inGame = () => ['assign', 'fight', 'waiting'].includes(phase) && !s.over;

// 참고용 카드. 아직 모르는 돌이 있으면 될 수 있는 계열을 보여 준다.
function civCard(owner, i, view) {
  const civ = s.players[owner].civs[i];
  let info = '', fam = '';
  if (inGame()) {
    const h = possibleHands(s.turn, view === owner ? colorsOf(civ) : publicSeq(civ)), names = new Set(h.hands.map(x => x.name));
    if (names.size === 1) { info = handLine(h.hands[0]); fam = h.hands[0].family; }
    else {
      info = `${h.families.map(f => famPill(f)).join(' ')} <span>가능</span>`;
      if (h.specials.length) info += `<div class="note">★ ${h.specials.join(', ')} 가능</div>`;
      if (h.families.length === 1) fam = h.families[0];
    }
  }
  return `<article class="card" ${fam ? `data-fam="${fam}"` : ''}>
    <div class="card-head"><strong>문명 ${LETTERS[i]}</strong></div>
    <div class="stones">${civ.stones.map(st => stoneHTML(st, owner, view)).join('') || '<span class="empty">돌 없음</span>'}</div>
    <div class="info">${info}</div>
  </article>`;
}

function assignCard(i) {
  const v = viewer, civ = s.players[v].civs[i], seq = colorsOf(civ), chosen = ui.assign[i];
  const picks = ['B','W','G'].map(kind => {
    const color = stoneColor(s, v, kind), e = evaluate(s.turn, seq + color);
    const label = kind === 'G' ? `회색 (실제 ${COLOR_NAME[color]})` : `${COLOR_NAME[color]}돌`;
    return `<button class="pick" data-act="assign" data-i="${i}" data-kind="${kind}" aria-pressed="${chosen === kind}" aria-label="문명 ${LETTERS[i]}에 ${label} 주기: ${FAMILY[e.family]} ${e.special ? '특수' : `${e.level}위`} ${e.name}">
      <span class="stone ${color === 'B' ? 'b' : 'w'}${kind === 'G' ? ' from-gray' : ''}"></span>
      <span class="labels">${kind === 'G' ? '<small>회색돌</small>' : ''}<span class="name">${handLine(e)}</span></span>
    </button>`;
  }).join('');
  const pending = chosen ? `<span class="stone pending ${stoneColor(s, v, chosen) === 'B' ? 'b' : 'w'}" role="img" aria-label="이번 턴에 줄 돌"></span>` : '';
  const fam = chosen ? evaluate(s.turn, seq + stoneColor(s, v, chosen)).family : '';
  return `<article class="card" ${fam ? `data-fam="${fam}"` : ''}>
    <div class="card-head"><strong>문명 ${LETTERS[i]}</strong></div>
    <div class="stones">${civ.stones.map(st => stoneHTML(st, v, v)).join('')}${pending || (civ.stones.length ? '' : '<span class="empty">돌 없음</span>')}</div>
    <div class="picks">${picks}</div>
  </article>`;
}

function fightCard(i) {
  const v = viewer, civ = s.players[v].civs[i], e = evaluate(s.turn, colorsOf(civ)), picked = ui.fighter === i;
  return `<article class="card ${picked ? 'selected' : ''}" data-fam="${e.family}">
    <div class="card-head"><strong>문명 ${LETTERS[i]}</strong></div>
    <div class="stones">${civ.stones.map(st => stoneHTML(st, v, v)).join('')}</div>
    <div class="hand-mini">${artImg(HAND_ART[e.name], 'thumb')}<div>
      <p class="hand">${handLine(e)}</p>
      <p class="muted">${e.why}</p>
      ${e.special ? '<p class="beats">다른 계열 모두 이김 · 같은 계열에 짐</p>' : ''}
    </div></div>
    <button class="fight" data-act="fight" data-i="${i}" aria-pressed="${picked}">${picked ? '출전 선택됨' : '이 문명 출전'}</button>
  </article>`;
}

// 이번 턴 족보표에서 각 문명이 어느 줄에 있는지. 족보 이름으로 찾는다.
function rowChips(t) {
  const chips = {};
  const add = (e, html) => { (chips[e.name] ??= []).push(html); };
  if (t !== s?.turn || !['assign', 'fight'].includes(phase)) return chips;
  const v = viewer;
  s.players[v].civs.forEach((civ, i) => {
    const kind = ui.assign[i], seq = phase === 'fight' ? colorsOf(civ) : kind ? colorsOf(civ) + stoneColor(s, v, kind) : null;
    if (seq) add(evaluate(t, seq), `<span class="chip" title="내 문명 ${LETTERS[i]}">${LETTERS[i]}</span>`);
  });
  if (phase === 'fight') s.players[1 - v].civs.forEach((civ, i) => {
    const q = publicSeq(civ);
    if (!q.includes('?')) add(evaluate(t, q), `<span class="chip opp" title="상대 문명 ${LETTERS[i]}">상대 ${LETTERS[i]}</span>`);
  });
  return chips;
}

// 족보표: 상성 순서(권력 › 자유 › 균형)대로 계열을 묶고, 계열 안에서는 강한 순서.
function tableHTML() {
  const t = tableTurn, chips = rowChips(t), current = s?.turn, why = ERAS[t][2];
  const row = r => {
    const family = familyOf(r[0], r[1]), special = !!r[4], level = special ? 0 : plainRows(t, family).indexOf(r) + 1;
    return `<li class="hand-row ${special ? 'special' : ''} ${chips[r[2]]?.length ? 'occupied' : ''}">
      ${artImg(HAND_ART[r[2]], 'thumb')}
      <div class="hand-body">
        <div class="hand-title">${famPill(family, special ? ' ★' : ` ${level}위`)} <strong>${r[2]}</strong>${(chips[r[2]] ?? []).join('')}</div>
        <div class="hand-shape">${special ? shapeDots(r[5], r[0], r[1]) : dotsOf(r[0], r[1])}</div>
        <p class="why">${r[3]}</p>
      </div>
    </li>`;
  };
  const group = f => {
    const rows = TABLES[t].filter(r => familyOf(r[0], r[1]) === f);
    if (!rows.length) return '';
    const prey = FAMILY[BEATS[f]];
    return `<section class="fam-group">
      <h3>${famPill(f)} ${why ? `<span>${prey}${eul(prey)} 이김: ${why[f]}</span>` : ''}</h3>
      <ol class="hand-list">${rows.map(row).join('')}</ol>
    </section>`;
  };
  return `<div class="tabs" role="group" aria-label="턴별 족보표">${Object.keys(TABLES).map(u => `<button class="tab ${Number(u) === current ? 'current' : ''}" data-act="tableTab" data-t="${u}" aria-pressed="${Number(u) === t}" aria-label="${u}턴 족보">${u}</button>`).join('')}</div>
    <div class="hand-head"><h2>${t}턴 ${ERAS[t][0]}</h2><span class="points">${pointsFor(t) ? `승리 ${pointsFor(t)}점` : '전투 없음'}</span></div>
    ${pointsFor(t) ? cycleHTML() : '<p class="muted">1턴은 돌만 놓고 전투하지 않습니다.</p>'}
    ${['P', 'F', 'E'].map(group).join('')}
    <p class="legend">계열 안 숫자가 작을수록 강합니다. 한 색 몰빵이 1위, 몰빵에서 하나 모자라면 꼴찌. ${t >= 3 ? `${STAR_RULE} <span class="any">${dot('B')}${dot('W')}</span> 칸 안의 돌은 순서 무관.` : ''}${t === current ? ' <span class="chip">A</span> 내 문명 <span class="chip opp">상대 A</span> 상대 문명의 현재 자리.' : ''}</p>`;
}

function historyHTML(open = false) {
  if (!s.history.length) return '';
  const lines = s.history.map(h => {
    const result = h.winner === null ? '무승부' : `${nameOf(h.winner)} 승 +${pointsFor(h.turn)}`;
    return `<li>${h.turn}턴: ${nameOf(0)} ${LETTERS[h.fighters[0]]} ${handLine(h.hands[0])} 대 ${nameOf(1)} ${LETTERS[h.fighters[1]]} ${handLine(h.hands[1])} · <b>${result}</b></li>`;
  }).join('');
  return `<details ${open ? 'open' : ''}><summary>전투 기록 (${s.history.length}턴)</summary><ol class="history">${lines}</ol></details>`;
}

// 전투 결과의 이유. 계열 상성, ★, 같은 계열 순위 중 무엇으로 갈렸는지.
function reasonText(h) {
  const [a, b] = h.hands;
  if (h.winner === null) return a.name === b.name ? '같은 족보라 무승부' : `같은 ${FAMILY[a.family]} 계열, 같은 순위라 무승부`;
  const w = h.hands[h.winner], l = h.hands[1 - h.winner];
  if (w.family !== l.family) {
    if (w.special && !l.special) return `★ ${w.name}${iga(w.name)} 다른 계열을 이김`;
    return `${FAMILY[w.family]}${iga(FAMILY[w.family])} ${FAMILY[l.family]}${eul(FAMILY[l.family])} 이김: ${ERAS[h.turn][2][w.family]}`;
  }
  if (l.special) return `★ ${l.name}${iga(l.name)} 같은 계열 ${w.name}에 짐`;
  return `같은 ${FAMILY[w.family]} 계열: ${w.level}위${iga(`${w.level}위`)} ${l.level}위${eul(`${l.level}위`)} 이김`;
}

function hud(now) {
  const pips = Object.keys(TABLES).map(Number).map(t => {
    const h = s.history.find(x => x.turn === t);
    const tag = !h ? (pointsFor(t) ? pointsFor(t) + '점' : '준비') : h.winner === null ? '무' : mode === 'hotseat' ? `P${h.winner + 1}` : h.winner === viewer ? '승' : '패';
    const tone = h && h.winner !== null && mode !== 'hotseat' ? (h.winner === viewer ? 'win' : 'lose') : '';
    return `<li class="pip ${t === now ? 'now' : ''} ${tone}" aria-label="${t}턴 ${h ? tag : pointsFor(t) ? `승리 ${pointsFor(t)}점` : '전투 없음'}">${t}턴<b>${tag}</b></li>`;
  }).join('');
  return `<header class="hud">
    <div class="score">${nameOf(0)} <b>${s.players[0].score}</b>점 : <b>${s.players[1].score}</b>점 ${nameOf(1)}</div>
    <ol class="pips">${pips}</ol>
  </header>`;
}

function eraBanner(t) {
  return `<section class="era">${artImg(ERA_ART[t])}<div class="era-text"><h1>${t}/${LAST_TURN}턴 · ${ERAS[t][0]}</h1><p>${ERAS[t][1]}${pointsFor(t) ? ` <span class="nowrap">승리 시 ${pointsFor(t)}점.</span>` : ''}</p><cite>${artCredit(ERA_ART[t])}</cite></div></section>`;
}

const steps = now => `<ol class="steps">${['돌 배치', '문명 출전', '전투'].map((label, i) => `<li class="${i === now ? 'now' : ''}" ${i === now ? 'aria-current="step"' : ''}>${i + 1}. ${label}</li>`).join('')}</ol>`;
const tableButton = '<button class="only-phone" data-act="openTable">족보표</button>';
const layout = (main, bar = '') => `<div class="layout"><main>${main}${bar}</main><aside class="rail" aria-label="족보표">${tableHTML()}</aside></div>`;

const screens = {
  start: () => `<section class="era hero">${artImg(ERA_ART[5])}<div class="era-text">
      <h1>문명 대전</h1>
      <p>돌을 나눠 키운 세 문명으로 일곱 시대를 겨룹니다.</p>
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
        <li>매 턴 돌 3개(${dot('B')} ${dot('W')} ${dot('G')})를 내 문명 3개에 하나씩 줍니다. 회색돌(${dot('G')})의 색은 랜덤이고 나만 압니다.</li>
        <li>양쪽 돌 배치가 동시에 공개됩니다. 상대의 회색돌은 "?"로 보입니다.</li>
        <li>배치를 보고 출전할 문명 하나를 비공개로 고릅니다. 출전 제한은 없습니다. 출전한 문명의 회색돌은 그때 공개됩니다.</li>
        <li>족보는 세 계열입니다. ${famPill('P')} 흑이 2개 이상 많음, ${famPill('F')} 백이 2개 이상 많음, ${famPill('E')} 차이가 1개 이하.</li>
        <li>권력은 자유를, 자유는 균형을, 균형은 권력을 이깁니다. 같은 계열끼리는 계열 안 순위가 높은 쪽이 이기고, 같으면 무승부입니다.</li>
        <li>하이리스크 하이리턴: 한 색 몰빵은 계열 1위, 몰빵에서 하나 모자라면 계열 꼴찌입니다.</li>
        <li>${STAR_RULE} 돌을 받은 순서가 정해진 모양이어야 완성됩니다.</li>
        <li>1턴은 전투 없이 문명을 세웁니다. 2~7턴 승리 점수는 1·1·2·2·2·3점이고, 동점이면 마지막 전투 승자가 이깁니다.</li>
      </ol>
    </details>
    <details class="panel"><summary>그림 출처</summary>
      <ul class="credits">${[...Object.values(ERA_ART), ...Object.values(HAND_ART)].map(art => `<li>${artCredit(art)}</li>`).join('')}</ul>
      <p class="muted">모두 저작권이 끝난 작품이며 위키미디어 공용에서 가져왔습니다.</p>
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
        <h2 class="sub">${nameOf(1 - v)} 문명</h2><div class="cards">${[0,1,2].map(i => civCard(1 - v, i, v)).join('')}</div>
        <h2 class="sub">${squadTitle(v)}</h2><div class="cards">${[0,1,2].map(i => civCard(v, i, v)).join('')}</div>
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
        <p class="muted">이번 회색돌의 실제 색: <span role="img" aria-label="${COLOR_NAME[s.gray[v]]}">${dot(s.gray[v])}</span> · 돌을 고르면 겹치는 문명과 자동으로 맞바꿉니다.${pointsFor(t) ? '' : ' 1턴은 전투가 없습니다.'}</p>
        ${pointsFor(t) ? cycleHTML() : ''}
        <div class="cards mine">${[0,1,2].map(assignCard).join('')}</div>
        <h2 class="sub">${nameOf(1 - v)} 문명</h2>
        <div class="cards">${[0,1,2].map(i => civCard(1 - v, i, v)).join('')}</div>
        ${historyHTML()}`,
      `<div class="actionbar">${tableButton}<button class="primary" data-act="confirmAssign" ${missing ? 'disabled' : ''}>돌 배치 확정</button>${missing ? '<span class="hint">돌을 모두 나눠 주세요.</span>' : ''}</div>`)}`;
  },

  fight: () => {
    const v = viewer, t = s.turn, missing = ui.fighter === null;
    return `${hud(t)}${eraBanner(t)}${steps(1)}
      ${layout(`<h2 class="sub">${nameOf(1 - v)} 문명</h2>
        <div class="cards">${[0,1,2].map(i => civCard(1 - v, i, v)).join('')}</div>
        <h2 class="act">${squadTitle(v)}: 출전 고르기</h2>
        ${cycleHTML()}
        <div class="cards mine">${[0,1,2].map(fightCard).join('')}</div>
        ${historyHTML()}`,
      `<div class="actionbar">${tableButton}<button class="primary" data-act="confirmFight" ${missing ? 'disabled' : ''}>출전 확정</button>${missing ? '<span class="hint">출전할 문명을 고르세요.</span>' : ''}</div>`)}`;
  },

  result: () => {
    const h = s.history.at(-1), view = mode === 'hotseat' ? null : viewer;
    const tone = h.winner === null || mode === 'hotseat' ? '' : h.winner === viewer ? 'win' : 'lose';
    const headline = h.winner === null ? '무승부' : `${nameOf(h.winner)} 승리 +${pointsFor(h.turn)}점`;
    const duel = p => { const art = HAND_ART[h.hands[p].name]; return `<article class="card duel-card ${h.winner === p ? 'winner' : ''}">
      ${artImg(art, 'hand-art')}
      <div class="card-head"><strong>${nameOf(p)} · 문명 ${LETTERS[h.fighters[p]]}</strong><span class="tag">${h.winner === p ? '승리' : h.winner === null ? '무승부' : '패배'}</span></div>
      <p class="hand-big">${handLine(h.hands[p])}</p>
      <div class="stones">${s.players[p].civs[h.fighters[p]].stones.map(st => stoneHTML(st, p, view)).join('')}</div>
      <p class="muted">${h.hands[p].why}</p>
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
      <h2 class="sub">${squadTitle(0)} (전체 공개)</h2><div class="cards">${[0,1,2].map(i => civCard(0, i, 'all')).join('')}</div>
      <h2 class="sub">${nameOf(1)} 문명 (전체 공개)</h2><div class="cards">${[0,1,2].map(i => civCard(1, i, 'all')).join('')}</div>
      ${historyHTML(true)}`;
  },
};

function enterStage() {
  if (s.over) { phase = 'end'; return; }
  ui = { assign:[null, null, null], fighter:null };
  if (s.stage === 'assign' && !s.history.length && s.turn > 1) { notice = '1턴은 전투 없이 끝났습니다. 상대가 놓은 돌을 보고 이번 턴을 준비하세요.'; noticeOk = true; }
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
  assign({ i, kind }) {
    const at = Number(i), other = ui.assign.indexOf(kind);
    if (other === at) return;
    if (other >= 0) ui.assign[other] = ui.assign[at];
    ui.assign[at] = kind;
    if (ui.assign.filter(k => k === null).length === 1) ui.assign[ui.assign.indexOf(null)] = ['B','W','G'].find(k => !ui.assign.includes(k));
  },
  confirmAssign() {
    if (mode === 'online') return submitOnline('assign', ui.assign);
    assigns[viewer] = ui.assign;
    if (!assigns[1 - viewer]) { viewer = 1 - viewer; phase = 'pass'; return; }
    s = placeStones(s, assigns);
    if (s.stage === 'assign') return beginTurn();
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

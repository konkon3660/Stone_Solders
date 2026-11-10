// 튜토리얼: 정해진 한 판을 game.js 규칙으로 실제로 진행하며 한 단계씩 설명한다. 규칙이 바뀌면 아래 대본 점검이 실패한다.
const app = document.getElementById('app');
const LETTERS = 'ABC';

// 턴별 대본: 내 돌, 상대 돌, 내 출전, 상대 출전.
const SCRIPT = [
  { mine:['W','B','W'], foe:['B','W','B'], field:1, foeField:0 },
  { mine:['B','W','B'], foe:['B','W','B'], field:2, foeField:2 },
  { mine:['B','GB','W'], foe:['B','GW','B'], field:1, foeField:0 },
  { mine:['W','W','W'], foe:['W','W','B'], field:0, foeField:2 },
];

const spread = tokens => tokens.map((k, c) => [c, k]);

function setup() {
  const g = newGame(() => 0.9);
  g.players[0].cards = ['마그나 카르타', '아폴로 계획'];
  g.players[1].cards = ['허블 망원경', '지동설'];
  g.players[0].stock = { B:7, W:7, GB:4, GW:3 };
  g.players[1].stock = { B:7, W:7, GB:3, GW:4 };
  return g;
}

(function checkScript() {
  const g = SCRIPT.reduce((now, t) => fightTurn(placeStones(now, [spread(t.mine), spread(t.foe)]), [t.field, t.foeField]), setup());
  const seen = g.history.map(h => `${h.hands[0].name}/${h.hands[1].name}`).join();
  if (seen !== '돌창/돌창,농경/청동검,법전/전차,마그나 카르타/기사단' || g.players[0].score !== 5) throw new Error('튜토리얼 대본이 규칙과 어긋남');
})();

const STEPS = [
  { kind:'info', title:'문명 대전', say:`돌을 쌓아 문명 셋을 키우고, 매 턴 그중 하나를 내보내 상대와 겨룹니다.</p><p>일곱 턴 동안 승리 점수를 더 많이 모으면 이깁니다. 천천히 네 턴만 같이 해 봅시다.` },
  { kind:'info', title:'돌', say:`판마다 돌 21개를 무작위로 뽑습니다. 보통 흑, 백, 회색이 고르게 나오고, 가끔 흑이나 백이 17개 쏠린 대박이 나옵니다. 이번 판은 흑 7, 백 7, 회색 7입니다.</p><p>매 턴 돌 3개를 문명들에 줍니다. 회색돌은 속이 흑이나 백인데, 그 색은 나만 압니다. 지금은 문명마다 하나씩 놓아 봅시다.` },
  { kind:'place', turn:0, title:'1턴: 돌 놓기', say:`문명마다 돌을 놓아 보세요. 버튼에 놓은 뒤의 족보가 미리 보입니다.</p><p>돌의 조합이 곧 그 문명의 족보입니다. 1턴에는 흑 하나인 돌창이 1위, 백 하나인 불이 2위입니다.` },
  { kind:'fight', turn:0, title:'1턴: 출전', say:`양쪽 돌이 동시에 공개됐습니다. 이제 싸울 문명 하나를 비밀로 고릅니다.</p><p>돌창인 문명 B를 내보내세요.` },
  { kind:'result', title:'1턴: 무승부', say:`같은 돌창이라 비겼습니다. 비기면 이번 턴 점수가 사라지지 않고 다음 승부에 얹힙니다.</p><p>출전한 문명은 쉬어야 합니다. 문명 B에 붙은 출전 제한을 보세요.` },
  { kind:'place', turn:1, title:'2턴: 족보 키우기', say:`돌이 쌓이면 족보가 바뀝니다. 2턴 1위는 흑 하나, 백 하나인 농경입니다. 순서는 상관없습니다.</p><p>아래 족보표를 열어 보고 돌을 놓아 보세요.` },
  { kind:'fight', turn:1, title:'2턴: 출전', say:`문명 B는 쉬는 중이라 나갈 수 없습니다. A와 C가 둘 다 농경입니다.</p><p>A는 뒤에 쓸 계획이 있으니 문명 C를 내보내세요.` },
  { kind:'result', title:'2턴: 승리', say:`농경이 청동검을 이겼습니다. 2턴 점수 1점에 이월된 1점을 더해 2점입니다.</p><p>이긴 문명은 다음 2턴을 쉽니다. 지거나 비기면 1턴만 쉽니다. 강한 문명 하나만 계속 내보낼 수는 없습니다.` },
  { kind:'place', turn:2, title:'3턴: 회색돌', say:`문명 B에 놓을 회색돌은 속이 흑입니다. 내게는 색이 보이지만 상대에게는 ?로 보입니다.</p><p>상대는 내 족보를 짐작만 할 수 있습니다.` },
  { kind:'fight', turn:2, title:'3턴: 상대의 회색돌', say:`상대 문명 B의 ?를 보세요. 저것도 회색돌이라 속 색을 알 수 없습니다.</p><p>흑·백·흑은 3턴 1위 법전입니다. 문명 B를 내보내세요. 출전한 문명의 회색돌은 공개됩니다.` },
  { kind:'result', title:'3턴: 승리', say:`법전이 전차를 이겨 1점을 얻었습니다. 내 회색돌도 이제 상대에게 공개됐습니다.` },
  { kind:'place', turn:3, card:'마그나 카르타', title:'4턴: 불가사의 카드', say:`게임을 시작할 때 불가사의 카드 2장을 비밀로 받습니다. 카드에 적힌 순서대로 돌을 쌓으면 나만 완성할 수 있습니다.</p><p>문명 A는 지금까지 백·흑·흑입니다. 백돌을 하나 더 놓으면 마그나 카르타입니다.` },
  { kind:'fight', turn:3, title:'4턴: 출전', say:`문명 B와 C는 쉬는 중입니다. 상대에게 4턴 1위 기사단이 보이지만, 문명 A를 내보내세요.` },
  { kind:'result', title:'4턴: 대역전', say:`★ 마그나 카르타는 3위지만 1위 기사단을 잡습니다. 4턴 점수 2점을 얻었습니다.</p><p>다만 전투에 쓴 카드는 공개되어 다음부터 상대가 대비합니다.` },
  { kind:'info', title:'테크 러시', say:`지금까지는 문명마다 돌을 하나씩 놓았습니다. 실제 게임에서는 돌 3개를 한 문명에 몰아줘도 됩니다.</p><p>돌 개수가 그 문명의 시대이고, 돌이 많은 문명이 무조건 이깁니다. 대신 나머지 문명은 뒤처지고, 출전한 문명은 쉬어야 합니다.` },
  { kind:'info', title:'테크 능력', say:`1위가 아닌 족보로 출전하면 전투 뒤 능력이 발동합니다. 약한 족보일수록 능력이 셉니다.</p><p>승점을 얻거나, 상대 회색돌을 공개하거나, 상대 돌을 뒤집습니다. 전차 같은 군사 테크는 이기면 진 문명의 마지막 돌을 뒤집습니다. 족보표에서 능력을 확인하세요.` },
  { kind:'done', title:'이제 직접 해 보세요', say:`알아 둘 것은 이것뿐입니다.` },
];

let s = setup(), step = 0, pend = [], past = [];

const rankTag = rank => `<b class="rank ${rank === 1 ? 'top' : rank <= 3 ? 'high' : ''}">${rank}위</b>`;
const handLine = e => `${rankTag(e.rank)} <span class="hand-name">${e.name}</span>${e.special ? ' <span class="star">★</span>' : ''}`;
const dot = c => `<span class="dot ${c.toLowerCase()}"></span>`;
const artImg = (art, cls) => `<img class="${cls}" src="${art.file}" alt="${art.title}" loading="lazy" style="object-position:${art.pos ?? 'center'}">`;
const stoneClass = (color, kind) => `${color === 'B' ? 'b' : 'w'}${kind === 'G' ? ' from-gray' : ''}`;
const stoneHTML = (st, owner) => st.kind === 'G' && !st.revealed && owner === 1
  ? '<span class="stone hidden" role="img" aria-label="공개되지 않은 회색돌">?</span>'
  : `<span class="stone ${stoneClass(st.color, st.kind)}"></span>`;

function stock(p) {
  const st = s.players[p].stock, item = (c, n) => `<span class="stock-item">${dot(c)}<b>${n}</b></span>`;
  return `<p class="stock"><span>남은 돌</span>${item('B', st.B)}${item('W', st.W)}${item('G', st.GB + st.GW)}</p>`;
}

function civCard(owner, i, cur) {
  const civ = s.players[owner].civs[i], left = civ.bannedThrough - s.turn + 1, me = s.players[0];
  const hand = owner === 0 && civ.stones.length ? `<div class="info">${handLine(evaluate(civ.stones.length, colorsOf(civ), me.cards))}</div>` : '';
  let extra = '', pending = '';
  if (owner === 0 && cur.kind === 'place') {
    const k = SCRIPT[cur.turn].mine[i], [kind, color] = TOKENS[k], q = colorsOf(civ) + color, done = pend.includes(i);
    if (done) pending = `<span class="stone pending ${stoneClass(color, kind)}"></span>`;
    extra = `<div class="picks tut-pick"><button class="pick" data-act="place" data-i="${i}" aria-pressed="${done}">
      <span class="stone ${stoneClass(color, kind)}"></span>
      <span class="labels"><small>${kind === 'G' ? '회색, 속은 흑' : { B:'흑돌', W:'백돌' }[color]}</small> <span class="name">${handLine(evaluate(q.length, q, me.cards))}</span></span>
    </button></div>`;
  }
  if (owner === 0 && cur.kind === 'fight') {
    const go = i === SCRIPT[cur.turn].field, banned = left > 0;
    extra = `<button class="fight ${go ? 'primary' : ''}" data-act="field" data-i="${i}" ${go ? '' : 'disabled'}>${banned ? '출전 제한' : go ? '이 문명 출전' : '이번엔 다른 문명'}</button>`;
  }
  return `<article class="card ${left > 0 ? 'banned' : ''}">
    <div class="card-head"><strong>문명 ${LETTERS[i]}</strong>${left > 0 ? `<span class="tag off">출전 제한 ${left}턴</span>` : ''}</div>
    <div class="stones">${civ.stones.map(st => stoneHTML(st, owner)).join('')}${pending}${civ.stones.length || pending ? '' : '<span class="empty">돌 없음</span>'}</div>
    ${hand}${extra}
  </article>`;
}

function duel() {
  const h = s.history.at(-1), side = p => {
    const e = h.hands[p];
    return `<article class="card duel-card ${h.winner === p ? 'winner' : ''}">${artImg(HAND_ART[e.name], 'hand-art')}
      <div class="card-head"><strong>${['나', '상대'][p]} · 문명 ${LETTERS[h.fighters[p]]}</strong><span class="tag">${h.winner === p ? '승리' : h.winner === null ? '무승부' : '패배'}</span></div>
      <p class="hand-big">${handLine(e)}</p>
      <p class="muted">${e.why}</p>
    </article>`;
  };
  return `<div class="duel">${side(0)}${side(1)}</div>`;
}

function cardHTML(name) {
  const t = specialTurn(name), row = TABLES[t].find(r => r[2] === name);
  return `<article class="card tut-card">${artImg(HAND_ART[name], 'thumb')}<div>
    <p><strong>${name}</strong> <span class="star">★</span> <span class="tag">내 카드 · 돌 ${t}개</span></p>
    <p><span class="dots">${[...row[5]].map(dot).join('')}</span></p>
    <p class="beats">${TABLES[t].slice(0, row[6] ?? 1).map(r => r[2]).join(', ')}를 이긴다</p>
  </div></article>`;
}

function tableHTML(t) {
  const rows = TABLES[t].map((r, i) => [r, i + 1]).filter(([r]) => !r[4]);
  return `<details class="panel"><summary>${t}턴 족보표 (일반 족보)</summary><ol class="hand-list">${rows.map(([r, rank]) => `<li class="hand-row">${artImg(HAND_ART[r[2]], 'thumb')}<div class="hand-body">
    <div class="hand-title">${rankTag(rank)} <strong>${r[2]}</strong></div>
    <div class="hand-shape"><span class="dots">${[...'B'.repeat(r[0]) + 'W'.repeat(r[1])].map(dot).join('')}</span></div>
    <p class="why">${r[3]}</p></div></li>`).join('')}</ol></details>`;
}

function barHTML(cur) {
  const back = step ? '<button data-act="back">이전</button>' : '';
  if (cur.kind === 'done') return `<div class="tut-bar">${back}<a class="primary" href="index.html">게임 시작 화면으로</a></div>`;
  if (cur.kind === 'place') return `<div class="tut-bar">${back}<button class="primary" data-act="confirm" ${pend.length === 3 ? '' : 'disabled'}>돌 배치 확정 (${pend.length}/3)</button></div>`;
  if (cur.kind === 'fight') return `<div class="tut-bar">${back}</div>`;
  return `<div class="tut-bar">${back}<button class="primary" data-act="next">다음</button></div>`;
}

const DONE_LIST = `<ol class="rules">
  <li>매 턴 돌 3개를 문명들에 주고, 문명 하나를 내보냅니다. 돌을 몰아줘도 됩니다.</li>
  <li>돌이 많은 문명이 무조건 이깁니다. 돌 21개는 판마다 무작위로 뽑습니다.</li>
  <li>돌 개수가 같으면 족보표 위쪽일수록 강합니다. 같은 족보면 비기고, 점수는 다음 승부에 얹힙니다.</li>
  <li>1위가 아닌 족보로 출전하면 테크 능력이 발동합니다.</li>
  <li>이긴 문명은 2턴, 지거나 비긴 문명은 1턴 쉽니다.</li>
  <li>승리 점수는 1~3턴 1점, 4~6턴 2점, 7턴 3점입니다. 동점이면 마지막 전투 승자가 이깁니다.</li>
  <li>회색돌로 족보를 숨기고, 불가사의 카드로 상위 족보를 잡으세요.</li>
</ol><p class="muted">시작 화면의 봇과 대전에서 일곱 턴을 끝까지 해 보세요.</p>`;

function render() {
  const cur = STEPS[step], showTurn = cur.kind === 'place' || cur.kind === 'fight' ? cur.turn + 1 : Math.min(s.turn, LAST_TURN);
  app.innerHTML = `<div class="tut-top"><span>튜토리얼 ${step + 1}/${STEPS.length} · 나 <b>${s.players[0].score}</b>점 : <b>${s.players[1].score}</b>점 상대</span><a href="index.html">나가기</a></div>
    <section class="panel coach"><h1>${cur.title}</h1><p>${cur.say}</p>${cur.kind === 'done' ? DONE_LIST : ''}</section>
    ${cur.card ? cardHTML(cur.card) : ''}
    ${cur.kind === 'result' ? duel() : ''}
    ${cur.kind === 'done' ? '' : `<h2 class="sub">내 문명</h2>${stock(0)}<div class="cards mine">${[0,1,2].map(i => civCard(0, i, cur)).join('')}</div>
      <h2 class="sub">상대 문명</h2><div class="cards">${[0,1,2].map(i => civCard(1, i, cur)).join('')}</div>`}
    ${barHTML(cur)}
    ${cur.kind === 'place' || cur.kind === 'fight' ? tableHTML(showTurn) : ''}`;
}

function advance() { past.push({ s, pend }); step++; pend = []; }

const actions = {
  next() { advance(); },
  back() { ({ s, pend } = past.pop()); step--; },
  place({ i }) { const c = Number(i); pend = pend.includes(c) ? pend.filter(x => x !== c) : [...pend, c]; },
  confirm() { const t = SCRIPT[STEPS[step].turn], before = s; advance(); s = placeStones(before, [spread(t.mine), spread(t.foe)]); },
  field() { const t = SCRIPT[STEPS[step].turn], before = s; advance(); s = fightTurn(before, [t.field, t.foeField]); },
};

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  actions[b.dataset.act](b.dataset);
  render();
  window.scrollTo(0, 0);
});

render();

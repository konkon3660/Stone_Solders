// 순수 게임 규칙. DOM을 모른다. 프로토타입이 끝나면 이 블록만 실제 구현으로 옮긴다.
// 돌 색은 'B'(흑), 'W'(백). 돌 종류는 'B', 'W', 'G'(회색).
// 배치 토큰: 'B' 흑돌, 'W' 백돌, 'GB' 속이 흑인 회색돌, 'GW' 속이 백인 회색돌.
const LAST_TURN = 7;
const STOCK = 7;      // 처음에 흑, 백, 회색을 7개씩 받아 일곱 턴 동안 나눠 쓴다
const HAND_CARDS = 2; // 불가사의 카드를 2장씩 비밀로 받는다

// 턴별 족보표, 강한 순서: [흑 개수, 백 개수, 족보 이름, 이유, 불가사의의 순서 규칙, 화면에 그릴 모양, 이기는 상위 족보 수(기본 1)]
// 시대마다 기술이 바뀐다. 흑은 군사 기술, 백은 학문과 문화, 섞이면 제도와 경제.
// ★ 불가사의는 그 카드를 가진 사람만 완성한다. 카드가 없으면 같은 돌도 같은 개수의 일반 족보다.
// 모양 표기: B와 W는 돌, []는 순서 무관, | 뒤는 덧붙이는 설명.
const TABLES = {
  1: [
    [1,0,'돌창','날카로운 돌로 사냥감과 적을 먼저 쓰러뜨린다'],
    [0,1,'불','밤을 밝혔지만 맞서 싸울 무기가 없다'],
  ],
  2: [
    [1,1,'농경','힘으로 땅을 지키고 지혜로 씨를 뿌려 가장 크게 정착했다'],
    [2,0,'청동검','단단한 무기를 가졌지만 먹여 살릴 땅이 없다'],
    [0,2,'문자','기록을 남기기 시작했지만 지킬 힘이 없다'],
  ],
  3: [
    [2,1,'법전','철의 힘에 규칙을 더해 나라를 다스린다'],
    [3,0,'전차','힘은 세지만 다스릴 법이 없다'],
    [1,2,'대도서관','왕이 세운 도서관에 지식이 연달아 쌓여 어떤 법전보다 앞선다',/^BWW$/,'BWW'],
    [1,2,'화폐','부를 쌓았지만 군대가 작다'],
    [2,1,'트로이 목마','선물인 척 성에 들어간 뒤 군사가 연달아 쏟아진다',/^WBB$/,'WBB',2],
    [0,3,'철학','묻고 따지기만 하고 결정하지 못한다'],
  ],
  4: [
    [4,0,'기사단','갑옷 입은 기사들이 모든 땅을 지배한다'],
    [3,1,'봉건제','영주들이 땅과 기사를 나눠 가져 왕의 힘이 약하다'],
    [2,2,'마그나 카르타','백성과 귀족이 왕을 앞뒤로 묶어 기사의 힘을 누른다',/^WBBW$/,'WBBW'],
    [2,2,'길드','장인과 상인이 손잡았지만 결속이 약하다'],
    [1,3,'대학','학문은 꽃피지만 지킬 힘이 모자란다'],
    [1,3,'인쇄기','한 대의 기계가 지식을 연달아 찍어 내 기사와 영주의 시대를 끝낸다',/^BWWW$/,'BWWW',2],
    [3,1,'만리장성','백성이 쌓은 성벽 위에 군대가 늘어서 기사의 돌격을 막는다',/^WBBB$/,'WBBB'],
    [0,4,'수도원','기도와 필사만 하고 칼을 들지 않는다'],
  ],
  5: [
    [3,2,'무적함대','함대의 힘과 무역의 부를 모두 갖췄다'],
    [2,3,'동인도 회사','부유하지만 군대가 조금 모자란다'],
    [4,1,'다빈치 공방','천재가 전쟁 기계를 연달아 설계해 무적함대보다 앞선다',/^BBB/,'BBB[BW]'],
    [4,1,'머스킷 부대','총은 많지만 재정이 버티지 못한다'],
    [5,0,'성형 요새','지킬 뿐 뻗어 나가지 못한다'],
    [0,5,'자유 무역항','부유하지만 군대가 없다'],
    [1,4,'종교개혁','말씀이 연달아 퍼져 가장 강한 제국을 흔든다',/^WWW/,'WWW[WB]'],
    [2,3,'세계 일주','바다를 번갈아 건너 세계를 한 바퀴 돌아 바다의 두 강자를 앞선다',/^WBWBW$/,'WBWBW',2],
    [3,2,'지동설','하늘과 땅이 번갈아 돈다는 것을 밝혀 두 강국의 세계관을 뒤집는다',/^BWBWB$/,'BWBWB',2],
    [1,4,'플랜테이션','번영을 남에게 빼앗긴다'],
  ],
  6: [
    [4,2,'증기기관','기계의 힘에 개혁을 더해 공장과 노동자를 함께 붙잡았다'],
    [5,1,'철갑선','강철로 무장했지만 민심이 곧 폭발한다'],
    [6,0,'기관총','쏘기만 하고 다스리지 못한다'],
    [3,3,'인권 선언','권력이 쌓인 끝에 자유가 연달아 터져 공장의 질서를 뒤집는다',/WW$/,'[BBBW]WW'],
    [3,3,'노동조합','자본과 노동이 둘로 갈려 결단을 내리지 못한다'],
    [0,6,'백과사전','지식은 넘치지만 지킬 군대가 없다'],
    [2,4,'여성 참정권','목소리를 연달아 높인 끝에 마지막으로 힘을 얻는다',/B$/,'[BWWWW]B'],
    [4,2,'대륙 횡단 철도','레일을 먼저 깔고 기관차가 연달아 달려 증기기관의 힘을 대륙 끝까지 퍼뜨린다',/^WWBBBB$/,'WWBBBB'],
    [5,1,'에펠탑','하나의 설계에 강철을 쏟아부어 산업 시대의 강자 셋을 내려다본다',/^WBBBBB$/,'WBBBBB',3],
    [2,4,'신문','목소리는 크지만 집행할 힘이 없다'],
    [1,5,'러다이트','기계를 부수지만 아무것도 세우지 못한다'],
  ],
  7: [
    [0,7,'인터넷','모든 지식이 모두에게 열린 문명의 정점'],
    [7,0,'핵무기','하나의 힘으로 모든 것을 멈출 수 있는 문명의 정점'],
    [3,4,'인공지능','자유로운 지식을 질서 있게 조직했다'],
    [2,5,'실리콘밸리','아이디어는 넘치지만 제각각 흩어져 있다'],
    [1,6,'가짜 뉴스','인터넷에 돌 하나가 모자라 거짓이 퍼진다'],
    [4,3,'냉전','둘로 갈라져 버티지만 앞으로 나아가지 못한다'],
    [2,5,'아폴로 계획','로켓의 힘에 과학을 연달아 실어 지구의 두 정점을 내려다본다',/^BBWWWWW$/,'BBWWWWW',2],
    [5,2,'허블 망원경','양 끝의 렌즈 사이에 거대한 장치를 세워 두 정점보다 멀리 본다',/^WBBBBBW$/,'WBBBBBW',2],
    [5,2,'감시 국가','통제가 창의를 죽였다'],
    [4,3,'스톤헨지','처음과 끝이 맞물린 돌의 원 앞에서는 어떤 정점도 시간에 무너진다',/^(B.*B|W.*W)$/,'[BBBBWWW]|처음과 끝이 같은 색',3],
    [6,1,'핵겨울','핵무기에 돌 하나가 모자라 모두가 얼어붙었다'],
  ],
};
const ERAS = {
  1: ['석기 시대','돌을 깎아 무기를 든 무리가 먼저 일어선 시대.'],
  2: ['청동기 시대','힘과 지혜를 합친 무리가 먼저 땅에 정착한 시대.'],
  3: ['철기 시대','철의 힘에 다스리는 지혜가 더해져야 오래가는 시대.'],
  4: ['중세','성과 기사, 강한 군사력이 땅을 지배한 시대.'],
  5: ['대항해 시대','함대의 힘과 무역의 부를 함께 가진 나라가 바다를 지배한 시대.'],
  6: ['산업 시대','기계의 힘에 개혁을 더한 나라가 앞서는 시대.'],
  7: ['정보 시대','한 길을 끝까지 판 문명이 정점에 서는 시대.'],
};
const POINTS = [0, 1, 1, 1, 2, 2, 2, 3];
const TOKENS = { B:['B','B'], W:['W','W'], GB:['G','B'], GW:['G','W'] }; // 토큰: [돌 종류, 실제 색]
const TOKEN_KEYS = Object.keys(TOKENS);
const SPECIALS = Object.values(TABLES).flat().filter(row => row[4]).map(row => row[2]);

const pointsFor = t => POINTS[t];
const specialTurn = name => Number(Object.keys(TABLES).find(t => TABLES[t].some(row => row[2] === name)));
const countBlack = seq => [...seq].filter(c => c === 'B').length;
const colorsOf = civ => civ.stones.map(st => st.color).join('');
const publicSeq = civ => civ.stones.map(st => st.kind === 'G' && !st.revealed ? '?' : st.color).join('');
const legalFighters = (s, p) => [0,1,2].filter(i => s.players[p].civs[i].bannedThrough < s.turn);
const plainIndex = (t, black) => TABLES[t].findIndex(row => !row[4] && row[0] === black);
const canPlace = (stock, assign) => Array.isArray(assign) && assign.length === 3 && assign.every(k => TOKEN_KEYS.includes(k))
  && TOKEN_KEYS.every(k => assign.filter(x => x === k).length <= stock[k]);
// 전투에서 이미 드러난 불가사의 카드.
const shownCards = (s, p) => s.players[p].cards.filter(c => s.history.some(h => h.hands[p].name === c));

// cards: 이 문명 주인이 가진 불가사의 카드 이름들.
function evaluate(t, seq, cards = []) {
  const black = countBlack(seq), specialIndex = TABLES[t].findIndex(row => row[0] === black && row[4]?.test(seq) && cards.includes(row[2]));
  const special = specialIndex >= 0, i = special ? specialIndex : plainIndex(t, black), row = TABLES[t][i];
  return { black, white: seq.length - black, rank: i + 1, name: row[2], why: row[3], special, beats: special ? row[6] ?? 1 : 0 };
}

// 0: a 승, 1: b 승, null: 무승부. 불가사의는 정해진 상위 족보를 이기고, 나머지는 순위대로.
function versus(ea, eb) {
  if (eb.rank <= ea.beats) return 0;
  if (ea.rank <= eb.beats) return 1;
  return ea.rank === eb.rank ? null : ea.rank < eb.rank ? 0 : 1;
}
const compareHands = (t, a, b, ca = [], cb = []) => versus(evaluate(t, a, ca), evaluate(t, b, cb));

// '?'를 흑과 백으로 채운 모든 경우.
const fills = pattern => [...pattern].reduce((all, c) => all.flatMap(seq => c === '?' ? [seq + 'B', seq + 'W'] : [seq + c]), ['']);

// 아는 돌 순서로 이번 턴에 가능한 족보 범위. 아직 안 놓은 돌과 숨은 회색돌은 '?'로 본다.
function possibleHands(t, known, cards = []) {
  const hands = fills(known.padEnd(t, '?')).map(seq => evaluate(t, seq, cards)).sort((a, b) => a.rank - b.rank);
  return { best:hands[0], worst:hands.at(-1), specials:[...new Set(hands.filter(h => h.special).map(h => h.name))] };
}

function newGame(rng = Math.random) {
  const deck = SPECIALS.map(name => [rng(), name]).sort((a, b) => a[0] - b[0]).map(([, name]) => name);
  const player = p => {
    const GB = Array.from({ length:STOCK }, () => rng()).filter(x => x < 0.5).length;
    return { score:0, stock:{ B:STOCK, W:STOCK, GB, GW:STOCK - GB }, cards:deck.slice(p * HAND_CARDS, (p + 1) * HAND_CARDS), civs:[0,1,2].map(() => ({ stones:[], bannedThrough:0 })) };
  };
  return { turn:1, stage:'assign', over:false, players:[player(0), player(1)], history:[] };
}

// 1단계: 양쪽 돌 배치. assigns[p] = [문명 A, B, C가 받을 토큰].
function placeStones(prev, assigns) {
  const s = structuredClone(prev);
  assigns.forEach((assign, p) => {
    const pl = s.players[p];
    if (!canPlace(pl.stock, assign)) throw new Error('돌 배분 오류');
    assign.forEach((token, i) => {
      const [kind, color] = TOKENS[token];
      pl.stock[token]--;
      pl.civs[i].stones.push({ kind, color, revealed:kind !== 'G' });
    });
  });
  s.stage = 'fight';
  return s;
}

// 2단계: 배치를 본 뒤 출전과 전투. fighters[p] = 문명 번호. 이긴 문명은 2턴, 지거나 비긴 문명은 1턴 쉰다.
function fightTurn(prev, fighters) {
  const s = structuredClone(prev), t = s.turn;
  fighters.forEach((fighter, p) => {
    if (!legalFighters(s, p).includes(fighter)) throw new Error('출전 불가 문명');
    s.players[p].civs[fighter].stones.forEach(st => { st.revealed = true; });
  });
  const seqs = fighters.map((fighter, p) => colorsOf(s.players[p].civs[fighter]));
  const hands = seqs.map((q, p) => evaluate(t, q, s.players[p].cards));
  const winner = versus(hands[0], hands[1]);
  if (winner !== null) s.players[winner].score += pointsFor(t);
  fighters.forEach((fighter, p) => { s.players[p].civs[fighter].bannedThrough = t + (p === winner ? 2 : 1); });
  s.history.push({ turn:t, fighters:[...fighters], seqs, hands, winner });
  s.turn++;
  s.stage = 'assign';
  s.over = s.turn > LAST_TURN;
  return s;
}

// 최종 승자. 동점이면 마지막으로 전투에서 이긴 쪽, 그것도 없으면 무승부(null).
function winnerOf(s) {
  const [a, b] = s.players.map(p => p.score);
  if (a !== b) return a > b ? 0 : 1;
  return s.history.findLast(h => h.winner !== null)?.winner ?? null;
}

const OPTIONS = TOKEN_KEYS.flatMap(a => TOKEN_KEYS.flatMap(b => TOKEN_KEYS.map(c => [a, b, c])));

// 봇이 족보의 쓸모를 잴 때 쓰는 값: 그 턴 일반 족보를 상대로 이기는 비율(비기면 절반).
// 내 카드의 불가사의는 상대 정점을 잡으려고 노리므로 어떤 일반 족보보다 높게 친다.
function handValue(t, seq, cards) {
  const e = evaluate(t, seq, cards), plain = TABLES[t].map((row, i) => ({ row, rank:i + 1, beats:0 })).filter(x => !x.row[4]);
  const v = plain.reduce((sum, x) => { const r = versus(e, x); return sum + (r === 0 ? 1 : r === null ? 0.5 : 0); }, 0) / plain.length;
  return e.special ? 1 : v;
}

// 지금 돌 순서에서 u턴까지 닿을 수 있는 가장 좋은 족보의 가치. 남은 흑, 백 개수 안에서만 채운다.
const reachMemo = new Map();
function reachValue(u, seq, cards, maxB, maxW) {
  const key = `${u}:${seq}:${cards}:${maxB}:${maxW}`;
  if (!reachMemo.has(key)) {
    const need = u - seq.length, have = countBlack(seq);
    const ok = fills(seq.padEnd(u, '?')).filter(q => { const b = countBlack(q) - have; return b <= maxB && need - b <= maxW; });
    reachMemo.set(key, Math.max(0, ...ok.map(q => handValue(u, q, cards))));
  }
  return reachMemo.get(key);
}

// 상대 카드 추정: 드러난 카드는 확실히, 모르는 카드는 장마다 같은 확률로 쥐었다고 본다.
function cardGuess(s, p) {
  const shown = shownCards(s, p), unknown = SPECIALS.filter(n => !shown.includes(n) && !s.players[1 - p].cards.includes(n));
  return { shown, unknown, chance:(HAND_CARDS - shown.length) / unknown.length };
}

// 내 문명 i가 상대 문명 j와 붙을 때의 기대 승패(+1, 0, -1). 상대의 '?'는 반반으로, 상대가 모르는 카드를 쥐었을 확률도 섞는다.
const edgeMatrix = (t, mine, myCards, theirs, guess) => mine.map(seq => {
  const e = evaluate(t, seq, myCards), score = r => r === 0 ? 1 : r === 1 ? -1 : 0;
  return theirs.map(pattern => {
    const qs = fills(pattern);
    return qs.reduce((sum, q) => {
      const plain = score(versus(e, evaluate(t, q, guess.shown))), hidden = evaluate(t, q, guess.unknown);
      return sum + (hidden.special ? (1 - guess.chance) * plain + guess.chance * score(versus(e, hidden)) : plain);
    }, 0) / qs.length;
  });
});

// 상대가 가장 잘 받아쳐도 보장되는 기대값과 그 혼합 전략(행 3개 이하, 격자 탐색).
function maximin(A) {
  const value = p => Math.min(...A[0].map((_, j) => A.reduce((sum, row, i) => sum + p[i] * row[j], 0)));
  let best = { v:-Infinity, p:null };
  const consider = p => { const v = value(p); if (v > best.v + 1e-9) best = { v, p }; };
  const N = 24;
  if (A.length === 1) consider([1]);
  else if (A.length === 2) for (let a = 0; a <= N; a++) consider([a / N, 1 - a / N]);
  else for (let a = 0; a <= N; a++) for (let b = 0; a + b <= N; b++) consider([a / N, b / N, (N - a - b) / N]);
  return best;
}

// ponytail: 이번 턴은 맞대결 계산, 이후 턴은 문명마다 닿을 수 있는 족보만 본다. 세 문명이 돌을 나눠 쓰는 경쟁은 대충만 반영.
// 공개 정보만 본다: 상대 회색돌은 '?', 상대 카드는 드러난 것만.
function botAssign(s, p, rng = Math.random) {
  const t = s.turn, me = s.players[p], them = s.players[1 - p];
  const theirs = legalFighters(s, 1 - p).map(j => publicSeq(them.civs[j]) + '?'), guess = cardGuess(s, 1 - p);
  let best = null, bestScore = -Infinity;
  for (const assign of OPTIONS) {
    if (!canPlace(me.stock, assign)) continue;
    const seqs = me.civs.map((civ, i) => colorsOf(civ) + TOKENS[assign[i]][1]), left = { ...me.stock };
    assign.forEach(k => { left[k]--; });
    const maxB = left.B + left.GB, maxW = left.W + left.GW;
    let score = maximin(edgeMatrix(t, legalFighters(s, p).map(i => seqs[i]), me.cards, theirs, guess)).v * pointsFor(t);
    for (let u = t + 1; u <= LAST_TURN; u++) seqs.forEach((seq, i) => {
      if (me.civs[i].bannedThrough < u) score += 0.2 * pointsFor(u) * reachValue(u, seq, me.cards, maxB, maxW);
    });
    score += rng() * 0.2;
    if (score > bestScore) { bestScore = score; best = assign; }
  }
  return best;
}

// 상대가 가장 잘 받아친다고 보고 혼합 전략으로 고른다. 출전한 문명이 다음 턴에 쉬는 손해도 센다.
function botFight(s, p, rng = Math.random) {
  const t = s.turn, me = s.players[p], them = s.players[1 - p], mine = legalFighters(s, p);
  const maxB = me.stock.B + me.stock.GB, maxW = me.stock.W + me.stock.GW;
  const A = edgeMatrix(t, mine.map(i => colorsOf(me.civs[i])), me.cards, legalFighters(s, 1 - p).map(j => publicSeq(them.civs[j])), cardGuess(s, 1 - p))
    .map((row, k) => {
      const cost = t < LAST_TURN ? 0.2 * pointsFor(t + 1) * reachValue(t + 1, colorsOf(me.civs[mine[k]]), me.cards, maxB, maxW) : 0;
      return row.map(x => x * pointsFor(t) - cost);
    });
  const { p: mix } = maximin(A);
  let x = rng();
  for (let k = 0; k < mix.length; k++) { x -= mix[k]; if (x <= 0) return mine[k]; }
  return mine.at(-1);
}

// 상대에게 보낼 상태. p의 숨은 회색돌 색, 남은 회색돌의 속 색, 아직 안 드러난 카드를 지운다.
function maskFor(prev, p) {
  const s = structuredClone(prev);
  if (s.over) return s;
  const pl = s.players[p], shown = shownCards(s, p);
  pl.stock = { B:pl.stock.B, W:pl.stock.W, G:pl.stock.GB + pl.stock.GW };
  pl.cards = pl.cards.map(c => shown.includes(c) ? c : '?');
  pl.civs.forEach(civ => civ.stones.forEach(st => { if (st.kind === 'G' && !st.revealed) st.color = '?'; }));
  return s;
}

// 네트워크로 받은 상태 점검. 화면에 그리기 전에 모양과 값을 확인한다. 전투 기록의 족보는 받는 쪽이 다시 계산한다.
function isValidView(v) {
  const int = Number.isInteger, count = n => int(n) && n >= 0 && n <= STOCK;
  const stoneOk = st => ['B','W','G'].includes(st?.kind) && ['B','W','?'].includes(st.color) && typeof st.revealed === 'boolean';
  const civOk = civ => int(civ?.bannedThrough) && Array.isArray(civ.stones) && civ.stones.length <= LAST_TURN && civ.stones.every(stoneOk);
  const stockOk = st => count(st?.B) && count(st.W) && (count(st.G) || count(st.GB) && count(st.GW));
  const cardsOk = cs => Array.isArray(cs) && cs.length === HAND_CARDS && cs.every(c => c === '?' || SPECIALS.includes(c));
  const playerOk = p => int(p?.score) && stockOk(p.stock) && cardsOk(p.cards) && Array.isArray(p.civs) && p.civs.length === 3 && p.civs.every(civOk);
  const fightOk = h => int(h?.turn) && h.turn >= 1 && h.turn <= LAST_TURN && [0, 1, null].includes(h.winner)
    && Array.isArray(h.fighters) && h.fighters.length === 2 && h.fighters.every(f => [0,1,2].includes(f))
    && Array.isArray(h.seqs) && h.seqs.length === 2 && h.seqs.every(q => typeof q === 'string' && q.length === h.turn && /^[BW]+$/.test(q));
  return !!v && int(v.turn) && v.turn >= 1 && v.turn <= LAST_TURN + 1 && ['assign','fight'].includes(v.stage) && typeof v.over === 'boolean'
    && Array.isArray(v.players) && v.players.length === 2 && v.players.every(playerOk)
    && Array.isArray(v.history) && v.history.every(fightOk);
}

function selfCheck() {
  const eq = (actual, expected, label) => { if (actual !== expected) throw new Error(`규칙 점검 실패: ${label}`); };
  const plain = (b, w) => 'B'.repeat(b) + 'W'.repeat(w);
  for (let t = 1; t <= LAST_TURN; t++) {
    const rows = TABLES[t], plainRows = rows.filter(row => !row[4]), specials = rows.filter(row => row[4]);
    eq(new Set(plainRows.map(row => row[0])).size, t + 1, `${t}턴 조합 수`);
    eq(plainRows.length, t + 1, `${t}턴 일반 족보 수`);
    rows.forEach(row => eq(row[0] + row[1], t, `${t}턴 ${row[2]} 돌 개수`));
    eq(specials.length > 0, t >= 3, `${t}턴 불가사의 유무`);
    for (const row of specials) {
      const name = row[2], beats = row[6] ?? 1, matches = fills('?'.repeat(t)).filter(seq => evaluate(t, seq, [name]).name === name);
      eq(matches.length > 0, true, `${name}을 만들 수 있음`);
      eq(rows.slice(0, beats).every(top => !top[4]) && rows.indexOf(row) >= beats, true, `${name}이 잡는 상위 족보는 일반 족보`);
      for (const seq of matches) {
        eq(evaluate(t, seq).name, rows[plainIndex(t, row[0])][2], `${name} 카드가 없으면 일반 족보`);
        for (const top of rows.slice(0, beats)) eq(compareHands(t, seq, plain(top[0], top[1]), [name]), 0, `${name}이 ${top[2]}를 이김`);
        eq(plainRows.some(other => compareHands(t, seq, plain(other[0], other[1]), [name]) === 1), true, `${name}도 지는 족보가 있음`);
      }
    }
    for (const [b, w] of plainRows) if (b > w && t < LAST_TURN) eq(plainIndex(t, b) < plainIndex(t, w), true, `${t}턴 흑 우세`);
  }
  for (const [b, w] of TABLES[7].filter(row => !row[4])) if (w > b) eq(plainIndex(7, b) < plainIndex(7, w), true, '7턴 백 우세');
  for (const t of [5, 6]) eq(plainIndex(t, 0) === TABLES[t].length - 1, false, `${t}턴 백 몰빵은 꼴찌가 아님`);
  eq(SPECIALS.length, 16, '불가사의 16장');
  eq(compareHands(1, 'B', 'W'), 0, '1턴 흑 승');
  eq(compareHands(1, 'B', 'B'), null, '같은 족보 무승부');
  eq(compareHands(3, 'BWW', 'WWB', ['대도서관']), 0, '카드가 있으면 불가사의가 같은 조합을 이김');
  eq(compareHands(3, 'BWW', 'WWB'), null, '카드가 없으면 같은 일반 족보');
  eq(compareHands(3, 'WBB', 'BBW', ['트로이 목마']), 0, '트로이 목마가 법전을 잡음');
  eq(compareHands(3, 'WBB', 'WWB', ['트로이 목마']), 1, '트로이 목마는 화폐에 짐');
  eq(compareHands(7, 'WWWWWWW', 'BBBBBBB'), 0, '7턴 백 7이 최강');
  eq(compareHands(7, 'BWWBWBB', 'BBBWWWW', ['스톤헨지']), 0, '스톤헨지이 인공지능을 이김');
  eq(compareHands(7, 'BBWWWWW', 'BWWBWBB', [], ['스톤헨지']), 0, '실리콘밸리가 스톤헨지을 이김');
  eq(compareHands(7, 'BBBBWWW', 'BWWBWBB', [], ['스톤헨지']), 0, '냉전도 스톤헨지을 이김');
  eq(evaluate(7, 'BBBWWBW', ['스톤헨지']).name, '냉전', '처음과 끝이 다르면 일반 족보');
  eq(evaluate(5, 'WWWBW', ['종교개혁']).name, '종교개혁', '종교개혁은 뒤 두 돌 순서 무관');
  eq(evaluate(5, 'WWBWW', ['종교개혁']).name, '플랜테이션', '흑이 앞쪽이면 플랜테이션');
  eq(possibleHands(3, 'B?', ['대도서관']).specials[0], '대도서관', '가능한 불가사의 표시');
  // 0번은 대도서관와 트로이 목마 카드, 회색돌은 모두 속이 흑.
  const g = newGame(() => 0);
  eq(g.players[0].cards.join(), '대도서관,트로이 목마', '카드 나눠 주기');
  eq((() => { try { placeStones(g, [['GW','B','W'], ['B','W','GB']]); return false; } catch { return true; } })(), true, '없는 돌은 못 놓음');
  let s = placeStones(g, [['B','W','GB'], ['B','B','B']]);
  eq(s.stage === 'fight' && s.players[0].stock.GB === 6 && s.players[1].stock.B === 4, true, '1턴도 전투, 남은 돌 줄어듦');
  const masked = maskFor(s, 0);
  eq(masked.players[0].civs[2].stones[0].color, '?', '상대 회색돌 색 가림');
  eq(masked.players[0].stock.G === 6 && masked.players[0].stock.GB === undefined, true, '상대 남은 회색돌 속 색 가림');
  eq(masked.players[0].cards.join(), '?,?', '상대 카드 가림');
  eq(masked.players[1].cards.join(), '마그나 카르타,인쇄기', '내 카드 유지');
  eq(isValidView(masked), true, '가린 상태는 유효');
  eq(isValidView({ ...masked, turn:'<b>' }), false, '잘못된 상태 거부');
  eq(isValidView({ ...masked, players:[{ ...masked.players[0], cards:['<img>', '?'] }, masked.players[1]] }), false, '없는 카드 이름 거부');
  s = fightTurn(s, [1, 0]);
  eq(s.history[0].winner === 1 && s.players[1].civs[0].bannedThrough === 3 && s.players[0].civs[1].bannedThrough === 2, true, '이긴 문명은 2턴, 진 문명은 1턴 쉼');
  s = fightTurn(placeStones(s, [['W','W','B'], ['W','W','W']]), [2, 1]);
  s = fightTurn(placeStones(s, [['W','B','B'], ['B','B','B']]), [0, 2]);
  eq(s.history[2].hands[0].name === '대도서관' && s.history[2].winner === 0, true, '대도서관 카드로 법전을 이김');
  eq(maskFor(s, 0).players[0].cards.join(), '대도서관,?', '쓴 카드는 공개');
  eq(winnerOf({ players:[{ score:3 }, { score:3 }], history:[{ winner:1 }, { winner:0 }, { winner:null }] }), 0, '동점이면 마지막 전투 승자');
}
selfCheck();

// 순수 게임 규칙. DOM을 모른다. 프로토타입이 끝나면 이 블록만 실제 구현으로 옮긴다.
// 돌 색은 'B'(흑), 'W'(백). 돌 종류는 'B', 'W', 'G'(회색).
// 배치 토큰: 'B' 흑돌, 'W' 백돌, 'GB' 속이 흑인 회색돌, 'GW' 속이 백인 회색돌.
const LAST_TURN = 7;
const STOCK = 7;      // 처음에 흑, 백, 회색을 7개씩 받아 일곱 턴 동안 나눠 쓴다
const HAND_CARDS = 2; // 특수 족보 카드를 2장씩 비밀로 받는다

// 턴별 족보표, 강한 순서: [흑 개수, 백 개수, 족보 이름, 이유, 특수 족보의 순서 규칙, 화면에 그릴 모양, 이기는 상위 족보 수(기본 1)]
// ★ 특수 족보는 그 카드를 가진 사람만 완성한다. 카드가 없으면 같은 돌도 같은 개수의 일반 족보다.
// 모양 표기: B와 W는 돌, []는 순서 무관, | 뒤는 덧붙이는 설명.
const TABLES = {
  1: [
    [1,0,'족장','힘으로 무리를 이끈다'],
    [0,1,'유랑민','자유롭지만 따르는 이가 없다'],
  ],
  2: [
    [1,1,'부족 연맹','힘과 자유를 합쳐 가장 크다'],
    [2,0,'약탈 부족','강하지만 홀로 싸운다'],
    [0,2,'작은 마을','평화롭지만 지킬 힘이 없다'],
  ],
  3: [
    [2,1,'왕국','왕의 권력에 백성의 지지까지 얻었다'],
    [3,0,'폭군','힘은 세지만 민심이 없다'],
    [1,2,'시민 봉기','왕이 섰지만 자유가 연달아 쌓여 왕을 끌어내린다',/^BWW$/,'BWW'],
    [1,2,'도시국가','자유롭지만 나라가 작다'],
    [2,1,'궁정 쿠데타','백성이 세운 왕을 귀족이 연달아 끌어내린다',/^WBB$/,'WBB',2],
    [0,3,'중우정치','말만 많고 결정하지 못한다'],
  ],
  4: [
    [4,0,'절대왕정','모든 권력이 왕에게 모였다'],
    [3,1,'군사정권','군대로 다스리지만 정통성이 약하다'],
    [2,2,'헌법 제정','자유가 권력을 앞뒤로 감싸 왕권을 묶는다',/^WBBW$/,'WBBW'],
    [2,2,'느슨한 연방','균형은 있지만 결속이 약하다'],
    [1,3,'허약한 정부','권력이 모자라 명령이 먹히지 않는다'],
    [1,3,'망명 정부','쫓겨난 왕실이 밖에서 세력을 모아 돌아온다',/^BWWW$/,'BWWW',2],
    [3,1,'친위 쿠데타','왕의 근위대가 왕을 갈아치운다',/^WBBB$/,'WBBB'],
    [0,4,'무정부 상태','국가의 시대에 국가가 없다'],
  ],
  5: [
    [3,2,'대제국','군사력과 번영을 모두 갖췄다'],
    [2,3,'상업 제국','부유하지만 군대가 조금 모자란다'],
    [4,1,'제국 분열','권력을 쌓은 제국 안에서 자유가 터져 나라가 갈라진다',/^BBB/,'BBB[BW]'],
    [4,1,'군사 제국','군대뿐이라 재정이 버티지 못한다'],
    [5,0,'요새 국가','지킬 뿐 뻗어 나가지 못한다'],
    [0,5,'중립 도시','부유하지만 군대가 없다'],
    [1,4,'독립 전쟁','오랜 식민지가 막판에 무기를 든다',/^WWW/,'WWW[WB]'],
    [2,3,'해상 동맹','작은 도시들이 번갈아 손잡아 바다를 지배한다',/^WBWBW$/,'WBWBW',2],
    [3,2,'용병 반란','제국이 고용한 용병이 칼끝을 돌린다',/^BWBWB$/,'BWBWB',2],
    [1,4,'식민지','번영을 제국에 빼앗긴다'],
  ],
  6: [
    [4,2,'개혁 군주','혁명이 터지기 전에 스스로 개혁한다'],
    [5,1,'계엄 정권','힘으로 버티지만 민심이 곧 폭발한다'],
    [6,0,'공포 정치','공포로만 다스린다'],
    [3,3,'대혁명','권력을 쌓은 나라에 자유가 연달아 터져 뒤집힌다',/WW$/,'[BBBW]WW'],
    [3,3,'과도 정부','둘로 갈려 결단을 내리지 못한다'],
    [0,6,'해방구','자유롭지만 지킬 군대가 없다'],
    [2,4,'왕의 처형','의회가 막판에 권력을 쥐고 왕을 처형한다',/B$/,'[BWWWW]B'],
    [4,2,'반혁명','혁명 세력을 먼저 쓸어 내고 왕정이 돌아온다',/^WWBBBB$/,'WWBBBB'],
    [5,1,'황제 즉위','혁명의 자식이 황제가 되어 모든 왕관을 꺾는다',/^WBBBBB$/,'WBBBBB',3],
    [2,4,'무력한 의회','이상은 크지만 집행할 힘이 없다'],
    [1,5,'폭도 정권','아무도 통제하지 못한다'],
  ],
  7: [
    [0,7,'절대자유','모든 시민이 완전히 자유로운 문명의 정점'],
    [7,0,'절대권력','하나의 의지로 움직이는 문명의 정점'],
    [3,4,'초지능사회','자유로운 지식을 질서 있게 조직했다'],
    [2,5,'지식사회','지식은 풍부하지만 조직력이 덜하다'],
    [1,6,'미완의 자유','절대자유에 돌 하나가 모자란다'],
    [4,3,'문명의 순환','역사가 돌고 돌아 처음으로 돌아오면 어떤 정점도 무너진다',/^(B.*B|W.*W)$/,'[BBBBWWW]|처음과 끝이 같은 색',3],
    [4,3,'낡은 질서','안정적이지만 시대에 뒤처졌다'],
    [2,5,'특이점','기계 지능이 두 정점을 앞지른다',/^BBWWWWW$/,'BBWWWWW',2],
    [5,2,'디스토피아','자유를 내건 통제가 정점을 삼킨다',/^WBBBBBW$/,'WBBBBBW',2],
    [5,2,'감시사회','통제가 창의를 죽였다'],
    [6,1,'혼돈','절대권력이 무너지고 혼란만 남았다'],
  ],
};
const ERAS = {
  1: ['태초의 시대','무리를 이루고 첫 돌을 놓는 시대. 전투 없이 문명을 세운다.'],
  2: ['결속의 시대','혼자서는 버틸 수 없어 힘과 자유를 합친 쪽이 앞서는 시대.'],
  3: ['정치의 시대','힘 있는 왕도 백성의 지지가 있어야 오래가는 시대.'],
  4: ['국가의 시대','강한 중앙 권력이 나라를 하나로 묶는 시대.'],
  5: ['제국의 시대','군사력과 번영을 함께 갖춘 나라가 세계를 지배하는 시대.'],
  6: ['혁명의 시대','개혁으로 민심을 붙잡은 권력만 살아남는 시대.'],
  7: ['문명의 시대','끝까지 한 길만 걸은 자가 문명의 정점에 서는 시대.'],
};
const POINTS = [0, 0, 1, 1, 2, 2, 2, 3];
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
// 전투에서 이미 드러난 특수 족보 카드.
const shownCards = (s, p) => s.players[p].cards.filter(c => s.history.some(h => h.hands[p].name === c));

// cards: 이 문명 주인이 가진 특수 족보 카드 이름들.
function evaluate(t, seq, cards = []) {
  const black = countBlack(seq), specialIndex = TABLES[t].findIndex(row => row[0] === black && row[4]?.test(seq) && cards.includes(row[2]));
  const special = specialIndex >= 0, i = special ? specialIndex : plainIndex(t, black), row = TABLES[t][i];
  return { black, white: seq.length - black, rank: i + 1, name: row[2], why: row[3], special, beats: special ? row[6] ?? 1 : 0 };
}

// 0: a 승, 1: b 승, null: 무승부. 특수 족보는 정해진 상위 족보를 이기고, 나머지는 순위대로.
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

// 1단계: 양쪽 돌 배치. assigns[p] = [문명 A, B, C가 받을 토큰]. 점수가 없는 턴(1턴)은 전투 없이 다음 턴으로 간다.
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
  if (pointsFor(s.turn) === 0) s.turn++;
  else s.stage = 'fight';
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
// 내 카드의 특수 족보는 상대 정점을 잡으려고 노리므로 어떤 일반 족보보다 높게 친다.
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
    let score = pointsFor(t) ? maximin(edgeMatrix(t, legalFighters(s, p).map(i => seqs[i]), me.cards, theirs, guess)).v * pointsFor(t) : 0;
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
    eq(specials.length > 0, t >= 3, `${t}턴 특수 족보 유무`);
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
  eq(SPECIALS.length, 16, '특수 족보 16장');
  eq(compareHands(1, 'B', 'W'), 0, '1턴 흑 승');
  eq(compareHands(1, 'B', 'B'), null, '같은 족보 무승부');
  eq(compareHands(3, 'BWW', 'WWB', ['시민 봉기']), 0, '카드가 있으면 특수 족보가 같은 조합을 이김');
  eq(compareHands(3, 'BWW', 'WWB'), null, '카드가 없으면 같은 일반 족보');
  eq(compareHands(3, 'WBB', 'BBW', ['궁정 쿠데타']), 0, '궁정 쿠데타가 왕국을 잡음');
  eq(compareHands(3, 'WBB', 'WWB', ['궁정 쿠데타']), 1, '궁정 쿠데타는 도시국가에 짐');
  eq(compareHands(7, 'WWWWWWW', 'BBBBBBB'), 0, '7턴 백 7이 최강');
  eq(compareHands(7, 'BWWBWBB', 'BBBWWWW', ['문명의 순환']), 0, '문명의 순환이 초지능사회를 이김');
  eq(compareHands(7, 'BBWWWWW', 'BWWBWBB', [], ['문명의 순환']), 0, '지식사회가 문명의 순환을 이김');
  eq(evaluate(7, 'BBBWWBW', ['문명의 순환']).name, '낡은 질서', '처음과 끝이 다르면 일반 족보');
  eq(evaluate(5, 'WWWBW', ['독립 전쟁']).name, '독립 전쟁', '독립 전쟁은 뒤 두 돌 순서 무관');
  eq(evaluate(5, 'WWBWW', ['독립 전쟁']).name, '식민지', '흑이 앞쪽이면 식민지');
  eq(possibleHands(3, 'B?', ['시민 봉기']).specials[0], '시민 봉기', '가능한 특수 족보 표시');
  // 0번은 시민 봉기와 궁정 쿠데타 카드, 회색돌은 모두 속이 흑.
  const g = newGame(() => 0);
  eq(g.players[0].cards.join(), '시민 봉기,궁정 쿠데타', '카드 나눠 주기');
  eq((() => { try { placeStones(g, [['GW','B','W'], ['B','W','GB']]); return false; } catch { return true; } })(), true, '없는 돌은 못 놓음');
  let s = placeStones(g, [['B','W','GB'], ['B','B','B']]);
  eq(s.turn === 2 && s.stage === 'assign' && s.players[0].stock.GB === 6 && s.players[1].stock.B === 4, true, '1턴은 전투 없이 2턴으로, 남은 돌 줄어듦');
  const masked = maskFor(s, 0);
  eq(masked.players[0].civs[2].stones[0].color, '?', '상대 회색돌 색 가림');
  eq(masked.players[0].stock.G === 6 && masked.players[0].stock.GB === undefined, true, '상대 남은 회색돌 속 색 가림');
  eq(masked.players[0].cards.join(), '?,?', '상대 카드 가림');
  eq(masked.players[1].cards.join(), '헌법 제정,망명 정부', '내 카드 유지');
  eq(isValidView(masked), true, '가린 상태는 유효');
  eq(isValidView({ ...masked, turn:'<b>' }), false, '잘못된 상태 거부');
  eq(isValidView({ ...masked, players:[{ ...masked.players[0], cards:['<img>', '?'] }, masked.players[1]] }), false, '없는 카드 이름 거부');
  s = fightTurn(placeStones(s, [['W','W','B'], ['W','W','W']]), [1, 2]);
  eq(s.history[0].winner === 1 && s.players[1].civs[2].bannedThrough === 4 && s.players[0].civs[1].bannedThrough === 3, true, '이긴 문명은 2턴, 진 문명은 1턴 쉼');
  s = fightTurn(placeStones(s, [['W','B','B'], ['B','B','B']]), [0, 0]);
  eq(s.history[1].hands[0].name === '시민 봉기' && s.history[1].winner === 0, true, '시민 봉기 카드로 왕국을 이김');
  eq(maskFor(s, 0).players[0].cards.join(), '시민 봉기,?', '쓴 카드는 공개');
  eq(winnerOf({ players:[{ score:3 }, { score:3 }], history:[{ winner:1 }, { winner:0 }, { winner:null }] }), 0, '동점이면 마지막 전투 승자');
}
selfCheck();

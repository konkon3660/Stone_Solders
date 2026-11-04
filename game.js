// 순수 게임 규칙. DOM을 모른다. 프로토타입이 끝나면 이 블록만 실제 구현으로 옮긴다.
// 돌 색은 'B'(흑), 'W'(백). 돌 종류는 'B', 'W', 'G'(회색).
const LAST_TURN = 7;

// 턴별 족보표, 강한 순서: [흑 개수, 백 개수, 족보 이름, 강하거나 약한 이유, 특수 족보의 돌 순서]
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
    [1,2,'시민 봉기','왕이 섰지만 자유가 연달아 쌓여 왕을 끌어내린다','BWW'],
    [1,2,'도시국가','자유롭지만 나라가 작다'],
    [0,3,'중우정치','말만 많고 결정하지 못한다'],
  ],
  4: [
    [4,0,'절대왕정','모든 권력이 왕에게 모였다'],
    [3,1,'군사정권','군대로 다스리지만 정통성이 약하다'],
    [2,2,'헌법 제정','자유가 권력을 앞뒤로 감싸 왕권을 묶는다','WBBW'],
    [2,2,'느슨한 연방','균형은 있지만 결속이 약하다'],
    [1,3,'허약한 정부','권력이 모자라 명령이 먹히지 않는다'],
    [0,4,'무정부 상태','국가의 시대에 국가가 없다'],
  ],
  5: [
    [3,2,'대제국','군사력과 번영을 모두 갖췄다'],
    [2,3,'상업 제국','부유하지만 군대가 조금 모자란다'],
    [4,1,'군사 제국','군대뿐이라 재정이 버티지 못한다'],
    [5,0,'요새 국가','지킬 뿐 뻗어 나가지 못한다'],
    [0,5,'중립 도시','부유하지만 군대가 없다'],
    [1,4,'독립 전쟁','오랜 식민지가 마지막에 무기를 든다','WWWWB'],
    [1,4,'식민지','번영을 제국에 빼앗긴다'],
  ],
  6: [
    [4,2,'개혁 군주','혁명이 터지기 전에 스스로 개혁한다'],
    [5,1,'계엄 정권','힘으로 버티지만 민심이 곧 폭발한다'],
    [6,0,'공포 정치','공포로만 다스린다'],
    [3,3,'대혁명','권력의 시대가 통째로 자유로 뒤집힌다','BBBWWW'],
    [3,3,'과도 정부','둘로 갈려 결단을 내리지 못한다'],
    [0,6,'해방구','자유롭지만 지킬 군대가 없다'],
    [2,4,'무력한 의회','이상은 크지만 집행할 힘이 없다'],
    [1,5,'폭도 정권','아무도 통제하지 못한다'],
  ],
  7: [
    [0,7,'절대자유','모든 시민이 완전히 자유로운 문명의 정점'],
    [7,0,'절대권력','하나의 의지로 움직이는 문명의 정점'],
    [3,4,'초지능사회','자유로운 지식을 질서 있게 조직했다'],
    [2,5,'지식사회','지식은 풍부하지만 조직력이 덜하다'],
    [1,6,'미완의 자유','절대자유에 돌 하나가 모자란다'],
    [4,3,'낡은 질서','안정적이지만 시대에 뒤처졌다'],
    [5,2,'문명의 순환','자유로 시작해 권력을 지나 자유로 돌아온다','WBBBBBW'],
    [5,2,'감시사회','통제가 창의를 죽였다'],
    [6,1,'혼돈','절대권력이 무너지고 혼란만 남았다'],
  ],
};
const ERAS = {
  1: ['태초의 시대','힘을 가진 자가 먼저 무리를 이끈 시대.'],
  2: ['결속의 시대','혼자서는 버틸 수 없어 힘과 자유를 합친 쪽이 앞서는 시대.'],
  3: ['정치의 시대','힘 있는 왕도 백성의 지지가 있어야 오래가는 시대.'],
  4: ['국가의 시대','강한 중앙 권력이 나라를 하나로 묶는 시대.'],
  5: ['제국의 시대','군사력과 번영을 함께 갖춘 나라가 세계를 지배하는 시대.'],
  6: ['혁명의 시대','개혁으로 민심을 붙잡은 권력만 살아남는 시대.'],
  7: ['문명의 시대','끝까지 한 길만 걸은 자가 문명의 정점에 서는 시대.'],
};

const pointsFor = t => t === LAST_TURN ? 5 : t >= 5 ? 2 : 1;
const countBlack = seq => [...seq].filter(c => c === 'B').length;
const rollGray = rng => rng() < 0.5 ? 'B' : 'W';
const colorsOf = civ => civ.stones.map(st => st.color).join('');
const publicSeq = civ => civ.stones.map(st => st.kind === 'G' && !st.revealed ? '?' : st.color).join('');
const stoneColor = (s, p, kind) => kind === 'G' ? s.gray[p] : kind;
const legalFighters = (s, p) => [0,1,2].filter(i => s.players[p].civs[i].bannedThrough < s.turn);
const plainIndex = (t, black) => TABLES[t].findIndex(row => !row[4] && row[0] === black);

function evaluate(t, seq) {
  const black = countBlack(seq), specialIndex = TABLES[t].findIndex(row => row[4] === seq);
  const i = specialIndex >= 0 ? specialIndex : plainIndex(t, black);
  return { black, white: seq.length - black, rank: i + 1, name: TABLES[t][i][2], why: TABLES[t][i][3], special: specialIndex >= 0 };
}

// 0: a 승, 1: b 승, null: 무승부. 특수 족보는 1위를 이기고, 나머지는 순위대로.
function compareHands(t, a, b) {
  const ea = evaluate(t, a), eb = evaluate(t, b);
  if (ea.special && eb.rank === 1) return 0;
  if (eb.special && ea.rank === 1) return 1;
  if (ea.rank !== eb.rank) return ea.rank < eb.rank ? 0 : 1;
  return null;
}

// '?'를 흑과 백으로 채운 모든 경우.
const fills = pattern => [...pattern].reduce((all, c) => all.flatMap(seq => c === '?' ? [seq + 'B', seq + 'W'] : [seq + c]), ['']);

// 아는 돌 순서로 이번 턴에 가능한 족보 범위. 아직 안 받은 돌은 '?'로 본다.
function possibleHands(t, known) {
  const hands = fills(known.padEnd(t, '?')).map(seq => evaluate(t, seq)).sort((a, b) => a.rank - b.rank);
  return { best:hands[0].rank, worst:hands.at(-1).rank, name:hands[0].name, specials:[...new Set(hands.filter(h => h.special).map(h => h.name))] };
}

function newGame(rng = Math.random) {
  const player = () => ({ score:0, civs:[0,1,2].map(() => ({ stones:[], bannedThrough:0 })) });
  return { turn:1, stage:'assign', over:false, players:[player(), player()], gray:[rollGray(rng), rollGray(rng)], history:[] };
}

// 1단계: 양쪽 돌 배치. assigns[p] = [문명 A, B, C가 받을 돌 종류]
function placeStones(prev, assigns) {
  const s = structuredClone(prev);
  assigns.forEach((assign, p) => {
    if ([...assign].sort().join('') !== 'BGW') throw new Error('돌 배분 오류');
    assign.forEach((kind, i) => s.players[p].civs[i].stones.push({ kind, color:stoneColor(s, p, kind), revealed:kind !== 'G' }));
  });
  s.stage = 'fight';
  return s;
}

// 2단계: 배치를 본 뒤 출전과 전투. fighters[p] = 문명 번호
function fightTurn(prev, fighters, rng = Math.random) {
  const s = structuredClone(prev), t = s.turn;
  const choices = [0,1].map(p => legalFighters(s, p).length);
  fighters.forEach((fighter, p) => {
    if (!legalFighters(s, p).includes(fighter)) throw new Error('출전 불가 문명');
    s.players[p].civs[fighter].stones.forEach(st => { st.revealed = true; });
  });
  const seqs = fighters.map((fighter, p) => colorsOf(s.players[p].civs[fighter]));
  const winner = compareHands(t, seqs[0], seqs[1]);
  if (winner !== null) s.players[winner].score += pointsFor(t);
  fighters.forEach((fighter, p) => { s.players[p].civs[fighter].bannedThrough = t + (p === winner ? 2 : 1); });
  s.history.push({ turn:t, fighters:[...fighters], seqs, hands:seqs.map(q => evaluate(t, q)), winner, choices });
  s.turn++;
  s.stage = 'assign';
  s.over = s.turn > LAST_TURN;
  if (!s.over) s.gray = [rollGray(rng), rollGray(rng)];
  return s;
}

const PERMS = ['BWG','BGW','WBG','WGB','GBW','GWB'].map(p => [...p]);
const rankValue = (t, i) => 1 - i / (TABLES[t].length - 1);
const handValue = (t, seq) => { const e = evaluate(t, seq); return rankValue(t, e.rank - 1) + (e.special ? 0.5 : 0); };

// 지금 돌 순서에서 u턴까지 닿을 수 있는 가장 좋은 족보의 가치.
function reachValue(u, seq) {
  const black = countBlack(seq);
  let best = 0;
  for (let k = 0; k <= u - seq.length; k++) best = Math.max(best, rankValue(u, plainIndex(u, black + k)));
  TABLES[u].forEach((row, i) => { if (row[4]?.startsWith(seq)) best = Math.max(best, rankValue(u, i) + 0.5); });
  return best;
}

// ponytail: 탐욕 휴리스틱. 상대 경로 저지나 회색돌 추론 없음. 봇이 약해서 재미 판단이 흐려지면 강화.
function botAssign(s, p, rng = Math.random) {
  const t = s.turn, civs = s.players[p].civs;
  let best = null, bestScore = -Infinity;
  for (const assign of PERMS) {
    const seqs = civs.map((civ, i) => colorsOf(civ) + stoneColor(s, p, assign[i]));
    let score = Math.max(...legalFighters(s, p).map(i => handValue(t, seqs[i]))) * pointsFor(t) + rng() * 0.3;
    for (let u = t + 1; u <= LAST_TURN; u++) seqs.forEach((seq, i) => {
      if (civs[i].bannedThrough < u) score += 0.2 * pointsFor(u) * reachValue(u, seq);
    });
    if (score > bestScore) { bestScore = score; best = assign; }
  }
  return best;
}

// 공개 정보만 본다. 상대 출전 문명과 회색돌은 고르게 일어난다고 가정.
function botFight(s, p, rng = Math.random) {
  const t = s.turn, me = s.players[p].civs, them = s.players[1 - p].civs;
  const oppOptions = legalFighters(s, 1 - p).map(i => fills(publicSeq(them[i])));
  let best = null, bestScore = -Infinity;
  for (const fighter of legalFighters(s, p)) {
    const seq = colorsOf(me[fighter]);
    const edge = oppOptions.reduce((sum, seqs) => sum + seqs.reduce((acc, q) => {
      const r = compareHands(t, seq, q);
      return acc + (r === 0 ? 1 : r === 1 ? -1 : 0);
    }, 0) / seqs.length, 0) / oppOptions.length;
    const cost = t < LAST_TURN ? 0.2 * pointsFor(t + 1) * reachValue(t + 1, seq) : 0;
    const score = edge * pointsFor(t) - cost + rng() * 0.2;
    if (score > bestScore) { bestScore = score; best = fighter; }
  }
  return best;
}

// 상대에게 보낼 상태. p의 아직 공개되지 않은 회색돌 색을 지운다.
function maskFor(prev, p) {
  const s = structuredClone(prev);
  if (s.over) return s;
  s.gray[p] = '?';
  s.players[p].civs.forEach(civ => civ.stones.forEach(st => { if (st.kind === 'G' && !st.revealed) st.color = '?'; }));
  return s;
}

// 네트워크로 받은 상태 점검. 화면에 그리기 전에 모양과 값을 확인한다.
function isValidView(v) {
  const int = Number.isInteger;
  const stoneOk = st => ['B','W','G'].includes(st?.kind) && ['B','W','?'].includes(st.color) && typeof st.revealed === 'boolean';
  const civOk = civ => int(civ?.bannedThrough) && Array.isArray(civ.stones) && civ.stones.length <= LAST_TURN && civ.stones.every(stoneOk);
  const playerOk = p => int(p?.score) && Array.isArray(p.civs) && p.civs.length === 3 && p.civs.every(civOk);
  const fightOk = h => int(h?.turn) && h.turn >= 1 && h.turn <= LAST_TURN && [0, 1, null].includes(h.winner)
    && Array.isArray(h.fighters) && h.fighters.length === 2 && h.fighters.every(f => [0,1,2].includes(f))
    && Array.isArray(h.choices) && h.choices.length === 2 && h.choices.every(int)
    && Array.isArray(h.seqs) && h.seqs.length === 2 && h.seqs.every(q => typeof q === 'string' && q.length === h.turn && /^[BW]+$/.test(q));
  return !!v && int(v.turn) && v.turn >= 1 && v.turn <= LAST_TURN + 1 && ['assign','fight'].includes(v.stage) && typeof v.over === 'boolean'
    && Array.isArray(v.players) && v.players.length === 2 && v.players.every(playerOk)
    && Array.isArray(v.gray) && v.gray.length === 2 && v.gray.every(c => ['B','W','?'].includes(c))
    && Array.isArray(v.history) && v.history.every(fightOk);
}

function selfCheck() {
  const eq = (actual, expected, label) => { if (actual !== expected) throw new Error(`규칙 점검 실패: ${label}`); };
  const plain = (b, w) => 'B'.repeat(b) + 'W'.repeat(w);
  const patterns = [];
  for (let t = 1; t <= LAST_TURN; t++) {
    const rows = TABLES[t], plainRows = rows.filter(row => !row[4]), specials = rows.filter(row => row[4]);
    eq(new Set(plainRows.map(row => row[0])).size, t + 1, `${t}턴 조합 수`);
    eq(plainRows.length, t + 1, `${t}턴 일반 족보 수`);
    rows.forEach(row => eq(row[0] + row[1], t, `${t}턴 ${row[2]} 돌 개수`));
    eq(specials.length, t >= 3 ? 1 : 0, `${t}턴 특수 족보 수`);
    for (const [b, w, name, , seq] of specials) {
      eq(seq.length, t, `${name} 길이`);
      eq(countBlack(seq), b, `${name} 흑 개수`);
      eq(/^(BW)+B?$|^(WB)+W?$/.test(seq), false, `${name}은 교대 패턴이 아님`);
      eq(compareHands(t, seq, plain(rows[0][0], rows[0][1])), 0, `${name}이 1위를 이김`);
      eq(compareHands(t, plain(rows[1][0], rows[1][1]), seq), 0, `${name}은 2위에 짐`);
      eq(rows.indexOf(rows.find(row => row[2] === name)) + 1, plainIndex(t, b), `${name}은 같은 조합 바로 위`);
      patterns.push(seq);
    }
    for (const [b, w] of plainRows) if (b > w && t < LAST_TURN) eq(plainIndex(t, b) < plainIndex(t, w), true, `${t}턴 흑 우세`);
  }
  for (const a of patterns) for (const b of patterns) if (a !== b) eq(b.startsWith(a), false, `${a}와 ${b} 경로 겹침`);
  for (const [b, w] of TABLES[7].filter(row => !row[4])) if (w > b) eq(plainIndex(7, b) < plainIndex(7, w), true, '7턴 백 우세');
  for (const t of [5, 6]) eq(plainIndex(t, 0) === TABLES[t].length - 1, false, `${t}턴 백 몰빵은 꼴찌가 아님`);
  eq(compareHands(1, 'B', 'W'), 0, '1턴 흑 승');
  eq(compareHands(1, 'B', 'B'), null, '같은 족보 무승부');
  eq(compareHands(3, 'BWW', 'WWB'), 0, '특수 족보가 같은 조합을 이김');
  eq(compareHands(3, 'BWW', 'BWW'), null, '특수 족보끼리 무승부');
  eq(compareHands(7, 'WWWWWWW', 'BBBBBBB'), 0, '7턴 백 7이 최강');
  eq(compareHands(7, 'WBBBBBW', 'WWWWWWW'), 0, '문명의 순환이 절대자유를 이김');
  eq(compareHands(7, 'BBBBBBB', 'WBBBBBW'), 0, '절대권력이 문명의 순환을 이김');
  eq(possibleHands(3, 'B?').specials[0], '시민 봉기', '가능한 특수 족보 표시');
  const placed = placeStones(newGame(() => 0), [['B','W','G'], ['B','W','G']]), masked = maskFor(placed, 0);
  eq(masked.players[0].civs[2].stones[0].color, '?', '상대 회색돌 색 가림');
  eq(masked.gray[0], '?', '상대 이번 턴 회색돌 색 가림');
  eq(masked.players[1].civs[2].stones[0].color, 'B', '내 회색돌 색 유지');
  eq(isValidView(masked), true, '가린 상태는 유효');
  eq(isValidView({ ...masked, turn:'<b>' }), false, '잘못된 상태 거부');
}
selfCheck();

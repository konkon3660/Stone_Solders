// 순수 게임 규칙. DOM을 모른다. 프로토타입이 끝나면 이 블록만 실제 구현으로 옮긴다.
// 돌 색은 'B'(흑), 'W'(백). 돌 종류는 'B', 'W', 'G'(회색).
const LAST_TURN = 7;

// 족보는 세 계열이 가위바위보처럼 돈다. 권력은 자유를, 자유는 균형을, 균형은 권력을 이긴다.
// 권력: 흑이 백보다 2개 이상 많음. 자유: 백이 흑보다 2개 이상 많음. 균형: 차이가 1개 이하.
// 같은 계열끼리는 표에 적힌 순서가 강한 순서다. 한 색 몰빵이 1등, 몰빵에서 돌 하나 모자라면 꼴등.
// ★ 특수 족보는 돌 순서가 정해진 모양이어야 하며, 다른 계열은 모두 이기고 같은 계열 일반 족보에는 진다.
// 행: [흑 개수, 백 개수, 족보 이름, 이유, 특수 족보의 순서 규칙, 화면에 그릴 모양]
// 모양 표기: B와 W는 돌, []는 순서 무관, | 뒤는 덧붙이는 설명.
const TABLES = {
  1: [
    [1,0,'족장','힘으로 무리를 모았다'],
    [0,1,'유랑민','자유롭게 떠돈다'],
  ],
  2: [
    [2,0,'약탈 부족','힘으로 빼앗아 살아간다'],
    [1,1,'부족 연맹','힘과 자유를 합쳐 함께 버틴다'],
    [0,2,'작은 마을','누구의 지배도 받지 않는다'],
  ],
  3: [
    [3,0,'폭군','힘으로만 다스린다'],
    [1,2,'시민 봉기','자유가 연달아 쌓여 폭군도 군중도 몰아낸다. 안정된 나라에서는 번지지 못한다',/^BWW$/,'BWW'],
    [2,1,'왕국','왕의 권력에 백성의 지지까지 얻었다'],
    [1,2,'도시국가','자유롭지만 나라가 작다'],
    [0,3,'중우정치','말이 많아 무엇이든 뒤엎는다'],
  ],
  4: [
    [4,0,'절대왕정','모든 권력이 왕에게 모였다'],
    [3,1,'군사정권','군대로 다스리지만 정통성이 약하다'],
    [2,2,'헌법 제정','자유가 권력을 앞뒤로 감싸 왕권을 묶는다. 느슨한 연방은 하나의 헌법에 묶이지 않는다',/^WBBW$/,'WBBW'],
    [2,2,'느슨한 연방','여러 세력이 느슨하게 손잡았다'],
    [0,4,'무정부 상태','어떤 권력도 인정하지 않는다'],
    [1,3,'허약한 정부','권력이 모자라 명령이 먹히지 않는다'],
  ],
  5: [
    [4,1,'제국 분열','권력을 쌓은 제국 안에서 자유가 터져 이웃 제국까지 갈라놓는다. 단단한 군사 국가는 갈라지지 않는다',/^BBB/,'BBB[BW]'],
    [5,0,'요새 국가','난공불락의 요새로 모든 것을 지킨다'],
    [4,1,'군사 제국','군대뿐이라 재정이 버티지 못한다'],
    [3,2,'대제국','군사력과 번영을 모두 갖췄다'],
    [2,3,'상업 제국','부유하지만 군대가 조금 모자란다'],
    [1,4,'독립 전쟁','오랜 식민지가 막판에 무기를 들어 제국을 몰아낸다. 같은 처지의 식민지는 따라오지 않는다',/^WWW/,'WWW[WB]'],
    [0,5,'중립 도시','어느 편에도 서지 않고 부를 쌓았다'],
    [1,4,'식민지','번영을 제국에 빼앗긴다'],
  ],
  6: [
    [6,0,'공포 정치','공포로 모든 것을 짓누른다'],
    [4,2,'개혁 군주','혁명이 터지기 전에 스스로 개혁한다'],
    [5,1,'계엄 정권','공포 정치에 돌 하나가 모자라 민심이 곧 폭발한다'],
    [3,3,'대혁명','권력을 쌓은 나라에 자유가 연달아 터져 뒤집힌다. 혁명의 열기는 타협 앞에서 식는다',/WW$/,'[BBBW]WW'],
    [3,3,'과도 정부','둘로 갈려 타협만 거듭한다'],
    [2,4,'왕의 처형','의회가 막판에 권력을 쥐고 왕을 처형한다. 뒤이은 혼란에서 더 과격한 세력에게 밀린다',/B$/,'[BWWWW]B'],
    [0,6,'해방구','누구의 지배도 받지 않는 땅'],
    [2,4,'무력한 의회','이상은 크지만 집행할 힘이 없다'],
    [1,5,'폭도 정권','해방구에 돌 하나가 모자라 아무도 통제하지 못한다'],
  ],
  7: [
    [7,0,'절대권력','하나의 의지로 움직이는 문명의 정점'],
    [5,2,'감시사회','통제가 창의를 죽였다'],
    [6,1,'혼돈','절대권력에 돌 하나가 모자라 혼란만 남았다'],
    [4,3,'문명의 순환','역사가 돌고 돌아 처음으로 돌아오면 어떤 정점도 무너진다. 균형 잡힌 문명은 휩쓸리지 않는다',/^(B.*B|W.*W)$/,'[BBBBWWW]|처음과 끝이 같은 색'],
    [3,4,'초지능사회','자유로운 지식을 질서 있게 조직했다'],
    [4,3,'낡은 질서','안정적이지만 시대에 뒤처졌다'],
    [0,7,'절대자유','모든 시민이 완전히 자유로운 문명의 정점'],
    [2,5,'지식사회','지식은 풍부하지만 조직력이 덜하다'],
    [1,6,'미완의 자유','절대자유에 돌 하나가 모자란다'],
  ],
};
// [시대 이름, 시대 설명, 상성 이유: 권력이 자유를(P), 자유가 균형을(F), 균형이 권력을(E) 이기는 이유]
const ERAS = {
  1: ['태초의 시대','무리를 이루고 첫 돌을 놓는 시대. 전투 없이 문명을 세운다.', null],
  2: ['결속의 시대','혼자서는 버틸 수 없어 무리를 이루기 시작한 시대.', { P:'약탈 부족이 작은 마을을 턴다', F:'작은 마을들이 연맹의 간섭을 떠난다', E:'연맹이 힘을 모아 약탈 부족을 막는다' }],
  3: ['정치의 시대','누가 어떻게 다스릴지 다투기 시작한 시대.', { P:'폭군이 떠드는 군중을 힘으로 누른다', F:'끝없는 논쟁이 왕국의 질서를 흔든다', E:'왕국과 도시들이 손잡고 폭군을 몰아낸다' }],
  4: ['국가의 시대','흩어진 힘이 하나의 나라로 묶이는 시대.', { P:'절대 권력이 무질서를 진압한다', F:'통제가 느슨해지자 연방이 흩어진다', E:'연방의 견제가 왕권을 묶는다' }],
  5: ['제국의 시대','나라가 바다 건너까지 뻗어 나가는 시대.', { P:'제국군이 식민지와 도시를 정복한다', F:'자유 무역 도시들이 제국의 질서를 빠져나간다', E:'번영한 제국이 교역과 동맹으로 군사 국가를 고립시킨다' }],
  6: ['혁명의 시대','낡은 권력과 새로운 자유가 정면으로 부딪치는 시대.', { P:'계엄군이 거리의 혁명을 진압한다', F:'과격파가 타협하는 과도 정부를 무너뜨린다', E:'타협한 의회가 군주의 권력을 나눠 가진다' }],
  7: ['문명의 시대','한 길을 끝까지 걸은 문명이 정점에 서는 시대.', { P:'감시와 통제가 자유를 누른다', F:'자유로운 지식이 낡은 질서를 넘어선다', E:'균형 잡힌 사회가 권력의 독주를 막는다' }],
};
const FAMILY = { P:'권력', E:'균형', F:'자유' };
const BEATS = { P:'F', F:'E', E:'P' };
const POINTS = [0, 0, 1, 1, 2, 2, 2, 3];

const pointsFor = t => POINTS[t];
const familyOf = (black, white) => black - white >= 2 ? 'P' : white - black >= 2 ? 'F' : 'E';
const countBlack = seq => [...seq].filter(c => c === 'B').length;
const rollGray = rng => rng() < 0.5 ? 'B' : 'W';
const colorsOf = civ => civ.stones.map(st => st.color).join('');
const publicSeq = civ => civ.stones.map(st => st.kind === 'G' && !st.revealed ? '?' : st.color).join('');
const stoneColor = (s, p, kind) => kind === 'G' ? s.gray[p] : kind;
const legalFighters = () => [0,1,2];
const plainRows = (t, family) => TABLES[t].filter(row => !row[4] && familyOf(row[0], row[1]) === family);

// level: 같은 계열 안의 순위(1이 가장 강함). 특수 족보는 0.
function evaluate(t, seq) {
  const black = countBlack(seq), white = seq.length - black, family = familyOf(black, white);
  const row = TABLES[t].find(r => r[0] === black && r[4]?.test(seq)) ?? TABLES[t].find(r => !r[4] && r[0] === black);
  const special = !!row[4];
  return { black, white, family, level: special ? 0 : plainRows(t, family).indexOf(row) + 1, name: row[2], why: row[3], special };
}

// 0: a 승, 1: b 승, null: 무승부.
function compareHands(t, a, b) {
  const x = evaluate(t, a), y = evaluate(t, b);
  if (x.family !== y.family) {
    if (x.special !== y.special) return x.special ? 0 : 1;
    return BEATS[x.family] === y.family ? 0 : 1;
  }
  if (x.special !== y.special) return x.special ? 1 : 0;
  return x.level === y.level ? null : x.level < y.level ? 0 : 1;
}

// '?'를 흑과 백으로 채운 모든 경우.
const fills = pattern => [...pattern].reduce((all, c) => all.flatMap(seq => c === '?' ? [seq + 'B', seq + 'W'] : [seq + c]), ['']);

// 아는 돌 순서로 이번 턴에 가능한 족보들. 아직 안 받은 돌은 '?'로 본다.
function possibleHands(t, known) {
  const hands = fills(known.padEnd(t, '?')).map(seq => evaluate(t, seq));
  return { hands, families: [...new Set(hands.map(h => h.family))], specials: [...new Set(hands.filter(h => h.special).map(h => h.name))] };
}

function newGame(rng = Math.random) {
  const player = () => ({ score:0, civs:[0,1,2].map(() => ({ stones:[] })) });
  return { turn:1, stage:'assign', over:false, players:[player(), player()], gray:[rollGray(rng), rollGray(rng)], history:[] };
}

// 1단계: 양쪽 돌 배치. assigns[p] = [문명 A, B, C가 받을 돌 종류]. 점수가 없는 턴(1턴)은 전투 없이 다음 턴으로 간다.
function placeStones(prev, assigns, rng = Math.random) {
  const s = structuredClone(prev);
  assigns.forEach((assign, p) => {
    if ([...assign].sort().join('') !== 'BGW') throw new Error('돌 배분 오류');
    assign.forEach((kind, i) => s.players[p].civs[i].stones.push({ kind, color:stoneColor(s, p, kind), revealed:kind !== 'G' }));
  });
  if (pointsFor(s.turn) === 0) { s.turn++; s.gray = [rollGray(rng), rollGray(rng)]; }
  else s.stage = 'fight';
  return s;
}

// 2단계: 배치를 본 뒤 출전과 전투. fighters[p] = 문명 번호
function fightTurn(prev, fighters, rng = Math.random) {
  const s = structuredClone(prev), t = s.turn;
  fighters.forEach((fighter, p) => {
    if (!legalFighters(s, p).includes(fighter)) throw new Error('출전 불가 문명');
    s.players[p].civs[fighter].stones.forEach(st => { st.revealed = true; });
  });
  const seqs = fighters.map((fighter, p) => colorsOf(s.players[p].civs[fighter]));
  const winner = compareHands(t, seqs[0], seqs[1]);
  if (winner !== null) s.players[winner].score += pointsFor(t);
  s.history.push({ turn:t, fighters:[...fighters], seqs, hands:seqs.map(q => evaluate(t, q)), winner });
  s.turn++;
  s.stage = 'assign';
  s.over = s.turn > LAST_TURN;
  if (!s.over) s.gray = [rollGray(rng), rollGray(rng)];
  return s;
}

// 최종 승자. 동점이면 마지막으로 전투에서 이긴 쪽, 그것도 없으면 무승부(null).
function winnerOf(s) {
  const [a, b] = s.players.map(p => p.score);
  if (a !== b) return a > b ? 0 : 1;
  return s.history.findLast(h => h.winner !== null)?.winner ?? null;
}

const PERMS = ['BWG','BGW','WBG','WGB','GBW','GWB'].map(p => [...p]);

// 내 문명 i가 상대 문명 j와 붙을 때의 기대 승패(+1, 0, -1). 상대의 '?'는 반반으로 본다.
const edgeMatrix = (t, mine, theirs) => mine.map(seq => theirs.map(pattern => {
  const qs = fills(pattern);
  return qs.reduce((sum, q) => { const r = compareHands(t, seq, q); return sum + (r === 0 ? 1 : r === 1 ? -1 : 0); }, 0) / qs.length;
}));

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

// ponytail: 이번 턴만 보는 휴리스틱에 계열 다양성 가산점. 봇이 약해서 재미 판단이 흐려지면 몇 턴 앞을 내다보게 강화.
function botAssign(s, p, rng = Math.random) {
  const t = s.turn, mine = s.players[p].civs, theirs = s.players[1 - p].civs.map(civ => publicSeq(civ) + '?');
  let best = null, bestScore = -Infinity;
  for (const assign of PERMS) {
    const seqs = mine.map((civ, i) => colorsOf(civ) + stoneColor(s, p, assign[i]));
    const now = pointsFor(t) ? maximin(edgeMatrix(t, seqs, theirs)).v * pointsFor(t) : 0;
    const variety = new Set(seqs.map(q => familyOf(countBlack(q), q.length - countBlack(q)))).size;
    const score = now + 0.3 * variety + rng() * 0.2;
    if (score > bestScore) { bestScore = score; best = assign; }
  }
  return best;
}

// 공개 정보만 본다. 상대가 가장 잘 받아친다고 보고 혼합 전략으로 고른다.
function botFight(s, p, rng = Math.random) {
  const t = s.turn, seqs = s.players[p].civs.map(colorsOf), theirs = s.players[1 - p].civs.map(publicSeq);
  const { p: mix } = maximin(edgeMatrix(t, seqs, theirs));
  let x = rng();
  for (let i = 0; i < mix.length; i++) { x -= mix[i]; if (x <= 0) return i; }
  return mix.length - 1;
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
  const civOk = civ => Array.isArray(civ?.stones) && civ.stones.length <= LAST_TURN && civ.stones.every(stoneOk);
  const playerOk = p => int(p?.score) && Array.isArray(p.civs) && p.civs.length === 3 && p.civs.every(civOk);
  const fightOk = h => int(h?.turn) && h.turn >= 1 && h.turn <= LAST_TURN && [0, 1, null].includes(h.winner)
    && Array.isArray(h.fighters) && h.fighters.length === 2 && h.fighters.every(f => [0,1,2].includes(f))
    && Array.isArray(h.seqs) && h.seqs.length === 2 && h.seqs.every(q => typeof q === 'string' && q.length === h.turn && /^[BW]+$/.test(q));
  return !!v && int(v.turn) && v.turn >= 1 && v.turn <= LAST_TURN + 1 && ['assign','fight'].includes(v.stage) && typeof v.over === 'boolean'
    && Array.isArray(v.players) && v.players.length === 2 && v.players.every(playerOk)
    && Array.isArray(v.gray) && v.gray.length === 2 && v.gray.every(c => ['B','W','?'].includes(c))
    && Array.isArray(v.history) && v.history.every(fightOk);
}

function selfCheck() {
  const eq = (actual, expected, label) => { if (actual !== expected) throw new Error(`규칙 점검 실패: ${label}`); };
  for (let t = 1; t <= LAST_TURN; t++) {
    const rows = TABLES[t], plain = rows.filter(row => !row[4]), specials = rows.filter(row => row[4]);
    eq(plain.map(row => row[0]).sort().join(), [...Array(t + 1).keys()].join(), `${t}턴 흑 개수마다 일반 족보 하나`);
    rows.forEach(row => eq(row[0] + row[1], t, `${t}턴 ${row[2]} 돌 개수`));
    eq(specials.length > 0, t >= 3, `${t}턴 특수 족보 유무`);
    for (const row of specials) eq(fills('?'.repeat(t)).some(seq => evaluate(t, seq).name === row[2]), true, `${row[2]}을 만들 수 있음`);
    // 하이리스크 하이리턴: 한 색 몰빵이 계열 1등, 몰빵에서 하나 모자라면 꼴등
    if (t >= 4) for (const [c, other, fam] of [['B', 'W', 'P'], ['W', 'B', 'F']]) {
      eq(evaluate(t, c.repeat(t)).level, 1, `${t}턴 ${FAMILY[fam]} 몰빵이 1등`);
      eq(evaluate(t, other + c.repeat(t - 1)).level, plainRows(t, fam).length, `${t}턴 ${FAMILY[fam]} 하나 모자라면 꼴등`);
    }
  }
  eq(compareHands(2, 'BB', 'WW'), 0, '권력이 자유를 이김');
  eq(compareHands(2, 'WW', 'BW'), 0, '자유가 균형을 이김');
  eq(compareHands(2, 'BW', 'BB'), 0, '균형이 권력을 이김');
  eq(compareHands(2, 'BW', 'WB'), null, '같은 족보는 무승부');
  eq(compareHands(5, 'BBBBB', 'WBBBB'), 0, '같은 계열은 표 순서대로');
  eq(compareHands(3, 'BWW', 'BBB'), 0, '특수 족보가 다른 계열(권력)을 이김');
  eq(compareHands(3, 'BWW', 'WWW'), 0, '특수 족보가 다른 계열(자유)을 이김');
  eq(compareHands(3, 'BBW', 'BWW'), 0, '특수 족보는 같은 계열 일반 족보에 짐');
  eq(compareHands(3, 'BWW', 'BWW'), null, '같은 특수 족보끼리 무승부');
  eq(compareHands(5, 'BBBBW', 'WWWBW'), 0, '특수 족보끼리는 계열 상성대로');
  eq(compareHands(7, 'BWWBWBB', 'WWWWWWW'), 0, '문명의 순환이 절대자유를 이김');
  eq(compareHands(7, 'BBBWWWW', 'BWWBWBB'), 0, '초지능사회가 문명의 순환을 이김');
  eq(evaluate(7, 'BBBWWBW').name, '낡은 질서', '처음과 끝이 다르면 일반 족보');
  eq(evaluate(5, 'WWWBW').name, '독립 전쟁', '독립 전쟁은 뒤 두 돌 순서 무관');
  eq(evaluate(5, 'WWBWW').name, '식민지', '흑이 앞쪽이면 식민지');
  eq(possibleHands(3, 'B?').specials[0], '시민 봉기', '가능한 특수 족보 표시');
  const placed = placeStones(newGame(() => 0), [['B','W','G'], ['B','W','G']], () => 0), masked = maskFor(placed, 0);
  eq(placed.turn === 2 && placed.stage === 'assign', true, '1턴은 전투 없이 2턴으로');
  eq(masked.players[0].civs[2].stones[0].color, '?', '상대 회색돌 색 가림');
  eq(masked.gray[0], '?', '상대 이번 턴 회색돌 색 가림');
  eq(masked.players[1].civs[2].stones[0].color, 'B', '내 회색돌 색 유지');
  eq(isValidView(masked), true, '가린 상태는 유효');
  eq(isValidView({ ...masked, turn:'<b>' }), false, '잘못된 상태 거부');
  eq(winnerOf({ players:[{ score:3 }, { score:3 }], history:[{ winner:1 }, { winner:0 }, { winner:null }] }), 0, '동점이면 마지막 전투 승자');
}
selfCheck();

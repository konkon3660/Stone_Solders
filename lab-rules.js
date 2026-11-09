// 실험실 규칙: 버릴 시험판. game.js의 족보표와 판정 위에 켠 실험만 얹는다. 성공한 실험만 game.js로 옮긴다.
// ponytail: 온라인 없음. 봇은 규칙을 모르는 몬테카를로라 약하다. 살아남은 실험만 전용 봇을 만든다.
const MODS = [
  { id:'ability', name:'테크 능력', desc:'1위가 아닌 족보로 출전하면 전투 뒤 능력이 발동한다. 약한 족보일수록 능력이 세다.' },
  { id:'rush', name:'테크 러시', desc:'한 턴의 돌 3개를 아무 문명에나 몰아줄 수 있다(문명당 7개까지). 돌이 더 많은 문명, 곧 더 앞선 시대가 무조건 이긴다.' },
  { id:'fronts', name:'세 전선', desc:'출전을 고르지 않고 문명 A·B·C가 상대 A·B·C와 매 턴 동시에 싸운다. 출전 제한은 없고, 회색돌은 끝까지 숨는다.' },
  { id:'bomb', name:'회색 폭발', desc:'회색돌이 같은 색 돌 사이에 낀 돌을 뒤집는다. 족보를 정할 때 적용한다.' },
  { id:'capture', name:'점령', desc:'전투에서 진 문명은 마지막 돌의 색이 뒤집힌다.' },
  { id:'carry', name:'무승부 이월', desc:'비기면 그 점수가 다음 승부에 얹힌다.' },
];

// 출전하면 전투 뒤 발동. [종류, 양]. 1위 족보와 불가사의에는 없다.
const ABILITY = {
  '불':['peek',1],
  '청동검':['break',1], '문자':['peek',1],
  '전차':['break',1], '화폐':['score',1], '철학':['peek',2],
  '봉건제':['lock'], '길드':['score',1], '대학':['peek',2], '수도원':['score',2],
  '동인도 회사':['score',1], '머스킷 부대':['break',1], '성형 요새':['rest'], '자유 무역항':['score',1], '플랜테이션':['score',2],
  '철갑선':['break',1], '기관총':['break',2], '노동조합':['lock'], '백과사전':['peek',3], '신문':['score',1], '러다이트':['break',2],
  '실리콘밸리':['score',1], '가짜 뉴스':['score',2], '냉전':['score',1], '감시 국가':['score',1], '핵겨울':['score',2],
};
const abilityText = name => {
  const fx = ABILITY[name];
  if (!fx) return '';
  const [kind, n] = fx;
  return { peek:`상대 숨은 회색돌 ${n}개 공개`, break:`상대 최강 문명의 마지막 돌 ${n}개 뒤집기`, score:`승점 +${n}`, lock:'상대 최강 문명 다음 턴 출전 금지', rest:'이 문명은 쉬지 않음' }[kind];
};

const flipColor = c => c === 'B' ? 'W' : 'B';
const stoneOf = token => { const [kind, color] = TOKENS[token]; return { kind, color, revealed:kind !== 'G' }; };

// 회색돌마다 양쪽으로 가장 가까운 같은 색 돌을 찾아 그 사이 돌을 뒤집는다.
function explode(stones) {
  const row = stones.map(st => st.color);
  stones.forEach((st, i) => {
    if (st.kind !== 'G') return;
    const c = row[i], left = i > 0 ? row.lastIndexOf(c, i - 1) : -1, right = row.indexOf(c, i + 1);
    if (left >= 0) for (let k = left + 1; k < i; k++) row[k] = c;
    if (right >= 0) for (let k = i + 1; k < right; k++) row[k] = c;
  });
  return row.join('');
}
const seqOfStones = (mods, stones) => mods.bomb ? explode(stones) : stones.map(st => st.color).join('');
const handOf = (s, p, i) => {
  const stones = s.players[p].civs[i].stones;
  return stones.length ? { ...evaluate(stones.length, seqOfStones(s.mods, stones), s.players[p].cards), age:stones.length } : null;
};

// 공개 정보만으로 본 상대 문명의 족보 범위.
function handRange(s, owner, i) {
  const stones = s.players[owner].civs[i].stones, hidden = st => st.kind === 'G' && !st.revealed;
  if (!stones.length) return null;
  const all = fills('?'.repeat(stones.filter(hidden).length)).map(f => {
    let j = 0;
    return evaluate(stones.length, seqOfStones(s.mods, stones.map(st => hidden(st) ? { ...st, color:f[j++] } : st)), s.shown[owner]);
  }).sort((a, b) => a.rank - b.rank);
  return { best:all[0], worst:all.at(-1) };
}

// 0: a 승, 1: b 승, null: 무승부. 돌이 없으면 지고, 시대가 다르면 앞선 쪽이 이긴다.
function clash(a, b) {
  if (!a || !b) return a ? 0 : b ? 1 : null;
  if (a.age !== b.age) return a.age > b.age ? 0 : 1;
  return versus(a, b);
}

function labNewGame(mods, rng = Math.random) {
  const deck = SPECIALS.map(name => [rng(), name]).sort((a, b) => a[0] - b[0]).map(([, name]) => name);
  const player = p => {
    const GB = Array.from({ length:STOCK }, () => rng()).filter(x => x < 0.5).length;
    return { score:0, stock:{ B:STOCK, W:STOCK, GB, GW:STOCK - GB }, cards:deck.slice(p * mods.cards, (p + 1) * mods.cards), civs:[0,1,2].map(() => ({ stones:[], bannedThrough:0 })) };
  };
  return { turn:1, stage:'assign', over:false, mods:{ ...mods }, pot:0, shown:[[], []], players:[player(0), player(1)], history:[] };
}

const cloneS = s => ({ ...s, shown:s.shown.map(a => [...a]), history:[...s.history],
  players:s.players.map(p => ({ ...p, stock:{ ...p.stock }, civs:p.civs.map(c => ({ ...c, stones:c.stones.map(st => ({ ...st })) })) })) });

const fightable = (s, p) => [0,1,2].filter(i => s.players[p].civs[i].bannedThrough < s.turn && s.players[p].civs[i].stones.length);

// 한 수는 [문명 번호, 토큰] 세 개.
function canMove(s, p, mv) {
  if (!Array.isArray(mv) || mv.length !== 3) return false;
  const pl = s.players[p], onCiv = c => mv.filter(m => m[0] === c).length;
  if (!TOKEN_KEYS.every(k => mv.filter(m => m[1] === k).length <= pl.stock[k])) return false;
  return s.mods.rush ? [0,1,2].every(c => pl.civs[c].stones.length + onCiv(c) <= LAST_TURN) : [0,1,2].every(c => onCiv(c) === 1);
}

// 최강 문명: 앞선 시대, 그다음 높은 순위.
function strongest(s, p) {
  let best = -1, key = -Infinity;
  [0,1,2].forEach(i => { const h = handOf(s, p, i); if (h && h.age * 100 - h.rank > key) { key = h.age * 100 - h.rank; best = i; } });
  return best;
}

function useAbility(s, p, c, hand) {
  const fx = s.mods.ability && hand && !hand.special && ABILITY[hand.name];
  if (!fx) return null;
  const [kind, n] = fx, q = 1 - p, foe = strongest(s, q), who = `문명 ${'ABC'[foe]}`;
  let text = '효과 없음';
  if (kind === 'score') { s.players[p].score += n; text = `승점 +${n}`; }
  if (kind === 'rest') { s.players[p].civs[c].bannedThrough = s.turn; text = '이 문명은 쉬지 않음'; }
  if (kind === 'peek') {
    const hid = s.players[q].civs.flatMap(civ => civ.stones).filter(st => st.kind === 'G' && !st.revealed).slice(0, n);
    hid.forEach(st => { st.revealed = true; });
    if (hid.length) text = `상대 회색돌 ${hid.length}개 공개`;
  }
  if (foe >= 0 && kind === 'break') {
    s.players[q].civs[foe].stones.slice(-n).forEach(st => { st.color = flipColor(st.color); });
    text = `상대 ${who}의 마지막 돌 ${n}개 뒤집음`;
  }
  if (foe >= 0 && kind === 'lock') {
    s.players[q].civs[foe].bannedThrough = Math.max(s.players[q].civs[foe].bannedThrough, s.turn + 1);
    text = `상대 ${who} 다음 턴 출전 금지`;
  }
  return { p, name:hand.name, text };
}

// a, b: 맞붙는 문명 번호. 출전할 문명이 없으면 null.
function resolve(s, a, b) {
  const t = s.turn, picks = [a, b], { mods } = s;
  const hands = picks.map((c, p) => c === null ? null : handOf(s, p, c));
  const seqs = picks.map((c, p) => c === null ? '' : seqOfStones(mods, s.players[p].civs[c].stones));
  if (!mods.fronts) picks.forEach((c, p) => { if (c !== null) s.players[p].civs[c].stones.forEach(st => { st.revealed = true; }); });
  const winner = clash(hands[0], hands[1]), gain = winner === null ? 0 : pointsFor(t) + s.pot;
  if (winner !== null) { s.players[winner].score += gain; s.pot = 0; } else if (mods.carry) s.pot += pointsFor(t);
  if (mods.capture && winner !== null && picks[1 - winner] !== null) {
    const last = s.players[1 - winner].civs[picks[1 - winner]].stones.at(-1);
    if (last) last.color = flipColor(last.color);
  }
  if (!mods.fronts) picks.forEach((c, p) => { if (c !== null) s.players[p].civs[c].bannedThrough = t + (p === winner ? 2 : 1); });
  const effects = picks.map((c, p) => c === null ? null : useAbility(s, p, c, hands[p])).filter(Boolean);
  hands.forEach((h, p) => { if (h?.special && !s.shown[p].includes(h.name)) s.shown[p].push(h.name); });
  return { fighters:picks, seqs, hands, winner, gain, effects };
}

function finish(s, battles) {
  const wins = [0, 1].map(p => battles.filter(b => b.winner === p).length);
  s.history.push({ turn:s.turn, winner:wins[0] === wins[1] ? null : wins[0] > wins[1] ? 0 : 1, battles });
  s.turn++;
  s.stage = 'assign';
  s.over = s.turn > LAST_TURN;
  return s;
}

function labPlace(prev, moves) {
  const s = cloneS(prev);
  moves.forEach((mv, p) => {
    if (!canMove(s, p, mv)) throw new Error('돌 배분 오류');
    mv.forEach(([c, k]) => { s.players[p].stock[k]--; s.players[p].civs[c].stones.push(stoneOf(k)); });
  });
  if (!s.mods.fronts) { s.stage = 'fight'; return s; }
  return finish(s, [0,1,2].map(i => resolve(s, i, i)));
}

function labFight(prev, fighters) {
  const s = cloneS(prev);
  return finish(s, [resolve(s, fighters[0], fighters[1])]);
}

// ---------- 봇: 공개 정보로 판을 상상해 끝까지 둬 보고 평균이 좋은 수를 고른다 ----------
const BOT = { cands:48, K:6 };
const pickOf = (a, rng) => a[Math.floor(rng() * a.length)];

function randomMove(s, p, rng) {
  const left = { ...s.players[p].stock }, room = s.players[p].civs.map(c => LAST_TURN - c.stones.length);
  return [0,1,2].map(n => {
    const c = s.mods.rush ? pickOf([0,1,2].filter(i => room[i] > 0), rng) : n;
    const k = pickOf(TOKEN_KEYS.filter(x => left[x] > 0), rng);
    left[k]--; room[c]--;
    return [c, k];
  });
}

// 돌을 놓은 뒤 세 문명 순위의 합. 수를 고르는 대충의 기준.
function moveValue(s, p, mv) {
  return [0,1,2].reduce((sum, c) => {
    const stones = [...s.players[p].civs[c].stones, ...mv.filter(m => m[0] === c).map(m => stoneOf(m[1]))];
    if (!stones.length) return sum;
    const rows = TABLES[stones.length].length, e = evaluate(stones.length, seqOfStones(s.mods, stones), s.players[p].cards);
    return sum + 1 - (e.rank - 1) / rows + (s.mods.rush ? stones.length * 0.3 : 0);
  }, 0);
}
function quickMove(s, p, rng) {
  let best = null, bv = -Infinity;
  for (let i = 0; i < 3; i++) { const mv = randomMove(s, p, rng), v = moveValue(s, p, mv); if (v > bv) { bv = v; best = mv; } }
  return best;
}
function quickField(s, p, rng) {
  const legal = fightable(s, p);
  if (!legal.length) return null;
  if (rng() < 0.3) return pickOf(legal, rng);
  return legal.reduce((a, b) => handOf(s, p, b).rank < handOf(s, p, a).rank ? b : a);
}
function playout(s, rng) {
  while (!s.over) {
    s = labPlace(s, [quickMove(s, 0, rng), quickMove(s, 1, rng)]);
    if (s.stage === 'fight') s = labFight(s, [quickField(s, 0, rng), quickField(s, 1, rng)]);
  }
  return s;
}
const margin = (s, p) => { const w = winnerOf(s); return s.players[p].score - s.players[1 - p].score + (w === null ? 0 : w === p ? 3 : -3); };

// p가 모르는 것(상대 숨은 돌, 남은 회색돌 속 색, 안 드러난 카드)을 무작위로 채운다.
function imagine(s, p, rng) {
  const d = cloneS(s), q = 1 - p, foe = d.players[q], left = foe.stock.GB + foe.stock.GW;
  foe.civs.forEach(civ => civ.stones.forEach(st => { if (st.kind === 'G' && !st.revealed) st.color = rng() < 0.5 ? 'B' : 'W'; }));
  foe.stock.GB = Array.from({ length:left }, () => rng()).filter(x => x < 0.5).length;
  foe.stock.GW = left - foe.stock.GB;
  const unknown = SPECIALS.filter(n => !d.players[p].cards.includes(n) && !d.shown[q].includes(n)).map(n => [rng(), n]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  foe.cards = foe.cards.map(c => d.shown[q].includes(c) ? c : unknown.pop());
  return d;
}

function labBotMove(s, p, rng = Math.random) {
  const all = s.mods.rush ? Array.from({ length:BOT.cands }, () => randomMove(s, p, rng)) : OPTIONS.map(o => o.map((k, i) => [i, k])).filter(mv => canMove(s, p, mv)).sort(() => rng() - 0.5).slice(0, BOT.cands);
  let best = all[0], bv = -Infinity;
  for (const mv of all) {
    let sum = 0;
    for (let k = 0; k < BOT.K; k++) {
      const d = imagine(s, p, rng), opp = quickMove(d, 1 - p, rng);
      let n = labPlace(d, p === 0 ? [mv, opp] : [opp, mv]);
      if (n.stage === 'fight') n = labFight(n, [quickField(n, 0, rng), quickField(n, 1, rng)]);
      sum += margin(playout(n, rng), p);
    }
    if (sum > bv) { bv = sum; best = mv; }
  }
  return best;
}

function labBotField(s, p, rng = Math.random) {
  const legal = fightable(s, p);
  if (legal.length < 2) return legal[0] ?? null;
  let best = legal[0], bv = -Infinity;
  for (const c of legal) {
    let sum = 0;
    for (let k = 0; k < BOT.K * 8; k++) {
      const d = imagine(s, p, rng), opp = quickField(d, 1 - p, rng);
      sum += margin(playout(labFight(d, p === 0 ? [c, opp] : [opp, c]), rng), p);
    }
    if (sum > bv) { bv = sum; best = c; }
  }
  return best;
}

function labSelfCheck() {
  const eq = (actual, expected, label) => { if (actual !== expected) throw new Error(`실험실 점검 실패: ${label}`); };
  const names = Object.values(TABLES).flat().filter(r => !r[4]).map(r => r[2]);
  Object.keys(ABILITY).forEach(n => eq(names.includes(n), true, `능력 족보 이름 ${n}`));
  const st = (color, kind = color) => ({ kind, color, revealed:kind !== 'G' });
  eq(explode([st('B'), st('W'), st('W'), st('B', 'G'), st('W'), st('W')]), 'BBBBWW', '회색 폭발');
  eq(explode([st('B', 'G'), st('W')]), 'BW', '양쪽에 같은 색이 없으면 그대로');
  eq(clash({ age:5, rank:9, beats:0 }, { age:4, rank:1, beats:0 }), 0, '앞선 시대가 이김');
  eq(clash(null, { age:1, rank:2, beats:0 }), 1, '돌 없는 문명은 짐');
  // 실험을 하나씩, 그리고 전부 켜고 무작위로 끝까지 둔다.
  let x = 7;
  const rng = () => (x = x * 16807 % 2147483647) / 2147483647;
  const off = Object.fromEntries(MODS.map(m => [m.id, false]));
  for (const on of [...MODS.map(m => [m.id]), MODS.map(m => m.id)]) {
    let g = labNewGame({ ...off, ...Object.fromEntries(on.map(id => [id, true])), cards:2 }, rng);
    while (!g.over) {
      g = labPlace(g, [randomMove(g, 0, rng), randomMove(g, 1, rng)]);
      if (g.stage === 'fight') g = labFight(g, [0, 1].map(p => { const l = fightable(g, p); return l.length ? pickOf(l, rng) : null; }));
    }
    eq(g.players.every(p => p.civs.flatMap(c => c.stones).length === 21 && Object.values(p.stock).every(n => n === 0)), true, `${on} 돌 21개를 다 씀`);
    eq(g.history.length, LAST_TURN, `${on} 일곱 턴`);
  }
}
labSelfCheck();

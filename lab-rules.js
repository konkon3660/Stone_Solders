// 실험실 규칙: 버릴 시험판. game.js의 족보표와 판정 위에 켠 실험만 얹는다. 성공한 실험만 game.js로 옮긴다.
// ponytail: 온라인 없음. 봇은 규칙을 모르는 몬테카를로라 약하다. 살아남은 실험만 전용 봇을 만든다.
// 본 게임 규칙(테크 능력, 테크 러시, 무승부 이월, 돌 뽑기)은 늘 켠다. 실험은 서로 섞이지 않으니 하나만 고른다.
const EXPERIMENTS = [
  { id:'tree', name:'테크 트리', desc:'족보표 대신 테크 트리. 돌 하나가 흑 가지나 백 가지 하나를 고르고, 가지는 갈라졌다 합쳐진다. 노드마다 힘이 있고 힘이 센 쪽이 이긴다. 군대는 일찍 세고 학문은 늦게 크며, 상업과 문화는 약한 대신 능력이 있다. 불가사의 카드는 없다.' },
  { id:'shape', name:'모양 족보', desc:'돌 순서의 모양으로 판정한다. 표 한 장, 여섯 줄을 돌 개수와 상관없이 쓴다. 불가사의 카드와 테크 능력은 없다.' },
  { id:'augment', name:'증강 모드', desc:'매 턴 카드 2장 중 1장을 손패로 가져온다. 돌 배치 전 준비 카드, 배치 공개 후 전술 카드 중 턴당 1장을 쓴다.' },
  { id:'fronts', name:'세 전선', desc:'출전을 고르지 않고 문명 A·B·C가 상대 A·B·C와 매 턴 동시에 싸운다. 출전 제한은 없고, 회색돌은 끝까지 숨는다.' },
  { id:'final', name:'최종 결전', desc:'7턴에는 세 문명을 전선 1·2·3에 비밀로 배치해 동시에 싸운다. 이긴 전선이 더 많은 쪽이 7턴 점수와 이월 점수를 모두 가져간다. 7턴에는 능력이 없다.' },
];
// 어느 실험에나 얹을 수 있는 간단한 규칙.
const ADDONS = [
  { id:'bag', name:'주머니 뽑기', desc:'뽑은 돌 21개를 섞어 주머니에 넣고 매 턴 3개를 꺼내 쓴다. 꺼낸 돌은 상대도 본다(회색돌 속 색은 숨김).' },
  { id:'bomb', name:'회색 폭발', desc:'회색돌이 같은 색 돌 사이에 낀 돌을 뒤집는다. 족보를 정할 때 적용한다.' },
];
// 모양 족보, 강한 순서: [이름, 설명, 예시]. 대체로 드문 모양이 위고, 외톨이만 하이리스크 규칙으로 꼴찌다.
const SHAPES = [
  ['외길','전부 같은 색','BBBBB'],
  ['교대','두 색이 번갈아 놓였다','BWBWB'],
  ['대칭','앞에서 읽으나 뒤에서 읽으나 같다','BWWWB'],
  ['두 덩이','색이 딱 한 번 바뀐다','BBBWW'],
  ['잡탕','아무 모양도 아니다','BBWBW'],
  ['외톨이','한 돌만 색이 달라 외길을 망쳤다','BBBWB'],
];
function shapeIndex(seq) {
  const n = seq.length, black = countBlack(seq), minority = Math.min(black, n - black);
  const changes = [...seq].slice(1).filter((c, i) => c !== seq[i]).length;
  if (minority === 0) return 0;
  if (changes === n - 1) return 1;
  if (minority === 1) return 5;
  if (seq === [...seq].reverse().join('')) return 2;
  return changes === 1 ? 3 : 4;
}
function shapeHand(seq) {
  const i = shapeIndex(seq), black = countBlack(seq);
  return { black, white:seq.length - black, rank:i + 1, name:SHAPES[i][0], why:SHAPES[i][1], special:false, beats:0 };
}
// ---------- 테크 트리 ----------
// 갈래마다 흑 가지(B)와 백 가지(W)가 가는 갈래, 돌 개수별 노드 [이름, 힘, 능력, 이야기]. 가지는 갈라졌다 합쳐진다.
// 이야기는 노드에 닿은 사연이다. 어느 부모에서 와도 말이 되게 쓴다.
// 군대는 일찍 세지만 끝이 약하고, 학문은 늦게 크며, 상업과 문화는 약한 대신 능력이 있다. 다음 힘만 좇으면 흑만 쌓여 핵무기에 그친다.
const TREE_ROOT = { B:'A', W:'F' };
const TREE = {
  A:{ name:'군대', B:'A', W:'C', at:{
    1:['돌창',2,null,'돌을 깎아 창을 들었다.'],
    2:['청동검',3,null,'청동을 녹여 검을 벼렸다.'],
    3:['전차',5,null,'말이 끄는 전차로 들판을 휩쓸었다.'],
    4:['기사단',7,null,'갑옷 입은 기사들이 땅을 차지했다.'],
    5:['머스킷 부대',8,['capture',1],'총을 든 보병이 줄지어 진군했다.'],
    6:['기관총',9,['capture',2],'기관총이 전장을 갈아엎었다.'],
    7:['핵무기',11,null,'쓸 수 없는 무기만 쌓여 갔다.'] } },
  B:{ name:'공학', B:'A', W:'D', at:{
    2:['대장간',2,null,'불로 쇠를 다루는 법을 익혔다.'],
    3:['바퀴',3,['rest'],'바퀴를 굴려 먼 곳까지 오갔다.'],
    4:['투석기',5,['break',1],'셈을 해서 돌을 성벽 너머로 날렸다.'],
    5:['대포',7,['break',2],'화약을 쇠통에 담아 성벽을 무너뜨렸다.'],
    6:['증기기관',9,null,'증기의 힘으로 기계를 돌렸다.'],
    7:['로켓',12,null,'로켓을 쏘아 하늘 끝에 닿았다.'] } },
  C:{ name:'통치', B:'C', W:'D', at:{
    2:['족장',2,null,'무리를 이끌 족장이 나섰다.'],
    3:['법전',4,['lock'],'법을 돌에 새겨 모두를 묶었다.'],
    4:['왕국',6,null,'군대와 법을 갖춘 왕국을 세웠다.'],
    5:['절대 왕정',8,['lock'],'왕이 모든 권력을 한 손에 쥐었다.'],
    6:['제국',10,null,'여러 나라를 거느린 제국이 되었다.'],
    7:['초강대국',13,null,'온 세계가 그 나라의 눈치를 보았다.'] } },
  D:{ name:'상업', B:'B', W:'E', at:{
    3:['화폐',3,['score',1],'조개 대신 동전으로 물건을 사고팔았다.'],
    4:['길드',4,['score',1],'장인과 상인이 모여 조합을 꾸렸다.'],
    5:['무역 회사',5,['score',1],'배를 띄워 먼 바다 너머와 거래했다.'],
    6:['은행',7,['score',2],'돈을 빌려주고 이자를 받았다.'],
    7:['세계 시장',9,['score',2],'온 세계가 하나의 시장이 되었다.'] } },
  E:{ name:'문화', B:'C', W:'F', at:{
    4:['축제',4,['rest'],'넉넉해진 사람들이 축제를 열었다.'],
    5:['르네상스',6,['score',1],'부자들이 예술가를 후원했다.'],
    6:['신문',8,['peek',3],'신문이 감춰진 일을 들춰냈다.'],
    7:['대중문화',10,['score',2],'노래와 영화가 국경을 넘었다.'] } },
  F:{ name:'학문', B:'B', W:'F', at:{
    1:['불',1,['peek',1],'불을 피워 밤을 밝혔다.'],
    2:['문자',2,['peek',1],'기억을 글자로 남겼다.'],
    3:['철학',3,['peek',2],'세상이 왜 이런지 묻기 시작했다.'],
    4:['대학',5,['peek',2],'학자들이 모여 대학을 세웠다.'],
    5:['과학 혁명',7,null,'실험으로 하늘과 땅의 법칙을 밝혔다.'],
    6:['백과사전',11,null,'세상의 지식을 책 한 질에 모았다.'],
    7:['인터넷',16,null,'모든 지식이 모두에게 열렸다.'] } },
};
// 돌 순서를 따라 나무를 걷는다. why는 지나온 이야기 전부.
function treeHand(seq) {
  let lane = null;
  const story = [...seq].map((c, i) => { lane = (lane ? TREE[lane] : TREE_ROOT)[c]; return TREE[lane].at[i + 1][3]; });
  const [name, power, fx] = TREE[lane].at[seq.length], black = countBlack(seq);
  return { black, white:seq.length - black, rank:1, name, why:story.join(' '), special:false, beats:0, power, fx, lane };
}
const judge = (mods, seq, cards) => mods.tree ? treeHand(seq) : mods.shape ? shapeHand(seq) : evaluate(seq.length, seq, cards);

const shuffled = (a, rng) => a.map(x => [rng(), x]).sort((p, q) => p[0] - q[0]).map(x => x[1]);
// 주머니 뽑기: stock을 이번 턴에 뽑은 돌로 바꾼다.
function drawFromBag(pl) {
  pl.stock = { B:0, W:0, GB:0, GW:0 };
  pl.bag.slice(0, 3).forEach(k => { pl.stock[k]++; });
  pl.bag = pl.bag.slice(3);
}

// ---------- 증강 모드 카드 ----------
const newFx = () => ({ blocked:[null, null], spoils:[false, false], used:[false, false], double:false, reverse:false, truce:false, log:[] });
const stonesWhere = (s, owner, test) => s.players[owner].civs.flatMap((civ, c) => civ.stones.flatMap((st, i) => test(st) ? [{ civ:c, i }] : []));
const allCivs = () => [0,1,2].map(civ => ({ civ }));
const noTarget = () => [{}];
const flipStone = (s, owner, u) => { const st = s.players[owner].civs[u.civ].stones[u.i]; st.color = flipColor(st.color); };

// stage: 쓰는 시점, order: 동시 공개 때 적용 순서(1 출전, 2 돌, 3 점수), n: 덱에 넣는 장수, until: 쓸 수 있는 마지막 턴.
const CARDS = {
  '신탁':{ stage:'prep', order:2, n:2, until:7, text:'내 남은 회색돌 하나의 속 색을 바꾼다.',
    uses:(s, p) => ['GB','GW'].filter(k => s.players[p].stock[k] > 0).map(token => ({ token })),
    run:(s, p, u) => { const st = s.players[p].stock; st[u.token]--; st[u.token === 'GB' ? 'GW' : 'GB']++; } },
  '역사 수정':{ stage:'prep', order:2, n:2, until:7, text:'내 문명 하나의 돌 두 개의 순서를 바꾼다.',
    uses:(s, p) => s.players[p].civs.flatMap((civ, c) => civ.stones.flatMap((a, i) => civ.stones.slice(i + 1).flatMap((b, k) => a.color !== b.color ? [{ civ:c, i, j:i + 1 + k }] : []))),
    run:(s, p, u) => { const st = s.players[p].civs[u.civ].stones; [st[u.i], st[u.j]] = [st[u.j], st[u.i]]; } },
  '개종':{ stage:'prep', order:2, n:2, until:6, text:'내 문명 하나의 돌 하나의 색을 바꾼다. 7턴 불가.',
    uses:(s, p) => stonesWhere(s, p, () => true), run:(s, p, u) => flipStone(s, p, u) },
  '봉쇄':{ stage:'prep', order:1, n:1, until:6, text:'상대 문명 하나가 이번 턴 흑돌 또는 백돌을 받지 못한다. 회색돌은 받는다. 7턴 불가.',
    uses:(s, p) => ['B','W'].flatMap(block => allCivs().map(x => ({ ...x, block }))).filter(u => canBlock(s, 1 - p, u)),
    run:(s, p, u) => { s.fx.blocked[1 - p] = { civ:u.civ, token:u.block }; } },
  '선동':{ stage:'prep', order:2, n:1, until:5, text:'상대 문명 하나의 공개된 돌 하나의 색을 바꾼다. 6·7턴 불가.',
    uses:(s, p) => stonesWhere(s, 1 - p, st => st.revealed), run:(s, p, u) => flipStone(s, 1 - p, u) },
  '첩보':{ stage:'tactic', order:2, n:2, until:7, text:'상대의 숨은 회색돌 하나의 색을 나만 확인한다.',
    uses:(s, p) => stonesWhere(s, 1 - p, st => st.kind === 'G' && !st.revealed && st.seenBy !== p),
    run:(s, p, u) => { s.players[1 - p].civs[u.civ].stones[u.i].seenBy = p; } },
  '전리품':{ stage:'tactic', order:3, n:2, until:7, text:'이번 턴 내가 이기면 승점 1점을 더 얻는다.',
    uses:noTarget, run:(s, p) => { s.fx.spoils[p] = true; } },
  '강행군':{ stage:'tactic', order:1, n:2, until:7, text:'내 문명 하나의 출전 제한을 1턴 줄인다.',
    uses:(s, p) => allCivs().filter(x => s.players[p].civs[x.civ].bannedThrough >= s.turn),
    run:(s, p, u) => { s.players[p].civs[u.civ].bannedThrough--; } },
  '전선 봉쇄':{ stage:'tactic', order:1, n:1, until:6, text:'상대 문명 하나를 이번 턴 출전하지 못하게 한다. 출전 가능 문명이 하나뿐이면 못 쓴다. 7턴 불가.',
    uses:(s, p) => fightable(s, 1 - p).length > 1 ? fightable(s, 1 - p).map(civ => ({ civ })) : [],
    run:(s, p, u) => { const civ = s.players[1 - p].civs[u.civ]; civ.bannedThrough = Math.max(civ.bannedThrough, s.turn); } },
  '총력전':{ stage:'tactic', order:3, n:1, until:6, text:'이번 턴 승점이 누가 이기든 2배가 된다. 7턴 불가.',
    uses:noTarget, run:s => { s.fx.double = true; } },
  '휴전':{ stage:'tactic', order:3, n:1, until:6, text:'이번 턴 전투를 하지 않는다. 승점과 출전 제한이 없다. 7턴 불가.',
    uses:noTarget, run:s => { s.fx.truce = true; } },
  '시대 역행':{ stage:'tactic', order:3, n:1, until:6, text:'이번 턴 순위를 거꾸로 적용하고 불가사의의 상위 격파를 끈다. 7턴 불가.',
    uses:noTarget, run:s => { s.fx.reverse = true; } },
};
const DECK = Object.entries(CARDS).flatMap(([name, c]) => Array(c.n).fill(name));
const offerCards = pl => { pl.offer = pl.deck.slice(0, 2); pl.deck = pl.deck.slice(2); };

const legalUses = (s, p, stage, hand = s.players[p].hand) => s.fx.used[p] ? [] : [...new Set(hand)].flatMap(card => {
  const c = CARDS[card];
  return c.stage === stage && s.turn <= c.until ? c.uses(s, p).map(u => ({ card, ...u })) : [];
});
const useWhere = u => [u.civ === undefined ? '' : `문명 ${'ABC'[u.civ]}`, u.j !== undefined ? `${u.i + 1}·${u.j + 1}번째 돌` : u.i !== undefined ? `${u.i + 1}번째 돌` : '', u.block ? `${u.block === 'B' ? '흑' : '백'}돌 금지` : ''].filter(Boolean).join(' ');

// 동시에 공개된 카드 적용. 양쪽이 같은 돌을 바꾸면 둘 다 무효.
function applyUses(s, uses) {
  const keys = (u, p) => !u ? [] : u.card === '개종' ? [`${p}${u.civ}${u.i}`] : u.card === '역사 수정' ? [`${p}${u.civ}${u.i}`, `${p}${u.civ}${u.j}`] : u.card === '선동' ? [`${1 - p}${u.civ}${u.i}`] : [];
  const [a, b] = uses.map(keys), voided = a.some(k => b.includes(k));
  uses.map((u, p) => ({ u, p })).filter(x => x.u).sort((x, y) => CARDS[x.u.card].order - CARDS[y.u.card].order).forEach(({ u, p }) => {
    const pl = s.players[p], at = pl.hand.indexOf(u.card);
    pl.hand = pl.hand.filter((_, i) => i !== at);
    s.fx.used[p] = true;
    s.fx.log.push({ p, text:[u.card, useWhere(u), voided ? '(같은 돌을 건드려 무효)' : ''].filter(Boolean).join(' ') });
    if (!voided) CARDS[u.card].run(s, p, u);
  });
}

// acts[p] = { keep:고른 카드, use:쓸 카드 또는 null }. null이면 첫 카드를 고르고 쓰지 않는다.
// ponytail: 손패가 3장을 넘으면 가장 오래된 카드를 자동으로 버린다. 플레이어가 고르게 하려면 단계 하나가 더 필요하다.
function labPrep(prev, acts) {
  const s = cloneS(prev);
  const uses = acts.map((a, p) => {
    const pl = s.players[p], keep = a?.keep ?? pl.offer[0], back = pl.offer[0] === keep ? pl.offer[1] : pl.offer[0];
    pl.hand = [...pl.hand, keep];
    pl.deck = [...pl.deck, back];
    pl.offer = [];
    return a?.use ?? null;
  });
  applyUses(s, uses);
  s.players.forEach(pl => { pl.hand = pl.hand.slice(-3); });
  s.stage = 'assign';
  return s;
}

function labTactic(prev, acts) {
  const s = cloneS(prev);
  applyUses(s, acts.map(a => a?.use ?? null));
  if (s.fx.truce) return finish(s, []);
  s.stage = 'fight';
  return s;
}

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
  if (!stones.length) return null;
  const h = judge(s.mods, seqOfStones(s.mods, stones), s.players[p].cards);
  // clash는 age부터 비교한다. 나무에서는 돌 개수 대신 힘으로 겨룬다.
  return { ...h, age:s.mods.tree ? h.power : stones.length };
};

// 공개 정보만으로 본 상대 문명의 족보 범위.
function handRange(s, owner, i, view) {
  const stones = s.players[owner].civs[i].stones, hidden = st => st.kind === 'G' && !st.revealed && st.seenBy !== view;
  if (!stones.length) return null;
  const all = fills('?'.repeat(stones.filter(hidden).length)).map(f => {
    let j = 0;
    return judge(s.mods, seqOfStones(s.mods, stones.map(st => hidden(st) ? { ...st, color:f[j++] } : st)), s.shown[owner]);
  }).sort((a, b) => (b.power ?? 0) - (a.power ?? 0) || a.rank - b.rank);
  return { best:all[0], worst:all.at(-1) };
}

// mods = { exp:실험 id 또는 'none', bag, bomb, cards }. 판 안에서는 s.mods[실험 id]가 true다.
function labNewGame(choice, rng = Math.random) {
  const mods = { ...choice, [choice.exp]:true };
  const deck = SPECIALS.map(name => [rng(), name]).sort((a, b) => a[0] - b[0]).map(([, name]) => name);
  const player = p => {
    const [drawn, jackpot] = drawStones(rng), [B, W, G] = drawn;
    const GB = Array.from({ length:G }, () => rng()).filter(x => x < 0.5).length;
    const pl = { score:0, drawn, jackpot, stock:{ B, W, GB, GW:G - GB }, cards:deck.slice(p * mods.cards, (p + 1) * mods.cards), civs:[0,1,2].map(() => ({ stones:[], bannedThrough:0 })) };
    if (mods.bag) { pl.bag = shuffled(Object.entries(pl.stock).flatMap(([k, n]) => Array(n).fill(k)), rng); drawFromBag(pl); }
    if (mods.augment) { pl.deck = shuffled(DECK, rng); pl.hand = []; offerCards(pl); }
    return pl;
  };
  return { turn:1, stage:mods.augment ? 'prep' : 'assign', over:false, mods, pot:0, fx:newFx(), shown:[[], []], players:[player(0), player(1)], history:[] };
}

const cloneS = s => ({ ...copyState(s), shown:s.shown.map(a => [...a]),
  fx:{ ...s.fx, blocked:[...s.fx.blocked], spoils:[...s.fx.spoils], used:[...s.fx.used], log:[...s.fx.log] } });
// 최종 결전: 세 문명을 전선 1·2·3에 놓는 여섯 가지 순서. 7턴이면 어느 규칙에서든 모든 문명이 돌 7개다.
const PERMS = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
const isFinal = s => s.mods.final && s.turn === LAST_TURN;
// 고를 수 있는 것: 보통은 문명 번호, 최종 결전이면 PERMS 번호.
const fightable = (s, p) => isFinal(s) ? [0,1,2,3,4,5] : [0,1,2].filter(i => s.players[p].civs[i].bannedThrough < s.turn && s.players[p].civs[i].stones.length);

// 봉쇄해도 q가 돌 세 개를 다 둘 수 있어야 한다. 막힌 색 돌은 나머지 문명 자리에만 들어간다.
function canBlock(s, q, u) {
  const pl = s.players[q], free = TOKEN_KEYS.reduce((n, k) => n + (k === u.block ? 0 : pl.stock[k]), 0);
  const room = [0,1,2].reduce((n, c) => n + (c === u.civ ? 0 : LAST_TURN - pl.civs[c].stones.length), 0);
  return Math.max(0, 3 - free) <= room;
}

// 한 수는 [문명 번호, 토큰] 세 개.
function canMove(s, p, mv) {
  if (!Array.isArray(mv) || mv.length !== 3) return false;
  const pl = s.players[p], onCiv = c => mv.filter(m => m[0] === c).length, block = s.fx.blocked[p];
  if (!TOKEN_KEYS.every(k => mv.filter(m => m[1] === k).length <= pl.stock[k])) return false;
  if (block && mv.some(m => m[0] === block.civ && m[1] === block.token)) return false;
  return [0,1,2].every(c => pl.civs[c].stones.length + onCiv(c) <= LAST_TURN);
}

// a, b: 맞붙는 문명 번호. 출전할 문명이 없으면 null.
function resolve(s, a, b) {
  const t = s.turn, picks = [a, b], { mods } = s;
  const hands = picks.map((c, p) => c === null ? null : handOf(s, p, c));
  const seqs = picks.map((c, p) => c === null ? '' : seqOfStones(mods, s.players[p].civs[c].stones));
  if (!mods.fronts) picks.forEach((c, p) => { if (c !== null) s.players[p].civs[c].stones.forEach(st => { st.revealed = true; }); });
  const turned = h => h && s.fx.reverse ? { ...h, rank:1000 - h.rank, beats:0 } : h;
  const winner = clash(turned(hands[0]), turned(hands[1])), gain = winner === null ? 0 : (pointsFor(t) + s.pot) * (s.fx.double ? 2 : 1) + (s.fx.spoils[winner] ? 1 : 0);
  if (winner !== null) { s.players[winner].score += gain; s.pot = 0; } else s.pot += pointsFor(t);
  if (!mods.fronts) picks.forEach((c, p) => { if (c !== null) s.players[p].civs[c].bannedThrough = t + (p === winner ? 2 : 1); });
  const effects = picks.map((c, p) => c === null ? null : useAbility(s, p, c, hands[p], winner, picks[1 - p], strongest(s, 1 - p, handOf))).filter(Boolean);
  hands.forEach((h, p) => { if (h?.special && !s.shown[p].includes(h.name)) s.shown[p].push(h.name); });
  return { fighters:picks, seqs, hands, winner, gain, effects, reversed:s.fx.reverse };
}

// 7턴 결전. perms[p][전선] = 그 전선에 나갈 p의 문명. 이긴 전선이 많은 쪽이 판돈을 모두 가져간다.
function resolveFinal(s, perms) {
  const battles = [0,1,2].map(lane => {
    const picks = perms.map(o => o[lane]), hands = picks.map((c, p) => handOf(s, p, c));
    return { fighters:picks, seqs:picks.map((c, p) => seqOfStones(s.mods, s.players[p].civs[c].stones)), hands, winner:clash(hands[0], hands[1]), gain:0, effects:[], final:true };
  });
  s.players.forEach(pl => pl.civs.forEach(civ => civ.stones.forEach(st => { st.revealed = true; })));
  const wins = [0, 1].map(p => battles.filter(b => b.winner === p).length);
  const w = wins[0] === wins[1] ? null : wins[0] > wins[1] ? 0 : 1, gain = w === null ? 0 : pointsFor(s.turn) + s.pot;
  if (w !== null) { s.players[w].score += gain; s.pot = 0; }
  return finish(s, battles, gain);
}

function finish(s, battles, gain = 0) {
  const wins = [0, 1].map(p => battles.filter(b => b.winner === p).length);
  s.history.push({ turn:s.turn, winner:wins[0] === wins[1] ? null : wins[0] > wins[1] ? 0 : 1, battles, gain, truce:s.fx.truce, log:s.fx.log });
  s.turn++;
  s.stage = s.mods.augment ? 'prep' : 'assign';
  s.over = s.turn > LAST_TURN;
  s.fx = newFx();
  if (s.mods.bag) s.players.forEach(drawFromBag);
  if (s.mods.augment && !s.over) s.players.forEach(offerCards);
  return s;
}

function labPlace(prev, moves) {
  const s = cloneS(prev);
  moves.forEach((mv, p) => {
    if (!canMove(s, p, mv)) throw new Error('돌 배분 오류');
    mv.forEach(([c, k]) => { s.players[p].stock[k]--; s.players[p].civs[c].stones.push(stoneOf(k)); });
  });
  if (s.mods.augment) { s.stage = 'tactic'; return s; }
  if (!s.mods.fronts) { s.stage = 'fight'; return s; }
  return finish(s, [0,1,2].map(i => resolve(s, i, i)));
}

function labFight(prev, fighters) {
  const s = cloneS(prev);
  if (isFinal(s)) return resolveFinal(s, fighters.map(i => PERMS[i]));
  return finish(s, [resolve(s, fighters[0], fighters[1])]);
}

// ---------- 봇: 공개 정보로 판을 상상해 끝까지 둬 보고 평균이 좋은 수를 고른다 ----------
const BOT = { cands:48, K:6 };
const pickOf = (a, rng) => a[Math.floor(rng() * a.length)];

function randomMove(s, p, rng) {
  // 러시에서 봉쇄당하면 앞 돌이 자리를 다 써서 막힐 수 있다. canBlock이 답이 있음을 보장하니 다시 뽑는다.
  for (let tries = 0; tries < 9999; tries++) {
    const left = { ...s.players[p].stock }, room = s.players[p].civs.map(c => LAST_TURN - c.stones.length), block = s.fx.blocked[p];
    const ok = (c, k) => left[k] > 0 && !(block && block.civ === c && block.token === k);
    const mv = [0,1,2].map(() => {
      const c = pickOf([0,1,2].filter(i => room[i] > 0 && TOKEN_KEYS.some(k => ok(i, k))), rng);
      const k = pickOf(TOKEN_KEYS.filter(x => ok(c, x)), rng);
      left[k]--; room[c]--;
      return [c, k];
    });
    if (canMove(s, p, mv) && mv.every(m => m[0] !== undefined)) return mv;
  }
  throw new Error('둘 수 있는 돌이 없음');
}

// 돌을 놓은 뒤 세 문명 순위의 합. 수를 고르는 대충의 기준.
function moveValue(s, p, mv) {
  return [0,1,2].reduce((sum, c) => {
    const stones = [...s.players[p].civs[c].stones, ...mv.filter(m => m[0] === c).map(m => stoneOf(m[1]))];
    if (!stones.length) return sum;
    const e = judge(s.mods, seqOfStones(s.mods, stones), s.players[p].cards);
    if (s.mods.tree) return sum + e.power / 6;
    return sum + 1 - (e.rank - 1) / (s.mods.shape ? SHAPES.length : TABLES[stones.length].length) + stones.length * 0.3;
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
  if (isFinal(s) || rng() < 0.3) return pickOf(legal, rng);
  const key = c => { const h = handOf(s, p, c); return h.age * 100 - h.rank; };
  return legal.reduce((a, b) => key(b) > key(a) ? b : a);
}
function playout(s, rng) {
  while (!s.over) {
    if (s.stage === 'prep') s = labPrep(s, [null, null]);
    else if (s.stage === 'assign') s = labPlace(s, [quickMove(s, 0, rng), quickMove(s, 1, rng)]);
    else if (s.stage === 'tactic') s = labTactic(s, [null, null]);
    else s = labFight(s, [quickField(s, 0, rng), quickField(s, 1, rng)]);
  }
  return s;
}
const margin = (s, p) => { const w = winnerOf(s); return s.players[p].score - s.players[1 - p].score + (w === null ? 0 : w === p ? 3 : -3); };

// p가 모르는 것(상대 숨은 돌, 남은 회색돌 속 색, 안 드러난 카드)을 무작위로 채운다.
function imagine(s, p, rng) {
  const d = cloneS(s), q = 1 - p, foe = d.players[q], left = foe.stock.GB + foe.stock.GW;
  foe.civs.forEach(civ => civ.stones.forEach(st => { if (st.kind === 'G' && !st.revealed && st.seenBy !== p) st.color = rng() < 0.5 ? 'B' : 'W'; }));
  foe.stock.GB = Array.from({ length:left }, () => rng()).filter(x => x < 0.5).length;
  foe.stock.GW = left - foe.stock.GB;
  if (d.mods.bag) { // 주머니 순서는 아무도 모르고, 상대 회색돌 속 색도 모른다.
    foe.bag = shuffled(foe.bag.map(k => TOKENS[k][0] === 'G' ? (rng() < 0.5 ? 'GB' : 'GW') : k), rng);
    d.players[p].bag = shuffled(d.players[p].bag, rng);
  }
  const unknown = SPECIALS.filter(n => !d.players[p].cards.includes(n) && !d.shown[q].includes(n)).map(n => [rng(), n]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  foe.cards = foe.cards.map(c => d.shown[q].includes(c) ? c : unknown.pop());
  return d;
}

function labBotMove(s, p, rng = Math.random) {
  const all = Array.from({ length:BOT.cands }, () => randomMove(s, p, rng));
  let best = all[0], bv = -Infinity;
  for (const mv of all) {
    let sum = 0;
    for (let k = 0; k < BOT.K; k++) {
      const d = imagine(s, p, rng), opp = quickMove(d, 1 - p, rng);
      sum += margin(playout(labPlace(d, p === 0 ? [mv, opp] : [opp, mv]), rng), p);
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

// 카드 쓰기: 안 쓰는 경우보다 평균이 뚜렷이 좋은 사용만 고른다. stage는 'prep' 또는 'tactic'.
// ponytail: 판을 끝까지 둘 때는 양쪽 다 카드를 안 쓴다고 본다. 가져올 카드도 희귀 우선으로 대충 고른다.
function labBotCard(s, p, stage, rng = Math.random) {
  const keep = stage === 'prep' ? (s.players[p].offer.find(c => CARDS[c].n === 1) ?? pickOf(s.players[p].offer, rng)) : undefined;
  const hand = stage === 'prep' ? [...s.players[p].hand, keep] : s.players[p].hand;
  const step = stage === 'prep' ? labPrep : labTactic;
  const value = use => {
    let sum = 0;
    for (let k = 0; k < BOT.K * 4; k++) {
      const act = { keep, use };
      sum += margin(playout(step(imagine(s, p, rng), p === 0 ? [act, null] : [null, act]), rng), p);
    }
    return sum / (BOT.K * 4);
  };
  let best = null, bv = value(null) + 0.5;
  for (const use of shuffled(legalUses(s, p, stage, hand), rng).slice(0, 12)) {
    const v = value(use);
    if (v > bv) { bv = v; best = use; }
  }
  return { keep, use:best };
}

// 무작위 카드 행동. 자체 점검용.
function randomAct(s, p, stage, rng) {
  const keep = stage === 'prep' ? pickOf(s.players[p].offer, rng) : undefined;
  const all = legalUses(s, p, stage, stage === 'prep' ? [...s.players[p].hand, keep] : s.players[p].hand);
  return { keep, use:all.length && rng() < 0.7 ? pickOf(all, rng) : null };
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
  for (let i = 0; i < 200; i++) eq(drawStones(rng)[0].reduce((a, b) => a + b), 21, '뽑은 돌은 21개');
  // 돌 뽑기가 늘 켜져 있으니 돌 수가 중요한 점검은 재고를 고정한다.
  const full = (color, n = 7) => Array.from({ length:n }, () => st(color));
  const game = (exp, rest = {}) => { const g = labNewGame({ exp, bag:false, bomb:false, cards:2, ...rest }, rng); g.players.forEach(pl => { if (!pl.bag) pl.stock = { B:7, W:7, GB:4, GW:3 }; }); return g; };
  // 테크 트리: 어떤 순서로 둬도 노드가 있고, 모든 노드에 닿을 수 있다.
  const reached = new Set();
  for (let n = 1; n <= LAST_TURN; n++) fills('?'.repeat(n)).forEach(q => reached.add(treeHand(q).lane + n));
  eq(reached.size, Object.values(TREE).reduce((k, l) => k + Object.keys(l.at).length, 0), '테크 트리 노드는 모두 닿을 수 있음');
  [['WWWWWWW','인터넷'],['BBBBBBB','핵무기'],['BBBBBBW','초강대국'],['BWW','화폐'],['WB','대장간']].forEach(([q, name]) => eq(treeHand(q).name, name, `테크 트리 ${q}`));
  const tg = game('tree');
  tg.players[0].civs[0].stones = full('B', 4); // 기사단, 힘 7
  tg.players[1].civs[0].stones = [...'BWBBW'].map(c => st(c)); // 무역 회사, 힘 5
  eq(clash(handOf(tg, 0, 0), handOf(tg, 1, 0)), 0, '테크 트리: 돌이 적어도 힘이 세면 이김');
  // 점령은 이겼을 때 진 문명만 뒤집는다. 결전은 이긴 전선이 많은 쪽이 판돈을 가져간다.
  const cap = game('none');
  cap.players[1].civs[0].stones = full('W', 3);
  eq(useAbility(cap, 0, 0, { name:'전차', special:false }, 1, 0), null, '지면 점령 없음');
  useAbility(cap, 0, 0, { name:'전차', special:false }, 0, 0);
  eq(cap.players[1].civs[0].stones.at(-1).color + cap.players[1].civs[0].stones[1].color, 'BW', '이기면 마지막 돌만 점령');
  const end = { ...game('final'), turn:LAST_TURN, stage:'fight', pot:2 };
  end.players[0].cards = end.players[1].cards = [];
  end.players[0].civs.forEach((c, i) => { c.stones = full(i < 2 ? 'W' : 'B'); });
  end.players[1].civs.forEach((c, i) => { c.stones = full(i < 1 ? 'W' : 'B'); });
  const done = labFight(end, [0, 0]);
  eq(done.history[0].battles.map(b => b.winner).join(), ',0,', '전선별 승패');
  eq(done.players[0].score, 5, '결전 승자가 7턴 3점과 이월 2점을 가져감');
  [['B','외길'],['BBBBBBB','외길'],['BW','교대'],['BWBWBWB','교대'],['BWWB','대칭'],['BBBWW','두 덩이'],['BBWBW','잡탕'],['BBBWB','외톨이'],['BBBBW','외톨이']]
    .forEach(([q, name]) => eq(shapeHand(q).name, name, `모양 ${q}`));
  for (let n = 4; n <= LAST_TURN; n++) for (let i = 0; i < n; i++) eq(shapeHand('B'.repeat(i) + 'W' + 'B'.repeat(n - 1 - i)).rank, SHAPES.length, '외길에서 한 돌 빗나가면 꼴찌');
  // 증강 카드 규칙.
  eq(DECK.length, 18, '증강 덱 18장');
  let h = game('augment');
  eq(h.stage, 'prep', '증강은 카드부터');
  h.players[0].offer = ['봉쇄', '신탁'];
  h = labPrep(h, [{ keep:'봉쇄', use:{ card:'봉쇄', civ:0, block:'B' } }, null]);
  eq(h.players[0].hand.length === 0 && h.players[0].deck.at(-1) === '신탁', true, '쓴 카드는 사라지고 안 고른 카드는 덱 아래로');
  eq(canMove(h, 1, [[0,'B'],[1,'W'],[2,'W']]), false, '봉쇄당한 돌은 못 받음');
  eq(canMove(h, 1, [[0,'W'],[1,'B'],[2,'B']]), true, '다른 돌은 받음');
  h = labPlace(h, [[[0,'B'],[1,'W'],[2,'B']], [[0,'W'],[1,'B'],[2,'W']]]);
  eq(h.stage, 'tactic', '배치 뒤 전술 단계');
  h.players[0].hand = ['시대 역행', '휴전'];
  eq(labFight(labTactic(h, [{ use:{ card:'시대 역행' } }, null]), [0, 0]).history[0].battles[0].winner, 1, '시대 역행은 순위를 뒤집음');
  let tr = labTactic(h, [{ use:{ card:'휴전' } }, null]);
  eq(tr.turn === 2 && tr.history[0].truce && tr.players[0].score === 0 && tr.players[0].civs[0].bannedThrough === 0, true, '휴전은 점수와 출전 제한이 없음');
  tr.players[0].offer = ['개종', '신탁'];
  tr.players[1].offer = ['선동', '신탁'];
  tr = labPrep(tr, [{ keep:'개종', use:{ card:'개종', civ:0, i:0 } }, { keep:'선동', use:{ card:'선동', civ:0, i:0 } }]);
  eq(tr.players[0].civs[0].stones[0].color, 'B', '같은 돌을 바꾸면 둘 다 무효');
  // 러시 후반 봉쇄: 막힌 돌이 들어갈 자리가 없으면 못 쓰고, 자리가 있으면 무작위 배치가 답을 찾는다.
  const tight = game('augment'), foe = tight.players[1];
  [7, 6, 2].forEach((n, c) => { foe.civs[c].stones = Array.from({ length:n }, () => stoneOf('B')); });
  foe.stock = { ...foe.stock, B:1, W:2, GB:0, GW:0 };
  eq(canBlock(tight, 1, { civ:2, block:'W' }), false, '막힌 돌 둘 자리가 없으면 봉쇄 불가');
  eq(canBlock(tight, 1, { civ:2, block:'B' }), true, '자리가 있으면 봉쇄 가능');
  tight.fx.blocked[1] = { civ:2, token:'B' };
  for (let i = 0; i < 200; i++) eq(canMove(tight, 1, randomMove(tight, 1, rng)), true, '봉쇄돼도 무작위 배치는 합법');
  // 실험마다, 간단한 규칙을 얹고 안 얹고 무작위로 끝까지 둔다.
  for (const exp of ['none', ...EXPERIMENTS.map(m => m.id)]) for (const on of [false, true]) {
    let g = labNewGame({ exp, bag:on, bomb:on, cards:2 }, rng);
    while (!g.over) {
      if (g.stage === 'prep' || g.stage === 'tactic') g = (g.stage === 'prep' ? labPrep : labTactic)(g, [0, 1].map(p => randomAct(g, p, g.stage, rng)));
      else if (g.stage === 'assign') g = labPlace(g, [randomMove(g, 0, rng), randomMove(g, 1, rng)]);
      else g = labFight(g, [0, 1].map(p => { const l = fightable(g, p); return l.length ? pickOf(l, rng) : null; }));
    }
    eq(g.players.every(p => p.civs.flatMap(c => c.stones).length === 21 && Object.values(p.stock).every(n => n === 0)), true, `${exp} ${on} 돌 21개를 다 씀`);
    eq(g.history.length, LAST_TURN, `${exp} ${on} 일곱 턴`);
  }
}
labSelfCheck();

// 온라인: 방을 만든 쪽이 규칙을 계산하고, 참가자에게는 비밀을 지운 상태만 보낸다.
// ponytail: 방을 만든 쪽이 창을 닫거나 새로고침하면 게임이 끝남. 이어 하기가 필요하면 저장 추가. 그쪽은 개발자 도구로 비밀을 볼 수 있음.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const roomId = code => `stone-soldiers-proto-${code}`;
const NET_ERRORS = {
  'peer-unavailable': '그 코드의 방을 찾을 수 없습니다. 코드를 확인하고, 방을 만든 창이 열려 있는지 확인하세요.',
  'unavailable-id': '방 코드가 겹쳤습니다. 다시 만들어 주세요.',
  'timeout': '연결하지 못했습니다. 일부 회사나 학교 네트워크에서는 막힐 수 있습니다.',
};

function leaveRoom() {
  net?.peer?.destroy();
  net = null;
}

function failNet(err) {
  if (!net || net.conn?.open) return;
  notice = NET_ERRORS[err?.type] ?? '연결하지 못했습니다. 잠시 뒤 다시 시도하세요.';
  leaveRoom();
  phase = 'start';
  render();
}

function sendState() {
  if (net?.conn?.open) net.conn.send({ type:'state', s:maskFor(s, 0) });
}

function hostAdvance() {
  if (s.stage === 'assign' && assigns[0] && assigns[1]) {
    s = placeStones(s, assigns);
    sendState();
    if (phase === 'waiting') enterStage();
  } else if (s.stage === 'fight' && fighters[0] !== null && fighters[1] !== null) {
    s = fightTurn(s, fighters.map(f => f === 'none' ? null : f));
    assigns = [null, null];
    fighters = [null, null];
    sendState();
    phase = 'result';
  }
}

function onGuestMove(msg) {
  const validAssign = canPlace(s.players[1], msg?.assign), noFighter = msg?.fighter === null && !legalFighters(s, 1).length;
  if (msg?.type === 'assign' && !s.over && s.stage === 'assign' && validAssign) assigns[1] = msg.assign;
  else if (msg?.type === 'fight' && !s.over && s.stage === 'fight' && (noFighter || legalFighters(s, 1).includes(msg.fighter))) fighters[1] = msg.fighter ?? 'none';
  else return;
  hostAdvance();
  render();
}

function openRoom() {
  const code = Array.from(crypto.getRandomValues(new Uint8Array(4)), b => CODE_CHARS[b % CODE_CHARS.length]).join('');
  mode = 'online';
  viewer = 0;
  s = newGame();
  assigns = [null, null];
  fighters = [null, null];
  net = { role:'host', code, conn:null, lost:false, peer:new Peer(roomId(code)) };
  phase = 'lobby';
  net.peer.on('error', failNet);
  net.peer.on('connection', conn => {
    net.conn?.close();
    net.conn = conn;
    conn.on('open', () => {
      net.lost = false;
      sendState();
      if (phase === 'lobby') showDraw();
      render();
    });
    conn.on('data', msg => { if (net?.conn === conn) onGuestMove(msg); });
    conn.on('close', () => { if (net?.conn === conn) { net.lost = true; render(); } });
  });
}

function receiveState(next) {
  next.history.forEach(h => { h.hands = h.seqs.map((q, p) => q ? { ...evaluate(q.length, q, next.players[p].cards), age:q.length } : null); });
  const prev = s;
  s = next;
  if (!prev || next.history.length < prev.history.length) { if (next.turn === 1 && next.stage === 'assign') showDraw(); else enterStage(); }
  else if (phase === 'waiting' && next.history.length === prev.history.length) enterStage();
  else if (next.history.length > prev.history.length) phase = 'result';
  render();
}

function joinRoom(code) {
  mode = 'online';
  viewer = 1;
  s = null;
  phase = 'lobby';
  net = { role:'guest', code, conn:null, lost:false, peer:new Peer() };
  net.peer.on('error', failNet);
  net.peer.on('open', () => {
    const conn = net.peer.connect(roomId(code), { serialization:'json', reliable:true });
    net.conn = conn;
    conn.on('open', () => { net.lost = false; render(); });
    conn.on('data', msg => { if (msg?.type === 'state' && isValidView(msg.s)) receiveState(msg.s); });
    conn.on('close', () => { if (net?.conn === conn) { net.lost = true; render(); } });
  });
  setTimeout(() => { if (net?.code === code && !net.conn?.open) failNet({ type:'timeout' }); }, 20000);
}

function submitOnline(type, value) {
  phase = 'waiting';
  if (net.role === 'guest') {
    if (net.conn?.open) net.conn.send(type === 'assign' ? { type, assign:value } : { type, fighter:value });
    return;
  }
  if (type === 'assign') assigns[0] = value; else fighters[0] = value ?? 'none';
  hostAdvance();
}

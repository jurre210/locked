/**
 * Online co-op over a raw WebRTC data channel.
 *
 * There is no server behind this site — it is a static page on GitHub Pages —
 * so the two peers are introduced by hand: the host generates a code, the guest
 * pastes it and generates a reply code, the host pastes that back. After that
 * the connection is direct and nothing touches a third party.
 *
 * The model is host-authoritative. The host runs the whole simulation and ships
 * a snapshot 20 times a second; the guest sends only its input and draws what it
 * is told. Deterministic lockstep would be cheaper on bandwidth but relies on
 * two browsers agreeing on floating point, which they do not.
 */

const ICE = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }] };

/* ------------------------------------------------------------------ */
/* signalling codes                                                    */
/* ------------------------------------------------------------------ */
const b64 = {
  enc: s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))
};

/**
 * Squeeze an SDP down to the handful of fields that actually vary.
 * A full offer is 2-4 KB of boilerplate; this gets the pasteable code to a few
 * hundred characters, which is the difference between "paste this" and "email
 * this to yourself".
 */
function packSdp(desc){
  const sdp = desc.sdp;
  const get = re => (sdp.match(re) || [])[1] || '';
  const cands = [...sdp.matchAll(/^a=candidate:(.+)$/gm)]
    .map(m => m[1].trim())
    // relay candidates need a TURN server we do not have; host+srflx is the reachable set
    .filter(c => / typ (host|srflx) /.test(c))
    .slice(0, 8);
  return {
    v: 1,
    t: desc.type === 'offer' ? 'o' : 'a',
    u: get(/^a=ice-ufrag:(.+)$/m),
    p: get(/^a=ice-pwd:(.+)$/m),
    f: get(/^a=fingerprint:sha-256 (.+)$/m),
    s: get(/^a=setup:(.+)$/m),
    c: cands
  };
}

function unpackSdp(o){
  const lines = [
    'v=0',
    'o=- 4611731400430051336 2 IN IP4 127.0.0.1',
    's=-',
    't=0 0',
    'a=group:BUNDLE 0',
    'a=extmap-allow-mixed',
    'a=msid-semantic: WMS',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
    'c=IN IP4 0.0.0.0',
    'a=ice-ufrag:' + o.u,
    'a=ice-pwd:' + o.p,
    'a=ice-options:trickle',
    'a=fingerprint:sha-256 ' + o.f,
    'a=setup:' + o.s,
    'a=mid:0',
    'a=sctp-port:5000',
    'a=max-message-size:262144'
  ];
  for (const c of o.c || []) lines.push('a=candidate:' + c);
  return { type: o.t === 'o' ? 'offer' : 'answer', sdp: lines.join('\r\n') + '\r\n' };
}

export function encodeCode(desc, { long = false } = {}){
  const payload = long
    ? 'F' + b64.enc(JSON.stringify({ type: desc.type, sdp: desc.sdp }))
    : 'C' + b64.enc(JSON.stringify(packSdp(desc)));
  return payload.match(/.{1,60}/g).join('\n');
}

export function decodeCode(code){
  const raw = String(code).replace(/\s+/g, '');
  const body = b64.dec(raw.slice(1));
  const obj = JSON.parse(body);
  return raw[0] === 'F' ? obj : unpackSdp(obj);
}

/** Resolves once ICE has finished gathering, so one paste carries everything. */
function gathered(pc){
  return new Promise(res => {
    if (pc.iceGatheringState === 'complete') return res();
    const done = () => { if (pc.iceGatheringState === 'complete'){ pc.removeEventListener('icegatheringstatechange', done); res(); } };
    pc.addEventListener('icegatheringstatechange', done);
    // some networks never report complete; ship what we have after a moment
    setTimeout(res, 2500);
  });
}

/* ------------------------------------------------------------------ */
/* connection                                                          */
/* ------------------------------------------------------------------ */
export class Net {
  constructor({ onOpen, onClose, onMessage, longCodes = false } = {}){
    this.pc = new RTCPeerConnection(ICE);
    this.ch = null;
    this.isHost = false;
    this.isClient = false;
    this.open = false;
    this.longCodes = longCodes;
    this.onOpen = onOpen || (() => {});
    this.onClose = onClose || (() => {});
    this.onMessage = onMessage || (() => {});
    this.lastSend = 0;
    this.pc.addEventListener('connectionstatechange', () => {
      if (['failed', 'closed', 'disconnected'].includes(this.pc.connectionState)){
        this.open = false;
        this.onClose(this.pc.connectionState);
      }
    });
  }

  bind(ch){
    this.ch = ch;
    ch.binaryType = 'arraybuffer';
    ch.onopen = () => { this.open = true; this.onOpen(); };
    ch.onclose = () => { this.open = false; this.onClose('closed'); };
    ch.onmessage = e => {
      try { this.onMessage(JSON.parse(e.data)); }
      catch (err){ /* a malformed frame is not worth killing the session over */ }
    };
  }

  /** Host: returns the code to hand to the other player. */
  async host(){
    this.isHost = true;
    const ch = this.pc.createDataChannel('basement', { ordered: false, maxRetransmits: 0 });
    this.bind(ch);
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await gathered(this.pc);
    return encodeCode(this.pc.localDescription, { long: this.longCodes });
  }

  /** Host: finish the handshake with the guest's reply code. */
  async accept(code){
    await this.pc.setRemoteDescription(decodeCode(code));
  }

  /** Guest: consume the host code, return the reply code. */
  async join(code){
    this.isClient = true;
    this.pc.ondatachannel = e => this.bind(e.channel);
    await this.pc.setRemoteDescription(decodeCode(code));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await gathered(this.pc);
    return encodeCode(this.pc.localDescription, { long: this.longCodes });
  }

  send(obj){
    if (!this.open || !this.ch || this.ch.readyState !== 'open') return;
    try { this.ch.send(JSON.stringify(obj)); } catch (e){}
  }

  /** Guest -> host, every frame. Tiny by design. */
  sendInput(inp){
    this.send({ k:'i',
      x:+inp.mx.toFixed(2), y:+inp.my.toFixed(2),
      a:+inp.ax.toFixed(2), b:+inp.ay.toFixed(2),
      f:(inp.active ? 1 : 0) | (inp.bomb ? 2 : 0) | (inp.card ? 4 : 0) | (inp.drop ? 8 : 0)
    });
  }

  close(){
    try { this.ch?.close(); } catch (e){}
    try { this.pc.close(); } catch (e){}
    this.open = false;
  }
}

/* ------------------------------------------------------------------ */
/* snapshots                                                           */
/* ------------------------------------------------------------------ */
const r1 = n => Math.round(n);
const r2 = n => Math.round(n * 100) / 100;

/** Everything the guest needs to draw one frame. */
export function snapshot(g){
  return {
    k:'s',
    t: r2(g.time),
    sh: r2(g.shakeT), sm: g.shakeMag,
    rm: g.room.key,
    dp: g.depth,
    cl: g.room.cleared,
    dr: Object.fromEntries(Object.entries(g.room.doors).map(([d, o]) =>
      [d, [o.kind, o.open ? 1 : 0, o.locked ? 1 : 0, o.hidden ? 1 : 0, o.revealed ? 1 : 0]])),
    ce: g.room.cells.map(r => r.join('')),
    pl: g.players.map(p => [
      r1(p.x), r1(p.y), p.facing, p.flip ? 1 : 0, r2(p.walkT % 2),
      p.red, p.soul, p.black, p.maxRed, p.coins, p.bombs, p.keys,
      r2(p.invuln), r2(p.hitFlash), p.dead ? 1 : 0, r2(p.charge),
      p.active?.id || '', p.trinket?.id || '', p.card ? 1 : 0, p.pill ? p.pill.variant : -1,
      r2(p.chargeShot), r2(p.temp.berserk || 0)
    ]),
    en: g.enemies.map(e => [
      r1(e.x), r1(e.y), e.def.isBoss ? 'B' + e.def.id : e.id,
      r2(e.hp), r2(e.maxHp), r2(e.flash), r2(e.deathT), r2(e.frozen), r2(e.charmed),
      r2(e.poison), r2(e.burn), r2(e.rot || 0), r1(e.lift || 0),
      e.charging ? 1 : 0, e.beam ? [r2(e.beam.a), e.beam.len, e.beam.colour || ''] : 0,
      r2(e.scaleMul || 1), e.vx < -0.2 ? 1 : 0
    ]),
    te: g.tears.map(t => [r1(t.x), r1(t.y), t.colour, t.hi, t.big ? 1 : 0, r2(t.scale)]),
    bo: g.bombs.map(b => [r1(b.x), r1(b.y), r2(b.fuse)]),
    pk: g.pickups.map(p => [r1(p.x), r1(p.y), p.kind, p.variant || 0, p.price ?? -1, p.priceKind || 'coin']),
    pr: g.props.map(p => [r1(p.x), r1(p.y), p.kind, p.item?.id || '', p.price ?? -1, p.priceKind || '', p.open ? 1 : 0, p.locked ? 1 : 0]),
    hz: g.hazards.map(h => [r1(h.x), r1(h.y), h.kind, r1(h.r), r2(h.life), r2(h.maxLife)]),
    bl: g.blasts.map(b => [r1(b.x), r1(b.y), r1(b.r), r2(b.t)]),
    wv: g.waves.map(w => [r1(w.x), r1(w.y), r1(w.r), r2(w.t), w.colour]),
    fl: g.floaters.map(f => [r1(f.x), r1(f.y), f.text, f.colour, r2(f.life), r2(f.maxLife)]),
    pa: g.particles.slice(0, 60).map(p => [r1(p.x), r1(p.y), r2(p.life), r2(p.maxLife), p.size, p.colour]),
    fa: g.familiars.map(f => [r1(f.x), r1(f.y), f.art, f.pal, r2(f.seed)]),
    bs: g.bossRef ? [r2(g.bossRef.hp), r2(g.bossRef.maxHp), g.bossRef.def.name] : 0,
    bn: g.banner && g.banner.t > 0 ? [g.banner.title, g.banner.sub, r2(g.banner.t)] : 0,
    to: g.toast && g.toast.t > 0 ? [g.toast.title, g.toast.sub, r2(g.toast.t)] : 0,
    ov: g.over ? (g.won ? 2 : 1) : 0
  };
}

/** Sent once when the floor changes — the map is static for a floor. */
export function floorSnapshot(g){
  return {
    k:'f',
    theme: g.floor.theme, name: g.floor.name, depth: g.floor.depth,
    curse: g.floor.curse ? { id:g.floor.curse.id, name:g.floor.curse.name, desc:g.floor.curse.desc } : null,
    rooms: [...g.floor.rooms.values()].map(r => [r.gx, r.gy, r.key, r.type, r.visited ? 1 : 0, r.seen ? 1 : 0, r.hidden ? 1 : 0])
  };
}

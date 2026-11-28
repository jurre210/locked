// ================= friends (PeerJS, host relays) =================
// Host owns peer id PFX+CODE; friends connect to it. Everyone plays the same seeded prompts at their own pace
// and streams a small state packet; the host relays packets to everyone else. Friends show as live tiles top-left.
const MP={on:false,host:false,peer:null,conns:new Map(),hostConn:null,me:"",myId:"",code:"",players:new Map(),lastSend:0,tiles:new Map()};
const PFX="deepcast-v1-";
const cleanName=n=>String(n||"").replace(/[<>&"]/g,"").trim().slice(0,16)||"Angler";
function loadPeer(){if(window.Peer)return Promise.resolve();const add=src=>new Promise((res,rej)=>{const sc=document.createElement("script");sc.src=src;sc.onload=res;sc.onerror=rej;document.head.appendChild(sc);});
 return add("vendor/peerjs.min.js").catch(()=>add("https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js")).catch(()=>{throw new Error("Couldn't load the multiplayer library — check your connection.");});}
function frMsg(t){$("frMsg").textContent=t||"";}
function mkCode(){const A="ABCDEFGHJKMNPQRSTUVWXYZ23456789";return Array.from({length:5},()=>A[Math.floor(Math.random()*A.length)]).join("");}
function mpSend(msg){if(!MP.on)return;try{if(MP.host){for(const c of MP.conns.values())if(c.open)c.send(msg);}else if(MP.hostConn&&MP.hostConn.open)MP.hostConn.send(msg);}catch(e){}}
function myName(){const n=cleanName($("frName").value);store.set("deepcast-name",n);return n;}
async function createRoom(tries=0,fixed){frMsg("Opening a room…");try{await loadPeer();}catch(e){frMsg(e.message);return;}
 MP.code=fixed||mkCode();MP.host=true;MP.me=myName();const peer=new Peer(PFX+MP.code);MP.peer=peer;
 peer.on("open",id=>{MP.myId=id;MP.on=true;MP.players=new Map([[id,{name:MP.me,score:0,qi:0}]]);frMsg("");showLobby();});
 peer.on("connection",conn=>{conn.on("open",()=>MP.conns.set(conn.peer,conn));conn.on("data",d=>hostRecv(conn,d));
  conn.on("close",()=>{MP.conns.delete(conn.peer);MP.players.delete(conn.peer);mpSend({t:"gone",id:conn.peer});lobbyChanged();});});
 peer.on("error",e=>{if(e.type==="unavailable-id"&&fixed){peer.destroy();joinRoom(fixed);}else if(e.type==="unavailable-id"&&tries<3){peer.destroy();createRoom(tries+1);}else frMsg("Connection problem: "+(e.type||e.message));});}
async function joinRoom(code){code=code.toUpperCase().replace(/[^A-Z0-9]/g,"");if(code.length!==5){frMsg("Room codes are 5 characters.");return;}
 frMsg("Joining…");try{await loadPeer();}catch(e){frMsg(e.message);return;}
 MP.code=code;MP.host=false;MP.me=myName();const peer=new Peer();MP.peer=peer;
 peer.on("open",id=>{MP.myId=id;const c=peer.connect(PFX+code,{reliable:true});MP.hostConn=c;
  c.on("open",()=>{MP.on=true;c.send({t:"hello",name:MP.me});frMsg("");showLobby();});
  c.on("data",clientRecv);
  c.on("close",()=>{if(MP.on){MP.on=false;toastText("The host left — you're fishing solo now.");clearTiles();}});});
 peer.on("error",e=>frMsg(e.type==="peer-unavailable"?"No room with that code.":"Connection problem: "+(e.type||e.message)));}
function hostRecv(conn,d){
 if(d.t==="hello"){MP.players.set(conn.peer,{name:cleanName(d.name),score:0,qi:0});lobbyChanged();if(G&&G.mode==="mp"&&!G.done)conn.send({t:"start",seed:G.seed});}
 else if(d.t==="st"){d.id=conn.peer;d.name=cleanName(d.name);applySt(d);for(const[id,c]of MP.conns)if(id!==conn.peer&&c.open)c.send(d);}}
function clientRecv(d){
 if(d.t==="lobby"){MP.players=new Map(d.players.map(p=>[p.id,Object.assign(MP.players.get(p.id)||{},p)]));renderLobby();}
 else if(d.t==="start"){if(!(G&&G.mode==="mp"&&G.seed===d.seed))startGame("mp",d.seed);}
 else if(d.t==="st")applySt(d);
 else if(d.t==="gone"){MP.players.delete(d.id);renderTiles();}}
function lobbyChanged(){mpSend({t:"lobby",players:[...MP.players].map(([id,p])=>({id,name:p.name}))});renderLobby();renderTiles();}
function applySt(d){if(d.id===MP.myId)return;const p=MP.players.get(d.id)||{};if(d.score>(p.score||0))p.gain={pts:d.score-(p.score||0),tier:d.lastTier,at:performance.now()};
 Object.assign(p,d);MP.players.set(d.id,p);renderTiles();if(G&&G.done)renderEndFriends();}
function pushState(force){if(!MP.on||!G||G.mode!=="mp")return;const now=performance.now(),gap=S.mode==="cast"?120:700;if(!force&&now-MP.lastSend<gap)return;MP.lastSend=now;
 const casting=S.mode==="cast";mpSend({t:"st",id:MP.myId,name:MP.me,qi:G.qi,phase:casting?S.phase:"idle",m:casting?worldToM(S.hy):0,tier:casting&&/reel|lift|hold/.test(S.phase)?S.tier:0,
  lastTier:G.picks.length?G.picks[G.picks.length-1].tier:0,score:G.score,done:G.done,picks:G.done?G.picks:null});}
function showLobby(){$("frStart").classList.add("hidden");$("frLobby").classList.remove("hidden");$("frCodeShow").textContent=MP.code;
 $("frGo").classList.toggle("hidden",!MP.host);$("frWait").classList.toggle("hidden",MP.host);renderLobby();}
function renderLobby(){$("frPlayers").innerHTML=[...MP.players].map(([id,p])=>`<span>${esc(p.name||"…")}${id===MP.myId?" (you)":""}</span>`).join("");}
function mpLeave(){if(MP.peer){try{MP.peer.destroy();}catch(e){}}Object.assign(MP,{on:false,host:false,peer:null,hostConn:null,code:""});MP.conns.clear();MP.players.clear();clearTiles();}
function openFriends(code){sfx.click();$("friends").classList.remove("hidden");$("frStart").classList.remove("hidden");$("frLobby").classList.add("hidden");frMsg("");
 $("frName").value=store.get("deepcast-name")||"";if(code)$("frCode").value=code;($("frName").value?(code?$("frJoin"):$("frCreate")):$("frName")).focus();}
async function discordRoom(){sfx.click();$("friends").classList.remove("hidden");$("frStart").classList.add("hidden");$("frLobby").classList.add("hidden");frMsg("");$("frMsg").style.color="";$("frMsg").textContent="Finding everyone in this channel…";
 try{await DC.ready;}catch(e){frMsg("Couldn't connect to Discord.");return;}
 $("frName").value=(DC.name||"Angler").slice(0,16);let h=0;for(const ch of DC.instanceId||DC.channelId||"x")h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;
 const A="ABCDEFGHJKMNPQRSTUVWXYZ23456789";let code="";for(let i=0;i<5;i++){code+=A[h%A.length];h=Math.floor(h/A.length)+i*7919;}
 $("frCopy").classList.add("hidden");createRoom(0,code);}
$("friendsBtn").onclick=()=>window.DC&&DC.on?discordRoom():openFriends();
$("frCreate").onclick=()=>{if(!$("frName").value.trim()){frMsg("Pick a name first.");return;}createRoom();};
$("frJoin").onclick=()=>{if(!$("frName").value.trim()){frMsg("Pick a name first.");return;}joinRoom($("frCode").value);};
$("frCode").addEventListener("keydown",e=>{if(e.key==="Enter")$("frJoin").click();});
$("frCopy").onclick=()=>{const u=location.origin+location.pathname+"?room="+MP.code;navigator.clipboard?.writeText(u).then(()=>$("frCopy").textContent="Link copied!",()=>frMsg(u));};
$("frGo").onclick=()=>{if(!MP.host)return;const seed=(Math.random()*2**31)|0;mpSend({t:"start",seed});startGame("mp",seed);};
$("frClose").onclick=()=>{sfx.click();mpLeave();$("friends").classList.add("hidden");$("frCopy").textContent="Copy invite link";};
{const q=new URLSearchParams(location.search).get("room");if(q)setTimeout(()=>openFriends(q.toUpperCase()),50);}
function toastText(t){const el=$("toast");el.style.borderColor="#ffd86b";el.querySelector(".tier").textContent="";el.querySelector(".what").textContent=t;el.querySelector(".s2").textContent="";el.classList.add("on");clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove("on"),3200);}

// ---- FaceTime-style friend tiles ----
function clearTiles(){$("tiles").innerHTML="";MP.tiles.clear();}
function renderTiles(){if(!MP.on||!G||G.mode!=="mp"){if(MP.tiles.size)clearTiles();return;}
 for(const[id,p]of MP.players){if(id===MP.myId)continue;let t=MP.tiles.get(id);
  if(!t){const el=document.createElement("div");el.className="tile";el.innerHTML='<canvas></canvas><i class="live"></i><span class="tq"></span><span class="tn"></span><span class="ts"></span><span class="tp"></span>';$("tiles").appendChild(el);t={el,cv:el.querySelector("canvas")};MP.tiles.set(id,t);}
  t.el.querySelector(".tn").textContent=p.name||"…";t.el.querySelector(".ts").textContent=(p.score||0)+" pts";t.el.querySelector(".tq").textContent=p.done?"done":`${(p.qi||0)+1}/${QUESTIONS}`;}
 for(const[id,t]of MP.tiles)if(!MP.players.has(id)){t.el.remove();MP.tiles.delete(id);}}
const ZCOL=["#1e6aa0","#185488","#103b67","#0b2647","#07162c","#040b18","#02050c"];
function mixHex(a,b,k){const pa=parseInt(a.slice(1),16),pb=parseInt(b.slice(1),16),ch=s=>Math.round(((pa>>s)&255)*(1-k)+((pb>>s)&255)*k);return`rgb(${ch(16)},${ch(8)},${ch(0)})`;}
function drawTiles(){if(!MP.tiles.size)return;const t=S.t;
 for(const[id,tl]of MP.tiles){const p=MP.players.get(id);if(!p)continue;const cv=tl.cv,w=cv.clientWidth||180,h=cv.clientHeight||112,d=Math.min(2,devicePixelRatio||1);
  if(cv.width!==Math.round(w*d)){cv.width=Math.round(w*d);cv.height=Math.round(h*d);}const c=cv.getContext("2d");c.setTransform(d,0,0,d,0,0);
  const m=p.m||0,under=m>0&&/sink|bite|reel/.test(p.phase||"");
  if(!under){const sea=h*.46,g=c.createLinearGradient(0,0,0,sea);g.addColorStop(0,"#79c3ec");g.addColorStop(1,"#e4f5fb");c.fillStyle=g;c.fillRect(0,0,w,sea);
   const g2=c.createLinearGradient(0,sea,0,h);g2.addColorStop(0,"#2a78b0");g2.addColorStop(1,"#123f6a");c.fillStyle=g2;c.fillRect(0,sea,w,h-sea);
   const bx=w*.28,by=sea+Math.sin(t*1.6)*1.5;c.fillStyle="#d14b3f";c.beginPath();c.moveTo(bx-26,by-5);c.lineTo(bx+28,by-6);c.quadraticCurveTo(bx+24,by+4,bx+14,by+6);c.lineTo(bx-18,by+6);c.closePath();c.fill();
   c.fillStyle="#f3ede2";c.fillRect(bx-22,by-17,12,12);c.fillStyle="#ffd23f";c.fillRect(bx+2,by-19,8,13);c.beginPath();c.arc(bx+6,by-22,4,0,7);c.fill();
   const tipX=bx+30,tipY=by-40;c.strokeStyle="#c9893a";c.lineWidth=2;c.beginPath();c.moveTo(bx+8,by-12);c.lineTo(tipX,tipY);c.stroke();
   const cast=p.phase&&p.phase!=="idle",ex=cast?w*.72:tipX,ey=cast?sea:tipY+16;c.strokeStyle="rgba(255,255,255,.85)";c.lineWidth=1;c.beginPath();c.moveTo(tipX,tipY);c.lineTo(ex,ey);c.stroke();
   if(p.tier>0){const[kind,len]=CATCH[p.tier];c.save();c.translate(ex,ey+len*.18+2);c.rotate(-Math.PI/2+Math.sin(t*9)*.18);creature(c,kind,len*.36,t,0);c.restore();}
   else if(cast){c.fillStyle="#ff4f6a";c.beginPath();c.arc(ex,sea,3,0,7);c.fill();}}
  else{let zf=0;for(let i=0;i<6;i++)if(m>=ZONE_M[i])zf=i+Math.min(1,(m-ZONE_M[i])/(ZONE_M[i+1]-ZONE_M[i]));const i=Math.min(5,Math.floor(zf));
   const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,mixHex(ZCOL[i],ZCOL[i+1],Math.max(0,zf-i-.15)));g.addColorStop(1,mixHex(ZCOL[i],ZCOL[i+1],Math.min(1,zf-i+.15)));c.fillStyle=g;c.fillRect(0,0,w,h);
   c.fillStyle="rgba(220,240,255,.35)";for(let k=0;k<18;k++){const x=(k*53.3)%w,y=(((k*37.1)-t*(p.phase==="reel"?-60:40))%h+h)%h;c.fillRect(x,y,1.5,1.5);}
   const hx=w*.5+Math.sin(t*2)*3,hy=h*.46;c.strokeStyle="rgba(240,245,250,.9)";c.lineWidth=1;c.beginPath();c.moveTo(w*.5,0);c.lineTo(hx,hy);c.stroke();
   c.strokeStyle="#c9d2dc";c.lineWidth=1.5;c.beginPath();c.moveTo(hx,hy);c.lineTo(hx,hy+6);c.arc(hx-3,hy+6,3,0,Math.PI);c.stroke();
   if(p.tier>0){const[kind,len]=CATCH[p.tier];c.save();c.translate(hx,hy+len*.18+4);c.rotate(-Math.PI/2+Math.sin(t*9)*.18);creature(c,kind,len*.36,t,0);c.restore();}
   if(p.phase==="bite"){c.fillStyle="#ffd23f";c.font="bold 18px Silkscreen, monospace";c.fillText("!",hx+8,hy-4);}
   c.fillStyle="#fff";c.font="18px VT323, monospace";c.textAlign="right";c.fillText(m.toLocaleString()+" m",w-8,h*.42);c.fillStyle="rgba(234,242,255,.7)";c.font="9px Silkscreen, monospace";c.fillText(TIER[Math.min(6,i+1)].zone.toUpperCase(),w-8,h*.42+12);c.textAlign="left";}
  const tp=tl.el.querySelector(".tp"),recent=p.gain&&performance.now()-p.gain.at<2600;tp.classList.toggle("on",!!recent);
  if(recent){tp.textContent="+"+p.gain.pts;tp.style.color=TIER[p.gain.tier||1].hex;tl.el.style.borderColor=TIER[p.gain.tier||1].hex;}else tl.el.style.borderColor="rgba(255,255,255,.85)";}}
function renderEndFriends(){const box=$("endFriends");if(!box)return;if(!MP.on||!G||G.mode!=="mp"){box.innerHTML="";return;}
 const list=[{name:MP.me,score:G.score,done:G.done,picks:G.picks,me:true},...[...MP.players].filter(([id])=>id!==MP.myId).map(([,p])=>p)].sort((a,b)=>(b.score||0)-(a.score||0));
 box.innerHTML='<div class="lbl">Friends leaderboard</div>'+list.map((p,i)=>`<div class="frrow${p.me?" me":""}"><span class="n">${i+1}</span><b>${esc(p.name||"?")}${p.me?" (you)":""}</b><span class="frp">${p.done&&p.picks?p.picks.map(x=>`<span class="chip sm" style="background:${TIER[x.tier].hex}">${esc(x.name)}</span>`).join(""):`still fishing · prompt ${(p.qi||0)+1}/${QUESTIONS}`}</span><b class="pts">${p.score||0}</b></div>`).join("");}

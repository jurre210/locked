// Deepcast as a Discord Activity. Only does anything when the page runs inside Discord
// (served through <app id>.discordsays.com, which proxies to this site via the app's URL mappings).
// Outside Discord, window.DC.on is false and the game plays as a normal website.
(function(){
const qs=new URLSearchParams(location.search);
const IN=/\.discordsays\.com$/.test(location.hostname)||qs.has("frame_id");
const DC=window.DC={on:IN,user:null,token:null,channelId:null,guildId:null,instanceId:null,msgId:null,ready:Promise.resolve(null)};
if(!IN)return;
document.documentElement.classList.add("in-discord");

const loadScript=src=>new Promise((res,rej)=>{const s=document.createElement("script");s.src=src;s.onload=res;s.onerror=()=>rej(new Error("load "+src));document.head.appendChild(s);});
// Google Fonts through the proxy (Discord's CSP only allows mapped hosts)
fetch("/.proxy/gfonts/css2?family=Silkscreen:wght@400;700&family=VT323&display=swap").then(r=>r.text())
 .then(css=>{const st=document.createElement("style");st.textContent=css.split("https://fonts.gstatic.com").join("/.proxy/gstatic");document.head.appendChild(st);}).catch(()=>{});

DC.ready=(async()=>{
 await loadScript("vendor/discord-sdk.js");
 const {DiscordSDK,patchUrlMappings}=window.DiscordSDKLib;
 patchUrlMappings([{prefix:"/peerjs",target:"0.peerjs.com"},{prefix:"/cdn",target:"cdn.discordapp.com"}]);
 const cfg=await (await fetch("/.proxy/api/config")).json();
 const sdk=new DiscordSDK(cfg.clientId);DC.sdk=sdk;await sdk.ready();
 DC.channelId=sdk.channelId;DC.guildId=sdk.guildId;DC.instanceId=sdk.instanceId;
 const {code}=await sdk.commands.authorize({client_id:cfg.clientId,response_type:"code",state:"",prompt:"none",scope:["identify"]});
 const tok=await (await fetch("/.proxy/api/token",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code})})).json();
 if(!tok.access_token)throw new Error("token exchange failed");
 const auth=await sdk.commands.authenticate({access_token:tok.access_token});
 DC.token=tok.access_token;DC.user=auth.user;
 DC.name=auth.user.global_name||auth.user.username;
 try{localStorage.setItem("deepcast-name",DC.name.slice(0,16));}catch(e){}
 return DC;})();
DC.ready.catch(e=>console.warn("[deepcast] Discord setup failed:",e));

const label=G=>G.mode==="daily"?`Deepcast #${diveNo()}`:G.mode==="mp"?"Deepcast with friends":"Deepcast Endless";
async function api(path,opts={}){await DC.ready;const r=await fetch("/.proxy/api"+path,{...opts,headers:{...(opts.headers||{}),Authorization:"Bearer "+DC.token}});return r.json();}

// "<name> is fishing…" message when a game starts
DC.started=async G=>{try{DC.msgId=null;const j=await api("/start",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({channelId:DC.channelId,label:label(G)})});DC.msgId=j.messageId||null;}catch(e){console.warn(e);}};
// edit it into the result card when the game ends
DC.finished=async G=>{try{const png=await renderCard(G);const f=new FormData();
 f.append("channelId",DC.channelId);if(DC.msgId)f.append("messageId",DC.msgId);f.append("score",String(G.score));f.append("rank",rankOf(G.score));f.append("label",label(G));
 f.append("emoji",G.hist.join(""));f.append("file",png,"deepcast.png");await api("/result",{method:"POST",body:f});}catch(e){console.warn(e);}};

// ---- result card (like Wordle's: avatar on the left, the dive on the right; answers stay hidden) ----
function rr(x,X,Y,w,h,r){x.beginPath();x.roundRect(X,Y,w,h,r);}
async function avatar(){const u=DC.user;if(!u)return null;const url=u.avatar?`/.proxy/cdn/avatars/${u.id}/${u.avatar}.png?size=256`:`/.proxy/cdn/embed/avatars/${(BigInt(u.id)>>22n)%6n}.png`;
 return new Promise(res=>{const i=new Image();i.crossOrigin="anonymous";i.onload=()=>res(i);i.onerror=()=>res(null);i.src=url;});}
async function renderCard(G){const W=800,H=380,c=document.createElement("canvas");c.width=W;c.height=H;const x=c.getContext("2d");
 const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,"#13294a");g.addColorStop(1,"#07162c");x.fillStyle=g;x.fillRect(0,0,W,H);
 x.fillStyle="#ffffff";x.font="22px VT323, monospace";x.textAlign="center";x.fillText(label(G),W/2,38);
 rr(x,60,60,W-120,H-90,18);x.strokeStyle="rgba(255,216,107,.55)";x.lineWidth=2;x.stroke();
 // avatar
 const av=await avatar(),cx=200,cy=210,r=78;x.save();x.beginPath();x.arc(cx,cy,r,0,7);x.closePath();x.fillStyle="#fff";x.fill();x.clip();
 if(av)x.drawImage(av,cx-r,cy-r,r*2,r*2);else{x.fillStyle="#1e6aa0";x.fillRect(cx-r,cy-r,r*2,r*2);x.font="80px serif";x.fillText("🎣",cx,cy+28);}x.restore();
 x.fillStyle="#eaf2ff";x.font="26px VT323, monospace";x.fillText(DC.name||"",cx,cy+r+34);
 // dive bars
 const bx=340,bw=300,by=84,rowH=37;x.textAlign="left";
 G.picks.forEach((p,i)=>{const T=TIER[p.tier],y=by+i*rowH;x.fillStyle="#081325";rr(x,bx,y,bw,24,6);x.fill();
  x.fillStyle=T.hex;rr(x,bx,y,Math.max(14,bw*p.tier/6),24,6);x.fill();
  x.fillStyle="#9fb6d6";x.font="20px VT323, monospace";x.fillText(T.zone,bx+bw+12,y+18);});
 x.fillStyle="#ffffff";x.font="64px VT323, monospace";x.fillText(G.score+" pts",bx,by+5*rowH+48);const sw=x.measureText(G.score+" pts").width;
 x.fillStyle="#ffd86b";x.font="24px VT323, monospace";x.fillText(rankOf(G.score).toUpperCase(),bx+sw+18,by+5*rowH+46);
 return new Promise(res=>c.toBlob(res,"image/png"));}
DC.renderCard=renderCard;
})();

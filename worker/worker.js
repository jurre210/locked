// Deepcast Discord backend (Cloudflare Worker).
//  /config        -> the app's client id for the Activity
//  /token         -> swaps the Activity's OAuth code for an access token (needs the client secret)
//  /start         -> bot posts "<name> is fishing Deepcast #N…" in the channel the Activity runs in
//  /result        -> bot edits that message into the result card (PNG made by the game) + score
//  /interactions  -> Discord's interactions endpoint: the "Play now!" button launches the Activity
// The Activity reaches this worker through the URL mapping /api -> <this worker's host>.
// Secrets (set with `wrangler secret put`): DISCORD_CLIENT_SECRET, DISCORD_BOT_TOKEN.
// Vars (wrangler.toml): DISCORD_CLIENT_ID, DISCORD_PUBLIC_KEY.
const API = "https://discord.com/api/v10";
const PLAY_BUTTON = [{ type: 1, components: [{ type: 2, style: 1, label: "Play now!", custom_id: "deepcast_play", emoji: { name: "🎣" } }] }];
const RANKS = ["Bait Dangler", "Deckhand", "Angler", "Deep-Sea Captain", "Abyss Hunter", "Leviathan Tamer"];
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", ...cors } });
const clean = s => String(s || "").replace(/[\\*_~`|>#@\[\]()]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
const isId = s => /^\d{15,25}$/.test(String(s || ""));

async function bot(env, path, method, body, isForm) {
  const r = await fetch(API + path, { method, headers: { Authorization: "Bot " + env.DISCORD_BOT_TOKEN, ...(isForm ? {} : { "Content-Type": "application/json" }) }, body: isForm ? body : body && JSON.stringify(body) });
  const t = await r.text();
  if (!r.ok) throw new Error(`Discord ${method} ${path} -> ${r.status}: ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : {};
}
async function whoIs(req) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const r = await fetch(API + "/users/@me", { headers: { Authorization: auth } });
  return r.ok ? r.json() : null;
}
const hex = h => new Uint8Array(h.match(/../g).map(b => parseInt(b, 16)));
async function verified(req, env, body) {
  const sig = req.headers.get("X-Signature-Ed25519"), ts = req.headers.get("X-Signature-Timestamp");
  if (!sig || !ts || !env.DISCORD_PUBLIC_KEY) return false;
  try {
    const key = await crypto.subtle.importKey("raw", hex(env.DISCORD_PUBLIC_KEY), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "Ed25519" }, key, hex(sig), new TextEncoder().encode(ts + body));
  } catch { return false; }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url), p = url.pathname.replace(/^\/api(?=\/)/, "");
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    try {
      if (p === "/config") return json({ clientId: env.DISCORD_CLIENT_ID });

      if (p === "/interactions" && req.method === "POST") {
        const body = await req.text();
        if (!(await verified(req, env, body))) return new Response("bad signature", { status: 401 });
        const i = JSON.parse(body);
        if (i.type === 1) return json({ type: 1 });                 // PING
        return json({ type: 12 });                                  // LAUNCH_ACTIVITY (Play button / commands)
      }

      if (p === "/token" && req.method === "POST") {
        const { code } = await req.json();
        const r = await fetch(API + "/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET, grant_type: "authorization_code", code: String(code || "") }) });
        const j = await r.json();
        return j.access_token ? json({ access_token: j.access_token }) : json({ error: "token exchange failed" }, 400);
      }

      if (p === "/start" || p === "/result") {
        const user = await whoIs(req);
        if (!user) return json({ error: "unauthorized" }, 401);
        const name = clean(user.global_name || user.username) || "Someone";
        if (p === "/start") {
          const { channelId, label } = await req.json();
          if (!isId(channelId)) return json({ error: "no channel" }, 400);
          const m = await bot(env, `/channels/${channelId}/messages`, "POST",
            { content: `🎣 **${name}** is fishing ${clean(label) || "Deepcast"}…`, allowed_mentions: { parse: [] }, components: PLAY_BUTTON });
          return json({ messageId: m.id });
        }
        const f = await req.formData();
        const channelId = f.get("channelId"), messageId = f.get("messageId"), file = f.get("file");
        if (!isId(channelId)) return json({ error: "no channel" }, 400);
        if (!file || typeof file === "string" || file.size > 1_500_000 || file.type !== "image/png") return json({ error: "bad image" }, 400);
        const score = Math.max(0, Math.min(5000, parseInt(f.get("score"), 10) || 0));
        const rank = RANKS.includes(f.get("rank")) ? f.get("rank") : "";
        const emoji = [...String(f.get("emoji") || "")].filter(ch => "🟩🟦🟪🟧🟥🌟".includes(ch)).slice(0, 10).join("");
        const content = `🎣 **${name}** fished ${clean(f.get("label")) || "Deepcast"} — **${score} pts**${rank ? " · " + rank : ""}\n${emoji}`;
        const form = new FormData();
        form.append("payload_json", JSON.stringify({ content, allowed_mentions: { parse: [] }, components: PLAY_BUTTON, attachments: [{ id: 0, filename: "deepcast.png" }] }));
        form.append("files[0]", file, "deepcast.png");
        let ok = false;
        if (isId(messageId)) {               // only edit the "<this player> is fishing…" message
          const old = await bot(env, `/channels/${channelId}/messages/${messageId}`, "GET").catch(() => null);
          if (old && old.content && old.content.startsWith(`🎣 **${name}** is fishing`)) {
            await bot(env, `/channels/${channelId}/messages/${messageId}`, "PATCH", form, true); ok = true;
          }
        }
        if (!ok) await bot(env, `/channels/${channelId}/messages`, "POST", form, true);
        return json({ ok: true });
      }
    } catch (e) {
      return json({ error: String(e.message || e) }, 500);
    }
    return new Response("Deepcast Discord backend is running.", { status: 200, headers: cors });
  }
};

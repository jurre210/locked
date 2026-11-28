# Deepcast in Discord — setup (about 10 minutes, once)

You need: your Discord account (with Manage Server on your server) and a free Cloudflare account
(https://dash.cloudflare.com/sign-up — the script's login step can create it too).

## A. In the Discord Developer Portal (https://discord.com/developers/applications)
1. **New Application** → name it `Deepcast` → accept the terms.
2. **General Information**: you'll copy the **Application ID** and **Public Key** into the script.
3. **Bot** page: click **Reset Token** → copy it (the script asks for it). No intents needed.
4. **OAuth2** page: click **Reset Secret** → copy the **Client Secret** (the script asks for it).

## B. Run the script
Double-click **`SETUP DISCORD.cmd`** (in this `worker` folder). It:
- asks for the Application ID + Public Key,
- logs you into Cloudflare (browser opens),
- asks you to paste the Client Secret and Bot Token (they go straight to Cloudflare),
- deploys the backend and prints the exact values for step C (also in `DISCORD-VALUES.txt` + clipboard),
- opens the bot invite link → pick your server → Authorize.

## C. Back in the portal (values come from the script)
1. **General Information → Interactions Endpoint URL** → `https://<your worker>/interactions` → Save.
2. **OAuth2 → Redirects** → add `https://127.0.0.1` → Save.
3. **Activities → Settings** → turn on **Enable Activities**.
4. **Activities → URL Mappings** → add the six rows the script printed (`/api`, `/peerjs`, `/gfonts`, `/gstatic`, `/cdn`, and `/` last).

## Play
In any text channel or voice channel of your server: click the **Apps / rocket** button → **Deepcast**.
- Starting a game posts “🎣 *name* is fishing Deepcast #N…”; finishing turns it into a result card with
  your avatar, how deep each answer went, the score and rank — answers stay hidden.
- Every message has a **Play now!** button that opens the game for whoever clicks it.
- **Friends** inside Discord: everyone who opened Deepcast in the same channel lands in the same room
  automatically (no code); the first one in presses Start.

If something doesn't show up: check the bot can **View Channel / Send Messages / Attach Files** in that channel.

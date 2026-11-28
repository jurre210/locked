# Deepcast -> Discord Activity setup. Run it by double-clicking "SETUP DISCORD.cmd".
# You paste your own keys when asked; they go straight to Cloudflare and are never saved in this folder.
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
try {
function Step($n, $t) { Write-Host ""; Write-Host "== $n. $t ==" -ForegroundColor Yellow }

Write-Host "Deepcast Discord setup" -ForegroundColor Cyan
Write-Host "Keep DISCORD-SETUP.md open next to this window - it says where every value is."

Step 1 "Discord Developer Portal"
$toml = Get-Content wrangler.toml -Raw
$appId = ([regex]::Match($toml, 'DISCORD_CLIENT_ID = "(\d+)"')).Groups[1].Value
$pubKey = ([regex]::Match($toml, 'DISCORD_PUBLIC_KEY = "([0-9a-fA-F]+)"')).Groups[1].Value
if ($appId -and $pubKey) { Write-Host "Already have the Application ID and Public Key - skipping." -ForegroundColor Green }
else {
Write-Host "Opening the Developer Portal. Create an application called Deepcast (if you haven't yet)."
Start-Process "https://discord.com/developers/applications"
$appId = (Read-Host "Paste the APPLICATION ID (General Information)").Trim()
$pubKey = (Read-Host "Paste the PUBLIC KEY (General Information)").Trim()
}
if ($appId -notmatch '^\d{15,25}$') { throw "That application id doesn't look right." }
if ($pubKey -notmatch '^[0-9a-fA-F]{64}$') { throw "That public key doesn't look right (should be 64 hex characters)." }
(Get-Content wrangler.toml -Raw) -replace 'DISCORD_CLIENT_ID = ".*"', "DISCORD_CLIENT_ID = `"$appId`"" -replace 'DISCORD_PUBLIC_KEY = ".*"', "DISCORD_PUBLIC_KEY = `"$pubKey`"" | Set-Content wrangler.toml -Encoding utf8

Step 2 "Cloudflare login (free account)"
$who = npx --yes wrangler@3 whoami 2>&1 | Out-String
if ($who -match "not authenticated") {
  Write-Host "A Cloudflare page opens. Log in (or Sign up - free), then click ALLOW on the 'Wrangler' page."
  Write-Host "Keep this window open until it says 'Successfully logged in'."
  npx --yes wrangler@3 login
  $who = npx --yes wrangler@3 whoami 2>&1 | Out-String
  if ($who -match "not authenticated") { throw "Cloudflare login didn't finish. Run SETUP DISCORD.cmd again and click Allow on the Cloudflare page." }
}
Write-Host "Logged in to Cloudflare." -ForegroundColor Green

Step 3 "Secrets (paste when wrangler asks; nothing is shown while you paste)"
Write-Host "CLIENT SECRET = OAuth2 page -> Reset Secret -> copy"
npx --yes wrangler@3 secret put DISCORD_CLIENT_SECRET
Write-Host "BOT TOKEN = Bot page -> Reset Token -> copy"
npx --yes wrangler@3 secret put DISCORD_BOT_TOKEN

Step 4 "Deploying the backend"
$out = npx --yes wrangler@3 deploy 2>&1 | Out-String
Write-Host $out
$m = [regex]::Match($out, 'https://[a-z0-9.-]+\.workers\.dev')
if (-not $m.Success) { throw "Couldn't find the workers.dev address in the deploy output above." }
$workerHost = $m.Value -replace '^https://', ''

$invite = "https://discord.com/oauth2/authorize?client_id=$appId&scope=bot+applications.commands&permissions=52224"
$todo = @"
DEEPCAST - paste these into the Developer Portal (app $appId)

General Information -> Interactions Endpoint URL:
  https://$workerHost/interactions

OAuth2 -> Redirects -> Add Redirect:
  https://127.0.0.1

Activities -> Settings -> enable Activities, then Activities -> URL Mappings (add each row):
  PREFIX     TARGET
  /api       $workerHost
  /peerjs    0.peerjs.com
  /gfonts    fonts.googleapis.com
  /gstatic   fonts.gstatic.com
  /cdn       cdn.discordapp.com
  /          jurre210.github.io/locked

Invite the bot to your server:
  $invite
"@
$todo | Set-Content "DISCORD-VALUES.txt" -Encoding utf8
Set-Clipboard $todo
Step 5 "Last clicks in the portal"
Write-Host $todo -ForegroundColor Green
Write-Host "(Also saved to worker\DISCORD-VALUES.txt and copied to your clipboard.)"
Start-Process $invite
Write-Host ""
Write-Host "Done. In Discord: open the server, click the rocket/Apps button in a channel and pick Deepcast." -ForegroundColor Cyan
} catch {
  Write-Host ""
  Write-Host "SOMETHING WENT WRONG:" -ForegroundColor Red
  Write-Host $_ -ForegroundColor Red
  Write-Host "You can just run SETUP DISCORD.cmd again - it skips the parts that already worked." -ForegroundColor Yellow
}
Read-Host "Press Enter to close"

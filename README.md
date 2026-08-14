# locked

25 tiny browser games in the dialed.gg mould: pure black, one giant lowercase word,
one rule, one score, and a verdict that is rude about it.

## Put it online

The site is static — no build step, no server — so any static host works. Every path is
relative, so it is happy in a subdirectory like `username.github.io/locked/`.

**The easy way.** The GitHub CLI is already installed. Two double-clicks:

1. **`1 - LOGIN FIRST.cmd`** — signs the CLI in to your GitHub account. This one needs
   your password, so it has to be you.
2. **`2 - PUBLISH.cmd`** — creates the repo, pushes, switches Pages on, prints the URL
   and opens it. Run it again any time to push updates.

**By hand.** Make an empty repo called `locked` on github.com, then:

```bash
git remote add origin https://github.com/YOUR-NAME/locked.git
```

```bash
git push -u origin main
```

Then Settings → Pages → Source: *Deploy from a branch* → `main` / `root`. The first
build takes a minute or two; after that it is live at
`https://YOUR-NAME.github.io/locked/`.

The commit author is currently a placeholder. To use your own:

```bash
git config user.name "your name"
```

**Netlify or Cloudflare Pages** work too — drag the folder onto
[app.netlify.com/drop](https://app.netlify.com/drop), or point Cloudflare Pages at the
repo with an empty build command and `/` as the output directory.

Note that `server.js` and `start.cmd` are only for running it locally; hosts ignore them.

## Run it locally

Double-click **locked** on the desktop or in the Start menu — it boots the server and
opens the browser. From a terminal:

```bash
node server.js
```

Then open http://localhost:5180. No build step, no dependencies, no bundler — it is
plain ES modules served statically.

## The games

| category | games |
|---|---|
| perception | colour, shade, gradient, angle, count, odd one |
| reflex | reaction, aim, track, dodge, clock |
| memory | sequence, pattern, chimp, digits, pairs |
| sound | songless, pitch, tempo, rhythm |
| mind | stroop, typing, maths, n-back, number line |
| modes | **gauntlet**, **daily** |

**gauntlet** runs five random games back to back and folds them into one rating.
**daily** picks three games from the date and seeds `Math.random` with it, so everyone
gets the identical run — same colours, same numbers, same tunes — until midnight. Both
live in `js/games/meta.js` and work by handing sub-games a proxied `api` whose `finish()`
collects the score instead of drawing the result screen.

Scores are kept in `localStorage` only. `record` in the top bar shows every best plus a
combined rating; nothing is ever sent anywhere.

## songless — three banks

Five songs a day in every mode, chosen by a date-seeded PRNG, so the set rolls over at
midnight and is the same for everyone until then. "Shuffle to a different set" bumps a
nonce if you want another five now.

| mode | songs | needs a connection |
|---|---|---|
| **charts** | 223 well-known tracks | yes |
| **melodies** | 40 public-domain tunes | no |
| **my own files** | whatever you pick | no |

**charts** is where the famous songs live. `js/data/charts.js` holds only *titles and
artists* — no audio and no melody data. At runtime each one is looked up on Apple's
public iTunes Search API and the official 30-second preview is streamed. Nothing
copyrighted is stored in this repo, and the guess box searches all 223 even though only
five are fetched per day.

Deliberately **not** done: encoding famous songs as note data into the built-in bank.
A song's melody is the copyrighted part, so hand-transcribing chart hits into
`melodies.js` would be copying the thing itself. That bank stays public-domain only —
which is also why it is the mode that works offline.

Same shape as the game it is modelled on: you hear one second, guess, and every miss or
skip buys you more — 1s → 2s → 4s → 7s → 11s → 16s, six tries, five tunes a run.

The built-in bank is **40 public-domain and traditional melodies encoded as note data**
in `js/data/melodies.js` and played live by the Web Audio synth in `js/core/audio.js`.
There are no audio files anywhere in this project, which is why it works offline and why
shipping it doesn't involve anyone's music rights.

If you want it to run on real tracks, **use my own audio files** on the songless start
screen takes a pile of local audio, decodes it in the page, and uses the filenames as the
answers. Those files are never uploaded — the picker just hands the browser the bytes.

## Adding a game

Games are plain objects. Drop one into any file in `js/games/` and export it:

```js
{
  key:'thing', name:'thing', cat:'reflex', family:'aim',
  blurb:'One line for the home grid.',
  rule:'One line under the title in-game.',
  unit:'ms', higherBetter:false,
  mount(stage, api){
    // api.life  — timers/listeners that get cleaned up on route change
    // api.sfx   — tick click good great perfect bad miss start over metro
    // api.audio — tone() playMelody() decode() playBuffer()
    // api.finish(displayValue, quality0to1, { label, breakdown, higherBetter })
  }
}
```

`quality` is the 0–1 number that picks the verdict tier, so map your raw score onto it
with `curve(value, worstYouExpect, bestYouExpect)`.

## Layout

```
index.html
css/style.css
js/main.js            router, home, result overlay, record modal
js/core/bg.js         the drifting colour field + per-category palettes
js/core/audio.js      synth, sfx bank, melody player
js/core/feedback.js   the verdict text banks
js/core/store.js      localStorage records + rating
js/core/ui.js         el(), Life (teardown), random helpers
js/data/melodies.js   the songless bank
js/games/*.js         the games, grouped by category
server.js             28-line static server
```

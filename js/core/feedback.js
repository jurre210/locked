// The thing people actually screenshot: what it says about you afterwards.
// tier 0 = disaster ... tier 5 = inhuman

const TIERS = [
  { min: 0.00, name:'disaster' },
  { min: 0.22, name:'poor' },
  { min: 0.45, name:'fine' },
  { min: 0.68, name:'sharp' },
  { min: 0.87, name:'locked' },
  { min: 0.97, name:'inhuman' }
];

const VERDICT = [
  ['no.', 'oh no.', 'grim.', 'rough.', 'bleak.', 'ouch.', 'catastrophic.', 'not close.'],
  ['weak.', 'meh.', 'below.', 'shaky.', 'loose.', 'unconvincing.', 'off.'],
  ['fine.', 'ok.', 'average.', 'passable.', 'middling.', 'acceptable.', 'fine, i guess.'],
  ['sharp.', 'nice.', 'clean.', 'solid.', 'tight.', 'good.', 'crisp.'],
  ['locked in.', 'dialed.', 'excellent.', 'razor.', 'surgical.', 'elite.', 'cold.'],
  ['inhuman.', 'flawless.', 'unreal.', 'suspicious.', 'ok wow.', 'perfect.', 'stop it.']
];

const LINE = [
  [
    'Statistically, guessing would have gone better.',
    'We checked twice. It really was that bad.',
    'Somewhere a scientist is updating a chart because of you.',
    'This is the score people delete their history over.',
    'Every attempt teaches us something. This one taught us nothing.',
    'Bold of you to press start at all.'
  ],
  [
    'There was an attempt. It has been noted.',
    'You are worse than you assumed. Most people are.',
    'The good news is the only direction left.',
    'Close enough to see it. Far enough to miss it.',
    'You were thinking about something else, weren\'t you.'
  ],
  [
    'Perfectly, aggressively average.',
    'The exact middle of the human race. Congratulations, I think.',
    'Nothing wrong here. Nothing right either.',
    'Solidly forgettable.',
    'You would be picked fourth.'
  ],
  [
    'Better than most people who will ever load this page.',
    'That was genuinely good. Do it again.',
    'You are clearly not new to paying attention.',
    'Comfortably above the crowd.',
    'A hair away from something special.'
  ],
  [
    'Very few people get here. You did.',
    'That is the score screenshots are made of.',
    'Precision like that is a personality trait.',
    'Whatever you were doing, keep doing it.',
    'Top of the room, easily.'
  ],
  [
    'We are legally required to ask if you cheated.',
    'That should not be possible on the first try.',
    'The scoreboard was not designed with you in mind.',
    'Genuinely one of the best runs this thing can produce.',
    'Nothing left to prove here.'
  ]
];

// Flavour per game — appended sometimes instead of the generic line.
const FLAVOUR = {
  color:   [['You saw a colour and invented a new one.','Your eyes and your memory are not on speaking terms.'],[],['Colour memory is a lie. Yours is averagely false.'],['Good eye.'],['Painter eyes.'],['You do not perceive colour, you archive it.']],
  reflex:  [['A sloth would have beaten you to it.','You reacted, eventually.'],[],['Human. Very human.'],['Fast hands.'],['That is competitive-shooter fast.'],['That is faster than most nerve conduction has any right to be.']],
  aim:     [['The targets were never in danger.'],[],['You hit things. Sometimes.'],['Clean tracking.'],['Aimlab would like a word.'],['Nobody moves a mouse like that by accident.']],
  time:    [['You do not have a clock in your head. You have a suggestion.'],[],['Your internal clock runs on vibes.'],['Good internal metronome.'],['You are basically a wristwatch.'],['Atomic.']],
  memory:  [['The information went in and immediately left.'],[],['A normal amount of forgetting.'],['Good recall.'],['That is a trained memory.'],['That is not how working memory is supposed to work.']],
  sound:   [['Consider seeing someone about your ears.'],[],['Regular ears. Regular brain.'],['Musical.'],['Trained ears, clearly.'],['Perfect-pitch behaviour.']],
  song:    [['Not one. You got not one.'],[],['You know some songs. Some.'],['You listen properly.'],['Encyclopaedic.'],['You have never once skipped an intro.']],
  mind:    [['Your brain refused to co-operate.'],[],['A very ordinary brain, doing ordinary things.'],['Quick thinking.'],['Ruthless processing.'],['That is a benchmark, not a score.']]
};

export function tierOf(q){
  const x = Math.max(0, Math.min(1, q));
  let t = 0;
  for (let i = 0; i < TIERS.length; i++) if (x >= TIERS[i].min) t = i;
  return t;
}

const pick = a => a[Math.floor(Math.random() * a.length)];

/**
 * @param {number} q quality 0..1
 * @param {string} family one of the FLAVOUR keys
 */
export function verdict(q, family){
  const t = tierOf(q);
  const fl = FLAVOUR[family]?.[t];
  const line = (fl && fl.length && Math.random() < 0.55) ? pick(fl) : pick(LINE[t]);
  return { tier: t, tierName: TIERS[t].name, verdict: pick(VERDICT[t]), line };
}

/** Short in-run reactions (shown mid-game, not at the end). */
export const NUDGE = {
  hit: ['yes', 'clean', 'good', 'nice', 'yep', 'sharp'],
  near:['close', 'nearly', 'almost', 'so close'],
  miss:['no', 'nope', 'miss', 'off', 'wrong']
};
export const nudge = k => pick(NUDGE[k]);

/** Turns a raw score into a 0..1 quality using a soft curve between two anchors. */
export function quality(value, worst, best){
  if (worst === best) return 0.5;
  const t = (value - worst) / (best - worst);
  return Math.max(0, Math.min(1, t));
}

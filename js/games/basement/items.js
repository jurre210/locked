/**
 * The item pool: passives, actives, familiars, trinkets, cards and pills.
 * All names, descriptions and effects here are original to this game.
 *
 * An item is data. Three levers cover almost everything:
 *   stats  — flat/multiplicative changes folded into the player's stat block
 *   flags  — counters the tear/collision code reads (piercing, homing, …)
 *   on     — event hooks: fire, hit, kill, damage, clear, floor, tick, pickup
 * Actives add `charge` + `use(g, p)`.
 */

/* Shared four-colour palettes: [main, shade, highlight, accent] */
const P = {
  bone:   ['#e8e2d0', '#a49e8c', '#fff8ec', '#c9483c'],
  gold:   ['#ffd166', '#c08a20', '#fff2c0', '#7a4a10'],
  rust:   ['#b4593a', '#7a3520', '#e08a63', '#ffd166'],
  blood:  ['#c9283c', '#7a1020', '#ff6a7a', '#f2d0d4'],
  flesh:  ['#e8a898', '#b06f60', '#ffd2c4', '#8a2f3a'],
  ink:    ['#3a3448', '#1e1a28', '#6a5f80', '#9b7ed6'],
  void:   ['#241c2e', '#100a16', '#4a3a5c', '#b07fff'],
  frost:  ['#a8d8ff', '#5a8ac0', '#e0f2ff', '#2a5f90'],
  toxic:  ['#8fd83a', '#5a8a20', '#d0f28a', '#3a5a10'],
  ember:  ['#ff8a3d', '#c04a10', '#ffd0a0', '#fff2c0'],
  silver: ['#d0d6e0', '#8a90a0', '#f4f6fa', '#5a6070'],
  copper: ['#c98040', '#8a5020', '#f0b070', '#3a2010'],
  jade:   ['#5ec9a0', '#2f8a68', '#a8f0d4', '#144a34'],
  plum:   ['#a05ec9', '#6a2f8a', '#d0a8f0', '#3a1450'],
  cream:  ['#f2eede', '#c0baa8', '#ffffff', '#8a8272'],
  soot:   ['#4a4650', '#26232c', '#7a7484', '#ff8a3d'],
  rose:   ['#ff8fa3', '#c05068', '#ffd0d8', '#7a1030'],
  amber:  ['#e0a030', '#a06810', '#ffd88a', '#503008'],
  deep:   ['#3a5ec9', '#1e3080', '#8aa8f0', '#c0d0ff'],
  lime:   ['#c9e04a', '#8aa020', '#f0ffa0', '#4a5a10'],
  ash:    ['#8a8494', '#5a5464', '#c0bacc', '#e8e2f0'],
  wine:   ['#7a2040', '#4a1028', '#b05070', '#ffd166'],
  brine:  ['#3aa0a0', '#1e6a6a', '#8ad8d8', '#f0ffff'],
  sun:    ['#ffe066', '#c0a020', '#fff8c0', '#ff8a3d']
};

const half = 1;   // one half-heart, in the units the player uses

/* ------------------------------------------------------------------ */
/* passives — stats                                                    */
/* ------------------------------------------------------------------ */
const STAT_ITEMS = [
  { id:'ironTooth', name:'Iron Tooth', form:'tooth', pal:P.silver, pool:['treasure','shop'], q:1,
    desc:'+1 damage.', stats:{ damage:1 } },
  { id:'longFuse', name:'Long Fuse', form:'bottle', pal:P.ember, pool:['treasure'], q:1,
    desc:'+0.7 damage, slightly slower shots.', stats:{ damage:0.7, tears:-0.15 } },
  { id:'quickHands', name:'Quick Hands', form:'hand', pal:P.flesh, pool:['treasure','shop'], q:1,
    desc:'+0.6 fire rate.', stats:{ tears:0.6 } },
  { id:'hummingbird', name:'Hummingbird', form:'wing', pal:P.jade, pool:['treasure'], q:2,
    desc:'+0.9 fire rate, -0.3 damage.', stats:{ tears:0.9, damage:-0.3 } },
  { id:'runnersHeel', name:"Runner's Heel", form:'wing', pal:P.lime, pool:['treasure','shop'], q:1,
    desc:'+0.35 speed.', stats:{ speed:0.35 } },
  { id:'leadInsoles', name:'Lead Insoles', form:'gear', pal:P.soot, pool:['treasure'], q:1,
    desc:'-0.2 speed, +1.4 damage.', stats:{ speed:-0.2, damage:1.4 } },
  { id:'longSight', name:'Long Sight', form:'eye', pal:P.frost, pool:['treasure'], q:1,
    desc:'+90 range.', stats:{ range:90 } },
  { id:'strongArm', name:'Strong Arm', form:'hand', pal:P.rust, pool:['treasure'], q:1,
    desc:'+1.2 shot speed and +40 range.', stats:{ shotSpeed:1.2, range:40 } },
  { id:'fourLeaf', name:'Four Leaf', form:'star', pal:P.toxic, pool:['treasure','shop'], q:2,
    desc:'+2 luck.', stats:{ luck:2 } },
  { id:'crookedDie', name:'Crooked Die', form:'gear', pal:P.bone, pool:['treasure'], q:1,
    desc:'+3 luck, -0.2 damage.', stats:{ luck:3, damage:-0.2 } },
  { id:'fullBelly', name:'Full Belly', form:'mushroom', pal:P.flesh, pool:['treasure','shop'], q:1,
    desc:'+1 heart container, fully healed.', stats:{ maxHp:2 }, heal:2 },
  { id:'secondWind', name:'Second Wind', form:'cloud', pal:P.cream, pool:['treasure'], q:2,
    desc:'+2 heart containers.', stats:{ maxHp:4 }, heal:4 },
  { id:'thinBlood', name:'Thin Blood', form:'bottle', pal:P.blood, pool:['treasure','curse'], q:2,
    desc:'-1 heart container, +1.8 damage.', stats:{ maxHp:-2, damage:1.8 } },
  { id:'oxHeart', name:'Ox Heart', form:'heart', pal:P.blood, pool:['boss'], q:2,
    desc:'+2 containers and +0.6 damage.', stats:{ maxHp:4, damage:0.6 }, heal:4 },
  { id:'batteryAcid', name:'Battery Acid', form:'bottle', pal:P.toxic, pool:['shop'], q:1,
    desc:'+0.4 fire rate and +1 luck.', stats:{ tears:0.4, luck:1 } },
  { id:'sharpStone', name:'Sharp Stone', form:'blade', pal:P.silver, pool:['treasure','shop'], q:1,
    desc:'+0.8 damage.', stats:{ damage:0.8 } },
  { id:'coldIron', name:'Cold Iron', form:'blade', pal:P.frost, pool:['treasure'], q:2,
    desc:'+1.1 damage, shots slow enemies briefly.', stats:{ damage:1.1 }, flags:{ chill:1 } },
  { id:'featherweight', name:'Featherweight', form:'wing', pal:P.cream, pool:['treasure'], q:2,
    desc:'+0.5 speed, -0.5 damage.', stats:{ speed:0.5, damage:-0.5 } },
  { id:'growthSpurt', name:'Growth Spurt', form:'mushroom', pal:P.rose, pool:['treasure'], q:3,
    desc:'+1.2 damage, +1 container, -0.15 speed. Bigger shots.',
    stats:{ damage:1.2, maxHp:2, speed:-0.15 }, flags:{ big:1 }, heal:2 },
  { id:'stunted', name:'Stunted', form:'mushroom', pal:P.toxic, pool:['treasure'], q:2,
    desc:'+0.4 speed, +0.5 fire rate, -0.4 damage.', stats:{ speed:0.4, tears:0.5, damage:-0.4 } },
  { id:'steadyGrip', name:'Steady Grip', form:'hand', pal:P.copper, pool:['shop'], q:1,
    desc:'+0.9 shot speed.', stats:{ shotSpeed:0.9 } },
  { id:'wideEye', name:'Wide Eye', form:'eye', pal:P.plum, pool:['treasure'], q:2,
    desc:'+130 range and +0.5 shot speed.', stats:{ range:130, shotSpeed:0.5 } },
  { id:'blackLung', name:'Black Lung', form:'cloud', pal:P.soot, pool:['curse','devil'], q:2,
    desc:'+2 damage. Costs a heart container.', stats:{ damage:2, maxHp:-2 } },
  { id:'restlessness', name:'Restlessness', form:'gear', pal:P.amber, pool:['treasure'], q:2,
    desc:'+0.25 speed and +0.5 fire rate.', stats:{ speed:0.25, tears:0.5 } },
  { id:'oldScar', name:'Old Scar', form:'bandaid', pal:P.rose, pool:['shop'], q:1,
    desc:'+0.5 damage and +1 luck.', stats:{ damage:0.5, luck:1 }, form2:'cross' }
];

/* ------------------------------------------------------------------ */
/* passives — shot modifiers                                           */
/* ------------------------------------------------------------------ */
const TEAR_ITEMS = [
  { id:'splitStone', name:'Split Stone', form:'blade', pal:P.bone, pool:['treasure'], q:3,
    desc:'Your shots pass through enemies.', flags:{ pierce:1 }, stats:{ damage:0.3 } },
  { id:'ghostGlass', name:'Ghost Glass', form:'orb', pal:P.ash, pool:['treasure'], q:3,
    desc:'Your shots pass through rocks and pits.', flags:{ spectral:1 } },
  { id:'lodestone', name:'Lodestone', form:'orb', pal:P.deep, pool:['treasure'], q:3,
    desc:'Your shots curve toward enemies.', flags:{ homing:1 }, stats:{ damage:0.2 } },
  { id:'ricochet', name:'Ricochet', form:'ring', pal:P.silver, pool:['treasure'], q:2,
    desc:'Shots bounce off walls twice.', flags:{ bounce:2 } },
  { id:'blackPowder', name:'Black Powder', form:'bottle', pal:P.soot, pool:['treasure','devil'], q:4,
    desc:'Your shots explode. You are immune to your own blasts.',
    flags:{ explosive:1, bombProof:1 }, stats:{ tears:-0.5, damage:0.5 } },
  { id:'rotGland', name:'Rot Gland', form:'bottle', pal:P.toxic, pool:['treasure'], q:2,
    desc:'Shots poison. Poison ticks for your damage over 3 seconds.', flags:{ poison:1 } },
  { id:'winterTeeth', name:'Winter Teeth', form:'tooth', pal:P.frost, pool:['treasure'], q:3,
    desc:'Shots can freeze enemies solid. Frozen enemies shatter for splash damage.',
    flags:{ freeze:1 } },
  { id:'sweetTalk', name:'Sweet Talk', form:'heart', pal:P.rose, pool:['treasure'], q:2,
    desc:'Shots can charm enemies into fighting for you.', flags:{ charm:1 } },
  { id:'forkedRoot', name:'Forked Root', form:'wing', pal:P.jade, pool:['treasure'], q:3,
    desc:'You fire two shots at once.', flags:{ multi:1 }, stats:{ damage:-0.15 } },
  { id:'thirdEye', name:'Third Eye', form:'eye', pal:P.plum, pool:['treasure'], q:4,
    desc:'You fire three shots in a spread.', flags:{ multi:2 }, stats:{ damage:-0.3, tears:-0.2 } },
  { id:'crownOfEyes', name:'Crown of Eyes', form:'crown', pal:P.gold, pool:['boss','angel'], q:4,
    desc:'You fire in four directions at once.', flags:{ quad:1 }, stats:{ damage:-0.2 } },
  { id:'longThread', name:'Long Thread', form:'ring', pal:P.cream, pool:['treasure'], q:3,
    desc:'Shots trail a second, weaker shot behind them.', flags:{ trail:1 } },
  { id:'heavyShot', name:'Heavy Shot', form:'orb', pal:P.copper, pool:['treasure'], q:2,
    desc:'Bigger, slower shots that knock enemies back hard.',
    flags:{ big:1, knock:2 }, stats:{ damage:0.9, shotSpeed:-0.6 } },
  { id:'hairTrigger', name:'Hair Trigger', form:'gear', pal:P.amber, pool:['treasure','shop'], q:2,
    desc:'Much faster, much weaker shots.', stats:{ tears:1.6, damage:-0.8 } },
  { id:'siphon', name:'Siphon', form:'syringe', pal:P.blood, pool:['treasure','devil'], q:4,
    desc:'Every 12 hits you land drops half a red heart.', flags:{ siphon:1 } },
  { id:'brandIron', name:'Brand Iron', form:'flame', pal:P.ember, pool:['treasure'], q:3,
    desc:'Shots set enemies alight, burning them over time.', flags:{ burn:1 } },
  { id:'boltThrower', name:'Bolt Thrower', form:'blade', pal:P.sun, pool:['treasure'], q:4,
    desc:'Charge your shot for a piercing bolt that hits everything in a line.',
    flags:{ charged:1, pierce:1 }, stats:{ damage:0.6 } },
  { id:'pillarOfSalt', name:'Pillar of Salt', form:'bottle', pal:P.cream, pool:['treasure'], q:2,
    desc:'Shots leave a lingering patch that damages what walks over it.', flags:{ patch:1 } },
  { id:'crookedBarrel', name:'Crooked Barrel', form:'gear', pal:P.rust, pool:['shop'], q:1,
    desc:'Shots spray wide. +0.5 fire rate.', flags:{ spray:1 }, stats:{ tears:0.5 } },
  { id:'orbitStone', name:'Orbit Stone', form:'ring', pal:P.deep, pool:['treasure'], q:3,
    desc:'Two rocks circle you, damaging anything they touch.', flags:{ orbitals:2 } },
  { id:'gravewater', name:'Gravewater', form:'bottle', pal:P.void, pool:['treasure','curse'], q:3,
    desc:'Enemies you kill leave a lingering shade that fights for you briefly.',
    flags:{ shades:1 } },
  { id:'stinger', name:'Stinger', form:'horn', pal:P.toxic, pool:['treasure'], q:2,
    desc:'Shots that hit at max range deal double damage.', flags:{ sniper:1 } },
  { id:'closeQuarters', name:'Close Quarters', form:'blade', pal:P.rust, pool:['treasure'], q:2,
    desc:'Shots that hit at point blank deal double damage.', flags:{ brawler:1 } },
  { id:'chainLightning', name:'Chain Lightning', form:'star', pal:P.frost, pool:['treasure','planetarium'], q:4,
    desc:'Hits arc to a nearby enemy for half damage.', flags:{ chain:1 } },
  { id:'shrapnel', name:'Shrapnel', form:'blade', pal:P.silver, pool:['treasure'], q:3,
    desc:'Shots burst into four fragments when they land.', flags:{ burst:1 } },
  { id:'holdBreath', name:'Hold Breath', form:'cloud', pal:P.frost, pool:['treasure'], q:3,
    desc:'Standing still for a second doubles your next shot.', flags:{ patient:1 } },
  { id:'bloodDebt', name:'Blood Debt', form:'heart', pal:P.wine, pool:['devil'], q:4,
    desc:'Damage scales with missing health, up to +3.', flags:{ desperate:1 } },
  { id:'lastLight', name:'Last Light', form:'candle', pal:P.sun, pool:['angel'], q:4,
    desc:'At half a heart, you deal double damage and take none for 2 seconds after a hit.',
    flags:{ lastStand:1 } },
  { id:'tideTurn', name:'Tide Turn', form:'orb', pal:P.brine, pool:['treasure'], q:3,
    desc:'Shots slow down, then race back to you, hitting twice.', flags:{ boomerang:1 } },
  { id:'nailBomb', name:'Nail Bomb', form:'bottle', pal:P.rust, pool:['shop'], q:2,
    desc:'Your bombs are bigger and throw nails outward.', flags:{ bigBombs:1, nailBombs:1 } }
];

/* ------------------------------------------------------------------ */
/* familiars                                                           */
/* ------------------------------------------------------------------ */
const FAMILIARS = [
  { id:'palBlob', name:'Little Brother', form:'orb', pal:P.flesh, pool:['treasure','shop'], q:2,
    desc:'A small friend follows you and fires with you.',
    familiar:{ art:'blob', pal:P.flesh, mode:'follow', dmg:2.5, rate:1.4 } },
  { id:'palFly', name:'Loyal Fly', form:'spider', pal:P.soot, pool:['treasure'], q:2,
    desc:'A fly circles you and hurts what it touches.',
    familiar:{ art:'fly', pal:P.soot, mode:'orbit', dmg:2, touch:true } },
  { id:'palSpirit', name:'Pale Sibling', form:'orb', pal:P.ash, pool:['treasure','angel'], q:3,
    desc:'A spirit follows you, firing spectral shots.',
    familiar:{ art:'spirit', pal:P.ash, mode:'follow', dmg:3, rate:1.1, spectral:true } },
  { id:'palCube', name:'Ice Cube', form:'orb', pal:P.frost, pool:['treasure'], q:3,
    desc:'A cube of ice slides around the room, freezing what it hits.',
    familiar:{ art:'cube', pal:P.frost, mode:'bounce', dmg:3, touch:true, freeze:true } },
  { id:'palSkull', name:'Chattering Skull', form:'skull', pal:P.bone, pool:['treasure'], q:3,
    desc:'A skull charges at whatever is closest.',
    familiar:{ art:'skull', pal:P.bone, mode:'charge', dmg:4, touch:true } },
  { id:'palLeech', name:'Fed Leech', form:'spider', pal:P.blood, pool:['devil'], q:3,
    desc:'A leech follows you. Every ten kills it drops half a red heart.',
    familiar:{ art:'blob', pal:P.blood, mode:'follow', dmg:2, rate:1.2, harvest:true } },
  { id:'palTwins', name:'The Twins', form:'orb', pal:P.plum, pool:['treasure'], q:4,
    desc:'Two friends, one on each side, firing with you.',
    familiar:{ art:'blob', pal:P.plum, mode:'follow', dmg:2, rate:1.3, count:2 } },
  { id:'palHalo', name:'Watchful Halo', form:'ring', pal:P.sun, pool:['angel'], q:4,
    desc:'A ring of light orbits you and blocks enemy shots.',
    familiar:{ art:'cube', pal:P.sun, mode:'orbit', dmg:2, touch:true, blocks:true, count:2 } },
  { id:'palHorn', name:'Small Horn', form:'horn', pal:P.wine, pool:['devil'], q:3,
    desc:'A demon follows you, firing shots that pierce.',
    familiar:{ art:'skull', pal:P.wine, mode:'follow', dmg:3.5, rate:0.9, pierce:true } },
  { id:'palSpore', name:'Spore Cap', form:'mushroom', pal:P.toxic, pool:['treasure'], q:2,
    desc:'A cap follows you and coughs poison clouds at enemies.',
    familiar:{ art:'blob', pal:P.toxic, mode:'follow', dmg:2, rate:0.8, poison:true } },
  { id:'palEmber', name:'Ember', form:'flame', pal:P.ember, pool:['treasure'], q:3,
    desc:'A flame orbits you, burning what it touches.',
    familiar:{ art:'fly', pal:P.ember, mode:'orbit', dmg:2.5, touch:true, burn:true } },
  { id:'palShade', name:'Your Shadow', form:'mask', pal:P.void, pool:['treasure','curse'], q:4,
    desc:'A copy of you, delayed by a moment, firing what you fire.',
    familiar:{ art:'spirit', pal:P.void, mode:'echo', dmg:0.5, mirror:true } },
  { id:'palMagnet', name:'Coin Magnet', form:'ring', pal:P.gold, pool:['shop'], q:2,
    desc:'Pickups drift toward you across the room.', flags:{ magnet:1 } },
  { id:'palGnat', name:'Gnat Swarm', form:'spider', pal:P.lime, pool:['treasure'], q:3,
    desc:'Three gnats orbit you at speed.',
    familiar:{ art:'fly', pal:P.lime, mode:'orbit', dmg:1.5, touch:true, count:3, fast:true } },
  { id:'palMirror', name:'Mirror Box', form:'book', pal:P.silver, pool:['treasure'], q:4,
    desc:'A box that reflects enemy shots back at them.',
    familiar:{ art:'cube', pal:P.silver, mode:'orbit', dmg:1, blocks:true, reflect:true } }
];

/* ------------------------------------------------------------------ */
/* passives — triggers                                                 */
/* ------------------------------------------------------------------ */
const TRIGGER_ITEMS = [
  { id:'spiteBloom', name:'Spite Bloom', form:'flame', pal:P.ember, pool:['treasure'], q:3,
    desc:'Taking damage fires a ring of shots.',
    on:{ damage(g, p){ g.ring(p, 10, 4); g.sfx.hurt(); } } },
  { id:'deadMansTax', name:"Dead Man's Tax", form:'coin', pal:P.gold, pool:['treasure','shop'], q:2, form2:'orb',
    desc:'Enemies sometimes drop a coin when they die.',
    on:{ kill(g, p, e){ if (g.luckRoll(p, 0.14, 0.03)) g.spawnPickup('coin', e.x, e.y); } } },
  { id:'harvestKnife', name:'Harvest Knife', form:'blade', pal:P.blood, pool:['treasure'], q:3,
    desc:'Clearing a room has a good chance to drop a heart.',
    on:{ clear(g, p, room){ if (g.luckRoll(p, 0.33, 0.04)) g.spawnPickup('heartHalf', room.cx, room.cy); } } },
  { id:'scavenger', name:'Scavenger', form:'hand', pal:P.copper, pool:['shop'], q:2,
    desc:'Clearing a room sometimes drops a bomb or a key.',
    on:{ clear(g, p, room){ if (g.luckRoll(p, 0.28, 0.03)) g.spawnPickup(g.rng() < 0.5 ? 'bomb' : 'key', room.cx, room.cy); } } },
  { id:'grudge', name:'Grudge', form:'skull', pal:P.void, pool:['treasure'], q:3,
    desc:'+0.4 damage for the rest of the floor each time you are hit.',
    on:{ damage(g, p){ p.temp.grudge = (p.temp.grudge || 0) + 0.4; p.dirty = true; },
         floor(g, p){ p.temp.grudge = 0; p.dirty = true; } },
    dyn:{ damage: p => p.temp.grudge || 0 } },
  { id:'momentum', name:'Momentum', form:'wing', pal:P.lime, pool:['treasure'], q:3,
    desc:'Killing an enemy stacks +0.06 speed and +0.1 fire rate for 6 seconds.',
    on:{ kill(g, p){ p.temp.momo = Math.min(10, (p.temp.momo || 0) + 1); p.temp.momoT = 6; p.dirty = true; },
         tick(g, p, dt){ if (p.temp.momoT > 0){ p.temp.momoT -= dt; if (p.temp.momoT <= 0){ p.temp.momo = 0; p.dirty = true; } } } },
    dyn:{ speed: p => (p.temp.momo || 0) * 0.06, tears: p => (p.temp.momo || 0) * 0.1 } },
  { id:'ironStomach', name:'Iron Stomach', form:'bottle', pal:P.jade, pool:['shop'], q:2,
    desc:'Pills are always good ones.', flags:{ goodPills:1 } },
  { id:'mapSense', name:'Map Sense', form:'book', pal:P.deep, pool:['shop','treasure'], q:2,
    desc:'The whole floor is on your map from the moment you arrive.',
    flags:{ fullMap:1 }, on:{ floor(g){ g.revealMap(true); }, pickup(g){ g.revealMap(true); } } },
  { id:'sixthSense', name:'Sixth Sense', form:'eye', pal:P.plum, pool:['shop'], q:2,
    desc:'Secret rooms are marked on your map.',
    flags:{ seeSecret:1 }, on:{ floor(g){ g.revealMap(false, true); }, pickup(g){ g.revealMap(false, true); } } },
  { id:'boneCollector', name:'Bone Collector', form:'bone', pal:P.bone, pool:['treasure'], q:3,
    desc:'Every 15 kills, a bone friend joins you for the room.',
    on:{ kill(g, p){ p.temp.bones = (p.temp.bones || 0) + 1; if (p.temp.bones % 15 === 0) g.spawnTempAlly(p); } } },
  { id:'contract', name:'The Contract', form:'book', pal:P.wine, pool:['devil'], q:4,
    desc:'Devil deals cost one less heart, minimum one.', flags:{ cheapDeals:1 } },
  { id:'pennyPincher', name:'Penny Pincher', form:'coin', pal:P.gold, pool:['shop'], q:2, form2:'orb',
    desc:'Shop prices are halved.', flags:{ discount:0.5 } },
  { id:'skeletonKey', name:'Skeleton Key', form:'bone', pal:P.gold, pool:['treasure','shop'], q:2,
    desc:'+5 keys now, and locks sometimes open free.',
    give:{ keys:5 }, flags:{ freeLocks:0.35 } },
  { id:'sappedNerve', name:'Sapped Nerve', form:'syringe', pal:P.void, pool:['curse'], q:3,
    desc:'You take double damage but deal double damage.',
    flags:{ glass:1 }, dyn:{ damage: p => p.base.damage } },
  { id:'stoneSkin', name:'Stone Skin', form:'gear', pal:P.ash, pool:['treasure','angel'], q:3,
    desc:'One hit per room is absorbed.', flags:{ ward:1 } },
  { id:'quietFoot', name:'Quiet Foot', form:'wing', pal:P.ash, pool:['treasure'], q:2,
    desc:'Spikes and floor traps no longer hurt you.', flags:{ spikeProof:1 } },
  { id:'fireproof', name:'Fireproof', form:'flame', pal:P.frost, pool:['shop'], q:1,
    desc:'Fire and your own explosions do not hurt you.', flags:{ fireProof:1, bombProof:1 } },
  { id:'hoarder', name:'Hoarder', form:'crown', pal:P.gold, pool:['treasure'], q:3,
    desc:'+0.02 damage for each coin you carry.',
    dyn:{ damage: p => Math.min(3, p.coins * 0.02) } },
  { id:'wickedLuck', name:'Wicked Luck', form:'star', pal:P.void, pool:['curse','devil'], q:3,
    desc:'+5 luck, but every room starts you at half a heart of shielding only.',
    stats:{ luck:5 }, flags:{ fragile:1 } },
  { id:'echoChamber', name:'Echo Chamber', form:'cloud', pal:P.plum, pool:['treasure'], q:4,
    desc:'Your active item fires twice.', flags:{ doubleActive:1 } }
];

/* ------------------------------------------------------------------ */
/* actives                                                             */
/* ------------------------------------------------------------------ */
const ACTIVES = [
  { id:'aBloodBank', name:'Blood Bank', form:'heart', pal:P.blood, pool:['treasure','shop'], q:2, type:'active', charge:4,
    desc:'Trade half a red heart for a soul heart.',
    use(g, p){ if (p.red <= 1) return false; p.red -= 1; p.addSoul(2); return true; } },
  { id:'aFlashbulb', name:'Flashbulb', form:'star', pal:P.sun, pool:['treasure'], q:3, type:'active', charge:6,
    desc:'Blinds and damages every enemy in the room.',
    use(g, p){ g.damageAll(p.stats.damage * 2.5, p); g.stunAll(2); return true; } },
  { id:'aDeepFreeze', name:'Deep Freeze', form:'orb', pal:P.frost, pool:['treasure'], q:3, type:'active', charge:6,
    desc:'Freezes everything in the room for 4 seconds.',
    use(g, p){ g.freezeAll(4); return true; } },
  { id:'aStopwatch', name:'Stopwatch', form:'gear', pal:P.silver, pool:['treasure','planetarium'], q:4, type:'active', charge:8,
    desc:'Stops time for 5 seconds. You can still move and shoot.',
    use(g){ g.timeStop(5); return true; } },
  { id:'aRerollBox', name:'Reroll Box', form:'book', pal:P.plum, pool:['treasure'], q:3, type:'active', charge:6,
    desc:'Rerolls every pedestal item in the room.',
    use(g){ return g.rerollPedestals(); } },
  { id:'aDiceOfFate', name:'Dice of Fate', form:'gear', pal:P.bone, pool:['treasure'], q:4, type:'active', charge:6,
    desc:'Rerolls all of your passive items into new ones.',
    use(g, p){ return g.rerollItems(p); } },
  { id:'aBloodBomb', name:'Blood Bomb', form:'bottle', pal:P.wine, pool:['devil'], q:2, type:'active', charge:0,
    desc:'Costs half a heart. Drops a huge bomb.',
    use(g, p){ if (p.totalHp() <= 1) return false; p.hurt(1, true); g.dropBomb(p, { r: 90, dmg: 60 }); return true; } },
  { id:'aSpareHeart', name:'Spare Heart', form:'heart', pal:P.rose, pool:['treasure','angel'], q:3, type:'active', charge:8,
    desc:'Heals one full red heart.', use(g, p){ return p.heal(2); } },
  { id:'aWormhole', name:'Wormhole', form:'ring', pal:P.void, pool:['treasure'], q:3, type:'active', charge:4,
    desc:'Teleports you to a random room on the floor.', use(g, p){ g.teleportRandom(p); return true; } },
  { id:'aBackTrack', name:'Back Track', form:'ring', pal:P.deep, pool:['shop'], q:2, type:'active', charge:3,
    desc:'Teleports you back to the room you started on.', use(g, p){ g.teleportStart(p); return true; } },
  { id:'aLootDrop', name:'Loot Drop', form:'crown', pal:P.gold, pool:['treasure'], q:3, type:'active', charge:6,
    desc:'Drops three random pickups at your feet.',
    use(g, p){ for (let i = 0; i < 3; i++) g.spawnPickup(g.randomPickup(), p.x + (g.rng() - .5) * 40, p.y + (g.rng() - .5) * 40); return true; } },
  { id:'aBerserk', name:'Berserk', form:'skull', pal:P.blood, pool:['treasure'], q:3, type:'active', charge:6,
    desc:'For 8 seconds: double fire rate, double speed, no shots — you damage on contact.',
    use(g, p){ p.temp.berserk = 8; p.dirty = true; return true; } },
  { id:'aMoonPull', name:'Moon Pull', form:'orb', pal:P.ash, pool:['planetarium'], q:4, type:'active', charge:6,
    desc:'Drags every enemy toward you and holds them for 3 seconds.',
    use(g, p){ g.pullAll(p, 3); return true; } },
  { id:'aSpiritBottle', name:'Spirit Bottle', form:'bottle', pal:P.ash, pool:['treasure'], q:3, type:'active', charge:5,
    desc:'Releases three spirits that seek out enemies.',
    use(g, p){ for (let i = 0; i < 3; i++) g.spawnSeeker(p); return true; } },
  { id:'aStoneWall', name:'Stone Wall', form:'gear', pal:P.ash, pool:['shop'], q:2, type:'active', charge:4,
    desc:'Raises a wall of rocks around you that blocks shots.',
    use(g, p){ g.raiseWall(p); return true; } },
  { id:'aVampirism', name:'Vampirism', form:'tooth', pal:P.wine, pool:['devil'], q:3, type:'active', charge:6,
    desc:'For 10 seconds, every hit you land heals you a little.',
    use(g, p){ p.temp.vamp = 10; return true; } },
  { id:'aSecondChance', name:'Second Chance', form:'cross', pal:P.cream, pool:['angel'], q:5, type:'active', charge:12,
    desc:'Held charge. If you would die, this revives you at one heart instead.',
    passiveRevive:true, use(g, p){ return p.heal(4); } },
  { id:'aMinesweeper', name:'Minesweeper', form:'bottle', pal:P.soot, pool:['shop'], q:2, type:'active', charge:4,
    desc:'Drops five bombs in a ring around you.',
    use(g, p){ for (let i = 0; i < 5; i++){ const a = i / 5 * Math.PI * 2; g.dropBomb(p, { dx: Math.cos(a) * 34, dy: Math.sin(a) * 34 }); } return true; } },
  { id:'aBookOfDeals', name:'Book of Deals', form:'book', pal:P.wine, pool:['devil'], q:4, type:'active', charge:10,
    desc:'Opens a devil door in the current room, once per floor.',
    use(g, p){ return g.openDealDoor(p); } },
  { id:'aSoulJar', name:'Soul Jar', form:'bottle', pal:P.frost, pool:['treasure'], q:3, type:'active', charge:8,
    desc:'Turns every pickup in the room into a soul heart.',
    use(g, p){ return g.convertPickups('heartSoul'); } },
  { id:'aGreedRing', name:'Greed Ring', form:'ring', pal:P.gold, pool:['shop'], q:3, type:'active', charge:6,
    desc:'Turns every pickup in the room into coins, then doubles them.',
    use(g, p){ return g.convertPickups('coin', 2); } },
  { id:'aPocketSun', name:'Pocket Sun', form:'flame', pal:P.sun, pool:['treasure','angel'], q:4, type:'active', charge:8,
    desc:'A burning ring expands from you, damaging everything it passes.',
    use(g, p){ g.novaBurst(p, p.stats.damage * 4); return true; } },
  { id:'aScapegoat', name:'Scapegoat', form:'mask', pal:P.bone, pool:['treasure'], q:3, type:'active', charge:5,
    desc:'A decoy appears that enemies chase for 6 seconds.',
    use(g, p){ g.spawnDecoy(p, 6); return true; } },
  { id:'aCallOfTheDeep', name:'Call of the Deep', form:'horn', pal:P.brine, pool:['treasure'], q:4, type:'active', charge:10,
    desc:'Summons a large ally that fights for the rest of the room.',
    use(g, p){ g.spawnBigAlly(p); return true; } },
  { id:'aQuickExit', name:'Quick Exit', form:'star', pal:P.lime, pool:['shop'], q:2, type:'active', charge:8,
    desc:'Opens a trapdoor to the next floor right here.',
    use(g, p){ return g.openTrapdoor(p); } }
];

/* ------------------------------------------------------------------ */
/* trinkets — small always-on effects, one slot                        */
/* ------------------------------------------------------------------ */
export const TRINKETS = [
  { id:'tRabbitFoot', name:"Rabbit's Foot", form:'bone', pal:P.bone, desc:'+2 luck.', stats:{ luck:2 } },
  { id:'tCrackedGlasses', name:'Cracked Glasses', form:'eye', pal:P.frost, desc:'Small chance to fire an extra shot.', flags:{ extraShot:0.18 } },
  { id:'tBentSpoon', name:'Bent Spoon', form:'blade', pal:P.silver, desc:'+0.3 damage.', stats:{ damage:0.3 } },
  { id:'tTornPage', name:'Torn Page', form:'book', pal:P.cream, desc:'Books and cards charge your active a little.', flags:{ paperCharge:1 } },
  { id:'tSmallChange', name:'Small Change', form:'coin', pal:P.gold, desc:'+3 coins, and coin drops are worth more.', give:{ coins:3 }, flags:{ richCoins:1 } },
  { id:'tSafetyPin', name:'Safety Pin', form:'blade', pal:P.copper, desc:'+30 range and +0.2 shot speed.', stats:{ range:30, shotSpeed:0.2 } },
  { id:'tChewedNail', name:'Chewed Nail', form:'blade', pal:P.rust, desc:'Enemies you touch take a little damage.', flags:{ thorns:1 } },
  { id:'tPetrifiedEgg', name:'Petrified Egg', form:'orb', pal:P.ash, desc:'Boss rooms drop an extra heart.', flags:{ bossHeart:1 } },
  { id:'tMouseTooth', name:'Mouse Tooth', form:'tooth', pal:P.bone, desc:'+0.25 fire rate.', stats:{ tears:0.25 } },
  { id:'tOldBandage', name:'Old Bandage', form:'cross', pal:P.rose, desc:'Clearing a room can drop half a heart.',
    on:{ clear(g, p, room){ if (g.luckRoll(p, 0.16, 0.03)) g.spawnPickup('heartHalf', room.cx, room.cy); } } },
  { id:'tBlackFeather', name:'Black Feather', form:'wing', pal:P.soot, desc:'+0.15 damage per item you own.',
    dyn:{ damage: p => p.items.length * 0.15 } },
  { id:'tCurvedHorn', name:'Curved Horn', form:'horn', pal:P.wine, desc:'+1 damage.', stats:{ damage:1 } },
  { id:'tGlassShard', name:'Glass Shard', form:'blade', pal:P.frost, desc:'+1.5 damage, but you take one extra half-heart per hit.',
    stats:{ damage:1.5 }, flags:{ brittle:1 } },
  { id:'tCoinPurse', name:'Coin Purse', form:'coin', pal:P.copper, desc:'Shops sell one extra item.', flags:{ bigShop:1 } },
  { id:'tGraveDirt', name:'Grave Dirt', form:'orb', pal:P.soot, desc:'At half a heart, +2 damage.',
    dyn:{ damage: p => p.totalHp() <= 1 ? 2 : 0 } },
  { id:'tWireHanger', name:'Wire Hanger', form:'gear', pal:P.silver, desc:'Locked doors and chests open without keys 50% of the time.', flags:{ freeLocks:0.5 } },
  { id:'tFlyEye', name:'Fly Eye', form:'spider', pal:P.lime, desc:'Killing an enemy sometimes leaves a friendly fly.',
    on:{ kill(g, p, e){ if (g.luckRoll(p, 0.1, 0.02)) g.spawnTempAlly(p, e.x, e.y); } } },
  { id:'tPaperClip', name:'Paper Clip', form:'gear', pal:P.silver, desc:'Chests are always unlocked.', flags:{ freeLocks:1 } },
  { id:'tRustedKey', name:'Rusted Key', form:'ring', pal:P.rust, desc:'+2 keys on every new floor.',
    on:{ floor(g, p){ p.keys += 2; } } },
  { id:'tMatchstick', name:'Matchstick', form:'flame', pal:P.ember, desc:'+2 bombs on every new floor.',
    on:{ floor(g, p){ p.bombs += 2; } } },
  { id:'tCatsCradle', name:"Cat's Cradle", form:'ring', pal:P.rose, desc:'You keep half a heart of shielding that refills each room.', flags:{ ward:1 } },
  { id:'tBrokenWatch', name:'Broken Watch', form:'gear', pal:P.deep, desc:'Enemies move 15% slower.', flags:{ slowRoom:0.85 } }
];

/* ------------------------------------------------------------------ */
/* cards — one-shot, held in a slot                                    */
/* ------------------------------------------------------------------ */
export const CARDS = [
  { id:'cFool', name:'The Wanderer', desc:'Teleports you to the starting room.', use:(g, p) => { g.teleportStart(p); return true; } },
  { id:'cStar', name:'The Star', desc:'Reveals the whole map.', use:(g) => { g.revealMap(true); return true; } },
  { id:'cMoon', name:'The Moon', desc:'Reveals and opens the secret rooms.', use:(g) => { g.revealMap(false, true, true); return true; } },
  { id:'cSun', name:'The Sun', desc:'Full heal and reveals the map.', use:(g, p) => { p.heal(99); g.revealMap(true); return true; } },
  { id:'cTower', name:'The Tower', desc:'Fills the room with bombs. Careful.', use:(g, p) => { g.rainBombs(p, 8); return true; } },
  { id:'cHermit', name:'The Hermit', desc:'Teleports you to the shop.', use:(g, p) => g.teleportType(p, 'shop') },
  { id:'cEmpress', name:'The Empress', desc:'+2 containers for this room, healed.', use:(g, p) => { p.tempContainers(2); return true; } },
  { id:'cDevil', name:'The Bargain', desc:'+2 damage for the rest of the room.', use:(g, p) => { p.temp.cardDmg = (p.temp.cardDmg || 0) + 2; p.dirty = true; return true; } },
  { id:'cJudgement', name:'Judgement', desc:'Spawns a beggar.', use:(g, p) => { g.spawnBeggar(p); return true; } },
  { id:'cWorld', name:'The World', desc:'Opens every door in the room, including secret ones.', use:(g) => { g.openAllDoors(); return true; } },
  { id:'cWheel', name:'The Wheel', desc:'Rerolls every pickup in the room.', use:(g) => g.rerollPickups() },
  { id:'cChariot', name:'The Chariot', desc:'Invincible for 7 seconds.', use:(g, p) => { p.invuln = Math.max(p.invuln, 7); return true; } },
  { id:'cDeath', name:'The Ending', desc:'Damages every enemy in the room heavily.', use:(g, p) => { g.damageAll(40, p); return true; } },
  { id:'cLovers', name:'The Lovers', desc:'Two red hearts.', use:(g, p) => { g.spawnPickup('heartRed', p.x - 14, p.y); g.spawnPickup('heartRed', p.x + 14, p.y); return true; } },
  { id:'cHanged', name:'The Hanged Man', desc:'Enemies are slowed for the rest of the room.', use:(g) => { g.slowRoom(0.55); return true; } },
  { id:'cMagician', name:'The Magician', desc:'Homing shots for the rest of the room.', use:(g, p) => { p.temp.cardHoming = true; return true; } },
  { id:'cHigh', name:'The Keeper', desc:'Two soul hearts.', use:(g, p) => { p.addSoul(4); return true; } },
  { id:'cEmperor', name:'The Emperor', desc:'Teleports you to the boss room.', use:(g, p) => g.teleportType(p, 'boss') },
  { id:'cJustice', name:'Justice', desc:'A heart, a coin, a bomb and a key.', use:(g, p) => { ['heartRed','coin','bomb','key'].forEach((k, i) => g.spawnPickup(k, p.x + (i - 1.5) * 20, p.y)); return true; } },
  { id:'cTemperance', name:'Temperance', desc:'Spawns a pill machine you can use once.', use:(g, p) => { g.spawnPickup('pill', p.x, p.y); g.spawnPickup('pill', p.x + 18, p.y); return true; } },
  { id:'cStrength', name:'Strength', desc:'+1 container and +1 damage for the room.', use:(g, p) => { p.tempContainers(1); p.temp.cardDmg = (p.temp.cardDmg || 0) + 1; p.dirty = true; return true; } },
  { id:'cRuneAsh', name:'Ash Rune', desc:'Destroys every rock in the room and drops what was under them.', use:(g) => { g.crumbleRocks(); return true; }, rune:true },
  { id:'cRuneTide', name:'Tide Rune', desc:'Pulls every pickup on the floor to you.', use:(g, p) => { g.gatherPickups(p); return true; }, rune:true },
  { id:'cRuneBond', name:'Bond Rune', desc:'Charms every enemy in the room for 10 seconds.', use:(g) => { g.charmAll(10); return true; }, rune:true }
];

/* ------------------------------------------------------------------ */
/* pills — colour is stable per run, effect is shuffled                */
/* ------------------------------------------------------------------ */
export const PILL_EFFECTS = [
  { id:'pHealth', name:'Health Up', good:true, use:(g, p) => { p.addContainers(1); p.heal(2); } },
  { id:'pHealthDown', name:'Health Down', good:false, use:(g, p) => { p.addContainers(-1); } },
  { id:'pRange', name:'Range Up', good:true, use:(g, p) => { p.perm.range += 40; p.dirty = true; } },
  { id:'pRangeDown', name:'Range Down', good:false, use:(g, p) => { p.perm.range -= 30; p.dirty = true; } },
  { id:'pSpeed', name:'Speed Up', good:true, use:(g, p) => { p.perm.speed += 0.18; p.dirty = true; } },
  { id:'pSpeedDown', name:'Speed Down', good:false, use:(g, p) => { p.perm.speed -= 0.14; p.dirty = true; } },
  { id:'pTears', name:'Tears Up', good:true, use:(g, p) => { p.perm.tears += 0.35; p.dirty = true; } },
  { id:'pTearsDown', name:'Tears Down', good:false, use:(g, p) => { p.perm.tears -= 0.28; p.dirty = true; } },
  { id:'pDamage', name:'Damage Up', good:true, use:(g, p) => { p.perm.damage += 0.6; p.dirty = true; } },
  { id:'pDamageDown', name:'Damage Down', good:false, use:(g, p) => { p.perm.damage -= 0.45; p.dirty = true; } },
  { id:'pLuck', name:'Lucky Feeling', good:true, use:(g, p) => { p.perm.luck += 1; p.dirty = true; } },
  { id:'pLuckDown', name:'Unlucky Feeling', good:false, use:(g, p) => { p.perm.luck -= 1; p.dirty = true; } },
  { id:'pFullHeal', name:'Feels Better', good:true, use:(g, p) => { p.heal(99); } },
  { id:'pBleed', name:'Feels Worse', good:false, use:(g, p) => { p.hurt(1, true); } },
  { id:'pMap', name:'Sudden Clarity', good:true, use:(g) => { g.revealMap(true); } },
  { id:'pExplosive', name:'Bad Gas', good:false, use:(g, p) => { g.explode(p.x, p.y, 44, 12, p); } },
  { id:'pBombs', name:'Full Pockets', good:true, use:(g, p) => { p.bombs += 3; p.keys += 2; } },
  { id:'pPurge', name:'Room Clearer', good:true, use:(g, p) => { g.damageAll(18, p); } }
];

/* ------------------------------------------------------------------ */
/* assembly                                                            */
/* ------------------------------------------------------------------ */
export const ITEMS = [...STAT_ITEMS, ...TEAR_ITEMS, ...FAMILIARS, ...TRIGGER_ITEMS, ...ACTIVES]
  .map(it => ({ type: it.type || (it.familiar ? 'familiar' : 'passive'), q: it.q ?? 1, pool: it.pool || ['treasure'], ...it }));

export const BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));
export const TRINKET_BY_ID = Object.fromEntries(TRINKETS.map(i => [i.id, i]));

/** Items available to a given pool, e.g. 'devil' or 'treasure'. */
export function poolOf(name){
  const list = ITEMS.filter(i => i.pool.includes(name));
  return list.length ? list : ITEMS.filter(i => i.pool.includes('treasure'));
}

export const POOL_NAMES = ['treasure', 'shop', 'boss', 'devil', 'angel', 'curse', 'planetarium', 'secret'];

/** Total content count, for the menu blurb. */
export const COUNTS = {
  items: ITEMS.length,
  trinkets: TRINKETS.length,
  cards: CARDS.length,
  pills: PILL_EFFECTS.length
};

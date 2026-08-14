/*
 * Melody bank for `songless`.
 *
 * Everything in here is public domain or traditional, and it is *note data*
 * written out by hand — no audio files, no samples, nothing downloaded.
 * The synth in core/audio.js turns it into sound at runtime, so the whole
 * game works offline.
 *
 * Format: "name:beats", "-" is a rest. Beats are relative to the tune's bpm.
 * `hint` is only revealed on the last life.
 */
export const MELODIES = [
  { id:'elise', title:'Für Elise', by:'Beethoven', era:'classical', bpm:132, hint:'Beethoven wrote it for someone whose name we still argue about.',
    notes:'e5:.5 d#5:.5 e5:.5 d#5:.5 e5:.5 b4:.5 d5:.5 c5:.5 a4:1 -:.5 c4:.5 e4:.5 a4:.5 b4:1 -:.5 e4:.5 g#4:.5 b4:.5 c5:1 -:.5 e4:.5 e5:.5 d#5:.5 e5:.5 d#5:.5 e5:.5 b4:.5 d5:.5 c5:.5 a4:1.5' },

  { id:'joy', title:'Ode to Joy', by:'Beethoven', era:'classical', bpm:120, hint:'The final movement of a ninth symphony, and the anthem of a continent.',
    notes:'e4:1 e4:1 f4:1 g4:1 g4:1 f4:1 e4:1 d4:1 c4:1 c4:1 d4:1 e4:1 e4:1.5 d4:.5 d4:2' },

  { id:'fifth', title:'Symphony No. 5', by:'Beethoven', era:'classical', bpm:108, hint:'Four notes. Probably the most famous four notes there are.',
    notes:'-:.5 g4:.5 g4:.5 g4:.5 d#4:3 -:.5 f4:.5 f4:.5 f4:.5 d4:3' },

  { id:'moonlight', title:'Moonlight Sonata', by:'Beethoven', era:'classical', bpm:60, hint:'A slow triplet crawl in C sharp minor.',
    notes:'g#3:.33 c#4:.33 e4:.33 g#3:.33 c#4:.33 e4:.33 g#3:.33 c#4:.33 e4:.33 g#3:.33 c#4:.33 e4:.33 a3:.33 c#4:.33 e4:.33 a3:.33 c#4:.33 e4:.33 a3:.33 d4:.33 f#4:.33 a3:.33 d4:.33 f#4:.33' },

  { id:'turca', title:'Rondo Alla Turca', by:'Mozart', era:'classical', bpm:132, hint:'Mozart doing an impression of a Turkish military band.',
    notes:'b4:.5 a4:.5 g#4:.5 a4:.5 c5:2 d5:.5 c5:.5 b4:.5 c5:.5 e5:2 f5:.5 e5:.5 d#5:.5 e5:.5 b5:.5 a5:.5 g5:.5 a5:.5 b5:.5 a5:.5 g5:.5 a5:.5 c6:2' },

  { id:'nacht', title:'Eine kleine Nachtmusik', by:'Mozart', era:'classical', bpm:132, hint:'A little night music, written for strings.',
    notes:'g4:.75 d4:.25 g4:.75 d4:.25 g4:.5 d4:.5 g4:.5 b4:.5 d5:1.5 -:.5 d5:.75 a4:.25 d4:.75 a4:.25 d4:.5 a4:.5 d4:.5 f#4:.5 a4:1.5' },

  { id:'canon', title:'Canon in D', by:'Pachelbel', era:'classical', bpm:100, hint:'Played at roughly every wedding since 1919.',
    notes:'f#5:2 e5:2 d5:2 c#5:2 b4:2 a4:2 b4:2 c#5:2 d5:2 c#5:2 b4:2 a4:2 g4:2 f#4:2 g4:2 e4:2' },

  { id:'toccata', title:'Toccata and Fugue in D minor', by:'Bach', era:'classical', bpm:96, hint:'The organ piece every cartoon villain owns.',
    notes:'a5:.5 g5:.25 a5:1.5 -:.5 g5:.25 f5:.25 e5:.25 d5:.25 c#5:1 d5:2' },

  { id:'mountain', title:'In the Hall of the Mountain King', by:'Grieg', era:'classical', bpm:120, hint:'It starts creeping and ends up sprinting.',
    notes:'b3:.5 c#4:.5 d4:.5 e4:.5 f#4:.5 d4:.5 f#4:1 f4:.5 c#4:.5 f4:1 e4:.5 c4:.5 e4:1 b3:.5 c#4:.5 d4:.5 e4:.5 f#4:.5 d4:.5 f#4:.5 b4:.5 a4:.5 f#4:.5 b4:1' },

  { id:'swan', title:'Swan Lake', by:'Tchaikovsky', era:'classical', bpm:96, hint:'The oboe theme from a ballet about a cursed bird.',
    notes:'b4:2 e5:1 f#5:1 g5:1 a5:1 b5:2 -:.5 b5:.5 a5:1 g5:1 f#5:1 e5:2' },

  { id:'danube', title:'The Blue Danube', by:'Strauss II', era:'classical', bpm:174, hint:'A waltz named after a river that is famously not blue.',
    notes:'d4:1 f#4:1 a4:2 a4:1 -:1 a4:1 -:1 b4:1 -:1 b4:1 -:2 d4:1 f#4:1 a4:2 a4:1 -:1 a4:1 -:1 g4:1 -:1 g4:1 -:2' },

  { id:'habanera', title:'Habanera (Carmen)', by:'Bizet', era:'classical', bpm:100, hint:'From an opera, sung by someone with very poor judgement in men.',
    notes:'d5:1 c#5:.5 c5:.5 b4:.5 a#4:.5 a#4:1 a4:1 -:1 a4:.5 a4:.5 a4:1 -:1 d5:1 c#5:.5 c5:.5 b4:.5 a#4:.5 a#4:1 a4:2' },

  { id:'entertainer', title:'The Entertainer', by:'Scott Joplin', era:'ragtime', bpm:150, hint:'Ragtime piano. You have heard it from an ice-cream van.',
    notes:'d5:.5 e5:.5 c5:.5 a4:1 b4:.5 g4:1 -:.5 d4:.25 e4:.25 c4:.5 a3:1 b3:.5 g3:1 -:.5 d4:.25 e4:.25 c4:.5 a3:1 b3:.5 d5:.5 d5:.5 c5:1' },

  { id:'korobeiniki', title:'Korobeiniki', by:'Russian folk', era:'folk', bpm:150, hint:'A 19th-century pedlars\' song that got very famous on a handheld console.',
    notes:'e5:1 b4:.5 c5:.5 d5:1 c5:.5 b4:.5 a4:1 a4:.5 c5:.5 e5:1 d5:.5 c5:.5 b4:1.5 c5:.5 d5:1 e5:1 c5:1 a4:1 a4:2' },

  { id:'greensleeves', title:'Greensleeves', by:'English traditional', era:'folk', bpm:100, hint:'A Tudor ballad often wrongly pinned on Henry VIII.',
    notes:'a4:1 c5:1.5 d5:.5 e5:1.5 f5:.5 e5:1 d5:1.5 b4:.5 g4:1 a4:1.5 b4:.5 c5:1.5 a4:.5 a4:1 g#4:.5 a4:.5 b4:1 g#4:1.5 e4:1.5' },

  { id:'scarborough', title:'Scarborough Fair', by:'English traditional', era:'folk', bpm:104, hint:'A riddle-song naming four herbs.',
    notes:'a3:1 a4:2 a4:1 e4:2 e4:1 e4:1.5 f#4:.5 g4:1 e4:2 -:1 d4:1.5 c4:.5 b3:1 a3:2 a3:1 a3:1 c4:1 d4:1 e4:3' },

  { id:'risingsun', title:'House of the Rising Sun', by:'American traditional', era:'folk', bpm:88, hint:'A New Orleans folk lament built on rolling arpeggios.',
    notes:'a3:.5 c4:.5 e4:.5 a4:1 -:.5 c4:.5 e4:.5 a4:.5 c5:1 -:.5 d4:.5 f#4:.5 a4:.5 d5:1 -:.5 f4:.5 a4:.5 c5:.5 f5:1' },

  { id:'amazing', title:'Amazing Grace', by:'Traditional hymn', era:'folk', bpm:84, hint:'An 18th-century hymn, usually played on bagpipes at the worst moment.',
    notes:'g4:1 c5:2 e5:.5 c5:.5 e5:2 d5:1 c5:2 a4:1 g4:3 g4:1 c5:2 e5:.5 c5:.5 e5:2 d5:3' },

  { id:'danny', title:'Londonderry Air', by:'Irish traditional', era:'folk', bpm:76, hint:'The Irish air that later picked up words about a departing boy.',
    notes:'c4:.5 f4:1.5 g4:.5 a4:1 a#4:.5 a4:1 f4:1 a4:1 c5:2 d5:1 c5:1 a4:1.5 f4:.5 g4:1 f4:2' },

  { id:'auld', title:'Auld Lang Syne', by:'Scottish traditional', era:'folk', bpm:96, hint:'Sung badly, by everyone, once a year.',
    notes:'c4:1 f4:1.5 e4:.5 f4:1 a4:1 g4:1.5 f4:.5 g4:1 a4:1 f4:1.5 f4:.5 a4:1 c5:1 d5:3' },

  { id:'saints', title:'When the Saints Go Marching In', by:'American traditional', era:'folk', bpm:120, hint:'A New Orleans jazz-funeral standard.',
    notes:'c4:1 e4:1 f4:1 g4:3 -:1 c4:1 e4:1 f4:1 g4:3 -:1 c4:1 e4:1 f4:1 g4:2 e4:1 c4:1 e4:1 d4:3' },

  { id:'hava', title:'Hava Nagila', by:'Jewish traditional', era:'folk', bpm:120, hint:'A celebration hora that starts slow and refuses to stay that way.',
    notes:'d4:.5 e4:.5 f4:1 g4:.5 f4:.5 e4:1 d4:.5 e4:.5 f4:1 g4:.5 f4:.5 e4:1 d4:.5 d4:.5 f4:1 f4:.5 g4:.5 a4:2' },

  { id:'cucaracha', title:'La Cucaracha', by:'Mexican traditional', era:'folk', bpm:150, hint:'A corrido about an insect with mobility problems.',
    notes:'c4:.5 c4:.5 c4:.5 f4:1.5 a4:1.5 c4:.5 c4:.5 c4:.5 f4:1.5 a4:1.5 f5:1 e5:.5 d5:.5 c5:2' },

  { id:'twinkle', title:'Twinkle Twinkle Little Star', by:'French traditional', era:'nursery', bpm:112, hint:'Mozart wrote variations on it. You learned it before you could read.',
    notes:'c4:1 c4:1 g4:1 g4:1 a4:1 a4:1 g4:2 f4:1 f4:1 e4:1 e4:1 d4:1 d4:1 c4:2' },

  { id:'frere', title:'Frère Jacques', by:'French traditional', era:'nursery', bpm:120, hint:'A round about a monk who will not wake up.',
    notes:'c4:1 d4:1 e4:1 c4:1 c4:1 d4:1 e4:1 c4:1 e4:1 f4:1 g4:2 e4:1 f4:1 g4:2' },

  { id:'mary', title:'Mary Had a Little Lamb', by:'Nursery traditional', era:'nursery', bpm:120, hint:'The first thing ever recorded onto a phonograph.',
    notes:'e4:1 d4:1 c4:1 d4:1 e4:1 e4:1 e4:2 d4:1 d4:1 d4:2 e4:1 g4:1 g4:2' },

  { id:'row', title:'Row Row Row Your Boat', by:'Nursery traditional', era:'nursery', bpm:112, hint:'A round with an unexpectedly bleak philosophical ending.',
    notes:'c4:1 c4:1 c4:.66 d4:.34 e4:1 e4:.66 d4:.34 e4:.66 f4:.34 g4:2 c5:.34 c5:.34 c5:.34 g4:.34 g4:.34 g4:.34 e4:.34 e4:.34 e4:.34 c4:.34 c4:.34 c4:.34 g4:.66 f4:.34 e4:.66 d4:.34 c4:2' },

  { id:'macdonald', title:'Old MacDonald Had a Farm', by:'Nursery traditional', era:'nursery', bpm:120, hint:'Involves a lot of vowels and a lot of livestock.',
    notes:'g4:1 g4:1 g4:1 d4:1 e4:1 e4:1 d4:2 b4:1 b4:1 a4:1 a4:1 g4:3 -:1 d4:1' },

  { id:'popweasel', title:'Pop Goes the Weasel', by:'English traditional', era:'nursery', bpm:150, hint:'The jack-in-the-box tune. You know exactly where the surprise lands.',
    notes:'c4:.5 c4:.5 d4:.5 d4:.5 e4:.5 g4:.5 e4:1 c4:.5 c4:.5 d4:.5 d4:.5 e4:1 c4:1 c4:.5 c4:.5 d4:.5 d4:.5 e4:.5 g4:.5 e4:1 c4:1.5 a4:.5 d4:1 e4:1 c4:1' },

  { id:'yankee', title:'Yankee Doodle', by:'American traditional', era:'folk', bpm:132, hint:'A colonial marching tune involving a feather and some poor fashion advice.',
    notes:'c4:.5 c4:.5 d4:.5 e4:.5 c4:.5 e4:.5 d4:.5 g3:.5 c4:.5 c4:.5 d4:.5 e4:.5 c4:1 b3:1 c4:.5 c4:.5 d4:.5 e4:.5 f4:.5 e4:.5 d4:.5 c4:.5 b3:.5 g3:.5 a3:.5 b3:.5 c4:1.5' },

  { id:'jingle', title:'Jingle Bells', by:'James Pierpont', era:'seasonal', bpm:140, hint:'Written for Thanksgiving, hijacked by December.',
    notes:'e4:1 e4:1 e4:2 e4:1 e4:1 e4:2 e4:1 g4:1 c4:1.5 d4:.5 e4:4 f4:1 f4:1 f4:1.5 f4:.5 f4:1 e4:1 e4:1 e4:.5 e4:.5 e4:1 d4:1 d4:1 e4:1 d4:2 g4:2' },

  { id:'silent', title:'Silent Night', by:'Franz Gruber', era:'seasonal', bpm:88, hint:'First performed on a guitar because the church organ had broken.',
    notes:'g4:1.5 a4:.5 g4:1 e4:3 g4:1.5 a4:.5 g4:1 e4:3 d5:2 d5:1 b4:3 c5:2 c5:1 g4:3' },

  { id:'carol', title:'Carol of the Bells', by:'Mykola Leontovych', era:'seasonal', bpm:160, hint:'A Ukrainian shchedryk built on a four-note ostinato that never lets up.',
    notes:'b4:1 a#4:1 b4:1 g#4:1 b4:1 a#4:1 b4:1 g#4:1 b4:1 a#4:1 b4:1 g#4:1 e5:1 e5:1 d#5:1 e5:1' },

  { id:'wewish', title:'We Wish You a Merry Christmas', by:'English traditional', era:'seasonal', bpm:150, hint:'Contains a firm demand for pudding.',
    notes:'c4:1 f4:1 f4:.5 g4:.5 f4:.5 e4:.5 d4:1 d4:1 d4:1 g4:1 g4:.5 a4:.5 g4:.5 f4:.5 e4:1 c4:1 c4:1 a4:1 a4:.5 a#4:.5 a4:.5 g4:.5 f4:1 d4:1 c4:.5 c4:.5 d4:1 g4:1 e4:1 f4:2' },

  { id:'tannenbaum', title:'O Tannenbaum', by:'German traditional', era:'seasonal', bpm:110, hint:'A German song admiring a tree\'s reliability.',
    notes:'c4:.5 f4:1 f4:.5 f4:1.5 g4:.5 a4:1 a4:.5 a4:1 a4:.5 g4:.5 a4:1 a#4:.5 e4:1 g4:1.5 f4:.5 f4:2' },

  { id:'wedding', title:'Bridal Chorus', by:'Wagner', era:'classical', bpm:100, hint:'The one that plays while everyone stands up and turns around.',
    notes:'b4:.5 e5:.75 e5:.25 e5:1.5 b4:.5 c#5:.75 b4:.25 b4:.5 c#5:.5 d#5:1.5 b4:.5 e5:.75 f#5:.25 g#5:1 e5:.5 e5:.5 e5:1 d#5:1 e5:2' },

  { id:'funeral', title:'Funeral March', by:'Chopin', era:'classical', bpm:60, hint:'Everybody hums this when something breaks.',
    notes:'b3:1.5 b3:.5 b3:1.5 b3:.5 b3:1.5 d4:.5 c#4:1 c#4:.5 b3:.5 b3:1 a#3:.5 b3:.5 b3:2' },

  { id:'greenaway', title:'Für die Reveille (Taps)', by:'American traditional', era:'folk', bpm:66, hint:'A bugle call played at dusk and at funerals.',
    notes:'g3:1 g3:.5 c4:2.5 g3:1 c4:.5 e4:2.5 g3:1 c4:.5 e4:1 g3:1 c4:.5 e4:2.5' },

  { id:'volga', title:'Song of the Volga Boatmen', by:'Russian traditional', era:'folk', bpm:66, hint:'A heaving work song for people pulling barges upriver.',
    notes:'d4:1.5 d4:.5 d4:1 e4:1 f4:1 f4:1 e4:1 d4:1 d4:1 c4:1 d4:2' },

  { id:'clementine', title:'Oh My Darling, Clementine', by:'American traditional', era:'folk', bpm:120, hint:'A gold-rush ballad with a very unhappy ending.',
    notes:'c4:.5 c4:.5 c4:.5 g3:1 e4:.5 e4:.5 e4:.5 c4:1 c4:.5 e4:.5 g4:.5 g4:.5 f4:1 e4:.5 d4:1.5 -:.5 d4:.5 e4:.5 f4:.5 f4:1 e4:.5 d4:.5 e4:.5 c4:1' }
];

export const ERAS = ['all', 'classical', 'folk', 'nursery', 'seasonal', 'ragtime'];

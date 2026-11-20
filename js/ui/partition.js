// La partition de Velours, v2 : cinq morceaux originaux, lo-fi et synthwave « casino feutré ».
// Module pur (aucun son ici) : il dit quelles notes tombent sur chaque pas.
// son.js se charge de les jouer. Les hauteurs sont des numéros MIDI (60 = do central).
//
// Toutes les mesures font 16 doubles croches. Les couches s'ajoutent avec l'intensité (0 à 3) :
//   0 : piano électrique, basse, grosse caisse ; c'est le calme avant de miser.
//   1 : la batterie entre, le refrain (le « chant ») se fait entendre.
//   2 : nappe, contre-chant, basse qui marche vers l'accord suivant.
//   3 : arpège, charleston serré, charleston ouvert : la tension de la dernière main.
// opts.fievre (crescendo de mains) ajoute un arpège rapide par-dessus, quelle que soit l'intensité.

// Accord : fondamentale de basse (MIDI) et voicing (4 notes du piano, autour du do central).
const A = (fond, notes) => ({ fond, notes });

// Chaque mesure du chant : liste de [pas, hauteur, durée en pas]. Chaque refrain revient deux fois.
const SCENES = {
  // Le titre : synthwave lente, la mineur, nappes et arpège en écho.
  titre: {
    nom: 'Néons du foyer',
    style: 'synth', bpm: 90, pas: 16, pasParTemps: 4, swing: 0,
    timbres: { basse: 'synth', accord: 'piano', chant: 'lead', contre: 'cloche', arpege: 'pincee', nappe: 'nappe' },
    accords: [
      [A(45, [57, 60, 64, 67])], [A(41, [53, 57, 60, 64])], [A(48, [55, 60, 64, 67])], [A(43, [55, 59, 62, 64])],
      [A(45, [57, 60, 64, 67])], [A(41, [53, 57, 60, 64])], [A(38, [53, 57, 60, 62])], [A(40, [52, 57, 59, 62]), A(40, [52, 56, 59, 62])],
    ],
    chant: [
      [[0, 76, 6], [6, 74, 2], [8, 72, 4], [12, 71, 2], [14, 72, 2]],
      [[0, 69, 8], [8, 72, 4], [12, 77, 4]],
      [[0, 76, 6], [6, 74, 2], [8, 72, 4], [12, 74, 4]],
      [[0, 71, 12], [12, 67, 4]],
      [[0, 76, 6], [6, 74, 2], [8, 72, 4], [12, 79, 4]],
      [[0, 77, 6], [6, 76, 2], [8, 74, 4], [12, 72, 4]],
      [[0, 74, 4], [4, 72, 4], [8, 69, 4], [12, 77, 4]],
      [[0, 76, 8], [8, 68, 8]],
    ],
    jouer(c) {
      const a = c.accord;
      if (c.pas === 0 || (c.accords.length === 2 && c.pas === 8)) c.nappe(a.notes, c.accords.length === 2 ? 8 : 16, 0.05);
      if (c.pas % 2 === 0) c.ev('basse', a.fond + (c.pas % 4 === 2 ? 12 : 0), 1.7, c.pas % 4 === 0 ? 0.26 : 0.18);
      if (c.pas === 0 || c.pas === 8) c.ev('grosse', 0, 1, 0.34);
      if (c.int >= 1 && (c.pas === 4 || c.pas === 12)) c.ev('claire', 0, 1, 0.12);
      if (c.pas % 4 === 2) c.ev('charley', 0, 1, 0.04);
      if (c.int >= 1) c.arp([0, 1, 2, 3, 2, 1, 2, 3], c.pas >= 8 ? 24 : 12, 0.045);
      if (c.int >= 1) c.chant();
      if (c.int >= 1 && c.cycle % 2 === 1 && c.pas === 8) c.ev('contre', a.notes[3] + 12, 6, 0.05);
      if (c.int >= 2 && c.pas === 0) c.ev('accord', a.notes[0] + 12, 4, 0.05);
    },
  },

  // La table : lo-fi hip-hop qui balance, ré mineur. Le refrain du jeu.
  manche: {
    nom: 'Velours de minuit',
    style: 'lofi', bpm: 84, pas: 16, pasParTemps: 4, swing: 0.22,
    timbres: { basse: 'ronde', accord: 'piano', chant: 'flute', contre: 'cloche', arpege: 'pincee', nappe: 'nappe' },
    accords: [
      [A(38, [53, 57, 60, 64])], [A(46, [53, 57, 58, 62])], [A(43, [58, 62, 65, 69])], [A(45, [55, 58, 61, 64])],
      [A(38, [53, 57, 60, 64])], [A(46, [53, 57, 58, 62])], [A(43, [55, 58, 62, 65]), A(48, [52, 55, 58, 62])], [A(41, [53, 57, 60, 64]), A(45, [55, 57, 61, 64])],
    ],
    chant: [
      [[0, 69, 3], [3, 72, 1], [4, 74, 4], [10, 77, 2], [12, 76, 4]],
      [[0, 74, 6], [8, 69, 2], [10, 65, 6]],
      [[0, 69, 3], [3, 70, 1], [4, 74, 4], [10, 79, 2], [12, 77, 4]],
      [[0, 76, 4], [6, 73, 2], [8, 70, 4], [12, 69, 4]],
      [[0, 69, 3], [3, 72, 1], [4, 74, 4], [10, 77, 2], [12, 76, 4]],
      [[0, 74, 3], [3, 77, 1], [4, 81, 6], [12, 79, 2], [14, 77, 2]],
      [[0, 79, 3], [3, 77, 1], [4, 74, 4], [8, 76, 4], [12, 72, 4]],
      [[0, 72, 3], [3, 69, 5], [8, 73, 4], [12, 76, 4]],
    ],
    jouer(c) {
      const a = c.accord;
      const deux = c.accords.length === 2;
      // Piano électrique : l'accord tenu, une relance, et l'accord suivant joué en avance (le « push » lo-fi).
      if (c.pas === 0 || (deux && c.pas === 8)) c.piano(a.notes, deux ? 7 : 9, 0.06);
      if (c.int >= 1 && !deux && c.pas === (c.mesure % 2 ? 10 : 6)) c.piano(a.notes, 2, 0.04);
      if (c.int >= 2 && c.pas === 14 && c.mesure % 2 === 1) c.piano(c.suivant.notes, 2, 0.045);
      if (c.int >= 2 && (c.pas === 0 || (deux && c.pas === 8))) c.nappe(a.notes.slice(1), deux ? 8 : 16, 0.03);
      // Basse ronde : fondamentale, rebond, approche chromatique vers l'accord suivant.
      if (c.pas === 0 || (deux && c.pas === 8)) c.ev('basse', a.fond, c.int >= 1 ? 5 : 8, 0.34);
      if (c.int >= 1 && c.pas === 10 && !deux) c.ev('basse', a.fond, 3, 0.26);
      if (c.int >= 1 && c.pas === 6 && !deux) c.ev('basse', a.fond + 7, 2, 0.2);
      if (c.int >= 2 && c.pas === 14) c.ev('basse', c.suivant.fond + (c.mesure % 2 ? 1 : -1), 2, 0.22);
      // Batterie feutrée.
      if (c.pas === 0) c.ev('grosse', 0, 1, c.int >= 1 ? 0.4 : 0.26);
      if (c.int >= 1 && c.pas === 10) c.ev('grosse', 0, 1, 0.34);
      if (c.int >= 2 && c.pas === 7) c.ev('grosse', 0, 1, 0.18);
      if (c.int >= 1 && (c.pas === 4 || c.pas === 12)) c.ev('claire', 0, 1, 0.16);
      if (c.int >= 1 && c.pas % 2 === 0) c.ev('charley', 0, 1, c.pas % 4 === 2 ? 0.06 : 0.035);
      if (c.int >= 3 && c.pas % 2 === 1) c.ev('charley', 0, 1, 0.025);
      if (c.int >= 3 && c.pas === 14) c.ev('ouvert', 0, 2, 0.05);
      if (c.int >= 1) c.chant();
      if (c.int >= 2 && c.cycle % 2 === 1 && c.pas === 8) c.ev('contre', a.notes[3] + 12, 6, 0.045);
      if (c.int >= 3) c.arp([0, 2, 1, 3, 2, 1, 3, 2], 12, 0.035, 2);
    },
  },

  // L'arrière-boutique : bossa lo-fi, fa majeur, on prend son temps.
  boutique: {
    nom: "Bossa de l'arrière-salle",
    style: 'lofi', bpm: 92, pas: 16, pasParTemps: 4, swing: 0.12,
    timbres: { basse: 'ronde', accord: 'piano', chant: 'flute', contre: 'cloche', arpege: 'pincee', nappe: 'nappe' },
    accords: [
      [A(41, [57, 60, 64, 67])], [A(40, [52, 55, 58, 62]), A(45, [55, 57, 61, 64])], [A(38, [53, 57, 60, 64])], [A(48, [51, 55, 58, 60]), A(41, [51, 57, 60, 65])],
      [A(46, [53, 57, 58, 62])], [A(46, [55, 58, 61, 65])], [A(45, [55, 60, 64, 67]), A(38, [54, 57, 60, 62])], [A(43, [53, 58, 62, 65]), A(48, [52, 58, 62, 64])],
    ],
    chant: [
      [[0, 72, 3], [3, 69, 1], [4, 72, 2], [6, 76, 6], [12, 74, 4]],
      [[0, 74, 3], [3, 70, 1], [4, 74, 4], [8, 73, 4], [12, 69, 4]],
      [[0, 72, 3], [3, 69, 1], [4, 72, 2], [6, 77, 6], [12, 76, 4]],
      [[0, 75, 4], [4, 74, 2], [6, 72, 2], [8, 70, 4], [12, 69, 4]],
      [[0, 69, 2], [2, 70, 2], [4, 74, 4], [8, 77, 6], [14, 76, 2]],
      [[0, 77, 4], [4, 73, 4], [8, 70, 8]],
      [[0, 72, 3], [3, 76, 1], [4, 79, 4], [8, 78, 4], [12, 74, 4]],
      [[0, 74, 3], [3, 70, 1], [4, 67, 4], [8, 64, 4], [12, 67, 4]],
    ],
    jouer(c) {
      const a = c.accord;
      const deux = c.accords.length === 2;
      // Basse de bossa : fondamentale, quinte, quinte, fondamentale.
      const b = { 0: [a.fond, 5, 0.32], 6: [a.fond + 7, 2, 0.22], 8: [a.fond, 5, 0.3], 14: [a.fond + 7, 2, 0.2] }[c.pas];
      if (b) c.ev('basse', b[0], b[1], b[2]);
      // Piano en clave : les accents de la bossa.
      const clave = c.mesure % 2 ? [2, 6, 10, 14] : [0, 3, 6, 10, 12];
      if (clave.includes(c.pas)) c.piano(a.notes, 2, c.pas === 0 ? 0.055 : 0.04);
      if (c.int >= 1 && (c.pas === 0 || (deux && c.pas === 8))) c.nappe(a.notes.slice(1), deux ? 8 : 16, 0.025);
      if ([0, 3, 6, 10, 12].includes(c.pas)) c.ev('rim', 0, 1, 0.06);
      if (c.pas === 0 || c.pas === 8) c.ev('grosse', 0, 1, 0.26);
      if (c.pas % 2 === 0) c.ev('charley', 0, 1, c.pas % 4 === 2 ? 0.04 : 0.022);
      if (c.int >= 1) c.chant();
      if (c.int >= 1 && c.cycle % 2 === 1 && c.pas === 8) c.ev('contre', a.notes[2] + 12, 6, 0.04);
      if (c.int >= 3) c.arp([0, 1, 2, 3], 12, 0.03, 2);
    },
  },

  // Le patron : darkwave, ré mineur, basse en galop d'octaves.
  patron: {
    nom: 'Haute mise',
    style: 'synth', bpm: 116, pas: 16, pasParTemps: 4, swing: 0,
    timbres: { basse: 'synth', accord: 'piano', chant: 'lead', contre: 'cloche', arpege: 'pincee', nappe: 'nappe' },
    accords: [
      [A(38, [50, 53, 57, 62])], [A(38, [50, 53, 57, 62])], [A(46, [50, 53, 58, 62])], [A(48, [52, 55, 60, 64])],
      [A(38, [50, 53, 57, 62])], [A(38, [50, 53, 57, 62])], [A(39, [51, 55, 58, 63])], [A(45, [52, 55, 57, 61])],
    ],
    chant: [
      [[0, 62, 6], [6, 65, 2], [8, 69, 8]],
      [[0, 70, 4], [4, 69, 4], [8, 65, 4], [12, 64, 4]],
      [[0, 65, 6], [6, 70, 2], [8, 74, 8]],
      [[0, 72, 4], [4, 70, 4], [8, 67, 4], [12, 64, 4]],
      [[0, 62, 6], [6, 65, 2], [8, 69, 6], [14, 70, 2]],
      [[0, 74, 8], [8, 73, 4], [12, 69, 4]],
      [[0, 70, 6], [6, 67, 2], [8, 63, 8]],
      [[0, 61, 4], [4, 64, 4], [8, 67, 4], [12, 73, 4]],
    ],
    jouer(c) {
      const a = c.accord;
      if (c.pas === 0) c.nappe(a.notes, 16, 0.045);
      if (c.int <= 0) {
        if (c.pas % 4 === 0) c.ev('basse', a.fond, 3, 0.26);
      } else {
        if (c.pas % 2 === 0) c.ev('basse', a.fond, 1.4, 0.26);
        if (c.int >= 2 && c.pas % 2 === 1) c.ev('basse', a.fond + 12, 0.9, 0.15);
      }
      if (c.int <= 0 ? c.pas % 8 === 0 : c.pas % 4 === 0) c.ev('grosse', 0, 1, 0.42);
      if (c.int >= 1 && (c.pas === 4 || c.pas === 12)) c.ev('claire', 0, 1, 0.15);
      if (c.int >= 1 && c.mesure % 4 === 3 && c.pas >= 13) c.ev('claire', 0, 1, 0.08);
      if (c.int >= 1 && c.pas % 4 === 2) c.ev('ouvert', 0, 1, 0.04);
      if (c.int >= 3 && c.pas % 2 === 1) c.ev('charley', 0, 1, 0.03);
      if (c.int >= 1 && c.cycle % 2 === 1 && c.pas === 0) c.ev('contre', a.notes[0] + 24, 4, 0.04);
      if (c.int >= 2) {
        c.arp([0, 1, 2, 1, 3, 2, 1, 2], 12, 0.03);
        c.chant(c.int >= 3 ? 12 : 0);
      }
    },
  },

  // Le salut : synthwave lumineuse, do majeur, la troupe revient saluer.
  salut: {
    nom: 'Rappel sous les néons',
    style: 'synth', bpm: 118, pas: 16, pasParTemps: 4, swing: 0,
    timbres: { basse: 'synth', accord: 'piano', chant: 'lead', contre: 'cloche', arpege: 'pincee', nappe: 'nappe' },
    accords: [
      [A(48, [55, 60, 64, 67])], [A(47, [55, 59, 62, 67])], [A(45, [57, 60, 64, 69])], [A(41, [57, 60, 65, 69])],
      [A(48, [55, 60, 64, 67])], [A(43, [55, 59, 62, 67])], [A(41, [57, 60, 65, 69])], [A(43, [53, 59, 62, 67])],
    ],
    chant: [
      [[0, 72, 4], [4, 76, 4], [8, 79, 6], [14, 76, 2]],
      [[0, 74, 4], [4, 79, 4], [8, 83, 8]],
      [[0, 81, 6], [6, 79, 2], [8, 76, 8]],
      [[0, 77, 4], [4, 76, 4], [8, 72, 4], [12, 69, 4]],
      [[0, 72, 4], [4, 76, 4], [8, 79, 6], [14, 81, 2]],
      [[0, 83, 4], [4, 81, 4], [8, 79, 8]],
      [[0, 77, 4], [4, 81, 4], [8, 84, 8]],
      [[0, 83, 8], [8, 79, 4], [12, 74, 4]],
    ],
    jouer(c) {
      const a = c.accord;
      if (c.pas === 0) c.nappe(a.notes, 16, 0.04);
      if (c.pas % 2 === 0) c.ev('basse', a.fond + (c.pas % 4 === 2 ? 12 : 0), 1.6, 0.24);
      if (c.pas % 4 === 0) c.ev('grosse', 0, 1, 0.36);
      if (c.pas === 4 || c.pas === 12) c.ev('claire', 0, 1, 0.13);
      if (c.pas % 4 === 2) c.ev('ouvert', 0, 1, 0.035);
      if (c.int >= 1) c.chant();
      if (c.int >= 1) c.arp([0, 1, 2, 3, 2, 1, 2, 3], 12, 0.03);
      if (c.int >= 1 && c.cycle % 2 === 1 && c.pas === 8) c.ev('contre', a.notes[3] + 12, 6, 0.04);
    },
  },
};

// ------------------------------------------------------------- v3 : la forme longue
// Chaque morceau dure maintenant environ quatre minutes avant de boucler, comme une vraie piste :
// intro, couplets, refrain (section B, nouvelle harmonie), solo, pont (section C ou A recolorée),
// breakdown, refrains, reprise un ton plus haut, final, outro. Les sections B et C sont écrites à la main.

const SECTIONS = {
  manche: {
    // Refrain : on monte vers le relatif majeur (fa), la mélodie s'envole.
    B: {
      accords: [
        [A(41, [53, 57, 60, 64])], [A(40, [52, 55, 60, 64])], [A(38, [53, 57, 60, 62])], [A(46, [53, 57, 58, 62])],
        [A(43, [53, 58, 62, 65])], [A(48, [52, 55, 58, 64])], [A(41, [53, 57, 60, 64])], [A(45, [55, 57, 61, 64]), A(45, [55, 58, 61, 65])],
      ],
      chant: [
        [[0, 81, 4], [4, 79, 2], [6, 77, 2], [8, 76, 6], [14, 77, 2]],
        [[0, 79, 6], [6, 76, 2], [8, 72, 8]],
        [[0, 77, 3], [3, 76, 1], [4, 74, 4], [8, 72, 2], [10, 74, 2], [12, 77, 4]],
        [[0, 81, 8], [8, 79, 4], [12, 77, 4]],
        [[0, 74, 3], [3, 77, 1], [4, 79, 4], [8, 82, 4], [12, 81, 4]],
        [[0, 79, 4], [4, 76, 4], [8, 72, 2], [10, 76, 2], [12, 79, 4]],
        [[0, 77, 6], [6, 76, 2], [8, 72, 4], [12, 69, 4]],
        [[0, 73, 4], [4, 76, 4], [8, 79, 4], [12, 81, 4]],
      ],
    },
    // Pont : couleur sombre (mi bémol majeur septième, le « deuxième degré abaissé »), chant plus lent.
    C: {
      accords: [
        [A(39, [55, 58, 62, 63])], [A(38, [53, 57, 60, 64])], [A(48, [51, 55, 58, 62])], [A(41, [51, 57, 60, 63])],
        [A(46, [53, 57, 58, 62])], [A(45, [52, 55, 60, 64])], [A(43, [53, 57, 58, 62])], [A(45, [55, 57, 61, 64]), A(45, [55, 58, 61, 65])],
      ],
      chant: [
        [[0, 74, 6], [6, 75, 2], [8, 79, 8]],
        [[0, 77, 8], [8, 76, 4], [12, 74, 4]],
        [[0, 75, 6], [6, 74, 2], [8, 72, 8]],
        [[0, 69, 4], [4, 72, 4], [8, 75, 4], [12, 74, 4]],
        [[0, 74, 6], [6, 77, 2], [8, 81, 8]],
        [[0, 79, 8], [8, 76, 4], [12, 72, 4]],
        [[0, 74, 4], [4, 72, 4], [8, 70, 4], [12, 69, 4]],
        [[0, 73, 8], [8, 76, 8]],
      ],
    },
  },
  titre: {
    B: {
      accords: [
        [A(41, [53, 57, 60, 64])], [A(43, [55, 59, 62, 65])], [A(40, [55, 59, 62, 64])], [A(45, [57, 60, 64, 67])],
        [A(38, [53, 57, 60, 62])], [A(43, [55, 59, 62, 67])], [A(48, [55, 60, 64, 67])], [A(40, [52, 56, 59, 62])],
      ],
      chant: [
        [[0, 77, 4], [4, 76, 4], [8, 72, 8]],
        [[0, 74, 4], [4, 79, 4], [8, 83, 6], [14, 81, 2]],
        [[0, 79, 8], [8, 76, 4], [12, 74, 4]],
        [[0, 76, 12], [12, 72, 4]],
        [[0, 74, 4], [4, 77, 4], [8, 81, 8]],
        [[0, 79, 4], [4, 77, 4], [8, 74, 4], [12, 71, 4]],
        [[0, 72, 6], [6, 76, 2], [8, 79, 8]],
        [[0, 80, 8], [8, 76, 4], [12, 71, 4]],
      ],
    },
  },
  boutique: {
    B: {
      accords: [
        [A(46, [53, 57, 58, 62])], [A(46, [53, 55, 58, 61])], [A(45, [52, 55, 60, 64])], [A(38, [54, 57, 60, 62])],
        [A(43, [53, 58, 62, 65])], [A(48, [52, 55, 58, 64])], [A(41, [53, 57, 60, 64])], [A(48, [53, 55, 58, 62])],
      ],
      chant: [
        [[0, 74, 3], [3, 77, 1], [4, 81, 6], [12, 79, 4]],
        [[0, 77, 6], [6, 73, 2], [8, 70, 8]],
        [[0, 72, 3], [3, 76, 1], [4, 79, 4], [8, 77, 4], [12, 76, 4]],
        [[0, 78, 6], [6, 74, 2], [8, 72, 4], [12, 69, 4]],
        [[0, 70, 3], [3, 74, 1], [4, 77, 6], [12, 74, 4]],
        [[0, 76, 4], [4, 79, 4], [8, 82, 4], [12, 79, 4]],
        [[0, 81, 8], [8, 77, 4], [12, 72, 4]],
        [[0, 74, 4], [4, 72, 4], [8, 70, 4], [12, 67, 4]],
      ],
    },
  },
  patron: {
    B: {
      accords: [
        [A(46, [50, 53, 58, 62])], [A(48, [52, 55, 60, 64])], [A(38, [50, 53, 57, 62])], [A(38, [50, 55, 57, 62])],
        [A(43, [50, 55, 58, 62])], [A(45, [49, 52, 57, 61])], [A(46, [50, 53, 58, 62])], [A(45, [49, 52, 55, 57])],
      ],
      chant: [
        [[0, 74, 4], [4, 77, 4], [8, 74, 4], [12, 70, 4]],
        [[0, 72, 4], [4, 76, 4], [8, 79, 8]],
        [[0, 77, 6], [6, 76, 2], [8, 74, 8]],
        [[0, 69, 4], [4, 72, 4], [8, 74, 4], [12, 76, 4]],
        [[0, 79, 6], [6, 77, 2], [8, 74, 8]],
        [[0, 76, 6], [6, 73, 2], [8, 69, 8]],
        [[0, 70, 4], [4, 74, 4], [8, 77, 4], [12, 82, 4]],
        [[0, 81, 8], [8, 76, 4], [12, 73, 4]],
      ],
    },
  },
  salut: {
    B: {
      accords: [
        [A(45, [57, 60, 64, 67])], [A(41, [57, 60, 65, 69])], [A(48, [55, 60, 64, 67])], [A(43, [55, 59, 62, 67])],
        [A(45, [57, 60, 64, 69])], [A(41, [57, 60, 65, 69])], [A(43, [55, 59, 62, 65])], [A(43, [53, 59, 62, 65])],
      ],
      chant: [
        [[0, 76, 4], [4, 79, 4], [8, 84, 6], [14, 83, 2]],
        [[0, 81, 8], [8, 77, 4], [12, 76, 4]],
        [[0, 76, 4], [4, 79, 4], [8, 84, 8]],
        [[0, 83, 6], [6, 81, 2], [8, 79, 8]],
        [[0, 81, 4], [4, 84, 4], [8, 88, 6], [14, 86, 2]],
        [[0, 84, 8], [8, 81, 4], [12, 77, 4]],
        [[0, 79, 4], [4, 81, 4], [8, 83, 4], [12, 86, 4]],
        [[0, 84, 12], [12, 79, 4]],
      ],
    },
  },
};

// La forme d'un morceau. Chaque entrée : section source (A, B ou C), nombre de mesures, réglages.
//   max : l'intensité ne dépasse pas cette valeur (sauf à la dernière main, où elle reste à 2 au moins)
//   min : intensité plancher ; contre : contre-chant ; pont : batterie retirée, chant à la cloche
//   solo : le chant passe une octave plus haut, à la cloche et au lead ; brk : breakdown (piano, basse, souffle)
//   transpo : demi-tons de plus (la reprise monte d'un ton) ; debut : première mesure lue dans la section
function construireForme(nom, bpm) {
  const aC = !!(SECTIONS[nom] && SECTIONS[nom].C);
  const F = [
    { n: 'intro', src: 'A', mes: 4, max: 0, sansChant: true },
    { n: 'couplet', src: 'A', mes: 8 },
    { n: 'couplet', src: 'A', mes: 8, contre: true },
    { n: 'refrain', src: 'B', mes: 8, min: 1, contre: true },
    { n: 'solo', src: 'A', mes: 8, min: 1, solo: true },
    { n: 'pont', src: aC ? 'C' : 'A', mes: 8, pont: true },
    { n: 'breakdown', src: 'A', mes: 4, max: 0, brk: true },
    { n: 'refrain', src: 'B', mes: 8, min: 2, contre: true },
    { n: 'reprise', src: 'A', mes: 8, min: 1, contre: true, transpo: 2 },
    { n: 'final', src: 'B', mes: 8, min: 2, contre: true, transpo: 2 },
    { n: 'final', src: 'B', mes: 8, min: 2, contre: true, transpo: 2, solo: true },
    { n: 'outro', src: 'A', mes: 4, debut: 4, max: 1 },
  ];
  // Environ quatre minutes : autant de mesures que de battements par minute (4 temps par mesure).
  let total = F.reduce((t, e) => t + e.mes, 0);
  while (total + 16 <= bpm + 4) {
    F.splice(F.length - 1, 0, { n: 'couplet', src: 'A', mes: 8, contre: true, transpo: 2 }, { n: 'refrain', src: 'B', mes: 8, min: 2, contre: true, transpo: 2 });
    total += 16;
  }
  let pos = 0;
  for (const e of F) {
    e.debut = e.debut || 0;
    e.pos = pos;
    pos += e.mes;
  }
  return { sections: F, mesures: pos };
}

// ------------------------------------------------------------- v7 : un thème par acte
// Même salle, même harmonie de minuit, mais chaque acte de la partie a sa voix : paliers 1-2 « Velours de minuit »,
// 3-4 « Fumée bleue » (cloche, un peu plus haut), 5-6 « Néons cerise » (lead synthétique, syncopes),
// 7-8 « Dernière tournée » (cuivres, plus vite). Le refrain revient d'un acte à l'autre, comme un leitmotiv.
const varianteManche = (o) => Object.assign({}, SCENES.manche, o, { timbres: Object.assign({}, SCENES.manche.timbres, o.timbres || {}) });
SCENES.manche_ii = varianteManche({
  nom: 'Fumée bleue', bpm: 88, transpo: 3, swing: 0.18, timbres: { chant: 'cloche', contre: 'flute' },
  chant: [
    [[0, 81, 6], [6, 79, 2], [8, 77, 8]],
    [[0, 74, 4], [4, 77, 4], [8, 82, 8]],
    [[0, 79, 6], [6, 77, 2], [8, 74, 4], [12, 70, 4]],
    [[0, 73, 8], [8, 76, 4], [12, 79, 4]],
    [[0, 81, 4], [4, 77, 2], [6, 79, 2], [8, 81, 8]],
    [[0, 82, 6], [6, 81, 2], [8, 77, 4], [12, 74, 4]],
    [[0, 79, 4], [4, 77, 4], [8, 76, 4], [12, 72, 4]],
    [[0, 77, 8], [8, 73, 4], [12, 76, 4]],
  ],
});
SCENES.manche_iii = varianteManche({
  nom: 'Néons cerise', style: 'synth', bpm: 94, transpo: 5, swing: 0.08, timbres: { basse: 'synth', chant: 'lead' },
  chant: [
    [[0, 74, 2], [3, 77, 2], [6, 81, 2], [8, 79, 3], [11, 77, 1], [12, 76, 4]],
    [[0, 77, 2], [3, 74, 2], [6, 70, 2], [8, 72, 8]],
    [[0, 74, 2], [3, 79, 2], [6, 82, 2], [8, 81, 3], [11, 79, 1], [12, 77, 4]],
    [[0, 76, 2], [3, 73, 2], [6, 69, 2], [8, 73, 4], [12, 76, 4]],
    [[0, 74, 2], [3, 77, 2], [6, 81, 2], [8, 79, 3], [11, 77, 1], [12, 81, 4]],
    [[0, 82, 2], [3, 81, 2], [6, 77, 2], [8, 79, 4], [12, 77, 4]],
    [[0, 79, 2], [3, 77, 2], [6, 74, 2], [8, 72, 4], [12, 70, 4]],
    [[0, 69, 3], [3, 72, 3], [6, 76, 2], [8, 73, 8]],
  ],
});
SCENES.manche_iv = varianteManche({
  nom: 'Dernière tournée', bpm: 100, transpo: -2, swing: 0.14, timbres: { chant: 'cuivre', contre: 'cloche' },
  chant: [
    [[0, 74, 1], [2, 74, 1], [4, 77, 2], [6, 81, 4], [12, 79, 4]],
    [[0, 77, 4], [4, 74, 2], [6, 70, 2], [8, 74, 8]],
    [[0, 79, 1], [2, 79, 1], [4, 82, 2], [6, 86, 4], [12, 84, 4]],
    [[0, 81, 4], [4, 79, 2], [6, 76, 2], [8, 73, 8]],
    [[0, 74, 1], [2, 74, 1], [4, 77, 2], [6, 81, 4], [12, 79, 4]],
    [[0, 82, 4], [4, 81, 2], [6, 77, 2], [8, 74, 4], [12, 77, 4]],
    [[0, 79, 2], [2, 77, 2], [4, 76, 2], [6, 74, 2], [8, 72, 8]],
    [[0, 73, 4], [4, 76, 4], [8, 79, 4], [12, 81, 4]],
  ],
});
for (const v of ['manche_ii', 'manche_iii', 'manche_iv']) SECTIONS[v] = SECTIONS.manche;
// Le morceau de manche selon le palier.
export function sceneManche(palier = 1) {
  return palier >= 7 ? 'manche_iv' : palier >= 5 ? 'manche_iii' : palier >= 3 ? 'manche_ii' : 'manche';
}

const FORMES = {};
for (const nom of Object.keys(SCENES)) FORMES[nom] = construireForme(nom, SCENES[nom].bpm);

export const NOMS_SCENES = Object.keys(SCENES);

export function infoScene(nom) {
  const s = SCENES[nom];
  return s ? { nom: s.nom, bpm: s.bpm, pas: s.pas, pasParTemps: s.pasParTemps, mesures: FORMES[nom].mesures, boucle: s.accords.length, timbres: s.timbres, style: s.style, swing: s.swing, duree: (FORMES[nom].mesures * s.pas * 60) / (s.bpm * s.pasParTemps) } : null;
}

// La section en cours à cette mesure (pour l'interface et les outils).
export function sectionA(nom, mesure) {
  const f = FORMES[nom];
  if (!f) return null;
  const k = ((mesure % f.mesures) + f.mesures) % f.mesures;
  for (const e of f.sections) if (k < e.pos + e.mes) return { nom: e.n, src: e.src, index: k - e.pos, mes: e.mes, pos: e.pos, transpo: e.transpo || 0 };
  return null;
}

// Première mesure de la section qui suit l'intro : pour reprendre un morceau sans rejouer l'intro.
export function mesureReprise(nom, mesure) {
  const f = FORMES[nom];
  if (!f) return 0;
  const k = ((mesure % f.mesures) + f.mesures) % f.mesures;
  // On repart au début de la section en cours (jamais dans l'intro ni le breakdown).
  for (const e of f.sections) if (k < e.pos + e.mes) {
    if (e.n === 'intro') return f.sections[1].pos;
    return e.pos;
  }
  return 0;
}

// Durée d'un pas en secondes. Le dernier patron presse le tempo.
export function dureePas(nom, opts = {}) {
  const s = SCENES[nom];
  return 60 / (s.bpm * (opts.final ? 1.06 : 1)) / s.pasParTemps;
}

const BATTERIE = ['grosse', 'claire', 'charley', 'ouvert', 'rim'];

// Les notes qui commencent sur ce pas.
// mesure : compteur depuis le début du morceau (boucle toute seule sur la forme longue). int : intensité de 0 à 3.
// opts.final : dernier palier (un ton plus haut). opts.fievre : crescendo en cours, arpège rapide en plus.
// Renvoie [{ voix, midi, duree (en pas), vol }]. Pour les percussions, midi vaut 0.
export function evenements(nom, mesure, pas, int = 1, opts = {}) {
  const s = SCENES[nom];
  if (!s) return [];
  const forme = FORMES[nom];
  const k = ((mesure % forme.mesures) + forme.mesures) % forme.mesures;
  let sec = forme.sections[0];
  for (const e of forme.sections) if (k < e.pos + e.mes) {
    sec = e;
    break;
  }
  const idx = k - sec.pos;
  const src = sec.src === 'A' ? s : SECTIONS[nom][sec.src];
  const n = src.accords.length;
  const m = (sec.debut + idx) % n;
  const derniereMesure = idx === sec.mes - 1;
  // Intensité de la section : plafond et plancher, mais la dernière main garde sa tension.
  let iEff = int;
  if (sec.max !== undefined) iEff = int >= 3 ? Math.min(int, Math.max(sec.max, 2)) : Math.min(int, sec.max);
  if (sec.min !== undefined && int >= 1) iEff = Math.max(iEff, sec.min);
  const accords = src.accords[m];
  const accord = accords[accords.length === 2 && pas >= s.pas / 2 ? 1 : 0];
  let suivant;
  if (accords.length === 2 && pas < s.pas / 2) suivant = accords[1];
  else if (!derniereMesure) suivant = src.accords[(m + 1) % n][0];
  else {
    const prochaine = forme.sections[(forme.sections.indexOf(sec) + 1) % forme.sections.length];
    const ps = prochaine.src === 'A' ? s : SECTIONS[nom][prochaine.src];
    suivant = ps.accords[prochaine.debut % ps.accords.length][0];
  }
  const transpo = (opts.final ? 2 : 0) + (sec.transpo || 0) + (s.transpo || 0);
  const sortie = [];
  const c = {
    mesure: m, cycle: sec.contre ? 1 : 0, pas, int: iEff, accord, accords, suivant, section: sec.n,
    ev(voix, midi, duree, vol) {
      // La basse reste audible sur de petits haut-parleurs : jamais sous le ré grave.
      if (voix === 'basse') while (midi < 38) midi += 12;
      let h = midi ? midi + transpo : 0;
      while (h > 96) h -= 12;
      sortie.push({ voix, midi: h, duree: Math.min(duree, s.pas), vol });
    },
    piano(notes, duree, vol) {
      for (const h of notes) c.ev('accord', h, duree, vol);
    },
    nappe(notes, duree, vol) {
      for (const h of notes) c.ev('nappe', h, duree, vol);
    },
    // Arpège sur les notes de l'accord. pasArp : 1 = doubles croches, 2 = croches.
    arp(motif, octave, vol, pasArp = 1) {
      if (c.pas % pasArp) return;
      const i = motif[(c.pas / pasArp) % motif.length] % accord.notes.length;
      c.ev('arpege', accord.notes[i] + octave, pasArp * 0.9, vol);
    },
    chant(octave = 0) {
      if (sec.sansChant) return;
      for (const [p, h, d] of src.chant[m]) if (p === pas) c.ev('chant', h + octave, d * 0.92, 0.12);
    },
  };
  s.jouer(c);
  // Pont : la batterie se retire, le chant passe à la cloche une octave plus haut.
  if (sec.pont) {
    for (let i = sortie.length - 1; i >= 0; i--) {
      const e = sortie[i];
      if (e.voix === 'claire' || (e.voix === 'grosse' && pas !== 0)) sortie.splice(i, 1);
      else if (e.voix === 'chant') {
        e.voix = 'contre';
        e.midi = Math.min(96, e.midi + 12);
        e.vol = 0.06;
      }
    }
    // Pour que le pont reste vivant même au calme : la cloche chante dès l'intensité 0.
    if (iEff < 1) for (const [p, h, d] of src.chant[m]) if (p === pas) c.ev('contre', Math.min(96, h + 12), d * 0.92, 0.055);
  }
  // Solo : le chant est doublé par la cloche une octave au-dessus, avec des notes de passage.
  if (sec.solo && iEff >= 1) {
    for (const e of sortie.slice()) if (e.voix === 'chant') {
      c.ev('contre', Math.min(96, e.midi - transpo + 12), Math.min(e.duree, 2), 0.045);
      if (e.duree >= 4) c.ev('arpege', e.midi - transpo + 7, 1, 0.03);
    }
  }
  // Breakdown : il ne reste que le piano, la basse et la nappe, puis un roulement relance tout.
  if (sec.brk) {
    for (let i = sortie.length - 1; i >= 0; i--) if (BATTERIE.includes(sortie[i].voix) || sortie[i].voix === 'chant' || sortie[i].voix === 'arpege') sortie.splice(i, 1);
    if (pas === 0 && !sortie.some((e) => e.voix === 'nappe')) c.nappe(accord.notes.slice(1), 16, 0.03);
    if (derniereMesure && pas >= 8) c.ev('claire', 0, 1, 0.04 + (pas - 8) * 0.018);
  }
  // Roulement de caisse claire à la fin de chaque section, pour relancer.
  if (iEff >= 2 && derniereMesure && pas >= 12 && !sec.pont && !sec.brk) c.ev('claire', 0, 1, 0.05 + (pas - 12) * 0.025);
  // La troupe joue avec l'orchestre (v4) : chaque famille de jokers ajoute son instrument.
  if (opts.couches && nom !== 'titre' && nom !== 'salut') ajouterCouches(c, opts.couches, sec, accord, pas, m, iEff);
  // v5 : la musique monte avec le multiplicateur de la main en cours (niveau 0 à 4).
  if (opts.multi && nom !== 'titre' && nom !== 'salut') coucheMulti(c, opts.multi, accord, pas);
  // v7 : et avec le score de la manche.
  if (opts.score && nom !== 'titre' && nom !== 'salut' && nom !== 'boutique' && !sec.brk) coucheScore(c, opts.score, accord, pas);
  // v5 : chaque patron a son thème, un motif de quatre notes qui revient toutes les deux mesures.
  if (opts.theme && nom === 'patron' && !sec.brk) motifPatron(c, opts.theme, accord, pas, k, sortie);
  // Fièvre du crescendo : un arpège serré qui scintille au-dessus de tout.
  if (opts.fievre && int >= 1 && !sec.brk && !sortie.some((e) => e.voix === 'arpege')) {
    const i = [0, 1, 2, 3, 2, 3, 1, 2][pas % 8] % accord.notes.length;
    c.ev('arpege', accord.notes[i] + 24, 0.8, 0.03);
  }
  return sortie;
}

// ------------------------------------------------------------ La troupe à l'orchestre (v4)
// Les familles de jokers de ta rangée ajoutent des instruments à la musique de la table.
// Une famille présente : l'instrument entre discrètement ; deux ou trois : il prend sa place.
export const COUCHES = {
  cloches: { nom: 'Cloches', familles: ['economie'], desc: 'Les louis tintent à contretemps.' },
  cuivres: { nom: 'Cuivres', familles: ['base', 'rangs', 'duos'], desc: 'Des accords de cuivres sur les temps forts.' },
  marimba: { nom: 'Marimba', familles: ['enseignes', 'matieres'], desc: 'Un marimba qui court sur les accords.' },
  cordes: { nom: 'Cordes', familles: ['croissance', 'copie', 'rejoue', 'regles', 'pousses', 'echos'], desc: 'Une nappe de cordes qui enfle.' },
  orgue: { nom: 'Orgue', familles: ['risque', 'hasard', 'patron', 'maudits'], desc: 'Un orgue de foire, un peu inquiétant.' },
  claps: { nom: 'Claps', familles: ['public', 'crescendo'], desc: 'La salle frappe dans ses mains.' },
};
export const COUCHE_DE = {};
for (const [id, k] of Object.entries(COUCHES)) for (const f of k.familles) COUCHE_DE[f] = id;

// familles : { famille: nombre de jokers }, combos : nombre de combos formés. Renvoie { couche: niveau de 0,5 à 1 }.
// ---------------------------------------------------- Le multiplicateur à l'orchestre (v5)
// Niveau d'après le multi courant : 0 (rien) à 4 (tout l'orchestre).
export function niveauMulti(multi) {
  const m = Number(multi) || 0;
  return m >= 100 ? 4 : m >= 40 ? 3 : m >= 15 ? 2 : m >= 5 ? 1 : 0;
}
// Une couche de plus par niveau : shaker, cordes tenues, cloches en croches, cuivres et claps.
export function coucheMulti(c, n, accord, pas) {
  const N = accord.notes;
  if (n >= 1 && pas % 4 === 2) c.ev('charley', 0, 1, 0.02 + 0.008 * n);
  if (n >= 2 && pas === 0) for (const h of [N[0], N[Math.min(2, N.length - 1)]]) c.ev('cordes', h, 16, 0.03 + 0.006 * n);
  if (n >= 3 && pas % 2 === 0) c.ev('cloches', N[(pas / 2) % N.length] + 24, 1.6, 0.022);
  if (n >= 4) {
    if (pas === 0 || pas === 8) for (const h of N.slice(0, 3)) c.ev('cuivres', h + 12, 2, 0.035);
    if (pas === 4 || pas === 12) c.ev('clap', 0, 1, 0.05);
  }
}

// ------------------------------------------------------- Le score de la manche à l'orchestre (v7)
// Niveau 0 à 4 d'après la part du score demandé déjà marquée : chaque quart ajoute une voix.
export function niveauScore(avance) {
  const a = Number(avance) || 0;
  return a >= 0.9 ? 4 : a >= 0.65 ? 3 : a >= 0.4 ? 2 : a >= 0.2 ? 1 : 0;
}
// 1 : tambourin sur les contretemps ; 2 : basse doublée à l'octave ; 3 : marimba en croches sur l'accord ;
// 4 : orgue tenu et cymbale ouverte : la salle sent que la manche va tomber.
export function coucheScore(c, n, accord, pas) {
  const N = accord.notes;
  if (n >= 1 && pas % 8 === 6) c.ev('tambourin', 0, 1, 0.03 + 0.006 * n);
  if (n >= 2 && (pas === 0 || pas === 8)) c.ev('basse', accord.fond + 12, 2, 0.12);
  if (n >= 3 && pas % 2 === 1) c.ev('marimba', N[((pas - 1) / 2) % N.length] + 12, 1, 0.028);
  if (n >= 4) {
    if (pas === 0) for (const h of N.slice(1, 4)) c.ev('orgue', h, 16, 0.022);
    if (pas === 14) c.ev('ouvert', 0, 2, 0.045);
  }
}

// ------------------------------------------------------------- Thèmes des patrons (v5)
const DEGRES_PATRON = [0, 2, 3, 5, 7, 8, 10, 12];
const TIMBRES_PATRON = ['orgue', 'cuivre', 'marimba', 'flute', 'lead', 'cloche'];
const RYTHMES_PATRON = [[0, 4, 8, 12], [0, 3, 6, 8], [0, 2, 8, 10], [0, 6, 8, 14], [0, 4, 6, 12]];
function hacherNom(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}
// Thème d'un patron : toujours le même pour un même patron, différent d'un patron à l'autre.
export function themePatron(id) {
  if (!id) return null;
  const h = hacherNom('patron-' + id);
  const motif = [0, 1, 2, 3].map((i) => DEGRES_PATRON[(h >>> (i * 3)) % DEGRES_PATRON.length]);
  return { id, motif, rythme: RYTHMES_PATRON[(h >>> 12) % RYTHMES_PATRON.length], timbre: TIMBRES_PATRON[(h >>> 16) % TIMBRES_PATRON.length], octave: (h >>> 20) % 2 ? 12 : 24 };
}
function motifPatron(c, t, accord, pas, mesure, sortie) {
  if (mesure % 2) return;
  const i = t.rythme.indexOf(pas);
  if (i < 0) return;
  c.ev('motif', accord.notes[0] + t.octave + t.motif[i], i === 3 ? 4 : 2, 0.06);
  sortie[sortie.length - 1].timbre = t.timbre;
}

export function couchesTroupe(familles = {}, combos = 0) {
  const n = {};
  for (const [f, k] of Object.entries(familles)) {
    const c = COUCHE_DE[f];
    if (c && k > 0) n[c] = (n[c] || 0) + k;
  }
  const out = {};
  for (const [c, k] of Object.entries(n)) out[c] = Math.min(1, (k >= 3 ? 0.9 : k === 2 ? 0.75 : 0.55) + Math.min(2, combos) * 0.05);
  return out;
}

function ajouterCouches(c, couches, sec, accord, pas, m, iEff) {
  const notes = accord.notes;
  const nn = notes.length;
  const calme = iEff < 1;
  for (const [couche, niv] of Object.entries(couches)) {
    if (!niv) continue;
    // Au breakdown, seules les cordes restent ; au pont, pas de claps.
    if (sec.brk && couche !== 'cordes') continue;
    if (calme && couche !== 'cordes' && couche !== 'cloches') continue;
    if (couche === 'cloches' && (pas === 6 || pas === 14 || (pas === 15 && m % 2 === 1))) c.ev('cloches', notes[(m + pas) % nn] + 24, 1, 0.032 * niv);
    else if (couche === 'cuivres') {
      if (pas === 0) for (const h of notes.slice(1)) c.ev('cuivres', h + 12, 1.5, 0.022 * niv);
      else if (pas === 6 && iEff >= 2) for (const h of notes.slice(1)) c.ev('cuivres', h + 12, 1, 0.016 * niv);
    } else if (couche === 'marimba' && pas % 2 === 0) c.ev('marimba', notes[[0, 2, 1, 3, 2, 1, 3, 2][(pas / 2) % 8] % nn] + 12, 1, 0.05 * niv);
    else if (couche === 'cordes' && pas === 0) for (const h of notes) c.ev('cordes', h + 12, 16, 0.016 * niv);
    else if (couche === 'orgue' && (pas === 4 || pas === 12)) for (const h of notes.slice(0, 3)) c.ev('orgue', h, 3, 0.02 * niv);
    else if (couche === 'claps' && !sec.pont) {
      if (pas === 4 || pas === 12) c.ev('clap', 0, 1, 0.1 * niv);
      if (pas % 4 === 2) c.ev('tambourin', 0, 1, 0.035 * niv);
    }
  }
}

// Les stingers : de courtes phrases jouées par l'orchestre de la musique, pas par les effets.
// Renvoie [{ voix, midi, debut (en temps), duree (en temps), vol }].
export function stinger(sorte) {
  const N = (voix, midi, debut, duree, vol) => ({ voix, midi, debut, duree, vol });
  if (sorte === 'manche') return [
    N('accord', 62, 0, 0.5, 0.05), N('accord', 65, 0, 0.5, 0.05), N('accord', 69, 0, 0.5, 0.05),
    N('chant', 74, 0, 0.5, 0.11), N('chant', 77, 0.5, 0.5, 0.11), N('chant', 81, 1, 2, 0.12),
    N('accord', 58, 1, 2, 0.05), N('accord', 62, 1, 2, 0.05), N('accord', 65, 1, 2, 0.05), N('accord', 69, 1, 2, 0.05),
    N('basse', 46, 1, 2, 0.3), N('contre', 86, 1.5, 1.5, 0.05), N('grosse', 0, 1, 1, 0.4),
  ];
  if (sorte === 'patron') return [
    N('basse', 38, 0, 0.5, 0.3), N('basse', 41, 0.5, 0.5, 0.28), N('basse', 46, 1, 0.5, 0.3), N('basse', 45, 1.5, 2.5, 0.32),
    N('chant', 74, 0, 0.5, 0.11), N('chant', 77, 0.5, 0.5, 0.11), N('chant', 82, 1, 0.5, 0.12), N('chant', 81, 1.5, 2.5, 0.13),
    N('nappe', 57, 1.5, 2.5, 0.05), N('nappe', 61, 1.5, 2.5, 0.05), N('nappe', 64, 1.5, 2.5, 0.05), N('nappe', 69, 1.5, 2.5, 0.05),
    N('grosse', 0, 0, 1, 0.4), N('grosse', 0, 1, 1, 0.4), N('claire', 0, 1.5, 1, 0.18), N('contre', 88, 2, 2, 0.05),
  ];
  if (sorte === 'defaite') return [
    N('accord', 57, 0, 1, 0.05), N('accord', 60, 0, 1, 0.05), N('accord', 64, 0, 1, 0.05),
    N('chant', 69, 0, 1, 0.1), N('chant', 68, 1, 1, 0.1), N('chant', 65, 2, 1, 0.1), N('chant', 62, 3, 3, 0.1),
    N('accord', 55, 3, 3, 0.05), N('accord', 58, 3, 3, 0.05), N('accord', 62, 3, 3, 0.05), N('accord', 65, 3, 3, 0.05),
    N('basse', 43, 3, 3, 0.26), N('nappe', 62, 3, 3, 0.04),
  ];
  if (sorte === 'victoire') return [
    N('chant', 72, 0, 0.5, 0.11), N('chant', 76, 0.5, 0.5, 0.11), N('chant', 79, 1, 0.5, 0.11), N('chant', 84, 1.5, 2.5, 0.13),
    N('accord', 60, 1.5, 2.5, 0.05), N('accord', 64, 1.5, 2.5, 0.05), N('accord', 67, 1.5, 2.5, 0.05), N('accord', 71, 1.5, 2.5, 0.05),
    N('basse', 48, 1.5, 2.5, 0.3), N('contre', 88, 2, 2, 0.06), N('grosse', 0, 1.5, 1, 0.42), N('ouvert', 0, 1.5, 1, 0.06),
  ];
  return [];
}

// Quelle musique pour quel moment de la partie. Module pur : on lui passe un résumé.
// r : { ecran, phase, patron, final, score, cible, mains, mainsMax, fin, victoire, crescendo }
// En manche, renvoie aussi la tension (0 à 1, avance vers le score demandé) et la fièvre (crescendo).
export function choisirScene(r) {
  if (!r || r.ecran !== 'jeu') return { scene: 'titre', int: 1 };
  // Victoire : la troupe salue. Défaite : silence.
  if (r.victoire || r.phase === 'victoire') return { scene: 'salut', int: 1 };
  if (r.fin || r.phase === 'defaite') return { scene: null, int: 0 };
  if (r.phase === 'boutique' || r.phase === 'paquet') return { scene: 'boutique', int: 1 };
  if (r.phase !== 'manche') return { scene: sceneManche(r.palier), int: 0 };
  const avance = r.cible > 0 ? r.score / r.cible : 0;
  const derniere = r.mains <= 1;
  let int = 1;
  if (avance >= 0.4 || r.mains < r.mainsMax) int = 2;
  if (derniere && avance < 1) int = 3;
  const tension = Math.max(0, Math.min(1, avance * 0.7 + (derniere && avance < 1 ? 0.3 : 0)));
  return { scene: r.patron ? 'patron' : sceneManche(r.palier), int, score: niveauScore(avance),  final: !!r.final, tension: Math.round(tension * 100) / 100, fievre: (r.crescendo || 0) >= 2 };
}

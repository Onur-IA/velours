// Le son de Velours, v2. Tout est synthétisé en WebAudio : aucun fichier, aucun échantillon.
// Le contexte audio n'est créé qu'au premier geste (clic ou touche), jamais avant.
//
// Chaîne : voix -> mélange musique -> saturation douce -> filtre de tension -> retrait -> fondu -> bus musique
//          effets -> bus effets ; les deux -> maître -> compresseur -> sortie.
// Une réverbération de salle (générée) et un écho calé sur le tempo sont partagés.
// La grosse caisse fait « pomper » la nappe et le piano (sidechain), comme en synthwave.

import { stinger as partitionStinger, mesureReprise, sectionA, evenements, dureePas, infoScene, niveauMulti, themePatron } from './partition.js';

let ctx = null;
let G = null; // le graphe en direct
let sonde = null;

const vol = { general: 0.8, musique: 0.5, effets: 0.8 };
let muet = false;
let musiqueActive = true;
let elan = 0; // crescendo en cours : fait monter la hauteur des effets de score

const borne = (v, d) => (Number.isFinite(Number(v)) ? Math.min(1, Math.max(0, Number(v))) : d);
const gainMaitre = () => (muet ? 0 : vol.general * 0.9);
const gainEffets = () => vol.effets * 1.7;
const gainMusique = () => (musiqueActive ? vol.musique * 0.8 : 0);
const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

function viser(param, v, tau = 0.03) {
  if (!ctx) return;
  param.cancelScheduledValues(ctx.currentTime);
  param.setTargetAtTime(v, ctx.currentTime, tau);
}
function appliquerVolumes() {
  if (!G) return;
  viser(G.maitre.gain, gainMaitre());
  viser(G.effets.gain, gainEffets());
  viser(G.musique.gain, gainMusique());
}

// ------------------------------------------------------------- Graphe

function bruitBlanc(c, secondes, canaux = 1) {
  const b = c.createBuffer(canaux, Math.floor(c.sampleRate * secondes), c.sampleRate);
  for (let k = 0; k < canaux; k++) {
    const d = b.getChannelData(k);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return b;
}

// Réponse de salle : bruit stéréo qui décroît, un peu assombri.
function reponseSalle(c, duree = 2.4) {
  const n = Math.floor(c.sampleRate * duree);
  const b = c.createBuffer(2, n, c.sampleRate);
  for (let k = 0; k < 2; k++) {
    const d = b.getChannelData(k);
    let bas = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      bas = bas * 0.6 + (Math.random() * 2 - 1) * 0.4;
      d[i] = bas * Math.pow(1 - t, 3.2) * (i < c.sampleRate * 0.012 ? i / (c.sampleRate * 0.012) : 1);
    }
  }
  return b;
}

// Craquements de vinyle : souffle très bas et petits clics épars, en boucle.
function vinyle(c) {
  const n = Math.floor(c.sampleRate * 3);
  const b = c.createBuffer(1, n, c.sampleRate);
  const d = b.getChannelData(0);
  let bas = 0;
  for (let i = 0; i < n; i++) {
    bas = bas * 0.97 + (Math.random() * 2 - 1) * 0.03;
    d[i] = bas * 0.6;
    if (Math.random() < 0.00018) {
      const amp = 0.3 + Math.random() * 0.7;
      for (let k = 0; k < 40 && i + k < n; k++) d[i + k] += amp * (Math.random() * 2 - 1) * Math.exp(-k / 6);
    }
  }
  return b;
}

function courbeSaturation(force = 1.6) {
  const n = 1024;
  const k = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    k[i] = Math.tanh(x * force) / Math.tanh(force);
  }
  return k;
}

export function construireGraphe(c) {
  const g = { c };
  g.compresseur = c.createDynamicsCompressor();
  g.compresseur.threshold.value = -16;
  g.compresseur.knee.value = 10;
  g.compresseur.ratio.value = 3.5;
  g.compresseur.attack.value = 0.006;
  g.compresseur.release.value = 0.22;
  g.compresseur.connect(c.destination);
  g.maitre = c.createGain();
  g.maitre.gain.value = gainMaitre();
  g.maitre.connect(g.compresseur);

  // Réverbération partagée.
  g.salle = c.createConvolver();
  g.salle.buffer = reponseSalle(c);
  const retourSalle = c.createGain();
  retourSalle.gain.value = 0.9;
  g.salle.connect(retourSalle);
  retourSalle.connect(g.maitre);

  // Effets.
  g.effets = c.createGain();
  g.effets.gain.value = gainEffets();
  g.effets.connect(g.maitre);
  g.envoiEffets = c.createGain();
  g.envoiEffets.gain.value = 0.18;
  g.effets.connect(g.envoiEffets);
  g.envoiEffets.connect(g.salle);

  // Musique.
  g.musique = c.createGain();
  g.musique.gain.value = gainMusique();
  g.musique.connect(g.maitre);
  g.fondu = c.createGain();
  g.fondu.gain.value = 1;
  g.fondu.connect(g.musique);
  g.retrait = c.createGain(); // s'efface un instant quand le total tombe
  g.retrait.connect(g.fondu);
  g.filtre = c.createBiquadFilter();
  g.filtre.type = 'lowpass';
  g.filtre.frequency.value = 3200;
  g.filtre.Q.value = 0.8;
  g.filtre.connect(g.retrait);
  g.sature = c.createWaveShaper();
  g.sature.curve = courbeSaturation();
  g.sature.oversample = '2x';
  g.sature.connect(g.filtre);
  g.mix = c.createGain();
  g.mix.gain.value = 1.0; // v3 : +1,4 dB, mesuré à -19,8 LUFS en v2, visé autour de -18
  // Air : charlestons et brillance, après le filtre de tension (v3, le haut du spectre était éteint).
  g.air = c.createGain();
  g.air.gain.value = 0.75;
  g.air.connect(g.retrait);
  g.mix.connect(g.sature);
  // Envoi réverbération de la musique (après le filtre, pour que la salle suive la tension).
  g.envoiSalle = c.createGain();
  g.envoiSalle.gain.value = 0.32;
  g.retrait.connect(g.envoiSalle);
  g.envoiSalle.connect(g.salle);
  // Pompe : nappe, piano et arpège passent par ici.
  g.pompe = c.createGain();
  g.pompe.connect(g.mix);
  // Écho calé sur le tempo (croche pointée), assombri à chaque retour.
  g.echo = c.createDelay(2);
  g.echo.delayTime.value = 0.4;
  const boucle = c.createGain();
  boucle.gain.value = 0.34;
  const sombre = c.createBiquadFilter();
  sombre.type = 'lowpass';
  sombre.frequency.value = 2400;
  g.echo.connect(sombre);
  sombre.connect(boucle);
  boucle.connect(g.echo);
  const sortieEcho = c.createGain();
  sortieEcho.gain.value = 0.5;
  sombre.connect(sortieEcho);
  sortieEcho.connect(g.mix);
  // Vibrato partagé (chant) et léger pleurage de bande (lo-fi).
  const lfo = c.createOscillator();
  lfo.frequency.value = 5.2;
  g.vibrato = c.createGain();
  g.vibrato.gain.value = 9;
  lfo.connect(g.vibrato);
  lfo.start();
  const pleur = c.createOscillator();
  pleur.frequency.value = 0.55;
  g.pleurage = c.createGain();
  g.pleurage.gain.value = 6;
  pleur.connect(g.pleurage);
  pleur.start();
  // Vinyle.
  g.craque = c.createBufferSource();
  g.craque.buffer = vinyle(c);
  g.craque.loop = true;
  g.niveauCraque = c.createGain();
  g.niveauCraque.gain.value = 0;
  const hautCraque = c.createBiquadFilter();
  hautCraque.type = 'highpass';
  hautCraque.frequency.value = 700;
  g.craque.connect(hautCraque);
  hautCraque.connect(g.niveauCraque);
  g.niveauCraque.connect(g.fondu);
  g.craque.start();
  g.bruit = bruitBlanc(c, 1);
  return g;
}

function assurer() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    G = construireGraphe(ctx);
    sonde = ctx.createAnalyser();
    sonde.fftSize = 2048;
    G.compresseur.connect(sonde);
  } catch {
    ctx = null;
    G = null;
  }
  return ctx;
}

// À appeler sur un geste de l'utilisateur : c'est le seul endroit qui crée le contexte audio.
export function reveiller() {
  const c = assurer();
  if (!c) return;
  // iOS : le son doit partir pendant le geste. On joue un échantillon muet, on reprend le contexte,
  // et on demande la catégorie « lecture » (Safari 16.4 et plus) pour jouer même interrupteur silencieux levé.
  try {
    if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback';
  } catch {}
  if (c.state !== 'running') {
    try {
      const b = c.createBuffer(1, 1, 22050);
      const src = c.createBufferSource();
      src.buffer = b;
      src.connect(c.destination);
      src.start(0);
    } catch {}
    c.resume().catch(() => {});
  }
  if (musiqueActive) lancerMinuterie();
}

// Safari met le contexte en « interrupted » quand l'appli passe en arrière-plan : on le relance au retour.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
  });
}

export function reglerMuet(v) {
  muet = !!v;
  appliquerVolumes();
}
export function estMuet() {
  return muet;
}
// Volumes de 0 à 1 : général, musique, effets. Les clés absentes ne changent pas.
export function reglerVolumes(v = {}) {
  for (const k of Object.keys(vol)) if (v[k] !== undefined) vol[k] = borne(v[k], vol[k]);
  appliquerVolumes();
}
export function volumes() {
  return Object.assign({ muet, musique: musiqueActive }, vol);
}

// ------------------------------------------------------------- Briques de synthèse

function env(g, t0, v, att, duree, rel = 0.08) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(v, t0 + att);
  g.gain.setTargetAtTime(0.0001, t0 + Math.max(att, duree), rel / 3);
}

function osc(c, type, f, t0, fin) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  o.start(t0);
  o.stop(fin);
  return o;
}

function bruitSrc(g, t0, duree) {
  const s = g.c.createBufferSource();
  s.buffer = g.bruit;
  s.start(t0, Math.random() * 0.7, duree + 0.05);
  return s;
}

function filtre(c, type, f, q = 0.7) {
  const n = c.createBiquadFilter();
  n.type = type;
  n.frequency.value = f;
  n.Q.value = q;
  return n;
}

function panner(c, p) {
  if (!c.createStereoPanner) return null;
  const n = c.createStereoPanner();
  n.pan.value = p;
  return n;
}

function relier(noeuds, sortie) {
  const liste = noeuds.filter(Boolean);
  for (let i = 0; i < liste.length - 1; i++) liste[i].connect(liste[i + 1]);
  liste[liste.length - 1].connect(sortie);
}

// --- Voix mélodiques de la musique. sortie : nœud de destination. Les volumes sont ceux de la partition.

const TIMBRES = {
  // Piano électrique : modulation de fréquence douce, la « tine » qui s'éteint vite.
  piano(g, f, t0, d, v, sortie) {
    const c = g.c;
    const fin = t0 + d + 0.5;
    const porteuse = osc(c, 'sine', f, t0, fin);
    const mod = osc(c, 'sine', f, t0, fin);
    const ind = c.createGain();
    ind.gain.setValueAtTime(f * 1.6, t0);
    ind.gain.exponentialRampToValueAtTime(f * 0.12, t0 + 0.35);
    mod.connect(ind);
    ind.connect(porteuse.frequency);
    const a = c.createGain();
    a.gain.setValueAtTime(0.0001, t0);
    a.gain.linearRampToValueAtTime(v * 0.85, t0 + 0.004);
    a.gain.setTargetAtTime(v * 0.3, t0 + 0.004, 0.25);
    a.gain.setTargetAtTime(0.0001, t0 + d, 0.12);
    g.pleurage.connect(porteuse.detune);
    porteuse.connect(a);
    a.connect(sortie);
  },
  // Nappe : deux scies désaccordées, attaque lente, filtre qui respire.
  nappe(g, f, t0, d, v, sortie) {
    const c = g.c;
    const fin = t0 + d + 0.9;
    const a = c.createGain();
    env(a, t0, v * 0.45, Math.min(0.5, d * 0.4), d, 0.6);
    const lp = filtre(c, 'lowpass', 900, 0.6);
    lp.frequency.setValueAtTime(700, t0);
    lp.frequency.linearRampToValueAtTime(1700, t0 + d * 0.6);
    for (const det of [-9, 9]) {
      const o = osc(c, 'sawtooth', f, t0, fin);
      o.detune.value = det;
      o.connect(lp);
    }
    lp.connect(a);
    a.connect(sortie);
  },
  // Basse synthé : scie et sous-octave, filtre qui claque à l'attaque.
  synth(g, f, t0, d, v, sortie) {
    const c = g.c;
    const fin = t0 + d + 0.2;
    const lp = filtre(c, 'lowpass', 300, 5);
    lp.frequency.setValueAtTime(1900, t0);
    lp.frequency.exponentialRampToValueAtTime(260, t0 + 0.16);
    const s = osc(c, 'sawtooth', f, t0, fin);
    const sub = osc(c, 'sine', f / 2, t0, fin);
    const gs = c.createGain();
    gs.gain.value = 0.9;
    s.connect(lp);
    sub.connect(gs);
    const a = c.createGain();
    env(a, t0, v * 0.32, 0.004, d * 0.85, 0.06);
    lp.connect(a);
    gs.connect(a);
    a.connect(sortie);
  },
  // Basse ronde (lo-fi) : sinus avec une pointe d'harmonique et une petite chute d'attaque.
  ronde(g, f, t0, d, v, sortie) {
    const c = g.c;
    const fin = t0 + d + 0.3;
    const o = osc(c, 'sine', f * 1.02, t0, fin);
    o.frequency.exponentialRampToValueAtTime(f, t0 + 0.05);
    const h = osc(c, 'triangle', f * 2, t0, fin);
    const gh = c.createGain();
    gh.gain.value = 0.35;
    h.connect(gh);
    const lp = filtre(c, 'lowpass', 900, 0.7);
    const a = c.createGain();
    a.gain.setValueAtTime(0.0001, t0);
    a.gain.linearRampToValueAtTime(v * 0.32, t0 + 0.012);
    a.gain.setTargetAtTime(v * 0.22, t0 + 0.012, 0.2);
    a.gain.setTargetAtTime(0.0001, t0 + d, 0.07);
    o.connect(lp);
    gh.connect(lp);
    lp.connect(a);
    a.connect(sortie);
  },
  // Lead synthwave : deux scies, filtre chantant, vibrato.
  lead(g, f, t0, d, v, sortie) {
    const c = g.c;
    const fin = t0 + d + 0.3;
    const lp = filtre(c, 'lowpass', 2400, 2.5);
    lp.frequency.setValueAtTime(1200, t0);
    lp.frequency.linearRampToValueAtTime(3000, t0 + 0.08);
    lp.frequency.setTargetAtTime(1900, t0 + 0.08, 0.3);
    for (const det of [-7, 7]) {
      const o = osc(c, 'sawtooth', f, t0, fin);
      o.detune.value = det;
      g.vibrato.connect(o.detune);
      o.connect(lp);
    }
    const a = c.createGain();
    env(a, t0, v * 0.36, 0.015, d, 0.12);
    lp.connect(a);
    a.connect(sortie);
    a.connect(g.echo);
  },
  // Flûte lo-fi : triangle et sinus, souffle à l'attaque, vibrato et pleurage.
  flute(g, f, t0, d, v, sortie) {
    const c = g.c;
    const fin = t0 + d + 0.3;
    const a = c.createGain();
    env(a, t0, v * 0.6, 0.035, d, 0.1);
    const t = osc(c, 'triangle', f, t0, fin);
    const s = osc(c, 'sine', f * 2, t0, fin);
    const gs = c.createGain();
    gs.gain.value = 0.18;
    for (const o of [t, s]) {
      g.vibrato.connect(o.detune);
      g.pleurage.connect(o.detune);
    }
    t.connect(a);
    s.connect(gs);
    gs.connect(a);
    const souffle = bruitSrc(g, t0, 0.08);
    const bp = filtre(c, 'bandpass', f * 2, 3);
    const gb = c.createGain();
    gb.gain.setValueAtTime(v * 0.5, t0);
    gb.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
    souffle.connect(bp);
    bp.connect(gb);
    gb.connect(sortie);
    a.connect(sortie);
    a.connect(g.echo);
  },
  // Cloche : partiel inharmonique, longue queue dans la salle.
  cloche(g, f, t0, d, v, sortie) {
    const c = g.c;
    const fin = t0 + d + 1.2;
    const a = c.createGain();
    a.gain.setValueAtTime(0.0001, t0);
    a.gain.linearRampToValueAtTime(v * 4, t0 + 0.003);
    a.gain.setTargetAtTime(0.0001, t0 + 0.003, 0.35);
    const o1 = osc(c, 'sine', f, t0, fin);
    const o2 = osc(c, 'sine', f * 2.76, t0, fin);
    const g2 = c.createGain();
    g2.gain.value = 0.3;
    o1.connect(a);
    o2.connect(g2);
    g2.connect(a);
    a.connect(sortie);
    a.connect(g.echo);
  },
  // Cuivre (v4) : trois scies serrées, filtre qui s'ouvre à l'attaque, comme une section qui pousse.
  cuivre(g, f, t0, d, v, sortie) {
    const c = g.c;
    const fin = t0 + d + 0.3;
    const lp = filtre(c, 'lowpass', 900, 1.4);
    lp.frequency.setValueAtTime(500, t0);
    lp.frequency.linearRampToValueAtTime(2600, t0 + 0.05);
    lp.frequency.setTargetAtTime(1200, t0 + 0.05, 0.2);
    for (const det of [-6, 0, 6]) {
      const o = osc(c, 'sawtooth', f, t0, fin);
      o.detune.value = det;
      o.connect(lp);
    }
    const a = c.createGain();
    env(a, t0, v * 0.5, 0.02, d, 0.12);
    lp.connect(a);
    a.connect(sortie);
  },
  // Marimba (v4) : sinus et partiel au quadruple, chute rapide, bois qui résonne.
  marimba(g, f, t0, d, v, sortie) {
    const c = g.c;
    const fin = t0 + 0.6;
    const a = c.createGain();
    a.gain.setValueAtTime(0.0001, t0);
    a.gain.linearRampToValueAtTime(v * 1.6, t0 + 0.003);
    a.gain.setTargetAtTime(0.0001, t0 + 0.003, 0.12);
    const o1 = osc(c, 'sine', f, t0, fin);
    const o2 = osc(c, 'sine', f * 3.9, t0, fin);
    const g2 = c.createGain();
    g2.gain.setValueAtTime(0.25, t0);
    g2.gain.exponentialRampToValueAtTime(0.01, t0 + 0.05);
    o1.connect(a);
    o2.connect(g2);
    g2.connect(a);
    a.connect(sortie);
  },
  // Cordes (v4) : quatre scies désaccordées, attaque lente, filtre doux.
  cordes(g, f, t0, d, v, sortie) {
    const c = g.c;
    const fin = t0 + d + 1.2;
    const lp = filtre(c, 'lowpass', 1400, 0.5);
    for (const det of [-12, -4, 4, 12]) {
      const o = osc(c, 'sawtooth', f, t0, fin);
      o.detune.value = det;
      g.vibrato.connect(o.detune);
      o.connect(lp);
    }
    const a = c.createGain();
    env(a, t0, v * 0.4, Math.min(0.9, d * 0.3), d, 0.9);
    lp.connect(a);
    a.connect(sortie);
  },
  // Orgue de foire (v4) : fondamentale, octave et quinte en carrés doux, trémolo.
  orgue(g, f, t0, d, v, sortie) {
    const c = g.c;
    const fin = t0 + d + 0.2;
    const lp = filtre(c, 'lowpass', 2200, 0.7);
    for (const [r, k] of [[1, 1], [2, 0.5], [3, 0.25]]) {
      const o = osc(c, r === 1 ? 'square' : 'sine', f * r, t0, fin);
      const gk = c.createGain();
      gk.gain.value = k;
      o.connect(gk);
      gk.connect(lp);
    }
    const trem = osc(c, 'sine', 6, t0, fin);
    const tg = c.createGain();
    tg.gain.value = v * 0.12;
    const a = c.createGain();
    env(a, t0, v * 0.35, 0.01, d, 0.08);
    trem.connect(tg);
    tg.connect(a.gain);
    lp.connect(a);
    a.connect(sortie);
  },
  // Pincée : carré filtré très court, pour les arpèges.
  pincee(g, f, t0, d, v, sortie) {
    const c = g.c;
    const fin = t0 + d + 0.25;
    const lp = filtre(c, 'lowpass', 600, 4);
    lp.frequency.setValueAtTime(4200, t0);
    lp.frequency.exponentialRampToValueAtTime(500, t0 + 0.14);
    const o = osc(c, 'square', f, t0, fin);
    o.connect(lp);
    const a = c.createGain();
    a.gain.setValueAtTime(0.0001, t0);
    a.gain.linearRampToValueAtTime(v * 1.1, t0 + 0.003);
    a.gain.setTargetAtTime(0.0001, t0 + 0.003, 0.09);
    lp.connect(a);
    a.connect(sortie);
    a.connect(g.echo);
  },
};

// --- Percussions de la musique.
function percu(g, sorte, t0, v, style) {
  const c = g.c;
  const lofi = style === 'lofi';
  if (sorte === 'clap' || sorte === 'tambourin') {
    // La salle frappe dans ses mains (v4) ; le tambourin, des cymbalettes très courtes.
    const n = sorte === 'clap' ? 4 : 1;
    for (let i = 0; i < n; i++) {
      const t = t0 + i * 0.009 + (sorte === 'clap' ? Math.random() * 0.004 : 0);
      const s = bruitSrc(g, t, 0.06);
      const f = filtre(c, sorte === 'clap' ? 'bandpass' : 'highpass', sorte === 'clap' ? 1100 + i * 180 : 7000, sorte === 'clap' ? 1.4 : 0.7);
      const a = c.createGain();
      a.gain.setValueAtTime(v * (sorte === 'clap' ? 1.6 : 1.2), t);
      a.gain.exponentialRampToValueAtTime(0.0001, t + (sorte === 'clap' ? 0.05 : 0.07));
      relier([s, f, a], g.air || g.mix);
    }
    return;
  }
  if (sorte === 'grosse') {
    const o = osc(c, 'sine', 150, t0, t0 + 0.4);
    o.frequency.exponentialRampToValueAtTime(lofi ? 50 : 44, t0 + 0.11);
    const a = c.createGain();
    a.gain.setValueAtTime(v * 1.5, t0);
    a.gain.exponentialRampToValueAtTime(0.0001, t0 + (lofi ? 0.3 : 0.38));
    o.connect(a);
    a.connect(g.mix);
    const clic = bruitSrc(g, t0, 0.01);
    const hp = filtre(c, 'highpass', lofi ? 1500 : 3000);
    const gc = c.createGain();
    gc.gain.setValueAtTime(v * 0.5, t0);
    gc.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.012);
    relier([clic, hp, gc], g.mix);
    // La pompe : la nappe et le piano s'écartent un instant.
    const creux = lofi ? 0.55 : 0.3;
    g.pompe.gain.cancelScheduledValues(t0);
    g.pompe.gain.setValueAtTime(creux, t0);
    g.pompe.gain.linearRampToValueAtTime(1, t0 + (lofi ? 0.22 : 0.3));
    return;
  }
  if (sorte === 'claire') {
    if (lofi) {
      // Caisse claire feutrée, comme jouée aux balais.
      const s = bruitSrc(g, t0, 0.2);
      const bp = filtre(c, 'bandpass', 1700, 0.9);
      const lp = filtre(c, 'lowpass', 5200);
      const a = c.createGain();
      a.gain.setValueAtTime(v * 2.6, t0);
      a.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      relier([s, bp, lp, a], g.mix);
      const corps = osc(c, 'triangle', 190, t0, t0 + 0.1);
      corps.frequency.exponentialRampToValueAtTime(150, t0 + 0.08);
      const gc = c.createGain();
      gc.gain.setValueAtTime(v * 1.1, t0);
      gc.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
      relier([corps, gc], g.mix);
    } else {
      // Clap : trois éclats rapprochés puis une queue dans la salle.
      for (let i = 0; i < 3; i++) {
        const s = bruitSrc(g, t0 + i * 0.011, 0.02);
        const bp = filtre(c, 'bandpass', 1300, 1.2);
        const a = c.createGain();
        a.gain.setValueAtTime(v * 1.8, t0 + i * 0.011);
        a.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.011 + 0.02);
        relier([s, bp, a], g.mix);
      }
      const s = bruitSrc(g, t0 + 0.033, 0.25);
      const bp = filtre(c, 'bandpass', 1100, 0.8);
      const a = c.createGain();
      a.gain.setValueAtTime(v * 1.3, t0 + 0.033);
      a.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26);
      relier([s, bp, a], g.mix);
    }
    return;
  }
  if (sorte === 'rim') {
    const o = osc(c, 'triangle', 1650, t0, t0 + 0.04);
    const a = c.createGain();
    a.gain.setValueAtTime(v * 1.4, t0);
    a.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.035);
    relier([o, a], g.mix);
    return;
  }
  // Charlestons.
  const ouvert = sorte === 'ouvert';
  const duree = ouvert ? 0.26 : 0.04;
  const s = bruitSrc(g, t0, duree);
  const hp = filtre(c, 'highpass', ouvert ? 6800 : 7600);
  const lp = lofi ? filtre(c, 'lowpass', 9000) : null;
  const a = c.createGain();
  a.gain.setValueAtTime(v * 5, t0);
  a.gain.exponentialRampToValueAtTime(0.0001, t0 + duree);
  const p = panner(c, ouvert ? -0.25 : 0.2);
  // v3 : les charlestons contournent le filtre de tension, pour garder de l'air dans le haut du spectre.
  relier([s, hp, lp, a, p], g.air || g.mix);
}

// Joue un pas de la partition à l'instant t0 sur le graphe g. Renvoie le nombre de notes.
// Les instruments de la troupe (v4) : timbre et place dans l'image stéréo.
const TIMBRE_COUCHE = { cloches: 'cloche', cuivres: 'cuivre', marimba: 'marimba', cordes: 'cordes', orgue: 'orgue' };
const PAN_COUCHE = { cloches: 0.5, marimba: -0.45, orgue: -0.25, cuivres: 0.15, cordes: -0.1 };

function planifierPas(g, scene, mesure, pas, t0, o = {}) {
  const info = infoScene(scene);
  const d = dureePas(scene, { final: o.final });
  const t = t0 + (pas % 2 === 1 ? info.swing * d : 0);
  const evs = evenements(scene, mesure, pas, o.int, { final: o.final, fievre: o.fievre, couches: o.couches, multi: o.multi, theme: o.theme, score: o.score });
  for (const e of evs) {
    if (o.seules && !o.seules.includes(e.voix)) continue;
    const duree = Math.max(0.05, e.duree * d);
    if (e.voix === 'grosse' || e.voix === 'claire' || e.voix === 'charley' || e.voix === 'ouvert' || e.voix === 'rim' || e.voix === 'clap' || e.voix === 'tambourin') {
      percu(g, e.voix, t, e.vol, info.style);
      continue;
    }
    const timbre = e.timbre || info.timbres[e.voix] || TIMBRE_COUCHE[e.voix] || 'piano';
    let sortie = g.mix;
    if (e.voix === 'nappe' || e.voix === 'accord' || e.voix === 'arpege') sortie = g.pompe;
    if (e.voix === 'arpege' || e.voix === 'contre' || PAN_COUCHE[e.voix]) {
      const p = panner(g.c, PAN_COUCHE[e.voix] || (e.voix === 'contre' ? 0.35 : (pas % 4 < 2 ? -0.45 : 0.45)));
      if (p) {
        p.connect(sortie);
        sortie = p;
      }
    }
    TIMBRES[timbre](g, midiHz(e.midi), t, duree, e.vol, sortie);
  }
  return evs.length;
}

// Réglages de couleur selon le style et la tension (0 à 1).
function couleur(g, info, tension, int, t, tau = 0.8) {
  const lofi = info.style === 'lofi';
  const base = lofi ? 3000 : 3600;
  const haut = lofi ? 7500 : 11000;
  const f = base + (haut - base) * Math.min(1, tension * 0.75 + int * 0.12);
  g.filtre.frequency.setTargetAtTime(f, t, tau);
  g.niveauCraque.gain.setTargetAtTime(lofi ? 0.05 : 0, t, 0.5);
  g.echo.delayTime.setTargetAtTime((60 / info.bpm) * 0.75, t, 0.05);
}

// ------------------------------------------------------------- Effets

function note(freq, duree, o = {}) {
  if (!G || muet || ctx.state !== 'running') return;
  const c = ctx;
  const t0 = c.currentTime + (o.delai || 0);
  const s = c.createOscillator();
  const g = c.createGain();
  s.type = o.type || 'square';
  s.frequency.setValueAtTime(freq, t0);
  if (o.glisse) s.frequency.exponentialRampToValueAtTime(Math.max(20, o.glisse), t0 + duree);
  const v = o.vol ?? 0.2;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(v, t0 + (o.att || 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duree);
  let sortie = g;
  if (o.lp) {
    const f = filtre(c, 'lowpass', o.lp, o.q || 1);
    if (o.lpFin) f.frequency.exponentialRampToValueAtTime(o.lpFin, t0 + duree);
    g.connect(f);
    sortie = f;
  }
  if (o.pan && c.createStereoPanner) {
    const p = panner(c, o.pan);
    sortie.connect(p);
    sortie = p;
  }
  s.connect(g);
  sortie.connect(G.effets);
  s.start(t0);
  s.stop(t0 + duree + 0.03);
}

function bruit(duree, o = {}) {
  if (!G || muet || ctx.state !== 'running') return;
  const c = ctx;
  const t0 = c.currentTime + (o.delai || 0);
  const src = c.createBufferSource();
  src.buffer = G.bruit;
  const g = c.createGain();
  if (o.att) {
    // Montée lente puis coupure nette : le souffle retenu juste avant l'impact.
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.vol ?? 0.15, t0 + o.att * 0.95);
    g.gain.linearRampToValueAtTime(0.0001, t0 + duree);
  } else {
    g.gain.setValueAtTime(o.vol ?? 0.15, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duree);
  }
  const chaine = [src];
  if (o.filtre) {
    const f = filtre(c, o.filtreType || 'highpass', o.filtre, o.q || 0.7);
    if (o.balaye) f.frequency.exponentialRampToValueAtTime(o.balaye, t0 + duree);
    chaine.push(f);
  }
  chaine.push(g);
  if (o.pan) chaine.push(panner(c, o.pan));
  relier(chaine, G.effets);
  src.start(t0, Math.random() * 0.7, duree + 0.05);
}

// Cloche courte : sinus et partiel, pour les jetons et les pièces.
function tinte(freq, duree, o = {}) {
  note(freq, duree, Object.assign({ type: 'sine' }, o));
  note(freq * 2.01, duree * 0.6, Object.assign({}, o, { type: 'sine', vol: (o.vol ?? 0.2) * 0.35 }));
}

// Pentatonique mineure de ré, accordée avec la musique de la table.
const PENTA = [0, 3, 5, 7, 10];
const penta = (i) => 62 + PENTA[((i % 5) + 5) % 5] + 12 * Math.floor(i / 5);
const hzM = (m) => midiHz(m);
// Les enchaînements de mains font monter le tout : deux degrés de plus par marche du crescendo.
const degre = (i) => Math.min(i, 14) + Math.min(elan, 5) * 2;

export const son = {
  survol: () => note(1320, 0.025, { vol: 0.025, type: 'sine' }),
  clic: () => {
    note(900, 0.04, { vol: 0.08, type: 'triangle', glisse: 600 });
    bruit(0.012, { vol: 0.05, filtre: 3000 });
  },
  choisir: () => {
    note(hzM(74), 0.07, { vol: 0.09, type: 'triangle', glisse: hzM(81) });
    bruit(0.02, { vol: 0.05, filtre: 4000 });
  },
  lacher: () => note(hzM(69), 0.07, { vol: 0.08, type: 'triangle', glisse: hzM(62) }),
  refus: () => {
    note(160, 0.12, { vol: 0.1, type: 'sawtooth', lp: 900 });
    note(118, 0.18, { vol: 0.1, type: 'sawtooth', lp: 700, delai: 0.07 });
  },
  // Carte posée : un froissement de feutre.
  // v5 : plus feutré, la carte se pose sur le velours (souffle filtré bas, coup sourd).
  carte: () => {
    bruit(0.07, { vol: 0.11, filtre: 1500, filtreType: 'bandpass', q: 0.6 });
    bruit(0.03, { vol: 0.05, filtre: 700, filtreType: 'lowpass' });
    note(150, 0.07, { vol: 0.05, type: 'sine', glisse: 90 });
  },
  pioche: (i = 0) => bruit(0.045, { vol: 0.07, filtre: 2200, filtreType: 'bandpass', delai: i * 0.045, pan: ((i % 3) - 1) * 0.3 }),
  // Défausse : un souffle qui balaie la table.
  defausse: (n = 3) => {
    bruit(0.22, { vol: 0.12, filtre: 500, filtreType: 'bandpass', balaye: 3200, q: 1.2 });
    for (let i = 0; i < Math.min(5, n); i++) bruit(0.03, { vol: 0.05, filtre: 4000, delai: 0.05 + i * 0.03 });
  },
  // Jetons : une petite cloche qui grimpe la gamme, carte après carte.
  // v5 : la cloche reste, adoucie, avec le petit claquement mat d'un jeton de céramique sur le feutre.
  jetons: (i = 0) => {
    const f = hzM(penta(degre(i)));
    tinte(f, 0.14, { vol: 0.085 });
    bruit(0.012, { vol: 0.05, filtre: 2400, filtreType: 'bandpass', q: 3 });
    bruit(0.01, { vol: 0.03, filtre: 3300, filtreType: 'bandpass', q: 4, delai: 0.018 });
  },
  // Multi : un pizzicato plus grave et plus rond.
  multi: (i = 0) => {
    const f = hzM(penta(degre(i)) - 12);
    note(f, 0.16, { vol: 0.15, type: 'square', lp: 2600, lpFin: 400, q: 3 });
    note(f * 2, 0.1, { vol: 0.05, type: 'sine' });
  },
  // ×Multi : accord de puissance, coup sourd et étincelles.
  xmulti: (i = 0) => {
    const f = hzM(penta(degre(i)) - 12);
    for (const r of [1, 1.5, 2]) note(f * r, 0.32, { vol: 0.07, type: 'sawtooth', lp: 5000, lpFin: 500, q: 4 });
    note(70, 0.25, { vol: 0.22, type: 'sine', glisse: 38 });
    for (let k = 0; k < 3; k++) tinte(hzM(penta(degre(i) + 5 + k)), 0.1, { vol: 0.04, delai: 0.04 + k * 0.035 });
  },
  // Un joker se réveille : un toc boisé et un éclat.
  joker: (i = 0) => {
    note(780, 0.05, { vol: 0.1, type: 'sine', glisse: 480 });
    tinte(hzM(penta(degre(i) + 7)), 0.09, { vol: 0.05, delai: 0.02, pan: 0.2 });
  },
  rejoue: () => {
    tinte(hzM(74), 0.06, { vol: 0.08 });
    tinte(hzM(81), 0.08, { vol: 0.08, delai: 0.05 });
  },
  // Pièce : le tintement du louis qui tombe.
  piece: (i = 0) => {
    tinte(1568, 0.07, { vol: 0.07, delai: i * 0.05 });
    tinte(2093, 0.16, { vol: 0.07, delai: i * 0.05 + 0.05 });
  },
  roulement: (i) => {
    bruit(0.05, { vol: 0.04 + i * 0.012, filtre: 300 + i * 500, filtreType: 'bandpass', q: 1.5 });
    note(hzM(50 + i * 2), 0.06, { vol: 0.03 + i * 0.008, type: 'sawtooth', lp: 1200 });
  },
  // Le total : un impact grave, un accord qui s'ouvre, la salle qui résonne.
  total: (force = 1) => {
    const base = hzM(50 + Math.min(elan, 5));
    note(90, 0.6, { vol: 0.25 + 0.04 * force, type: 'sine', glisse: 32 });
    [0, 7, 12, 15, 19].forEach((d, i) => note(base * Math.pow(2, d / 12), 0.5 + 0.15 * force, { vol: 0.07, type: 'sawtooth', lp: 1500 + 1500 * force, lpFin: 300, q: 2, delai: i * 0.012, pan: (i - 2) * 0.2 }));
    bruit(0.4, { vol: 0.1 + 0.04 * force, filtre: 5000, filtreType: 'lowpass', balaye: 200 });
    etouffer(0.4 + force * 0.2);
  },
  // Le compteur qui défile monte la gamme : chaque tic est un peu plus aigu.
  compte: (i = 0) => note(hzM(86 + Math.min(i, 24) * 0.5), 0.025, { vol: 0.03, type: 'sine' }),
  // Inspiration avant un gros total : la salle retient son souffle (bruit inversé qui monte).
  souffle: (duree = 0.5) => {
    bruit(duree, { vol: 0.06, filtre: 300, filtreType: 'bandpass', balaye: 5000, q: 1.4, att: duree });
    note(hzM(38), duree, { vol: 0.06, type: 'sine', glisse: hzM(50), att: duree * 0.9 });
  },
  // Récompenses des gros scores, par palier : 1 manche battue d'un coup, 2 le double, 3 cinq fois, 4 record.
  palier: (n = 1) => {
    const k = Math.max(1, Math.min(4, n));
    const base = 62 + Math.min(elan, 5);
    const accord = [0, 4, 7, 11, 14, 19].slice(0, 3 + k);
    accord.forEach((d, i) => note(hzM(base + d), 0.7 + k * 0.25, { vol: 0.05, type: 'sawtooth', lp: 2500 + k * 1200, lpFin: 600, q: 2, delai: i * 0.03, pan: (i % 2 ? 0.4 : -0.4) }));
    for (let i = 0; i < 4 + k * 4; i++) tinte(hzM(penta(10 + i)), 0.18, { vol: 0.05, delai: 0.08 + i * 0.045, pan: Math.sin(i) * 0.6 });
    if (k >= 2) bruit(1.2, { vol: 0.07, filtre: 6000, filtreType: 'highpass' });
    if (k >= 3) for (let i = 0; i < 10; i++) son.piece(i);
    if (k >= 3) son.bravo(4);
  },
  // La main prend feu : un souffle qui s'enflamme et une quinte qui monte.
  embrase: () => {
    bruit(0.6, { vol: 0.11, filtre: 500, filtreType: 'bandpass', balaye: 6000, q: 0.9 });
    note(hzM(50), 0.5, { vol: 0.08, type: 'sawtooth', lp: 900, lpFin: 4000, glisse: hzM(62) });
    tinte(hzM(81), 0.25, { vol: 0.06, delai: 0.18 });
  },
  record: () => {
    [0, 7, 12, 16, 19, 24].forEach((d, i) => tinte(hzM(67 + d), 0.4, { vol: 0.08, delai: i * 0.06 }));
    note(hzM(43), 1.2, { vol: 0.12, type: 'sawtooth', lp: 1800, lpFin: 300, delai: 0.1 });
  },
  // Combo reconnu : deux accords de cuivres qui se répondent, comme une annonce de numéro.
  combo: (n = 1) => {
    const base = 67 + Math.min(elan, 5);
    [[0, 4, 7], [5, 9, 12]].forEach((acc, k) => acc.forEach((d, i) => note(hzM(base + d), 0.22, { vol: 0.06, type: 'sawtooth', lp: 3200, lpFin: 900, q: 1.5, delai: k * 0.13 + i * 0.01, pan: k ? 0.3 : -0.3 })));
    if (n > 1) tinte(hzM(base + 24), 0.3, { vol: 0.06, delai: 0.28 });
  },
  // Niveau de renommée gagné : une petite fanfare de cloches.
  niveau: () => [0, 4, 7, 12, 16, 19, 24].forEach((d, i) => tinte(hzM(72 + d), 0.3, { vol: 0.07, delai: i * 0.07 })),
  brise: () => {
    bruit(0.3, { vol: 0.18, filtre: 4500 });
    for (let k = 0; k < 4; k++) tinte(2400 + k * 700, 0.12, { vol: 0.035, delai: k * 0.03 });
  },
  // Achat : le tiroir-caisse.
  achat: () => {
    bruit(0.03, { vol: 0.08, filtre: 2500, filtreType: 'bandpass' });
    tinte(1318, 0.12, { vol: 0.08, delai: 0.03 });
    tinte(1976, 0.3, { vol: 0.08, delai: 0.09 });
  },
  vente: () => {
    tinte(1976, 0.08, { vol: 0.07 });
    tinte(1318, 0.18, { vol: 0.07, delai: 0.06 });
  },
  relance: () => {
    for (let i = 0; i < 5; i++) bruit(0.04, { vol: 0.07, filtre: 3200, filtreType: 'bandpass', delai: i * 0.045, pan: (i % 2 ? 0.3 : -0.3) });
  },
  paquet: () => {
    bruit(0.3, { vol: 0.1, filtre: 600, filtreType: 'bandpass', balaye: 4000 });
    [0, 3, 7, 10, 14].forEach((d, i) => tinte(hzM(74 + d), 0.2, { vol: 0.06, delai: 0.15 + i * 0.05 }));
  },
  astre: () => [0, 4, 7, 11, 14].forEach((d, i) => tinte(hzM(72 + d), 0.3, { vol: 0.06, delai: i * 0.06 })),
  arcane: () => [12, 7, 12, 15].forEach((d, i) => note(hzM(62 + d), 0.16, { vol: 0.07, type: 'triangle', delai: i * 0.06 })),
  // Le crescendo monte : une gamme qui grimpe, d'autant plus haute que la marche.
  elan: (n = 1) => {
    const k = Math.min(n, 5);
    for (let i = 0; i < 3 + k; i++) note(hzM(penta(5 + k * 2 + i)), 0.14, { vol: 0.11, type: 'square', lp: 3500, delai: i * 0.045, pan: (i % 2 ? 0.35 : -0.35) });
    bruit(0.4, { vol: 0.09, filtre: 800, filtreType: 'bandpass', balaye: 7000, q: 1.5 });
  },
  victoireManche: () => {
    [0, 4, 7, 12, 16].forEach((d, i) => tinte(hzM(62 + d), 0.3, { vol: 0.09, delai: i * 0.07 }));
    [0, 7, 12].forEach((d) => note(hzM(50 + d), 0.8, { vol: 0.05, type: 'sawtooth', lp: 2500, lpFin: 500, delai: 0.3 }));
  },
  victoire: () => {
    [0, 4, 7, 12, 7, 12, 16, 19, 24].forEach((d, i) => tinte(hzM(60 + d), 0.35, { vol: 0.09, delai: i * 0.1 }));
    [0, 4, 7, 12].forEach((d) => note(hzM(48 + d), 1.6, { vol: 0.05, type: 'sawtooth', lp: 3000, lpFin: 600, delai: 0.9 }));
  },
  defaite: () => {
    [12, 8, 5, 0, -4].forEach((d, i) => note(hzM(57 + d), 0.4, { vol: 0.09, type: 'sawtooth', lp: 1400, lpFin: 300, delai: i * 0.18, glisse: hzM(56 + d) }));
    note(80, 1.4, { vol: 0.15, type: 'sine', glisse: 30, delai: 0.9 });
  },
  // Le public : quelques mains qui claquent, un murmure, une salle entière, un rappel.
  bravo: (n = 1) => {
    for (let i = 0; i < 5 + n * 4; i++) bruit(0.03, { vol: 0.04 + Math.random() * 0.05, filtre: 1600 + Math.random() * 1800, filtreType: 'bandpass', delai: Math.random() * 0.4, pan: Math.random() * 1.2 - 0.6 });
  },
  murmure: () => {
    note(150, 0.3, { vol: 0.07, type: 'triangle', glisse: 105 });
    bruit(0.35, { vol: 0.04, filtre: 500, filtreType: 'lowpass' });
  },
  ovation: () => {
    for (let i = 0; i < 80; i++) {
      const t = Math.random() * 1.7;
      bruit(0.035, { vol: (0.035 + Math.random() * 0.05) * (1 - t / 2.4), filtre: 1400 + Math.random() * 2600, filtreType: 'bandpass', delai: t, pan: Math.random() * 1.6 - 0.8 });
    }
    [0, 4, 7, 12, 16].forEach((d, i) => tinte(hzM(67 + d), 0.35, { vol: 0.07, delai: i * 0.07 }));
  },
  rappel: () => {
    [0, 7, 12, 7, 12, 16].forEach((d, i) => tinte(hzM(67 + d), 0.18, { vol: 0.08, delai: i * 0.09 }));
    for (let i = 0; i < 24; i++) bruit(0.03, { vol: 0.03 + Math.random() * 0.04, filtre: 1600 + Math.random() * 2000, filtreType: 'bandpass', delai: 0.1 + Math.random() * 0.7, pan: Math.random() - 0.5 });
  },
  patron: () => {
    note(55, 1.0, { vol: 0.25, type: 'sawtooth', glisse: 41, lp: 600 });
    note(82, 1.0, { vol: 0.12, type: 'square', glisse: 62, delai: 0.05, lp: 500 });
    bruit(0.8, { vol: 0.1, filtre: 300, filtreType: 'lowpass' });
    note(40, 1.2, { vol: 0.2, type: 'sine', delai: 0.02 });
  },
};

// Stinger : une courte phrase jouée par les instruments de la musique (piano, lead, nappe, batterie),
// par-dessus le morceau qui s'efface. sorte : manche, patron, victoire, defaite.
function jouerStinger(g, sorte, t0, bpm = 96) {
  const notes = partitionStinger(sorte);
  if (!notes.length) return 0;
  const c = g.c;
  const bus = c.createGain();
  bus.gain.value = 1;
  bus.connect(g.musique);
  const env2 = c.createGain();
  env2.gain.value = 0.32;
  bus.connect(env2);
  env2.connect(g.salle);
  const gs = Object.assign({}, g, { mix: bus, pompe: bus, air: bus });
  const temps = 60 / bpm;
  const style = sorte === 'manche' ? 'lofi' : 'synth';
  const timbres = { basse: style === 'lofi' ? 'ronde' : 'synth', accord: 'piano', chant: style === 'lofi' ? 'flute' : 'lead', contre: 'cloche', nappe: 'nappe' };
  for (const n of notes) {
    const t = t0 + n.debut * temps;
    if (['grosse', 'claire', 'charley', 'ouvert', 'rim'].includes(n.voix)) percu(gs, n.voix, t, n.vol, style);
    else TIMBRES[timbres[n.voix] || 'piano'](gs, midiHz(n.midi), t, Math.max(0.08, n.duree * temps), n.vol * 1.15, bus);
  }
  return notes.length;
}

export function stinger(sorte) {
  if (!G || muet || ctx.state !== 'running' || !musiqueActive) return;
  const t = ctx.currentTime + 0.02;
  // Le morceau s'écarte pour laisser passer la phrase.
  G.retrait.gain.cancelScheduledValues(t);
  G.retrait.gain.setTargetAtTime(0.25, t, 0.05);
  G.retrait.gain.setTargetAtTime(1, t + 2.4, 0.6);
  jouerStinger(G, sorte, t, sorte === 'manche' ? 92 : sorte === 'defaite' ? 76 : 110);
}

// La musique s'efface un instant pour laisser passer un effet fort.
export function etouffer(duree = 0.5) {
  if (!G || !ctx) return;
  const t = ctx.currentTime;
  G.retrait.gain.cancelScheduledValues(t);
  G.retrait.gain.setTargetAtTime(0.4, t, 0.02);
  G.retrait.gain.setTargetAtTime(1, t + duree, 0.35);
}

// Crescendo en cours (nombre de marches). Fait monter les effets de score et la fièvre de la musique.
export function reglerElan(n) {
  elan = Math.max(0, n | 0);
  mus.fievre = elan >= 2;
}

// ------------------------------------------------------------- Musique
// Un ordonnanceur lit la partition un pas à la fois, avec un peu d'avance sur l'horloge audio.
// Changement de morceau : fondu de sortie, puis le nouveau morceau entre en fondu sur un temps.

const mus = { multi: 0, score: 0, theme: null, scene: null, voulue: null, int: 1, final: false, tension: 0, fievre: false, mesure: 0, pas: 0, prochain: 0, notes: 0, bascule: 0, sortie: false, couches: null };
let minuterie = null;

function ordonnancer() {
  if (!ctx || ctx.state !== 'running' || !musiqueActive) return;
  const t = ctx.currentTime;
  // Onglet resté en arrière-plan : on repart du présent sans rattraper le retard.
  if (mus.prochain < t - 0.05) mus.prochain = t + 0.06;
  let garde = 0;
  while (mus.prochain < t + 0.16 && garde++ < 32) {
    if (mus.voulue !== mus.scene) {
      const info = mus.scene ? infoScene(mus.scene) : null;
      if (!info) {
        entrer(mus.prochain);
      } else if (!mus.sortie) {
        // On commence à s'effacer, le morceau continue pendant le fondu.
        mus.sortie = true;
        mus.bascule = mus.prochain + 0.7;
        G.fondu.gain.cancelScheduledValues(mus.prochain);
        G.fondu.gain.setTargetAtTime(0.0001, mus.prochain, 0.18);
      } else if (mus.prochain >= mus.bascule && mus.pas % info.pasParTemps === 0) {
        entrer(mus.prochain);
      }
    } else if (mus.sortie) {
      // On est revenu au morceau d'avant pendant le fondu : il remonte.
      mus.sortie = false;
      G.fondu.gain.cancelScheduledValues(mus.prochain);
      G.fondu.gain.setTargetAtTime(1, mus.prochain, 0.15);
    }
    if (!mus.scene) {
      mus.prochain = t + 0.2;
      return;
    }
    mus.notes += planifierPas(G, mus.scene, mus.mesure, mus.pas, mus.prochain, mus);
    mus.pas++;
    const info = infoScene(mus.scene);
    if (mus.pas >= info.pas) {
      mus.pas = 0;
      mus.mesure++;
    }
    mus.prochain += dureePas(mus.scene, { final: mus.final });
  }
}

// Chaque morceau se souvient d'où il en était : revenir à la table après la boutique reprend
// la section en cours (sans rejouer l'intro), pour que la longue forme se déroule vraiment.
const memoire = {};
function entrer(t) {
  if (mus.scene) memoire[mus.scene] = mus.mesure;
  mus.scene = mus.voulue;
  mus.mesure = mus.scene && memoire[mus.scene] !== undefined ? mesureReprise(mus.scene, memoire[mus.scene]) : 0;
  mus.pas = 0;
  mus.sortie = false;
  G.fondu.gain.cancelScheduledValues(t);
  G.fondu.gain.setValueAtTime(0.0001, t);
  G.fondu.gain.setTargetAtTime(1, t, 0.25);
  mus.cleCouleur = mus.scene + '|' + mus.int + '|' + mus.tension;
  if (mus.scene) couleur(G, infoScene(mus.scene), mus.tension, mus.int, t, 0.05);
  else G.niveauCraque.gain.setTargetAtTime(0, t, 0.3);
}

function lancerMinuterie() {
  if (!minuterie) minuterie = setInterval(ordonnancer, 40);
}

// Montée de bruit quand la tension passe au maximum (dernière main) : la salle retient son souffle.
function montee() {
  if (!G || muet || ctx.state !== 'running' || !musiqueActive) return;
  const c = ctx;
  const t0 = c.currentTime;
  const s = c.createBufferSource();
  s.buffer = G.bruit;
  s.loop = true;
  const bp = filtre(c, 'bandpass', 400, 2);
  bp.frequency.exponentialRampToValueAtTime(6000, t0 + 1.4);
  const a = c.createGain();
  a.gain.setValueAtTime(0.0001, t0);
  a.gain.exponentialRampToValueAtTime(0.06, t0 + 1.3);
  a.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.5);
  relier([s, bp, a], G.fondu);
  s.start(t0);
  s.stop(t0 + 1.6);
}

// Choisit le morceau (titre, manche, boutique, patron, salut, ou null pour le silence) et son intensité de 0 à 3.
// opts : { final, tension (0 à 1), fievre }.
export function reglerScene(scene, int = 1, opts = {}) {
  const avant = mus.int;
  mus.voulue = scene && infoScene(scene) ? scene : null;
  mus.int = Math.max(0, Math.min(3, int | 0));
  mus.final = !!opts.final;
  if (opts.tension !== undefined) mus.tension = Math.max(0, Math.min(1, Number(opts.tension) || 0));
  if (opts.fievre !== undefined) mus.fievre = !!opts.fievre || elan >= 2;
  if (opts.score !== undefined) mus.score = Math.max(0, Math.min(4, opts.score | 0));
  const cle = mus.scene + '|' + mus.int + '|' + mus.tension;
  if (G && mus.scene && mus.scene === mus.voulue && cle !== mus.cleCouleur) {
    mus.cleCouleur = cle;
    couleur(G, infoScene(mus.scene), mus.tension, mus.int, ctx.currentTime);
  }
  if (mus.int === 3 && avant < 3 && mus.scene === mus.voulue && mus.scene) montee();
}

// La troupe à l'orchestre (v4) : { couche: niveau } d'après les familles de jokers (voir partition.js).
// v5 : la musique monte avec le multiplicateur (niveau 0 à 4), et chaque patron a son thème.
export function reglerMulti(multi) {
  mus.multi = niveauMulti(multi);
}
export function reglerPatron(id) {
  if (!id) mus.theme = null;
  else if (!mus.theme || mus.theme.id !== id) mus.theme = themePatron(id);
}

export function reglerTroupe(couches) {
  mus.couches = couches && Object.keys(couches).length ? couches : null;
}

export function reglerMusique(v) {
  musiqueActive = !!v;
  appliquerVolumes();
  if (musiqueActive && ctx) lancerMinuterie();
  if (!musiqueActive && minuterie) {
    clearInterval(minuterie);
    minuterie = null;
  }
}

// Niveau de sortie instantané (crête de 0 à 1), pour vérifier que le son sort sans saturer.
export function niveauSon() {
  if (!sonde) return 0;
  const d = new Float32Array(sonde.fftSize);
  sonde.getFloatTimeDomainData(d);
  let max = 0;
  for (let i = 0; i < d.length; i++) max = Math.max(max, Math.abs(d[i]));
  return max;
}

// Pour les outils de vérification : où en est le son.
export function etatSon() {
  return { contexte: ctx ? ctx.state : 'absent', section: mus.scene ? (sectionA(mus.scene, mus.mesure) || {}).nom : null, scene: mus.scene, voulue: mus.voulue, int: mus.int, tension: mus.tension, fievre: mus.fievre, elan, mesure: mus.mesure, notes: mus.notes, couches: mus.couches ? Object.keys(mus.couches) : [], muet, musique: musiqueActive, volumes: Object.assign({}, vol) };
}

// Rend un morceau hors ligne (sans haut-parleur), pour les écoutes et les mesures des outils.
// Renvoie { gauche, droite, frequence, crete, rms } ; ne touche pas au son en direct.
export async function rendreMorceau(scene, o = {}) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const info = infoScene(scene);
  if (!OAC || !info) return null;
  const sr = o.frequence || 44100;
  const secondes = o.secondes || 20;
  const c = new OAC(2, Math.floor(sr * secondes), sr);
  const g = construireGraphe(c);
  g.maitre.gain.value = 0.9 * (o.general ?? 0.8);
  g.musique.gain.value = (o.musique ?? 0.5) * 0.8;
  const etats = { int: o.int ?? 1, final: !!o.final, fievre: !!o.fievre, seules: o.seules || null, couches: o.couches || null };
  couleur(g, info, o.tension || 0, etats.int, 0, 0.01);
  let t = 0.05;
  let mesure = o.debut || 0;
  let pas = 0;
  let notes = 0;
  const d = dureePas(scene, { final: etats.final });
  for (const st of o.stingers || []) notes += jouerStinger(g, st.sorte, st.a, st.bpm || 100);
  while (t < secondes - 0.5) {
    // Changements programmés : [{ a: secondes, int, tension, fievre }]
    for (const ch of o.changements || []) if (!ch.fait && t >= ch.a) {
      ch.fait = true;
      if (ch.int !== undefined) etats.int = ch.int;
      if (ch.fievre !== undefined) etats.fievre = ch.fievre;
      if (ch.couches !== undefined) etats.couches = ch.couches;
      couleur(g, info, ch.tension ?? 0, etats.int, t, 0.8);
    }
    notes += planifierPas(g, scene, mesure, pas, t, etats);
    pas++;
    if (pas >= info.pas) {
      pas = 0;
      mesure++;
    }
    t += d;
  }
  const b = await c.startRendering();
  const gauche = b.getChannelData(0);
  const droite = b.getChannelData(1);
  let crete = 0;
  let somme = 0;
  for (let i = 0; i < gauche.length; i++) {
    const v = Math.max(Math.abs(gauche[i]), Math.abs(droite[i]));
    if (v > crete) crete = v;
    somme += gauche[i] * gauche[i];
  }
  return { gauche, droite, frequence: sr, crete, rms: Math.sqrt(somme / gauche.length), notes };
}

// Les stingers sont aussi accessibles depuis l'objet des effets.
son.stinger = stinger;

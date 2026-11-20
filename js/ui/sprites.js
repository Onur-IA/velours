// Sprites de Velours : cartes, jokers, consommables, paquets, patrons. Tout est mis en cache.

import { C, COUL_ENS, COUL_ENS_CLAIR, COUL_RARETE, TEINTES, toile, rect, ell, tri, ligne, rrect, motif, hachage, melange, PIPS7, PIPS5, grandeEnseigne, ICONES, louis } from './dessin.js';
import { texte, largeurTexte } from './police.js';
import { lettreRang } from '../noyau/donnees.js';
import { JOKER, descDef } from '../noyau/jokers.js';
import { CONSO } from '../noyau/consommables.js';
import { MAINS } from '../noyau/donnees.js';

export const LC = 48;
export const HC = 66;
const cache = new Map();
// v5 : direction art déco (dorures, coins à gradins, dos en éventail). Réglable dans les options.
export const STYLE = { deco: true };
export function reglerDeco(v) {
  STYLE.deco = v !== false;
}
function memo(cle, fabrique) {
  if (STYLE.deco) cle = 'd|' + cle;
  let s = cache.get(cle);
  if (!s) {
    s = fabrique();
    cache.set(cle, s);
  }
  return s;
}

// ------------------------------------------------------------ Portraits

const FONDS = [
  ['#2a6fd6', '#1d55ad'], ['#8f1d2f', '#6b1123'], ['#2e9e5b', '#1f7a44'], ['#7a3fc0', '#5a2a98'], ['#e8792b', '#c05c18'],
  ['#2aa7a8', '#1b7f84'], ['#e0aa2a', '#b77d1a'], ['#55526b', '#3d3b52'], ['#f08bb4', '#c9648f'], ['#25244d', '#17162f'],
];
const PEAUX = { ivoire: ['#f3e9d2', '#d2c3a0'], peche: ['#f2c9a0', '#cf9d72'], brun: ['#b97a56', '#8f5a3c'], blanc: ['#ffffff', '#cfd3e6'], vert: ['#9ccf7a', '#6fa052'], bleu: ['#9fc4f0', '#6f95c8'], gris: ['#bdb9c9', '#8a879c'], rose: ['#f6c1cf', '#d993a8'] };
const CHAPEAUX = ['grelots', 'trois', 'haut', 'melon', 'beret', 'plume', 'chignon', 'cheveux', 'tricorne', 'fez', 'bandeau', 'capuche'];
const YEUX = ['points', 'ronds', 'fermes', 'loup', 'monocle', 'larme', 'lunettes', 'points', 'ronds'];
const BOUCHES = ['sourire', 'rire', 'plat', 'o', 'moue', 'moustache', 'rouge', 'sourire'];
const MOTIFS = ['rayures', 'losanges', 'pois', 'rayons', 'damier', 'uni'];
const COLS = ['fraise', 'noeud', 'revers', 'fraise'];
const TISSUS = ['#e0343c', '#2a6fd6', '#2e9e5b', '#e0aa2a', '#7a3fc0', '#e8792b', '#1c2340', '#f3e9d2', '#2aa7a8', '#f08bb4'];

function demiEll(g, cx, cy, rx, ry, c) {
  g.fillStyle = c;
  cx = Math.round(cx);
  cy = Math.round(cy);
  const n = Math.floor(ry);
  for (let y = -n; y <= 0; y++) {
    const d = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))) + 0.5);
    g.fillRect(cx - d, cy + y, 2 * d + 1, 1);
  }
}

export function portrait(g, x0, y0, w, h, p) {
  const u = w / 40;
  const s = Math.max(1, Math.round(u));
  const cx = x0 + Math.floor(w / 2);
  const cy = y0 + Math.round(h * 0.54);
  const peau = PEAUX[p.peau] || PEAUX.ivoire;
  g.save();
  g.beginPath();
  g.rect(x0, y0, w, h);
  g.clip();
  rect(g, x0, y0, w, h, p.fond);
  const f2 = p.fond2;
  if (p.motif === 'rayures') for (let i = -h; i < w; i += Math.round(8 * u)) for (let k = 0; k < h; k++) rect(g, x0 + i + k, y0 + k, Math.round(4 * u), 1, f2);
  else if (p.motif === 'losanges') {
    const t = Math.round(5 * u);
    for (let j = 0; j * t < h + t; j++) for (let i = 0; i * 2 * t < w + 2 * t; i++) {
      const lx = x0 + i * 2 * t + (j % 2 ? t : 0);
      const ly = y0 + j * t;
      for (let k = -t + 1; k < t; k++) rect(g, lx - (t - 1 - Math.abs(k)), ly + k, 2 * (t - 1 - Math.abs(k)) + 1, 1, f2);
    }
  } else if (p.motif === 'pois') {
    for (let j = 0; j * 7 * u < h + 4; j++) for (let i = 0; i * 7 * u < w + 4; i++) ell(g, x0 + i * 7 * u + (j % 2 ? 3.5 * u : 0), y0 + j * 7 * u, 1.4 * u, 1.4 * u, f2);
  } else if (p.motif === 'rayons') {
    for (let a = 0; a < 12; a += 2) {
      const a1 = (a / 12) * Math.PI * 2;
      const a2 = ((a + 1) / 12) * Math.PI * 2;
      tri(g, cx, cy, cx + Math.cos(a1) * w, cy + Math.sin(a1) * w, cx + Math.cos(a2) * w, cy + Math.sin(a2) * w, f2);
    }
  } else if (p.motif === 'damier') {
    const t = Math.round(6 * u);
    for (let j = 0; j * t < h; j++) for (let i = 0; i * t < w; i++) if ((i + j) % 2) rect(g, x0 + i * t, y0 + j * t, t, t, f2);
  }
  const c1 = p.c1;
  const c2 = p.c2;
  // Derrière la tête.
  if (p.chapeau === 'capuche') {
    ell(g, cx, cy - 1 * u, 13.5 * u, 14.5 * u, c1);
    tri(g, cx - 5 * u, cy - 13 * u, cx + 6 * u, cy - 13 * u, cx + 3 * u, cy - 20 * u, c1);
  }
  if (p.chapeau === 'chignon' || p.chapeau === 'cheveux') ell(g, cx, cy + 1 * u, 12 * u, 13 * u, c1);
  // Buste et col.
  ell(g, cx, y0 + h + 5 * u, 18 * u, 13 * u, p.habit);
  ell(g, cx, y0 + h + 7 * u, 14 * u, 11 * u, melange(p.habit, '#000000', 0.18));
  rect(g, cx - 3 * u, cy + 8 * u, 6 * u + 1, 5 * u, peau[1]);
  if (p.col === 'fraise') {
    for (let k = -3; k <= 3; k++) ell(g, cx + k * 3.6 * u, cy + 12.5 * u + Math.abs(k) * 0.4 * u, 2.4 * u, 2 * u, k % 2 ? C.gris3 : C.blanc);
  } else if (p.col === 'noeud') {
    tri(g, cx - 6 * u, cy + 10 * u, cx - 6 * u, cy + 16 * u, cx, cy + 13 * u, c2);
    tri(g, cx + 6 * u, cy + 10 * u, cx + 6 * u, cy + 16 * u, cx, cy + 13 * u, c2);
    rect(g, cx - s, cy + 12 * u, 2 * s + 1, 2 * u, melange(c2, '#000000', 0.3));
  } else {
    tri(g, cx - 9 * u, cy + 11 * u, cx, cy + 19 * u, cx - 2 * u, cy + 11 * u, C.blanc);
    tri(g, cx + 9 * u, cy + 11 * u, cx, cy + 19 * u, cx + 2 * u, cy + 11 * u, C.blanc);
  }
  // Tête.
  ell(g, cx, cy, 10 * u, 11 * u, peau[1]);
  ell(g, cx - 1.2 * u, cy - 0.6 * u, 8.8 * u, 10.2 * u, peau[0]);
  if (p.joues) {
    rect(g, cx - 8 * u, cy + 2 * u, 2 * s, 2 * s, C.rose1);
    rect(g, cx + 6 * u, cy + 2 * u, 2 * s, 2 * s, C.rose1);
  }
  rect(g, cx, cy + 1 * u, s, 2 * u, peau[1]);
  // Yeux.
  const ey = cy - 1 * u;
  const exg = cx - 4 * u;
  const exd = cx + 4 * u;
  const oeil = (ex) => rect(g, ex - s, ey - s, 2 * s, 2 * s, C.noir);
  const y = p.yeux;
  if (y === 'ronds') {
    for (const ex of [exg, exd]) {
      ell(g, ex, ey, 2.3 * u, 2.3 * u, C.blanc);
      rect(g, ex - s + (p.regard || 0), ey - s + 1, 2 * s, 2 * s, C.noir);
    }
  } else if (y === 'fermes') {
    for (const ex of [exg, exd]) {
      rect(g, ex - 2 * u, ey, 4 * u + 1, s, C.noir);
      rect(g, ex - 2 * u, ey - s, s, s, C.noir);
      rect(g, ex + 2 * u, ey - s, s, s, C.noir);
    }
  } else if (y === 'loup') {
    rrect(g, cx - 9 * u, ey - 3 * u, Math.round(18 * u) + 1, Math.round(6 * u), p.masque || C.noir, s);
    for (const ex of [exg, exd]) rect(g, ex - 1.5 * u, ey - s, 3 * u + 1, 2 * s, C.blanc);
  } else if (y === 'monocle') {
    oeil(exg);
    ell(g, exd, ey, 3.4 * u, 3.4 * u, C.or2);
    ell(g, exd, ey, 2.4 * u, 2.4 * u, '#dff6f5');
    oeil(exd);
    ligne(g, exd + 3 * u, ey + 2 * u, exd + 5 * u, ey + 9 * u, C.or2, s);
  } else if (y === 'larme') {
    oeil(exg);
    oeil(exd);
    rect(g, exg - s, ey + 2 * u, s, 3 * u, C.bleu2);
    tri(g, exg - 2 * u, ey - 4 * u, exg + 2 * u, ey - 4 * u, exg, ey - 6 * u, C.noir);
  } else if (y === 'lunettes') {
    for (const ex of [exg, exd]) {
      rrect(g, ex - 3 * u, ey - 2 * u, Math.round(6 * u) + 1, Math.round(4 * u) + 1, C.noir, s);
      rect(g, ex - 2 * u, ey - 1 * u, s, s, C.gris3);
    }
    rect(g, exg + 3 * u, ey - s, 2 * u, s, C.noir);
  } else if (y === 'croix') {
    for (const ex of [exg, exd]) {
      ligne(g, ex - 2 * u, ey - 2 * u, ex + 2 * u, ey + 2 * u, C.noir, s);
      ligne(g, ex + 2 * u, ey - 2 * u, ex - 2 * u, ey + 2 * u, C.noir, s);
    }
  } else if (y === 'colere') {
    for (const [ex, sens] of [[exg, 1], [exd, -1]]) {
      ell(g, ex, ey + s, 2.2 * u, 1.8 * u, p.lueur || C.or3);
      rect(g, ex - s + 1, ey, s, 2 * s, C.noir);
      ligne(g, ex - 3 * u * sens, ey - 4 * u, ex + 3 * u * sens, ey - 2 * u, C.noir, s + (u > 1.5 ? 1 : 0));
    }
  } else {
    oeil(exg);
    oeil(exd);
  }
  // Bouche.
  const my = cy + 5 * u;
  const b = p.bouche;
  if (b === 'rire') {
    rrect(g, cx - 3.5 * u, my - 1 * u, Math.round(7 * u) + 1, Math.round(3.4 * u), C.noir, s);
    rect(g, cx - 2.5 * u, my - 1 * u, 5 * u + 1, s, C.blanc);
  } else if (b === 'plat') rect(g, cx - 2 * u, my, 4 * u + 1, s, C.noir);
  else if (b === 'o') ell(g, cx, my + s, 1.6 * u, 1.8 * u, C.noir);
  else if (b === 'moue') {
    rect(g, cx - 3 * u, my, 6 * u + 1, s, C.noir);
    rect(g, cx - 4 * u, my + s, s, s, C.noir);
    rect(g, cx + 4 * u - s + 1, my + s, s, s, C.noir);
  } else if (b === 'moustache') {
    ell(g, cx - 3 * u, my - 1 * u, 3.2 * u, 1.4 * u, p.poil || C.noir);
    ell(g, cx + 3 * u, my - 1 * u, 3.2 * u, 1.4 * u, p.poil || C.noir);
    rect(g, cx - 1 * u, my + 1.5 * u, 2 * u + 1, s, C.noir);
  } else if (b === 'rouge') {
    rect(g, cx - 2 * u, my, 4 * u + 1, s, C.rouge1);
    rect(g, cx - 1 * u, my + s, 2 * u + 1, s, C.rouge1);
  } else {
    rect(g, cx - 3 * u, my, 6 * u + 1, s, C.noir);
    rect(g, cx - 4 * u, my - s, s, s, C.noir);
    rect(g, cx + 4 * u - s + 1, my - s, s, s, C.noir);
  }
  // Chapeau.
  const ch = p.chapeau;
  const grelot = (x, yy) => {
    ell(g, x, yy, 2 * u, 2 * u, C.or2);
    rect(g, x - s, yy - s, s, s, C.or3);
  };
  if (ch === 'grelots' || ch === 'trois') {
    tri(g, cx - 10 * u, cy - 5 * u, cx, cy - 11 * u, cx - 16 * u, cy - 17 * u, c1);
    tri(g, cx + 10 * u, cy - 5 * u, cx, cy - 11 * u, cx + 16 * u, cy - 17 * u, c2);
    if (ch === 'trois') {
      tri(g, cx - 5 * u, cy - 9 * u, cx + 5 * u, cy - 9 * u, cx, cy - 21 * u, C.or2);
      grelot(cx, cy - 21 * u);
    }
    demiEll(g, cx, cy - 6 * u, 10 * u, 5.5 * u, c1);
    g.save();
    g.beginPath();
    g.rect(cx, y0, w, h);
    g.clip();
    demiEll(g, cx, cy - 6 * u, 10 * u, 5.5 * u, c2);
    g.restore();
    grelot(cx - 16 * u, cy - 17 * u);
    grelot(cx + 16 * u, cy - 17 * u);
  } else if (ch === 'haut') {
    rect(g, cx - 7 * u, cy - 21 * u, 14 * u + 1, 13 * u, c1);
    rect(g, cx - 7 * u, cy - 11 * u, 14 * u + 1, 2 * u, c2);
    rect(g, cx - 12 * u, cy - 9 * u, 24 * u + 1, 2 * u, c1);
    rect(g, cx - 6 * u, cy - 20 * u, s, 8 * u, melange(c1, '#ffffff', 0.25));
  } else if (ch === 'melon') {
    demiEll(g, cx, cy - 8 * u, 9 * u, 9 * u, c1);
    rect(g, cx - 9 * u, cy - 10 * u, 18 * u + 1, 2 * u, c2);
    rect(g, cx - 13 * u, cy - 8 * u, 26 * u + 1, 2 * u, c1);
  } else if (ch === 'beret') {
    demiEll(g, cx - 2 * u, cy - 7 * u, 13 * u, 7 * u, c1);
    rect(g, cx - 9 * u, cy - 8 * u, 18 * u + 1, 2 * u, melange(c1, '#000000', 0.3));
    rect(g, cx - 2 * u, cy - 16 * u, s, 2 * u, c1);
  } else if (ch === 'couronne') {
    rect(g, cx - 9 * u, cy - 12 * u, 18 * u + 1, 4 * u, C.or2);
    for (const k of [-6, 0, 6]) tri(g, cx + (k - 3) * u, cy - 12 * u, cx + (k + 3) * u, cy - 12 * u, cx + k * u, cy - 19 * u, C.or2);
    rect(g, cx - 9 * u, cy - 9 * u, 18 * u + 1, s, C.or0);
    rect(g, cx - s, cy - 11 * u, 2 * s, 2 * s, c1);
    rect(g, cx - 6 * u, cy - 11 * u, 2 * s, 2 * s, c2);
    rect(g, cx + 5 * u, cy - 11 * u, 2 * s, 2 * s, c2);
    rect(g, cx - s, cy - 19 * u, s, s, C.or3);
  } else if (ch === 'capuche') {
    demiEll(g, cx, cy - 7 * u, 10.5 * u, 6 * u, melange(c1, '#000000', 0.3));
  } else if (ch === 'plume') {
    demiEll(g, cx, cy - 7 * u, 10.5 * u, 6 * u, c1);
    rect(g, cx - 12 * u, cy - 8 * u, 24 * u + 1, 2 * u, c1);
    for (let k = 0; k < 12; k++) {
      const t = k / 11;
      ell(g, cx + (5 + 9 * t) * u, cy - (10 + 12 * t - 4 * t * t) * u, (2.6 - 1.6 * t) * u, (2.6 - 1.6 * t) * u, k % 3 === 0 ? melange(c2, '#ffffff', 0.4) : c2);
    }
  } else if (ch === 'chignon') {
    demiEll(g, cx, cy - 5 * u, 10.5 * u, 7 * u, c1);
    ell(g, cx, cy - 15 * u, 4.5 * u, 4.5 * u, c1);
    rect(g, cx - 3 * u, cy - 16 * u, 2 * s, s, melange(c1, '#ffffff', 0.35));
    rect(g, cx - 4 * u, cy - 12 * u, 8 * u + 1, s, c2);
  } else if (ch === 'cheveux') {
    demiEll(g, cx, cy - 5 * u, 10.5 * u, 7.5 * u, c1);
    tri(g, cx - 10 * u, cy - 6 * u, cx - 3 * u, cy - 6 * u, cx - 9 * u, cy - 1 * u, c1);
    rect(g, cx - 4 * u, cy - 11 * u, 3 * u, s, melange(c1, '#ffffff', 0.3));
  } else if (ch === 'tricorne') {
    tri(g, cx - 16 * u, cy - 7 * u, cx + 16 * u, cy - 7 * u, cx, cy - 20 * u, c1);
    ligne(g, cx - 15 * u, cy - 8 * u, cx + 15 * u, cy - 8 * u, C.or2, s);
    rect(g, cx - s, cy - 14 * u, 2 * s + 1, 2 * s + 1, c2);
  } else if (ch === 'fez') {
    tri(g, cx - 7 * u, cy - 9 * u, cx - 5 * u, cy - 19 * u, cx + 7 * u, cy - 9 * u, c1);
    tri(g, cx + 5 * u, cy - 19 * u, cx - 5 * u, cy - 19 * u, cx + 7 * u, cy - 9 * u, c1);
    ligne(g, cx, cy - 19 * u, cx + 8 * u, cy - 14 * u, C.or2, s);
    rect(g, cx + 7 * u, cy - 14 * u, 2 * s, 3 * u, C.or2);
  } else if (ch === 'bandeau') {
    demiEll(g, cx, cy - 5 * u, 10.5 * u, 6.5 * u, c2);
    rect(g, cx - 10 * u, cy - 8 * u, 20 * u + 1, 3 * u, c1);
    tri(g, cx + 9 * u, cy - 7 * u, cx + 15 * u, cy - 10 * u, cx + 14 * u, cy - 3 * u, c1);
  } else if (ch === 'cornes') {
    tri(g, cx - 10 * u, cy - 5 * u, cx - 4 * u, cy - 10 * u, cx - 14 * u, cy - 20 * u, C.creme);
    tri(g, cx + 10 * u, cy - 5 * u, cx + 4 * u, cy - 10 * u, cx + 14 * u, cy - 20 * u, C.creme);
    tri(g, cx - 12 * u, cy - 13 * u, cx - 10 * u, cy - 14 * u, cx - 14 * u, cy - 20 * u, C.creme3);
    tri(g, cx + 12 * u, cy - 13 * u, cx + 10 * u, cy - 14 * u, cx + 14 * u, cy - 20 * u, C.creme3);
    demiEll(g, cx, cy - 6 * u, 10 * u, 5 * u, c1);
  }
  g.restore();
}

// Tenues imposées pour les figures marquantes : chapeau yeux bouche [clef:valeur...]
const TENUES = {
  figurant: 'melon points plat', videur: 'cheveux lunettes plat col:revers', duo: 'grelots points sourire', trio: 'trois ronds rire',
  escaladeuse: 'bandeau points sourire', teinturier: 'beret points sourire', siamois: 'grelots fermes sourire', geometre: 'cheveux lunettes plat',
  tisserand: 'chignon fermes sourire', fossoyeur: 'capuche points moue fond:9 peau:gris', entremetteuse: 'chignon ronds rouge joues:1 fond:8',
  preteur: 'haut monocle moustache fond:6', jardinier: 'beret points sourire fond:2 joues:1', cour: 'couronne points sourire', personnel: 'bandeau points sourire joues:1',
  mathematicien: 'chignon lunettes plat', croupier: 'cheveux points sourire col:noeud fond:2', as_manche: 'haut loup sourire', souffleur: 'beret ronds o',
  chiffonnier: 'bandeau points moue', rentier: 'haut monocle sourire fond:6', grippe_sou: 'melon fermes moue', brocanteur: 'tricorne points sourire',
  fauche: 'cheveux larme moue', girouette: 'plume ronds o', bonimenteur: 'haut ronds rire', receleur: 'capuche loup sourire', bluffeur: 'cheveux lunettes sourire col:noeud',
  longue_vue: 'tricorne monocle plat fond:0', chandelle: 'chignon fermes o fond:4', arlequin: 'grelots loup sourire motif:losanges', nuit_noire: 'capuche fermes plat fond:9',
  sang_bleu: 'couronne fermes moue peau:bleu', portraitiste: 'beret monocle moustache', bal_masque: 'plume loup rouge', miroir_loge: 'chignon ronds rouge joues:1',
  ventriloque: 'haut ronds o', vigneron: 'beret points moustache fond:3', astrologue: 'fez fermes moustache fond:9', ogre: 'cornes ronds rire peau:vert',
  cannibale: 'cheveux croix rire', faux_monnayeur: 'melon loup sourire', coffre_fort: 'haut lunettes plat fond:7', stoique: 'bandeau fermes plat peau:gris',
  tricheur: 'melon loup sourire col:noeud', boiteux: 'tricorne larme plat', forgeron: 'bandeau points moustache peau:brun fond:4', orpailleur: 'tricorne points moustache fond:6',
  de_pipe: 'fez ronds rire', alchimiste: 'capuche monocle plat fond:3', puriste: 'chignon fermes plat peau:blanc', avocat: 'cheveux lunettes plat col:revers fond:7',
  voyante: 'capuche ronds sourire fond:3 joues:1', souvenir: 'bandeau larme plat peau:blanc fond:9', crescendo: 'cheveux fermes o col:noeud', flambeur: 'haut lunettes rire fond:1 col:noeud',
  poete: 'beret fermes sourire fond:9 col:fraise', palindrome: 'grelots ronds o motif:damier', compte_bon: 'cheveux points sourire col:noeud fond:2', marionnettiste: 'chignon loup sourire',
  philateliste: 'chignon lunettes sourire fond:5', equilibriste: 'bandeau fermes sourire motif:rayures', provocateur: 'cornes colere rire peau:rose fond:1', commanditaire: 'haut monocle plat fond:7',
  perroquet: 'plume ronds o peau:vert fond:4', echo: 'capuche fermes o peau:bleu', doublure: 'grelots loup plat peau:blanc', passe_muraille: 'capuche points sourire peau:bleu fond:9',
  contorsionniste: 'bandeau croix sourire', diva: 'chignon fermes rouge joues:1 fond:1', tandem: 'trois points rire', funambule: 'bandeau ronds sourire motif:rayons',
  madame_velours: 'couronne fermes rouge joues:1 fond:1 motif:losanges col:fraise', chef_orchestre: 'cheveux fermes moustache col:noeud fond:9 motif:rayons',
  reine_mere: 'couronne ronds rouge peau:blanc fond:3 motif:losanges col:fraise', faiseur_ombres: 'capuche loup plat fond:9 peau:gris motif:rayons',
  eternel_second: 'trois larme moue peau:blanc fond:7 motif:damier',
  // v7 : chaque joker a maintenant sa tenue choisie, plus aucun visage tiré au hasard.
  suite_idees: 'beret lunettes sourire fond:0 motif:rayures', bourse: 'melon points sourire fond:6 col:noeud', bas_laine: 'capuche fermes sourire fond:4 joues:1 peau:peche',
  dime: 'haut monocle plat fond:6 col:revers', ouverture: 'haut ronds rire fond:1 col:noeud motif:rayons', minimaliste: 'cheveux points plat fond:7 motif:uni',
  archiviste: 'chignon lunettes plat fond:7 col:revers', lesteur: 'bandeau points moustache peau:brun fond:0', ovation: 'plume ronds rire fond:1 motif:rayons joues:1',
  balayeur: 'melon fermes plat fond:9 peau:gris', veilleur: 'capuche ronds o fond:9 motif:pois', placier: 'haut points sourire col:noeud fond:1',
  testament: 'capuche fermes plat peau:gris fond:9 col:fraise', daltonien: 'beret croix sourire motif:damier fond:5', salon_prive: 'chignon loup rouge joues:1 fond:8 col:fraise',
  rappel: 'plume ronds o fond:1 motif:rayons', echo_balcon: 'beret ronds o fond:3 motif:rayures', bis: 'grelots ronds rire fond:1 motif:losanges',
  brise_glace: 'bandeau ronds rire peau:bleu fond:5', fripier: 'melon larme sourire fond:4 motif:pois', pique_assiette: 'cheveux ronds rire fond:2 col:noeud joues:1',
  coup_eclat: 'haut ronds rire fond:6 motif:rayons', mecene: 'couronne monocle moustache fond:6 col:fraise', manches_longues: 'haut loup sourire fond:9 col:revers',
  poubelle_doree: 'tricorne points rire fond:6 peau:brun', dernier_verre: 'melon fermes moue fond:1 joues:1 col:noeud', souffleur_verre: 'bandeau ronds o fond:5 peau:peche',
  cirier: 'capuche points plat fond:4 col:revers', enlumineur: 'capuche lunettes sourire fond:6 motif:losanges', dresseur: 'haut colere moustache fond:1 col:revers',
  dernier_souffle: 'capuche larme o peau:blanc fond:9', salle_vide: 'cheveux fermes plat fond:7 motif:uni peau:gris', derniere_chance: 'bandeau colere plat fond:1',
  rebouteux: 'beret points moustache peau:brun fond:2', exces_zele: 'cheveux ronds rire fond:4 motif:rayons col:noeud', famille: 'trois points rire fond:6 motif:pois joues:1',
  trepied: 'trois fermes sourire fond:0 motif:rayures', monochrome: 'chignon fermes plat fond:9 peau:blanc motif:uni', claque: 'grelots ronds rire fond:1 joues:1',
  chauffeur: 'beret colere rire fond:4 col:noeud', ouvreuse: 'chignon points sourire fond:1 col:revers joues:1', cabotine: 'plume fermes rouge joues:1 fond:8 col:fraise',
  critique: 'cheveux monocle moue fond:7 col:noeud', bouquet: 'plume points sourire fond:8 motif:pois joues:1', maestro: 'cheveux fermes moustache fond:9 col:noeud motif:rayons',
  metronome: 'haut points plat fond:7 motif:rayures', montee_marches: 'tricorne points sourire fond:6 motif:rayures', souffleuse: 'chignon ronds o fond:3 joues:1',
  point_orgue: 'cheveux fermes o fond:9 col:fraise motif:rayons', ec_resonance: 'capuche fermes o peau:bleu fond:0 motif:rayures', ec_reverb: 'capuche ronds o peau:bleu fond:3',
  ec_cascade: 'bandeau fermes sourire peau:bleu fond:5 motif:rayures', ec_canon: 'haut fermes o peau:bleu fond:9 col:fraise motif:rayons', po_bourgeon: 'plume points sourire peau:vert fond:2 joues:1',
  po_lierre: 'capuche fermes sourire peau:vert fond:2 motif:losanges', po_chene: 'couronne fermes moustache peau:brun fond:2 motif:rayures', po_orchidee: 'chignon fermes rouge peau:rose fond:3 joues:1',
  mo_pacte: 'cornes loup sourire fond:1 peau:gris', mo_voile: 'capuche loup plat fond:9 peau:blanc', mo_clepsydre: 'capuche larme plat fond:6 peau:gris',
  mo_masque: 'cornes colere plat fond:9 peau:gris motif:damier', du_cour: 'beret points sourire fond:1 col:noeud', du_jardin: 'beret points sourire fond:2 col:noeud',
  du_violon: 'cheveux fermes moustache fond:1 col:fraise', du_muse: 'chignon fermes sourire fond:8 joues:1 motif:pois', sy_roi: 'couronne points moustache fond:1 col:fraise',
  sy_reine: 'couronne fermes rouge joues:1 fond:3 col:fraise', sy_valet: 'plume points sourire fond:0 col:revers', sy_contrebasse: 'cheveux fermes moustache peau:brun fond:4 col:noeud',
  sy_ermite: 'capuche fermes plat fond:9 peau:gris', sy_moine: 'capuche fermes sourire fond:4', sy_pickpocket: 'melon loup sourire fond:7',
  sy_faussaire: 'beret monocle sourire fond:6', sy_reflet: 'chignon ronds plat peau:blanc fond:5 motif:damier', sy_fleuriste: 'plume points sourire fond:8 joues:1 motif:pois',
};

// v7 : l'emblème de famille, en haut à droite du portrait.
const EMBLEMES = {
  economie: ['.###.', '#.#.#', '#.##.', '#.#.#', '.###.'], crescendo: ['..##.', '..#.#', '..#..', '###..', '##...'],
  public: ['#.#.#', '.###.', '#####', '.###.', '#.#.#'], pousses: ['...##', '..###', '.##..', '#.#..', '..#..'],
  maudits: ['.###.', '#.#.#', '#####', '.###.', '.#.#.'], echos: ['#.#.#', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
  duos: ['##.##', '##.##', '.#.#.', '..#..', '.....'], rejoue: ['.###.', '#...#', '#.#.#', '...##', '.###.'],
  rangs: ['#.#.#', '#####', '#####', '.....', '#####'], enseignes: ['..#..', '.###.', '#####', '..#..', '.###.'],
  matieres: ['.###.', '#####', '.###.', '..#..', '.....'], regles: ['####.', '#..#.', '####.', '#..#.', '#####'],
  risque: ['..#..', '.##..', '.###.', '#####', '.###.'], croissance: ['..#..', '.###.', '#.#.#', '..#..', '..#..'],
  patron: ['#####', '#...#', '#.#.#', '.#.#.', '..#..'], base: ['..#..', '..#..', '#####', '..#..', '..#..'], hasard: ['#####', '#...#', '#.#.#', '#...#', '#####'], copie: ['###..', '#.###', '###.#', '..#.#', '..###'],
};

function specDepuis(id, base = {}) {
  const h = hachage('v' + id);
  const pick = (t, d) => t[(h >>> d) % t.length];
  const fond = pick(FONDS, 3);
  const p = {
    fond: fond[0], fond2: fond[1],
    motif: pick(MOTIFS, 7), peau: pick(['ivoire', 'peche', 'ivoire', 'brun', 'peche', 'ivoire'], 11),
    chapeau: pick(CHAPEAUX, 5), yeux: pick(YEUX, 14), bouche: pick(BOUCHES, 17),
    c1: pick(TISSUS, 20), c2: pick(TISSUS, 23), habit: pick(TISSUS, 26), col: pick(COLS, 9), joues: (h >>> 29) % 3 === 0,
  };
  if (p.c1 === p.fond) p.c1 = C.creme;
  if (p.c2 === p.c1) p.c2 = C.or2;
  if (p.habit === p.fond) p.habit = C.encre;
  const t = TENUES[id];
  if (t) {
    const mots = t.split(' ');
    p.chapeau = mots[0];
    p.yeux = mots[1];
    p.bouche = mots[2];
    for (const m of mots.slice(3)) {
      const [k, v] = m.split(':');
      if (k === 'fond') {
        p.fond = FONDS[Number(v)][0];
        p.fond2 = FONDS[Number(v)][1];
      } else if (k === 'joues') p.joues = true;
      else p[k] = v;
    }
    if (p.c1 === p.fond) p.c1 = C.creme;
    if (p.habit === p.fond) p.habit = C.encre;
  }
  if (p.chapeau === 'chignon' || p.chapeau === 'cheveux') p.c1 = ['#3a2114', '#1c2340', '#b77d1a', '#8a1622', '#bdb9c9', '#e8792b'][(h >>> 2) % 6];
  return Object.assign(p, base);
}

// ---------------------------------------------------------------- Jokers

export function typeEffet(def) {
  const d = descDef(def);
  if (d.includes('{x|')) return 'x';
  if (d.includes('{m|')) return 'm';
  if (d.includes('{j|')) return 'j';
  if (d.includes('{l|')) return 'l';
  return 'o';
}

function pastille(g, x, y, type) {
  const coul = { x: [C.or2, C.rouge0], m: [C.rouge1, C.blanc], j: [C.bleu1, C.blanc], l: [C.or2, C.or0], o: [C.gris2, C.nuit] }[type];
  rrect(g, x, y, 11, 9, C.noir, 1);
  rrect(g, x + 1, y + 1, 9, 7, coul[0], 1);
  const signe = { x: ['#.#', '.#.', '#.#'], m: ['.#.', '###', '.#.'], j: ['.#.', '###', '.#.'], l: ['.#.', '.#.', '.##'], o: ['#.#', '.#.', '#.#'] }[type];
  if (type === 'o') motif(g, ['.#.', '###', '.#.'], x + 4, y + 3, coul[1]);
  else motif(g, signe, x + 4, y + 3, coul[1]);
}

export function spriteJoker(id) {
  return memo('j:' + id, () => {
    const def = JOKER[id];
    const [cv, g] = toile(LC, HC);
    const r = COUL_RARETE[def ? def.r : 'C'];
    rrect(g, 0, 0, LC, HC, C.noir, 3);
    rrect(g, 1, 1, LC - 2, HC - 2, r[0], 2);
    rect(g, 3, 1, LC - 6, 1, r[1]);
    rect(g, 1, 3, 1, HC - 6, r[1]);
    rect(g, 3, HC - 2, LC - 6, 1, r[2]);
    rect(g, LC - 2, 3, 1, HC - 6, r[2]);
    rect(g, 3, 3, LC - 6, 46, C.noir);
    portrait(g, 4, 4, LC - 8, 44, specDepuis(id));
    const emb = def && EMBLEMES[def.fam];
    if (emb) {
      rrect(g, LC - 12, 5, 8, 8, C.noir, 1);
      rrect(g, LC - 11, 6, 6, 6, r[2], 1);
      motif(g, emb, LC - 11, 6, r[1]);
    }
    // Bandeau du bas : pastille d'effet et gemmes de rareté.
    rect(g, 3, 51, LC - 6, 12, r[2]);
    rect(g, 3, 51, LC - 6, 1, C.noir);
    pastille(g, 5, 53, def ? typeEffet(def) : 'o');
    const n = { C: 1, U: 2, R: 3, E: 4, L: 5 }[def ? def.r : 'C'];
    for (let i = 0; i < n; i++) {
      if (n >= 4) {
        // Épique et légendaire : gemmes plus serrées.
        const gx = LC - 8 - i * 4;
        motif(g, ['.#.', '###', '###', '.#.'], gx - 1, 55, C.noir);
        rect(g, gx, 56, 1, 2, def.r === 'L' ? C.or3 : r[1]);
        continue;
      }
      const gx = LC - 9 - i * 6;
      motif(g, ['.#.', '###', '###', '.#.'], gx, 55, C.noir);
      motif(g, ['#', '#'], gx + 1, 56, r[1]);
    }
    if (def && def.r === 'L') {
      for (let i = 0; i < 4; i++) rect(g, [2, LC - 4, 2, LC - 4][i], [2, 2, HC - 4, HC - 4][i], 2, 2, C.or3);
    }
    if (STYLE.deco && def && (def.r === 'R' || def.r === 'E' || def.r === 'L')) cadreDeco(g, LC, HC, C.or2, C.or3, 1);
    if (def && def.sig) {
      // Petit V de velours pour les signatures.
      motif(g, ['#...#', '#...#', '.#.#.', '.#.#.', '..#..'], 18, 55, C.or3);
    }
    return cv;
  });
}

// ---------------------------------------------------------------- Cartes

const FONDS_CARTE = {
  aucun: [C.creme, C.creme2], lestee: ['#d6e4f8', '#a9c3ea'], ardente: ['#fbdfd0', '#f0b69c'], cameleon: [C.creme, C.creme2],
  cristal: ['#e2f8f6', '#b2e4e2'], enclume: ['#cbc8d6', '#9a97ad'], doree: ['#fbe38c', '#e0aa2a'], veinarde: ['#d9f0d3', '#a8d9a4'],
};
const CADRES = { lestee: C.bleu1, ardente: C.rouge1, cristal: C.cyan1, enclume: C.gris1, doree: C.or1, veinarde: C.vert1 };
const MINI = {
  lestee: [['#####', '##.##', '#...#', '##.##', '#####'], C.bleu1],
  ardente: [['..#..', '.##..', '.###.', '#####', '.###.'], C.rouge1],
  cristal: [['..#..', '.###.', '#####', '.###.', '..#..'], '#2aa7a8'],
  enclume: [['#####', '#####', '.###.', '.###.', '#####'], C.gris0],
  doree: [['.###.', '#####', '#####', '#####', '.###.'], C.or0],
  veinarde: [['##.##', '##.##', '..#..', '##.##', '##.##'], C.vert1],
};
const COUL_SCEAU = { carmin: ['#c81e2e', '#ff8a78'], azur: ['#2a6fd6', '#9fd0ff'], ambre: ['#e8792b', '#ffd27a'], lilas: ['#7a3fc0', '#d9b8ff'] };

function coin(g, c, coul) {
  texte(g, lettreRang(c.rang), 0, 0, { c: coul });
  motif(g, PIPS5[c.ens], c.rang === 10 ? 3 : 0, 9, coul);
}

const TETES = {
  11: { chapeau: 'plume', yeux: 'points', bouche: 'sourire' },
  12: { chapeau: 'chignon', yeux: 'fermes', bouche: 'rouge', joues: true },
  13: { chapeau: 'couronne', yeux: 'points', bouche: 'moustache' },
};

export function spriteCarte(c) {
  const cle = 'c:' + c.rang + c.ens + (c.amel || '') + '|' + (c.sceau || '');
  return memo(cle, () => {
    const [cv, g] = toile(LC, HC);
    const f = FONDS_CARTE[c.amel || 'aucun'];
    const coul = COUL_ENS[c.ens];
    rrect(g, 0, 0, LC, HC, C.noir, 3);
    rrect(g, 1, 1, LC - 2, HC - 2, f[0], 2);
    rect(g, 3, HC - 3, LC - 6, 2, f[1]);
    rect(g, LC - 3, 3, 2, HC - 6, f[1]);
    if (c.amel === 'cristal') {
      for (const d of [8, 14, 34, 52]) ligne(g, 2, d, Math.min(d, LC - 3), Math.max(2, d - LC + 5), C.blanc);
    }
    if (c.amel === 'doree') {
      for (let k = 0; k < HC - 4; k++) rect(g, Math.max(2, 30 - k), 2 + k, k < 30 ? 5 : 0, 1, '#fff2b8');
    }
    if (c.amel === 'enclume') for (const [x, y] of [[3, 3], [LC - 5, 3], [3, HC - 5], [LC - 5, HC - 5]]) rect(g, x, y, 2, 2, C.gris1);
    if (STYLE.deco && !CADRES[c.amel] && c.amel !== 'cameleon') {
      // v5 : filet d'or à gradins sur l'ivoire, et un petit éventail sous l'index.
      cadreDeco(g, LC, HC, '#c99a3a', '#f8d86a', 2);
      for (let k = 0; k < 3; k++) rect(g, LC / 2 - 1 - k * 2, 4 + k, 3 + k * 4, 1, k === 1 ? '#e0aa2a' : '#c99a3a');
    }
    if (CADRES[c.amel]) {
      const k = CADRES[c.amel];
      rect(g, 2, 2, LC - 4, 1, k);
      rect(g, 2, HC - 3, LC - 4, 1, k);
      rect(g, 2, 2, 1, HC - 4, k);
      rect(g, LC - 3, 2, 1, HC - 4, k);
    }
    if (c.amel === 'cameleon') {
      rect(g, 2, 2, LC - 4, 2, COUL_ENS.P);
      rect(g, LC - 4, 2, 2, HC - 4, COUL_ENS.C);
      rect(g, 2, HC - 4, LC - 4, 2, COUL_ENS.K);
      rect(g, 2, 2, 2, HC - 4, COUL_ENS.T);
    }
    // Index en coin, haut gauche et bas droite (retourné).
    const [cc, gc] = toile(11, 14);
    coin(gc, c, coul);
    g.drawImage(cc, 5, 5);
    g.save();
    g.translate(LC - 5, HC - 5);
    g.rotate(Math.PI);
    g.drawImage(cc, 0, 0);
    g.restore();
    // Centre.
    if (c.rang === 14) {
      // v7 : l'As porte une couronne de lauriers dorés.
      for (let k = 0; k <= 44; k++) {
        const a = Math.PI * 0.62 + (k / 44) * Math.PI * 1.76;
        const px = Math.round(24 + Math.cos(a) * 16), py = Math.round(33 + Math.sin(a) * 17);
        rect(g, px, py, 1, 1, k % 4 === 0 ? '#f8d86a' : '#c99a3a');
        if (k % 4 === 2) rect(g, px + (Math.cos(a) > 0 ? 1 : -1), py - 1, 1, 1, '#e0aa2a');
      }
      grandeEnseigne(g, c.ens, 24, 33, 26, coul);
      grandeEnseigne(g, c.ens, 23, 32, 9, COUL_ENS_CLAIR[c.ens]);
    } else if (c.rang >= 11) {
      rect(g, 11, 11, 26, 44, coul);
      const teinte = melange(COUL_ENS_CLAIR[c.ens], '#ffffff', 0.35);
      const spec = Object.assign({ fond: teinte, fond2: melange(teinte, coul, 0.18), motif: 'losanges', peau: 'ivoire', c1: c.rang === 13 ? C.rouge1 : c.rang === 12 ? '#3a2114' : coul, c2: c.rang === 11 ? C.or2 : coul, habit: coul, col: c.rang === 12 ? 'fraise' : 'revers' }, TETES[c.rang]);
      portrait(g, 12, 12, 24, 42, spec);
      // v7 : l'attribut de la figure (sceptre du Roi, rose de la Dame, hallebarde du Valet) et un cadre d'or.
      if (c.rang === 13) {
        rect(g, 14, 30, 1, 23, C.or1);
        rect(g, 15, 30, 1, 23, C.or3);
        ell(g, 15, 28, 2, 2, C.noir);
        ell(g, 15, 28, 2, 2, C.or2);
        rect(g, 14, 27, 1, 1, C.blanc);
        rect(g, 13, 33, 5, 1, C.or2);
      } else if (c.rang === 12) {
        rect(g, 15, 36, 1, 17, '#2e7a3a');
        rect(g, 16, 41, 2, 1, '#2e9e5b');
        ell(g, 15, 34, 2, 2, C.noir);
        ell(g, 15, 34, 2, 2, '#e0343c');
        rect(g, 14, 33, 1, 1, '#ff8a9a');
      } else {
        rect(g, 15, 26, 1, 27, '#8a5a2c');
        motif(g, ['..#..', '.###.', '#####', '..#..'], 13, 23, C.gris3);
        rect(g, 15, 24, 1, 2, C.blanc);
      }
      for (const [x, y, w, h] of [[11, 11, 26, 1], [11, 54, 26, 1], [11, 11, 1, 44], [36, 11, 1, 44]]) rect(g, x, y, w, h, C.or2);
      for (const [x, y] of [[11, 11], [36, 11], [11, 54], [36, 54]]) rect(g, x, y, 1, 1, C.or3);
      motif(g, PIPS7[c.ens], 28, 45, C.noir);
      motif(g, PIPS5[c.ens], 29, 46, COUL_ENS_CLAIR[c.ens]);
    } else {
      const xg = 14, xc = 21, xd = 28;
      const y1 = 13, y4 = 46, ym = 30;
      const y2 = 24, y3 = 35;
      const pos = {
        2: [[xc, y1], [xc, y4]],
        3: [[xc, y1], [xc, ym], [xc, y4]],
        4: [[xg, y1], [xd, y1], [xg, y4], [xd, y4]],
        5: [[xg, y1], [xd, y1], [xc, ym], [xg, y4], [xd, y4]],
        6: [[xg, y1], [xd, y1], [xg, ym], [xd, ym], [xg, y4], [xd, y4]],
        7: [[xg, y1], [xd, y1], [xc, 21], [xg, ym], [xd, ym], [xg, y4], [xd, y4]],
        8: [[xg, y1], [xd, y1], [xc, 21], [xg, ym], [xd, ym], [xc, 38], [xg, y4], [xd, y4]],
        9: [[xg, y1], [xd, y1], [xg, y2], [xd, y2], [xc, ym], [xg, y3], [xd, y3], [xg, y4], [xd, y4]],
        10: [[xg, y1], [xd, y1], [xc, 18], [xg, y2], [xd, y2], [xg, y3], [xd, y3], [xc, 41], [xg, y4], [xd, y4]],
      }[c.rang];
      for (const [px, py] of pos) {
        const pip = py > ym ? PIPS7[c.ens].slice().reverse() : PIPS7[c.ens];
        motif(g, pip, px, py, coul);
      }
    }
    if (MINI[c.amel]) {
      rrect(g, LC - 12, 4, 9, 9, f[1], 1);
      motif(g, MINI[c.amel][0], LC - 10, 6, MINI[c.amel][1]);
    }
    if (c.amel === 'cameleon') {
      rect(g, LC - 11, 5, 3, 3, COUL_ENS.P);
      rect(g, LC - 8, 5, 3, 3, COUL_ENS.C);
      rect(g, LC - 11, 8, 3, 3, COUL_ENS.T);
      rect(g, LC - 8, 8, 3, 3, COUL_ENS.K);
    }
    if (c.sceau) {
      const s = COUL_SCEAU[c.sceau];
      ell(g, 9, HC - 11, 5, 5, C.noir);
      ell(g, 9, HC - 11, 4, 4, s[0]);
      rect(g, 7, HC - 14, 2, 1, s[1]);
      rect(g, 6, HC - 13, 1, 2, s[1]);
      rect(g, 8, HC - 11, 3, 1, melange(s[0], '#000000', 0.35));
      rect(g, 9, HC - 12, 1, 3, melange(s[0], '#000000', 0.35));
    }
    return cv;
  });
}

// Coins à gradins façon art déco : trois marches dorées dans chaque angle, filet intérieur.
export function cadreDeco(g, w, h, c1, c2, inset = 3) {
  const x0 = inset, y0 = inset, x1 = w - inset - 1, y1 = h - inset - 1;
  rect(g, x0 + 4, y0, x1 - x0 - 7, 1, c1);
  rect(g, x0 + 4, y1, x1 - x0 - 7, 1, c1);
  rect(g, x0, y0 + 4, 1, y1 - y0 - 7, c1);
  rect(g, x1, y0 + 4, 1, y1 - y0 - 7, c1);
  for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
    // Gradins : (0,4) (1,3)... une marche par pixel, puis un point d'or clair.
    for (let k = 0; k < 4; k++) {
      rect(g, cx + sx * k, cy + sy * (4 - k), 1, 1, c1);
      rect(g, cx + sx * (k + 1), cy + sy * (4 - k - 1 + 0), 1, 1, c1);
    }
    rect(g, cx + sx * 2, cy + sy * 2, 1, 1, c2);
  }
}

// Dos art déco : velours sombre, soleil levant d'or en éventail, médaillon à gradins.
function dosDeco() {
  const [cv, g] = toile(LC, HC);
  rrect(g, 0, 0, LC, HC, C.noir, 3);
  rrect(g, 1, 1, LC - 2, HC - 2, C.or1, 2);
  rect(g, 2, 2, LC - 4, HC - 4, C.velours0);
  g.save();
  g.beginPath();
  g.rect(3, 3, LC - 6, HC - 6);
  g.clip();
  rect(g, 3, 3, LC - 6, HC - 6, C.velours1);
  // Rayons du soleil, depuis le bas, un sur deux plus sombre.
  const cx = LC / 2, cy = HC - 4;
  for (let i = 0; i < 13; i++) {
    const a0 = Math.PI + (i / 13) * Math.PI, a1 = Math.PI + ((i + 1) / 13) * Math.PI;
    g.fillStyle = i % 2 ? C.velours2 : C.velours1;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a0) * 90, cy + Math.sin(a0) * 90);
    g.lineTo(cx + Math.cos(a1) * 90, cy + Math.sin(a1) * 90);
    g.closePath();
    g.fill();
  }
  // Arcs dorés concentriques.
  for (const r of [10, 16, 22]) for (let k = 0; k <= 40; k++) {
    const a = Math.PI + (k / 40) * Math.PI;
    rect(g, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1, r === 16 ? C.or2 : C.or0);
  }
  g.restore();
  cadreDeco(g, LC, HC, C.or2, C.or3, 3);
  // Médaillon losange à gradins, V au centre.
  const mx = 24, my = 26;
  for (let k = 0; k < 9; k++) {
    rect(g, mx - k, my - 9 + k, 2 * k + 1, 1, C.or1);
    rect(g, mx - k, my + 9 - k, 2 * k + 1, 1, C.or1);
  }
  for (let k = 0; k < 7; k++) {
    rect(g, mx - k, my - 7 + k, 2 * k + 1, 1, C.velours0);
    rect(g, mx - k, my + 7 - k, 2 * k + 1, 1, C.velours0);
  }
  texte(g, 'V', mx - 2, my - 3, { c: C.or3 });
  return cv;
}

export function spriteDos() {
  if (STYLE.deco) return memo('dos', dosDeco);
  return memo('dos', () => {
    const [cv, g] = toile(LC, HC);
    rrect(g, 0, 0, LC, HC, C.noir, 3);
    rrect(g, 1, 1, LC - 2, HC - 2, C.creme, 2);
    rect(g, 3, 3, LC - 6, HC - 6, C.velours2);
    g.save();
    g.beginPath();
    g.rect(4, 4, LC - 8, HC - 8);
    g.clip();
    for (let j = -1; j < 12; j++) for (let i = -1; i < 8; i++) {
      const x = 4 + i * 8 + (j % 2 ? 4 : 0);
      const y = 4 + j * 6;
      motif(g, ['..#..', '.#.#.', '#...#', '.#.#.', '..#..'], x, y, C.velours3);
    }
    g.restore();
    rect(g, 4, 4, LC - 8, 1, C.or1);
    rect(g, 4, HC - 5, LC - 8, 1, C.or1);
    rect(g, 4, 4, 1, HC - 8, C.or1);
    rect(g, LC - 5, 4, 1, HC - 8, C.or1);
    ell(g, 24, 33, 10, 10, C.or0);
    ell(g, 24, 33, 9, 9, C.velours1);
    texte(g, 'V', 19, 27, { c: C.or2, e: 2 });
    return cv;
  });
}

// Version inversée d'un sprite (édition Inverté).
export function inverse(sprite, cle) {
  return memo('inv:' + cle, () => {
    const [cv, g] = toile(sprite.width, sprite.height);
    g.drawImage(sprite, 0, 0);
    g.globalCompositeOperation = 'difference';
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, cv.width, cv.height);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(sprite, 0, 0);
    g.globalCompositeOperation = 'source-over';
    return cv;
  });
}

// ---------------------------------------------------------- Consommables

function cadreConso(g, bord, clair, fond) {
  rrect(g, 0, 0, LC, HC, C.noir, 3);
  rrect(g, 1, 1, LC - 2, HC - 2, bord, 2);
  rect(g, 3, 1, LC - 6, 1, clair);
  rect(g, 4, 4, LC - 8, HC - 8, C.noir);
  rect(g, 5, 5, LC - 10, HC - 10, fond);
}

export function spriteConso(id) {
  return memo('k:' + id, () => {
    const d = CONSO[id];
    const [cv, g] = toile(LC, HC);
    const h = hachage(id);
    if (d.cat === 'astre') {
      cadreConso(g, C.bleu0, C.bleu2, C.nuit);
      for (let y = 0; y < HC - 10; y++) if (y % 2 === 0 && y > 30) rect(g, 5, 5 + y, LC - 10, 1, C.nuit2);
      for (let i = 0; i < 26; i++) {
        const x = 6 + ((h >>> (i % 16)) * (i + 3) * 7) % (LC - 12);
        const y = 6 + ((h >>> ((i + 5) % 16)) * (i + 11) * 5) % (HC - 12);
        rect(g, x, y, 1, 1, i % 4 === 0 ? C.bleu2 : C.gris1);
      }
      // Constellation propre à la main.
      const idx = MAINS.findIndex((m) => m.astre === id);
      const n = 3 + (idx % 5);
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (h % 7);
        const r = 9 + ((h >>> (i * 3)) % 9);
        pts.push([24 + Math.round(Math.cos(a) * r), 30 + Math.round(Math.sin(a) * r * 1.25)]);
      }
      for (let i = 0; i < n - 1; i++) ligne(g, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], C.bleu0);
      if (idx % 2 === 0) ligne(g, pts[n - 1][0], pts[n - 1][1], pts[0][0], pts[0][1], C.bleu0);
      pts.forEach(([x, y], i) => {
        if (i === 0) {
          motif(g, ['..#..', '..#..', '#####', '..#..', '..#..'], x - 2, y - 2, C.or3);
          rect(g, x - 1, y - 1, 3, 3, C.blanc);
        } else {
          motif(g, ['.#.', '###', '.#.'], x - 1, y - 1, i % 2 ? C.bleu2 : C.blanc);
        }
      });
      texte(g, String(idx + 1), 24, HC - 15, { c: C.bleu2, a: 'c' });
    } else {
      const ombre = d.cat === 'ombre';
      if (ombre) {
        cadreConso(g, C.gris0, C.gris2, C.noir);
        for (let y = 0; y < HC - 10; y++) for (let x = 0; x < LC - 10; x++) {
          const v = Math.sin((x + h % 9) * 0.5) + Math.cos((y + h % 5) * 0.37) + ((x * 7 + y * 13) % 5) * 0.2;
          if (v > 1.2 && (x + y) % 2 === 0) rect(g, 5 + x, 5 + y, 1, 1, C.violet0);
        }
      } else {
        cadreConso(g, C.violet1, C.violet2, C.violet0);
        for (let j = 0; j < 10; j++) for (let i = 0; i < 7; i++) if ((i + j) % 2 === 0) rect(g, 6 + i * 6, 6 + j * 6, 1, 1, C.violet1);
        rect(g, 7, 7, LC - 14, 1, C.or1);
        rect(g, 7, HC - 8, LC - 14, 1, C.or1);
        rect(g, 7, 7, 1, HC - 14, C.or1);
        rect(g, LC - 8, 7, 1, HC - 14, C.or1);
      }
      const coul = ombre ? (d.teinte ? COUL_SCEAU[d.teinte][0] : C.violet2) : C.or2;
      ell(g, 24, 33, 15, 15, ombre ? C.gris0 : C.or0);
      ell(g, 24, 33, 14, 14, ombre ? '#120f1f' : '#2a1250');
      if ('PCKT'.includes(d.icone)) {
        grandeEnseigne(g, d.icone, 24, 33, 20, COUL_ENS_CLAIR[d.icone]);
      } else {
        const ic = ICONES[d.icone] || ICONES.etoile;
        motif(g, ic, 13, 22, coul, 2);
      }
    }
    return cv;
  });
}

export function spritePrivilege(id) {
  return memo('p:' + id, () => {
    const [cv, g] = toile(LC, HC);
    const h = hachage(id);
    const t = Object.values(TEINTES)[h % 10];
    rrect(g, 0, 0, LC, HC, C.noir, 3);
    rrect(g, 1, 1, LC - 2, HC - 2, C.or2, 2);
    rect(g, 3, 1, LC - 6, 1, C.or3);
    rect(g, 4, 4, LC - 8, HC - 8, C.or0);
    rect(g, 5, 5, LC - 10, HC - 10, C.creme);
    rect(g, 5, 5, LC - 10, 12, t[1]);
    rect(g, 5, 16, LC - 10, 1, C.or0);
    texte(g, 'PRIV', 24, 8, { c: C.creme, a: 'c' });
    const ICONE_PRIV = { main_velours: 'fleche', corbeille: 'boucle', rente: 'piece', vitrine: 'miroir', ristourne: 'ciseaux', marchandage: 'piece', grande_manche: 'fleche', ecrin: 'cristal', estrade: 'couronne', telescope: 'etoile', vernissage: 'pinceau', coup_pouce: 'poids', carnet: 'masque', strapontins: 'grelot', abonnes: 'oeil' };
    motif(g, ICONES[ICONE_PRIV[id]] || ICONES.couronne, 13, 21, t[0], 2);
    for (let i = 0; i < 4; i++) rect(g, 9, 47 + i * 3, 30 - ((h >>> i) % 4) * 4, 1, C.creme3);
    return cv;
  });
}

const COUL_PAQUET = {
  cartes: [C.velours3, C.velours4, C.creme, 'C'], arcanes: [C.violet1, C.violet2, C.or2, 'masque'], astres: [C.bleu0, C.bleu1, C.or3, 'etoile'],
  jokers: [C.or1, C.or3, C.creme, 'grelot'], ombres: [C.gris0, C.gris1, C.violet2, 'oeil'],
};
export function spritePaquet(type, taille) {
  return memo('q:' + type + taille, () => {
    const [cv, g] = toile(LC, HC);
    const k = COUL_PAQUET[type];
    const haut = taille === 'petit' ? 6 : taille === 'grand' ? 3 : 0;
    // Sachet gaufré en haut et en bas.
    for (let x = 2; x < LC - 2; x += 4) {
      tri(g, x, haut + 4, x + 3, haut + 4, x + 1.5, haut, C.noir);
      tri(g, x, HC - 5, x + 3, HC - 5, x + 1.5, HC - 1, C.noir);
    }
    rect(g, 1, haut + 3, LC - 2, HC - 7 - haut, C.noir);
    rect(g, 2, haut + 4, LC - 4, HC - 9 - haut, k[0]);
    for (let x = 3; x < LC - 3; x += 4) {
      rect(g, x, haut + 2, 2, 2, k[0]);
      rect(g, x, HC - 5, 2, 2, k[0]);
    }
    rect(g, 2, haut + 7, LC - 4, 1, k[1]);
    rect(g, 2, HC - 9, LC - 4, 1, melange(k[0], '#000000', 0.35));
    rect(g, 4, haut + 9, 2, HC - 20 - haut, k[1]);
    ell(g, 24, 33 + haut / 2, 15, 15, C.noir);
    ell(g, 24, 33 + haut / 2, 14, 14, melange(k[0], '#000000', 0.45));
    if (k[3] === 'C') {
      grandeEnseigne(g, 'P', 18, 30 + haut / 2, 11, k[2]);
      grandeEnseigne(g, 'C', 30, 30 + haut / 2, 11, C.rouge2);
      grandeEnseigne(g, 'T', 18, 40 + haut / 2, 9, C.vert2);
      grandeEnseigne(g, 'K', 30, 40 + haut / 2, 11, C.orange1);
    } else motif(g, ICONES[k[3]], 13, 22 + Math.round(haut / 2), k[2], 2);
    const n = taille === 'petit' ? 1 : taille === 'grand' ? 2 : 3;
    for (let i = 0; i < n; i++) motif(g, ['.#.', '###', '.#.'], 24 - n * 3 + i * 6, HC - 14, k[2]);
    return cv;
  });
}

export function spriteTicket(id) {
  return memo('t:' + id, () => {
    const [cv, g] = toile(40, 22);
    const h = hachage(id);
    const t = Object.values(TEINTES)[h % 10];
    rrect(g, 0, 0, 40, 22, C.noir, 2);
    rrect(g, 1, 1, 38, 20, t[1], 1);
    rect(g, 2, 2, 36, 1, t[2]);
    for (let y = 3; y < 20; y += 3) rect(g, 28, y, 1, 2, C.noir);
    ell(g, 0, 11, 3, 3, C.noir);
    ell(g, 39, 11, 3, 3, C.noir);
    motif(g, ICONES.etoile, 9, 6, C.creme);
    motif(g, ['###', '#.#', '###'], 32, 9, t[2]);
    return cv;
  });
}

// ---------------------------------------------------------------- Patrons

export function spritePatron(patron, taille) {
  return memo('b:' + patron.id + taille, () => {
    const [cv, g] = toile(taille, taille);
    const t = TEINTES[patron.teinte] || TEINTES.rouge;
    const h = hachage('p' + patron.id);
    const spec = {
      fond: t[0], fond2: melange(t[0], '#000000', 0.35), motif: 'rayons',
      peau: ['gris', 'blanc', 'bleu', 'gris'][h % 4],
      chapeau: ['cornes', 'capuche', 'haut', 'couronne', 'tricorne', 'cornes'][(h >>> 3) % 6],
      yeux: 'colere', bouche: ['moue', 'rire', 'plat', 'moustache'][(h >>> 7) % 4],
      c1: t[1], c2: t[2], habit: C.noir, col: ['revers', 'fraise'][(h >>> 9) % 2], lueur: t[2],
    };
    portrait(g, 0, 0, taille, taille, spec);
    return cv;
  });
}

// Jeton de mise (petite et grande).
export function spriteJeton(coul, taille) {
  return memo('m:' + coul + taille, () => {
    const [cv, g] = toile(taille, taille);
    const t = TEINTES[coul] || TEINTES.bleu;
    const r = taille / 2 - 1;
    const c = taille / 2;
    ell(g, c, c, r, r, C.noir);
    ell(g, c, c, r - 1, r - 1, t[1]);
    for (let a = 0; a < 8; a++) {
      const an = (a / 8) * Math.PI * 2;
      tri(g, c, c, c + Math.cos(an - 0.16) * r, c + Math.sin(an - 0.16) * r, c + Math.cos(an + 0.16) * r, c + Math.sin(an + 0.16) * r, C.creme);
    }
    ell(g, c, c, r * 0.68, r * 0.68, t[0]);
    ell(g, c, c, r * 0.6, r * 0.6, t[1]);
    ell(g, c - r * 0.2, c - r * 0.2, r * 0.25, r * 0.2, t[2]);
    return cv;
  });
}

export { louis, largeurTexte };

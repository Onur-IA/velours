// L'écran de jeu : table de velours, rangée de jokers, main, score, boutique, paquets.

import { majGuide } from './guide.js';
import { conseiller, revue as revueMentor, astuceAuto, dessinerMentor, cacherMentor, mentorActif } from './mentor.js';
import { PUBLIC, AIDE_PUBLIC, publicActif, etatPublic, reactionPublic, reserveMax } from '../noyau/public.js';
import { L, H, PORTRAIT, FORMAT, C, COUL_RARETE, TEINTES, toile, rect, rrect, panneau, motif, ell, melange, grandeEnseigne, PIPS5, COUL_ENS, COUL_ENS_CLAIR, ICONES, louis } from './dessin.js';
import { texte, largeurTexte, couperTexte } from './police.js';
import { M, zone, survole, appuie, attendre, poser, sauter, positionDe, popup, eclats, secouer, flasher, zoomer, majInclinaison, figer, vibrer } from './moteur.js';
import { LC, HC, spriteCarte, spriteDos, spriteJoker, spriteConso, spritePrivilege, spritePaquet, spriteTicket, spritePatron, spriteJeton, inverse } from './sprites.js';
import { son, etouffer as etoufferMusique, reglerMulti } from './son.js';
import * as P from '../noyau/partie.js';
import { apportsJokers, BONUS_MARCHE } from '../noyau/score.js';
import { CRESCENDO_MAX as CRESC_MAX } from '../noyau/partie.js';
import { MAIN, MAINS, AMELIORATIONS, EDITIONS, SCEAUX, fmt, fmtM, nomCarte, baseDeMain, lettreRang } from '../noyau/donnees.js';
import { JOKER, RARETES, descJoker, compatibles } from '../noyau/jokers.js';
import { CONSO, NOM_CAT, PRIVILEGE, TICKET, TYPES_PAQUET, TAILLES_PAQUET, nomPaquet, contenuPaquet } from '../noyau/consommables.js';
import { PATRON } from '../noyau/patrons.js';
import { repliqueDe } from '../noyau/repliques.js';
import { combosActifs, combosDeclenches, nomCombo } from '../noyau/combos.js';
import { SYNERGIE, synergiesRangee, synergiesDuJoker, avancementSynergies, apportSynergie } from '../noyau/synergies.js';
import { JEU, ENJEUX } from '../noyau/regles.js';
import { rangTroupe as rangLisible } from '../noyau/meta.js';
import { carteParId, emplJokers, emplConsos, jokersComptes, placeConso, valeurVenteJoker, aides, estAffaiblie, patronActif, mod, tailleMain, mainsParManche, defaussesParManche, nivJoker, facteurNiv, peutMonter, NIV_MAX, jokersActifs } from '../noyau/outils.js';

// Mise en page. Paysage : panneau à gauche, table à droite. Portrait (v4) : bandeau en haut,
// jokers puis consommables, compteur, cartes jouées, main, et les boutons sous le pouce.
let PX = 4;
let PW = 148;
let TX = 156;
let TW = 480;
let Y_JOKERS = 12;
let Y_CONSOS = 12;
let Y_METRE = 92;
let Y_JEU = 134;
let Y_MAIN = 218;
let Y_BOUTONS = 298;
let Y_TABLE = 92; // haut de la zone libre sous les rangées (boutique, choix, paquets)
let X_PIOCHE = 574;
let Y_PIOCHE = 218;
let CX = TX + TW / 2;
let X_PUBLIC = TX + 12;
let Y_PUBLIC = 99;
let Y_CRESC = 121;
let formatVu = -1;
function majFormat() {
  if (formatVu === FORMAT) return;
  formatVu = FORMAT;
  fondCache = null;
  if (PORTRAIT) {
    PX = 4; PW = L - 8; TX = 4; TW = L - 8;
    Y_JOKERS = 104;
    Y_CONSOS = 188;
    Y_TABLE = Y_CONSOS + HC + 14;
    Y_METRE = Y_TABLE + 14;
    Y_BOUTONS = H - 74;
    Y_MAIN = Y_BOUTONS - HC - 18;
    Y_JEU = Math.round((Y_METRE + 50 + Y_MAIN - 18) / 2 - HC / 2);
    X_PIOCHE = TX + 126;
    Y_PIOCHE = Y_CONSOS;
    X_PUBLIC = TX + 10;
    Y_PUBLIC = Y_CONSOS + 8;
    Y_CRESC = Y_CONSOS + 36;
  } else {
    PX = 4; PW = 148; TX = 156; TW = 480;
    Y_JOKERS = 12; Y_CONSOS = 12; Y_TABLE = 92; Y_METRE = 92; Y_JEU = 134; Y_MAIN = 218; Y_BOUTONS = 298;
    X_PIOCHE = TX + TW - 62; Y_PIOCHE = Y_MAIN;
    X_PUBLIC = TX + 12; Y_PUBLIC = 99; Y_CRESC = 121;
  }
  CX = TX + TW / 2;
}
const ARC = [C.rouge2, C.or3, C.vert2, C.cyan1, C.bleu2, C.violet2, C.rose1];

export function nouvelleUi() {
  return {
    sel: [], selJoker: null, selConso: null, selArticle: null, selChoix: null,
    scene: null, occupe: false, calque: null, annonce: null, toasts: [], rev: 0,
    apercuCle: '', apercu: null, encT0: 0, fin: null, compteurs: {}, phaseVue: null,
  };
}

// ------------------------------------------------------------ Décor

let fondCache = null;
// Tapis de table (renommée, v3) : quatre teintes du plus sombre au plus clair.
const PALETTES_TAPIS = {
  velours: [C.velours0, C.velours1, C.velours2, C.velours3],
  emeraude: ['#06231a', '#0b3a2a', '#145a40', '#1f7a56'],
  saphir: ['#08142e', '#0f2350', '#183a7a', '#2552a3'],
  ardoise: ['#111318', '#1c2028', '#2c323e', '#3d4554'],
  prune: ['#1c0a24', '#2e1240', '#47205f', '#5f2e7d'],
  or: ['#2a1a04', '#45300a', '#6b4b12', '#8f681c'],
  neon: ['#2a0620', '#470b36', '#6e1556', '#99207a'],
};
let tapisCourant = 'velours';
export function reglerTapis(id) {
  if (!PALETTES_TAPIS[id] || id === tapisCourant) return;
  tapisCourant = id;
  fondCache = null;
}
function fondTable() {
  if (fondCache) return fondCache;
  const [cv, g] = toile(L, H);
  const [t0, t1, t2, t3] = PALETTES_TAPIS[tapisCourant];
  rect(g, 0, 0, L, H, C.nuit);
  for (let j = 0; j < H / 12 + 1; j++) for (let i = 0; i < L / 12 + 1; i++) {
    const x = i * 12 + (j % 2 ? 6 : 0);
    motif(g, ['.#.', '#.#', '.#.'], x - 1, j * 12 - 1, C.nuit2);
  }
  // Bord de table : bois sombre, liseré or, puis le tapis.
  rrect(g, TX - 2, 2, TW + 4, H - 4, C.noir, 3);
  rrect(g, TX - 1, 3, TW + 2, H - 6, C.or0, 3);
  rrect(g, TX, 4, TW, H - 8, t0, 3);
  rrect(g, TX + 2, 6, TW - 4, H - 12, C.or1, 2);
  rrect(g, TX + 3, 7, TW - 6, H - 14, t2, 2);
  // Velours : grain en trame, plus sombre vers les bords.
  let s = 12345;
  const alea = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  for (let y = 7; y < H - 7; y++) for (let x = TX + 3; x < TX + TW - 3; x++) {
    const bord = Math.min(x - TX - 3, TX + TW - 4 - x, y - 7, H - 8 - y);
    const r = alea();
    if (bord < 26 && r < (26 - bord) / 30 && (x + y) % 2 === 0) rect(g, x, y, 1, 1, t1);
    else if (r < 0.05) rect(g, x, y, 1, 1, t1);
    else if (r > 0.965) rect(g, x, y, 1, 1, t3);
  }
  // Enseignes fantômes au centre du tapis.
  g.globalAlpha = 0.16;
  const yE = PORTRAIT ? Y_JEU + 30 : 158;
  const dxE = PORTRAIT ? 80 : 96;
  grandeEnseigne(g, 'P', CX - dxE, yE, 44, t0);
  grandeEnseigne(g, 'C', CX - dxE / 3, yE, 44, t0);
  grandeEnseigne(g, 'T', CX + dxE / 3, yE, 44, t0);
  grandeEnseigne(g, 'K', CX + dxE, yE, 44, t0);
  g.globalAlpha = 1;
  fondCache = cv;
  return cv;
}

// ----------------------------------------------------------- Widgets

const BOUTONS = {
  bleu: [C.bleu1, C.bleu2, C.bleu0], rouge: [C.rouge1, C.rouge2, C.rouge0], or: [C.or2, C.or3, C.or0], vert: [C.vert1, C.vert2, C.vert0],
  gris: [C.gris1, C.gris2, C.gris0], violet: [C.violet1, C.violet2, C.violet0], nuit: [C.nuit3, C.nuit4, C.nuit],
};
export function bouton(g, id, x, y, w, h, label, o = {}) {
  const actif = o.actif !== false;
  const k = BOUTONS[actif ? o.coul || 'bleu' : 'gris'];
  const sur = actif && survole(id);
  const bas = actif && appuie(id);
  const dy = bas ? 1 : 0;
  rrect(g, x, y + 1, w, h, C.noir, 2);
  if (!bas) rrect(g, x, y + h - 2, w, 3, k[2], 2);
  rrect(g, x, y + dy, w, h - 2, C.noir, 2);
  rrect(g, x + 1, y + 1 + dy, w - 2, h - 4, sur ? melange(k[0], '#ffffff', 0.18) : k[0], 1);
  rect(g, x + 2, y + 1 + dy, w - 4, 1, actif ? k[1] : C.gris2);
  const lignes = Array.isArray(label) ? label : [label];
  const e = o.e || 1;
  const ht = lignes.length * 8 * e - e;
  const coulTxt = actif ? o.ctexte || C.blanc : C.gris3;
  lignes.forEach((l, i) => {
    const ty = y + dy + Math.floor((h - 2 - ht) / 2) + i * 8 * e;
    if (typeof l === 'object') {
      // Libellé avec une pièce : { t: 'ACHETER', prix: 5 }
      const w1 = largeurTexte(l.t, e);
      const w2 = largeurTexte(String(l.prix), e);
      const tot = w1 + 4 + 8 + w2;
      const x0 = Math.round(x + (w - tot) / 2);
      texte(g, l.t, x0, ty, { c: coulTxt, e, ombre: actif && !o.ctexte ? k[2] : null });
      louis(g, x0 + w1 + 4, ty);
      texte(g, String(l.prix), x0 + w1 + 13, ty, { c: actif ? o.ctexte || C.or3 : C.gris3, e, ombre: actif && !o.ctexte ? k[2] : null });
    } else texte(g, l, x + w / 2, ty, { c: coulTxt, e, a: 'c', ombre: actif && !o.ctexte ? k[2] : null });
  });
  zone({ id, x, y, w, h, clic: actif ? o.clic : o.refus || null, bulle: o.bulle, bulleBas: o.bulleBas, muet: !actif });
}

function etiquettePrix(g, x, y, prix, peut) {
  const s = prix === 0 ? 'OFFERT' : String(prix);
  const w = largeurTexte(s) + (prix === 0 ? 6 : 16);
  const x0 = Math.round(x - w / 2);
  rrect(g, x0, y, w, 11, C.noir, 2);
  rrect(g, x0 + 1, y + 1, w - 2, 9, peut ? C.nuit2 : C.velours0, 1);
  if (prix === 0) texte(g, s, x0 + 3, y + 2, { c: C.vert2 });
  else {
    louis(g, x0 + 3, y + 2);
    texte(g, s, x0 + 12, y + 2, { c: peut ? C.or3 : C.rouge2 });
  }
}

function ombreCarte(g, x, y, w = LC, h = HC) {
  g.globalAlpha = 0.35;
  rrect(g, x + 2, y + 3, w, h, C.noir, 3);
  g.globalAlpha = 1;
}

function effetEdition(g, x, y, ed, graine) {
  const t = M.t;
  if (ed === 'brillant') {
    for (let i = 0; i < 7; i++) {
      const ph = (t * 1.3 + i * 0.37 + graine * 0.13) % 1;
      if (ph > 0.4) continue;
      const px = x + 5 + ((graine * 31 + i * 17) % (LC - 10));
      const py = y + 5 + ((graine * 13 + i * 29) % (HC - 10));
      const s = ph > 0.12 && ph < 0.28 ? 2 : 1;
      rect(g, px - s, py, 2 * s + 1, 1, C.blanc);
      rect(g, px, py - s, 1, 2 * s + 1, C.blanc);
    }
  } else if (ed === 'irise') {
    g.globalAlpha = 0.3;
    for (let b = 0; b * 4 < HC - 4; b++) rect(g, x + 2, y + 2 + b * 4, LC - 4, Math.min(4, HC - 4 - b * 4), ARC[(b + Math.floor(t * 6)) % ARC.length]);
    g.globalAlpha = 1;
  } else if (ed === 'prisme') {
    g.globalAlpha = 0.36;
    for (let yy = 0; yy < HC - 4; yy += 2) for (let xx = 0; xx < LC - 4; xx += 6) {
      rect(g, x + 2 + xx, y + 2 + yy, Math.min(6, LC - 4 - xx), 2, ARC[(Math.floor((xx + yy) / 6) + Math.floor(t * 5)) % ARC.length]);
    }
    g.globalAlpha = 1;
    const bx = Math.floor((t * 40 + graine * 7) % (LC + 40)) - 20;
    g.globalAlpha = 0.5;
    for (let yy = 2; yy < HC - 2; yy++) {
      const px = x + bx - Math.floor(yy / 3);
      if (px > x + 1 && px < x + LC - 3) rect(g, px, y + yy, 2, 1, C.blanc);
    }
    g.globalAlpha = 1;
  }
}

function lueur(g, x, y, coul, w = LC, h = HC) {
  // Liseré plein, puis tirets clairs qui tournent autour de la carte.
  rect(g, x - 2, y - 2, w + 4, 2, coul);
  rect(g, x - 2, y + h, w + 4, 2, coul);
  rect(g, x - 2, y, 2, h, coul);
  rect(g, x + w, y, 2, h, coul);
  const per = 2 * (w + h);
  const ph = Math.floor(M.t * 24) % 12;
  for (let i = -ph; i < per; i += 12) {
    for (let d = 0; d < 5; d++) {
      const k = (((i + d) % per) + per) % per;
      let px;
      let py;
      if (k < w) [px, py] = [x + k, y - 2];
      else if (k < w + h) [px, py] = [x + w, y + k - w];
      else if (k < 2 * w + h) [px, py] = [x + w - 1 - (k - w - h), y + h];
      else [px, py] = [x - 2, y + h - 1 - (k - 2 * w - h)];
      rect(g, px, py, 2, 2, C.blanc);
    }
  }
}

export function dessinerCarte(g, c, x, y, o = {}) {
  x = Math.round(x);
  y = Math.round(y);
  if (!o.sansOmbre) ombreCarte(g, x, y);
  if (o.cachee) {
    g.drawImage(spriteDos(), x, y);
    return;
  }
  g.drawImage(spriteCarte(c), x, y);
  if (c.edition) effetEdition(g, x, y, c.edition, c.id % 97);
  if (c.niv > 0) etoilesRetouche(g, x, y, c.niv);
  if (o.affaiblie) {
    g.globalAlpha = 0.55;
    rrect(g, x + 1, y + 1, LC - 2, HC - 2, C.nuit, 2);
    g.globalAlpha = 1;
    for (let i = 0; i < 20; i++) {
      rect(g, x + 14 + i, y + 23 + i, 2, 2, C.rouge1);
      rect(g, x + 33 - i, y + 23 + i, 2, 2, C.rouge1);
    }
  }
  if (o.lueur) lueur(g, x, y, o.lueur);
}

// v6 : niveau de retouche d'une carte, en losanges dorés en bas à gauche.
function etoilesRetouche(g, x, y, n) {
  for (let i = 0; i < n; i++) {
    const cx = x + 5 + i * 6, cy = y + HC - 7;
    rect(g, cx, cy - 2, 3, 5, C.noir);
    rect(g, cx - 1, cy - 1, 5, 3, C.noir);
    rect(g, cx + 1, cy - 1, 1, 3, C.or3);
    rect(g, cx, cy, 3, 1, C.or3);
  }
}
// v6 : niveau d'un joker, pastille dorée en haut à droite (II, III).
function pastilleNiveau(g, x, y, n) {
  if (n <= 1) return;
  const s = n === 2 ? 'II' : 'III';
  const w = largeurTexte(s) + 5;
  const bx = x + LC - w - 1, by = y + 1;
  rrect(g, bx - 1, by - 1, w + 2, 11, C.noir, 2);
  rrect(g, bx, by, w, 9, n >= 3 ? C.or3 : C.or1, 2);
  texte(g, s, bx + w / 2, by + 1, { c: C.noir, a: 'c' });
}

// v5 : réglages visuels lus à chaque image (options du joueur).
export const VISUEL = { relief: true };

// Reflet doré qui glisse sur une carte rare en relief, selon l'inclinaison.
function reflet(g, x, y, ix, iy) {
  g.save();
  g.beginPath();
  g.rect(x + 2, y + 2, LC - 4, HC - 4);
  g.clip();
  const pos = Math.round((ix + 1) / 2 * (LC + HC) - HC / 2 + iy * 6);
  for (let k = 0; k < HC; k += 1) {
    const px = x + pos - k * 0.6;
    g.globalAlpha = 0.22;
    rect(g, Math.round(px), y + k, 4, 1, C.or3);
    g.globalAlpha = 0.12;
    rect(g, Math.round(px) + 7, y + k, 2, 1, C.blanc);
  }
  g.globalAlpha = 1;
  g.restore();
}


// v7 : cadre vivant des jokers épiques (pulsation violette) et légendaires (or qui court sur le bord, étincelles).
function cadreRarete(g, x, y, def) {
  if (!def || (def.r !== 'E' && def.r !== 'L') || VISUEL.reduit) return;
  const t = M.t || 0;
  if (def.r === 'E') {
    g.globalAlpha = 0.25 + 0.2 * Math.sin(t * 2.4);
    rect(g, x - 1, y - 1, LC + 2, 1, '#cda2ff');
    rect(g, x - 1, y + HC, LC + 2, 1, '#cda2ff');
    rect(g, x - 1, y, 1, HC, '#cda2ff');
    rect(g, x + LC, y, 1, HC, '#cda2ff');
    g.globalAlpha = 1;
    return;
  }
  const per = 2 * (LC + HC);
  const pt = (d) => {
    d = ((d % per) + per) % per;
    if (d < LC) return [x + d, y];
    if (d < LC + HC) return [x + LC - 1, y + d - LC];
    if (d < 2 * LC + HC) return [x + LC - 1 - (d - LC - HC), y + HC - 1];
    return [x, y + HC - 1 - (d - 2 * LC - HC)];
  };
  const tete = t * 70;
  for (let k = 0; k < 18; k++) {
    for (const dec of [0, per / 2]) {
      const [px, py] = pt(tete + dec - k);
      g.globalAlpha = 1 - k / 18;
      rect(g, px, py, 1, 1, k < 3 ? C.blanc : C.or3);
    }
  }
  // Deux étincelles qui clignent dans le portrait.
  for (let i = 0; i < 2; i++) {
    const ph = (t * 0.9 + i * 0.5) % 1;
    if (ph > 0.25) continue;
    const sx = x + 8 + ((Math.floor(t * 0.9 + i * 0.5) * 17 + i * 23) % (LC - 16));
    const sy = y + 6 + ((Math.floor(t * 0.9 + i * 0.5) * 11 + i * 13) % 36);
    g.globalAlpha = 1 - ph * 4;
    rect(g, sx, sy - 1, 1, 3, C.blanc);
    rect(g, sx - 1, sy, 3, 1, C.blanc);
  }
  g.globalAlpha = 1;
}

export function dessinerJoker(g, j, x, y, o = {}) {
  x = Math.round(x);
  y = Math.round(y);
  const def = JOKER[j.id];
  const relief = VISUEL.relief && def && (def.r === 'R' || def.r === 'E' || def.r === 'L') && !o.plat;
  if (relief) {
    // Relief : l'ombre part à l'opposé de l'inclinaison, la carte se soulève de deux pixels.
    const I = majInclinaison();
    const dx = Math.round(I.x * 2), dy = Math.round(I.y * 2);
    if (!o.sansOmbre) {
      g.globalAlpha = 0.5;
      rrect(g, x - dx + 2, y - dy + 3, LC, HC, C.noir, 3);
      g.globalAlpha = 1;
    }
    let sp = spriteJoker(j.id);
    if (j.edition === 'inverte') sp = inverse(sp, 'j' + j.id);
    g.drawImage(sp, x + dx, y + dy - 1);
    reflet(g, x + dx, y + dy - 1, I.x, I.y);
    cadreRarete(g, x + dx, y + dy - 1, def);
    if (j.edition && j.edition !== 'inverte') effetEdition(g, x + dx, y + dy - 1, j.edition, (j.uid || 1) % 97);
    pastilleNiveau(g, x + dx, y + dy - 1, nivJoker(j));
    if (o.muet) {
      g.globalAlpha = 0.6;
      rrect(g, x + 1, y + 1, LC - 2, HC - 2, C.nuit, 2);
      g.globalAlpha = 1;
      rect(g, x + 6, y + 28, LC - 12, 11, C.noir);
      texte(g, 'MUSELÉ', x + LC / 2, y + 30, { c: C.rouge2, a: 'c' });
    }
    if (o.lueur) lueur(g, x, y, o.lueur);
    return;
  }
  if (!o.sansOmbre) ombreCarte(g, x, y);
  let sp = spriteJoker(j.id);
  if (j.edition === 'inverte') sp = inverse(sp, 'j' + j.id);
  g.drawImage(sp, x, y);
  cadreRarete(g, x, y, def);
  if (j.edition && j.edition !== 'inverte') effetEdition(g, x, y, j.edition, (j.uid || 1) % 97);
  pastilleNiveau(g, x, y, nivJoker(j));
  if (o.muet) {
    g.globalAlpha = 0.6;
    rrect(g, x + 1, y + 1, LC - 2, HC - 2, C.nuit, 2);
    g.globalAlpha = 1;
    rect(g, x + 6, y + 28, LC - 12, 11, C.noir);
    texte(g, 'MUSELÉ', x + LC / 2, y + 30, { c: C.rouge2, a: 'c' });
  }
  if (o.lueur) lueur(g, x, y, o.lueur);
}

// Nombre animé : glisse vers sa cible et note l'instant du dernier changement.
function compteur(ui, cle, cible, vitesse = 10) {
  let c = ui.compteurs[cle];
  if (!c) c = ui.compteurs[cle] = { v: cible, cible, t: -9 };
  if (c.cible !== cible) {
    c.cible = cible;
    c.t = M.t;
  }
  const d = c.cible - c.v;
  if (Math.abs(d) < 0.5) c.v = c.cible;
  else c.v += d * Math.min(1, M.dt * vitesse);
  return c;
}

// Texte de nombre qui tient dans une largeur : réduit l'échelle au besoin.
function nombre(g, s, cx, y, largeur, o = {}) {
  let e = o.e || 2;
  while (e > 1 && largeurTexte(s, e) > largeur) e--;
  texte(g, s, cx, y + ((o.e || 2) - e) * 3, { c: o.c || C.blanc, e, a: 'c', ombre: o.ombre, contour: o.contour });
}

export function toast(ui, txt, coul) {
  // v7 : un message trop large pour l'écran se coupe en deux lignes.
  if (largeurTexte(txt) > L - 24 && txt.includes(' ')) {
    const mots = txt.split(' ');
    let a = '';
    while (mots.length && largeurTexte(a + ' ' + mots[0]) <= L - 24) a = (a ? a + ' ' : '') + mots.shift();
    if (a && mots.length) {
      ui.toasts.push({ txt: a, coul: coul || C.creme, t0: M.t });
      txt = mots.join(' ');
    }
  }
  ui.toasts.push({ txt, coul: coul || C.creme, t0: M.t });
  if (ui.toasts.length > 3) ui.toasts.shift();
}

// --------------------------------------------------------------- Bulles

function extrasCarte(c) {
  const ex = [];
  if (c.amel) ex.push({ titre: AMELIORATIONS[c.amel].nom + ' :', corps: AMELIORATIONS[c.amel].desc });
  if (c.edition) ex.push({ titre: EDITIONS[c.edition].nom + ' :', corps: EDITIONS[c.edition].desc });
  if (c.sceau) ex.push({ titre: SCEAUX[c.sceau].nom + ' :', corps: SCEAUX[c.sceau].desc });
  return ex;
}
export function bulleCarte(c, etat, o = {}) {
  if (o.cachee) return { titre: 'Carte face cachée', corps: 'Tu ne sauras ce qu\'elle vaut qu\'en la jouant.' };
  const j = c.rang >= 11 && c.rang <= 13 ? 10 : c.rang === 14 ? 11 : c.rang;
  const ex = extrasCarte(c);
  if (c.niv > 0) ex.push({ titre: 'Retouchée, niveau ' + c.niv + ' :', corps: '{j|+' + 15 * c.niv + ' jetons} et {m|+' + 2 * c.niv + ' multi} quand elle marque.' });
  return {
    titre: nomCarte(c),
    corps: '{j|+' + (j + (c.bonus || 0)) + ' jetons}' + (o.affaiblie ? ' {g|(affaiblie : ne marque rien)}' : ''),
    extras: ex,
  };
}
export function bulleJoker(j, etat, o = {}) {
  const d = JOKER[j.id];
  const ex = [];
  if (j.edition) ex.push({ titre: EDITIONS[j.edition].nom + ' :', corps: EDITIONS[j.edition].desc });
  const coul = COUL_RARETE[d.r][1];
  let pied = o.pied || '';
  const possede = etat && etat.jokers.includes(j);
  if (!pied && possede) {
    pied = 'Revente : {l|' + valeurVenteJoker(etat, j) + ' louis}';
    const cs = combosActifs(etat.jokers).filter((c) => c.uids.includes(j.uid));
    if (cs.length) pied = 'Combo : ' + cs.map(nomCombo).join(', ') + '. ' + pied;
  }
  // v6 : niveau et synergies.
  const niv = nivJoker(j);
  if (niv > 1) ex.unshift({ titre: 'Niveau ' + niv + ' :', corps: 'effets {v|×' + String(facteurNiv(niv)).replace('.', ',') + '}' + (d.rejoue || d.rejoueEnMain ? (niv >= 3 ? ', et une rejoue de plus' : '') : '') + '.' });
  else if (possede && peutMonter(d) && !d.pousse) ex.push({ titre: 'Niveau 1 :', corps: '{g|un doublon ou une répétition en boutique le fait monter (effets ×1,4 puis ×1,8).}' });
  if (etat) {
    const rangee = etat.jokers;
    for (const sy of synergiesDuJoker(j.id)) {
      const a = avancementSynergies(possede ? rangee : rangee.concat([{ id: j.id, uid: -1 }])).find((x) => x.id === sy.id);
      const deja = avancementSynergies(rangee).find((x) => x.id === sy.id);
      let t;
      if (possede && a.actif) t = '{v|active} : ' + sy.effet;
      else if (!possede && a.actif && !deja.actif) t = '{v|ce joker la complète !} ' + sy.effet;
      else {
        const manque = a.manquants.slice(0, Math.max(a.manqueMembres, 0)).map((id) => (JOKER[id] ? JOKER[id].nom : id));
        const reste = [];
        if (a.manqueMembres) reste.push(a.manquants.length > a.manqueMembres ? a.manqueMembres + ' parmi ' + a.manquants.map((id) => JOKER[id].nom).join(', ') : manque.join(', '));
        if (a.manquePlus) reste.push(a.manquePlus + ' autre' + (a.manquePlus > 1 ? 's' : '') + ' (' + (sy.autres || '') + ')');
        t = a.n + '/' + a.besoin + (reste.length ? ', il manque ' + reste.join(' et ') : '') + '. ' + sy.effet;
      }
      ex.push({ titre: '★ ' + sy.nom + ' :', corps: t });
    }
  }
  // v7 : la réplique du personnage.
  if (repliqueDe(j.id) && !o.sansReplique) ex.unshift({ titre: '', corps: '{g|« ' + repliqueDe(j.id) + ' »}' });
  return { titre: d.nom, sous: RARETES[d.r].nom + (d.sig ? ' · Signature Velours' : ''), sousCoul: coul, corps: descJoker(j, etat), extras: ex, pied };
}
export function bulleConso(id, pied) {
  const d = CONSO[id];
  return { titre: d.nom, sous: NOM_CAT[d.cat], sousCoul: d.cat === 'astre' ? C.bleu2 : d.cat === 'ombre' ? C.gris3 : C.violet2, corps: d.desc, pied };
}

// ---------------------------------------------------------- Panneau gauche

function panneauGauche(g, app, vue) {
  if (PORTRAIT) return bandeauPortrait(g, app, vue);
  const e = app.etat;
  const ui = app.ui;
  const m = e.manche;
  const P_ = P.infoPalier(e);
  const idx = m ? m.type : e.mancheIdx;
  const patron = idx === 2 ? PATRON[m ? m.patron : P_.patron] : null;
  const teinte = patron ? TEINTES[patron.teinte] : idx === 1 ? TEINTES.or : TEINTES.bleu;
  const enManche = !!m && (e.phase === 'manche' || e.phase === 'encaissement' || e.phase === 'victoire' || e.phase === 'defaite' || ui.scene);

  // Mise en cours.
  panneau(g, PX, 4, PW, 66, { fond: C.nuit2, clair: C.nuit4 });
  rrect(g, PX + 2, 6, PW - 4, 13, teinte[0], 1);
  rect(g, PX + 3, 6, PW - 6, 1, teinte[1]);
  texte(g, patron ? patron.nom : P.NOMS_MANCHE[idx], PX + PW / 2, 9, { c: C.blanc, a: 'c', ombre: C.noir });
  if (patron) g.drawImage(spritePatron(patron, 32), PX + 6, 24);
  else g.drawImage(spriteJeton(idx === 1 ? 'or' : 'bleu', 32), PX + 6, 24);
  rect(g, PX + 5, 23, 34, 1, C.noir);
  const cible = enManche ? vue.cible : P.cibleManche(e, idx);
  texte(g, 'SCORE À BATTRE', PX + 44, 24, { c: C.gris2 });
  nombre(g, fmt(cible), PX + 94, 34, 98, { c: C.rouge2, ombre: C.noir });
  texte(g, 'GAIN', PX + 44, 56, { c: C.gris2 });
  const gain = P.gainManche(e, idx);
  for (let i = 0; i < gain; i++) louis(g, PX + 72 + i * 8, 56);
  if (!gain) texte(g, 'AUCUN', PX + 72, 56, { c: C.gris1 });
  zone({ id: 'p-mise', x: PX, y: 4, w: PW, h: 66, bulleBas: true, bulle: patron ? { titre: patron.nom, sous: 'Patron', sousCoul: teinte[2], corps: patron.desc + (m && m.patronAnnule ? ' {v|(Annulé par ton joker.)}' : '') } : { titre: P.NOMS_MANCHE[idx], corps: 'Marque le score demandé avant d\'épuiser tes mains.' } });

  // Effet du patron.
  panneau(g, PX, 72, PW, 22, { fond: patron ? teinte[0] : C.nuit2 });
  if (patron) {
    const lignes = couperTexte(m && m.patronAnnule ? 'Effet annulé' : patron.court, PW - 10);
    lignes.slice(0, 2).forEach((l, i) => texte(g, l, PX + PW / 2, (lignes.length > 1 ? 75 : 79) + i * 9, { c: teinte[2], a: 'c' }));
  } else {
    texte(g, JEU[e.regles.jeu].nom, PX + PW / 2, 75, { c: C.gris2, a: 'c' });
    texte(g, 'ENJEU ' + ENJEUX[e.regles.enjeu].nom, PX + PW / 2, 84, { c: C.gris1, a: 'c' });
  }

  // Score de la manche.
  panneau(g, PX, 96, PW, 44, { fond: C.nuit2, clair: C.nuit4 });
  texte(g, 'SCORE DE LA MANCHE', PX + PW / 2, 100, { c: C.gris2, a: 'c' });
  const sc = compteur(ui, 'score', enManche ? vue.score : 0, 8);
  const pop = M.t - sc.t < 0.15;
  nombre(g, fmt(Math.round(sc.v)), PX + PW / 2, pop ? 110 : 111, PW - 12, { c: pop ? C.or3 : C.blanc, ombre: C.noir });
  // Jauge.
  rect(g, PX + 6, 130, PW - 12, 5, C.noir);
  const ratio = enManche && cible > 0 ? Math.min(1, sc.v / cible) : 0;
  rect(g, PX + 7, 131, Math.round((PW - 14) * ratio), 3, ratio >= 1 ? C.vert1 : C.or2);
  rect(g, PX + 7, 131, Math.round((PW - 14) * ratio), 1, ratio >= 1 ? C.vert2 : C.or3);

  // Mains et défausses.
  const demi = (PW - 2) / 2;
  const cases = [['MAINS', vue.mains, C.bleu1, C.bleu2, 'Mains restantes dans cette manche.'], ['DÉFAUSSES', vue.defausses, C.rouge1, C.rouge2, 'Défausses restantes dans cette manche.']];
  cases.forEach(([lab, val, c1, c2, aide], i) => {
    const x = PX + i * (demi + 2);
    panneau(g, x, 142, demi, 36, { fond: C.nuit2, clair: C.nuit4 });
    texte(g, lab, x + demi / 2, 146, { c: C.gris2, a: 'c' });
    rrect(g, x + 14, 156, demi - 28, 18, C.noir, 2);
    rrect(g, x + 15, 157, demi - 30, 16, melange(c1, '#000000', 0.55), 1);
    texte(g, String(val), x + demi / 2, 158, { c: c2, e: 2, a: 'c' });
    zone({ id: 'p-' + lab, x, y: 142, w: demi, h: 36, bulle: { titre: lab === 'MAINS' ? 'Mains' : 'Défausses', corps: aide } });
  });

  // Louis.
  panneau(g, PX, 180, PW, 30, { fond: C.nuit2, clair: C.nuit4 });
  const ar = compteur(ui, 'argent', vue.argent, 12);
  const popA = M.t - ar.t < 0.2;
  const sA = fmt(Math.round(ar.v));
  const wA = largeurTexte(sA, 2);
  const xA = PX + PW / 2 - (wA + 18) / 2;
  g.drawImage(pieceGrande(), Math.round(xA), 187 - (popA ? 1 : 0));
  texte(g, sA, xA + 18, 188 - (popA ? 1 : 0), { c: ar.v < 0 ? C.rouge2 : C.or3, e: 2, ombre: C.noir });
  const plafond = Math.max(0, e.regles.interetMax + mod(e, 'interetMax'));
  zone({ id: 'p-louis', x: PX, y: 180, w: PW, h: 30, bulle: { titre: 'Louis', corps: 'Ta monnaie. À la fin de chaque manche, tu touches {l|1 louis} d\'intérêt par tranche de ' + e.regles.interetPar + ' louis gardés, jusqu\'à {l|' + plafond + '}.' } });

  // Palier et manche.
  panneau(g, PX, 212, PW, 36, { fond: C.nuit2, clair: C.nuit4 });
  texte(g, 'PALIER', PX + 8, 217, { c: C.gris2 });
  texte(g, e.palier + (e.palier <= e.regles.paliers ? '/' + e.regles.paliers : ''), PX + 8, 228, { c: C.or3, e: 2, ombre: C.noir });
  texte(g, 'MANCHE', PX + 84, 217, { c: C.gris2 });
  for (let i = 0; i < 3; i++) {
    const et = ui.scene ? ui.scene.etats[i] : P_.etats[i];
    const cx = PX + 90 + i * 20;
    const k = i === 2 ? TEINTES[PATRON[P_.patron].teinte] : i === 1 ? TEINTES.or : TEINTES.bleu;
    ell(g, cx, 235, 7, 7, C.noir);
    ell(g, cx, 235, 6, 6, et === 'a_venir' ? (i === idx ? k[1] : i === 2 ? k[0] : C.gris0) : et === 'battue' ? C.vert1 : C.gris1);
    if (et === 'battue') motif(g, ['....#', '...#.', '#.#..', '.#...'], cx - 2, 233, C.blanc);
    else if (et === 'passee') motif(g, ['#.#.', '.#.#', '#.#.'], cx - 2, 234, C.gris3);
    else if (i === idx && Math.floor(M.t * 2) % 2 === 0) rect(g, cx - 1, 234, 3, 3, C.blanc);
  }
  zone({ id: 'p-palier', x: PX, y: 212, w: PW, h: 36, bulle: { titre: 'Palier ' + e.palier, sous: 'Patron : ' + PATRON[P_.patron].nom, sousCoul: TEINTES[PATRON[P_.patron].teinte][2], corps: '{x|' + PATRON[P_.patron].nom + '} t\'attend en fin de palier : ' + PATRON[P_.patron].desc + ' Chaque palier compte 3 manches : petite mise, grande mise, puis le patron.' } });

  // Dernière main et main favorite.
  panneau(g, PX, 250, PW, 40, { fond: C.nuit2, clair: C.nuit4 });
  const priv = e.privileges.length;
  texte(g, 'PRIVILÈGES', PX + 8, 255, { c: C.gris2 });
  if (!priv) texte(g, 'AUCUN', PX + 8, 268, { c: C.gris1 });
  e.privileges.slice(0, 8).forEach((id, i) => {
    const x = PX + 8 + i * 17;
    rrect(g, x, 265, 15, 19, C.noir, 1);
    rrect(g, x + 1, 266, 13, 17, C.or2, 1);
    rect(g, x + 2, 267, 11, 4, Object.values(TEINTES)[hach(id) % 10][1]);
    motif(g, ['#.#.#', '#####', '#####'], x + 5, 275, C.or0);
    zone({ id: 'priv-' + id, x, y: 265, w: 15, h: 19, bulle: { titre: PRIVILEGE[id].nom, sous: 'Privilège', sousCoul: C.or3, corps: PRIVILEGE[id].desc } });
  });

  // Boutons du bas.
  const bw = 47;
  bouton(g, 'b-infos', PX, 294, bw, 20, 'MAINS', { coul: 'nuit', clic: () => ouvrirCalque(app, 'infos'), bulle: { titre: 'Tes mains', corps: 'Niveaux, valeurs de base et nombre de fois jouées.' } });
  bouton(g, 'b-paquet', PX + bw + 3, 294, bw, 20, 'PAQUET', { coul: 'nuit', clic: () => ouvrirCalque(app, 'paquet'), bulle: { titre: 'Ton paquet', corps: 'Toutes tes cartes, et celles qui restent à piocher.' } });
  bouton(g, 'b-menu', PX + 2 * bw + 6, 294, PW - 2 * bw - 6, 20, 'MENU', { coul: 'nuit', clic: () => app.pause() });
  if (mentorActif(app)) bouton(g, 'b-mentor', PX, 317, PW, 14, 'MENTOR : LE MEILLEUR COUP', { coul: 'or', ctexte: C.noir, clic: () => conseiller(app), bulle: { titre: 'Le Mentor', corps: 'Le meilleur coup pour ta main ou la boutique, et pourquoi.' } });
  else texte(g, 'GRAINE ' + e.graine, PX + PW / 2, 322, { c: C.gris1, a: 'c' });
  if (e.zen) texte(g, 'MODE ZEN', PX + PW / 2, 333, { c: C.vert2 || C.or1, a: 'c' });
  else if (e.defi) texte(g, 'DÉFI DU ' + e.defi.date.slice(8) + '/' + e.defi.date.slice(5, 7), PX + PW / 2, 333, { c: C.or1, a: 'c' });
  else if (app.demo) texte(g, 'DÉMONSTRATION', PX + PW / 2, 333, { c: C.or1, a: 'c' });
  else if (e.atelier) texte(g, 'RÈGLES D\'ATELIER', PX + PW / 2, 333, { c: C.violet2, a: 'c' });
  bouton(g, 'b-son', PX, 340, 70, 16, app.meta.options.muet ? 'SON COUPÉ' : 'SON ACTIF', { coul: app.meta.options.muet ? 'gris' : 'nuit', clic: () => app.basculerSon() });
  const v = app.meta.options.vitesse;
  bouton(g, 'b-vit', PX + 74, 340, PW - 74, 16, 'VITESSE ×' + v, { coul: 'nuit', clic: () => app.changerVitesse(), bulle: { titre: 'Vitesse des animations', corps: 'Maintenir le clic accélère aussi le décompte.' } });
}

// Portrait : le panneau de gauche devient un bandeau compact en haut, et les boutons de service passent en bas.
function bandeauPortrait(g, app, vue) {
  const e = app.etat;
  const ui = app.ui;
  const m = e.manche;
  const P_ = P.infoPalier(e);
  const idx = m ? m.type : e.mancheIdx;
  const patron = idx === 2 ? PATRON[m ? m.patron : P_.patron] : null;
  const teinte = patron ? TEINTES[patron.teinte] : idx === 1 ? TEINTES.or : TEINTES.bleu;
  const enManche = !!m && (e.phase === 'manche' || e.phase === 'encaissement' || e.phase === 'victoire' || e.phase === 'defaite' || ui.scene);
  const W = L - 8;
  const demi = (W - 4) / 2;
  // Mise et score à battre.
  panneau(g, 4, 2, demi, 42, { fond: C.nuit2, clair: C.nuit4 });
  rrect(g, 6, 4, demi - 4, 11, teinte[0], 1);
  texte(g, patron ? patron.nom : P.NOMS_MANCHE[idx], 4 + demi / 2, 6, { c: C.blanc, a: 'c', ombre: C.noir });
  if (patron) g.drawImage(spritePatron(patron, 24), 8, 17);
  else g.drawImage(spriteJeton(idx === 1 ? 'or' : 'bleu', 24), 8, 17);
  const cible = enManche ? vue.cible : P.cibleManche(e, idx);
  texte(g, 'À BATTRE', 36, 18, { c: C.gris2 });
  nombre(g, fmt(cible), 36 + (demi - 38) / 2, 27, demi - 40, { c: C.rouge2, ombre: C.noir });
  zone({ id: 'p-mise', x: 4, y: 2, w: demi, h: 42, bulleBas: true, bulle: patron ? { titre: patron.nom, sous: 'Patron', sousCoul: teinte[2], corps: patron.desc + (m && m.patronAnnule ? ' {v|(Annulé par ton joker.)}' : '') } : { titre: P.NOMS_MANCHE[idx], corps: 'Marque le score demandé avant d\'épuiser tes mains. Gain : ' + P.gainManche(e, idx) + ' louis.' } });
  // Score de la manche.
  const xs = 8 + demi;
  panneau(g, xs, 2, demi, 42, { fond: C.nuit2, clair: C.nuit4 });
  texte(g, 'SCORE', xs + demi / 2, 6, { c: C.gris2, a: 'c' });
  const sc = compteur(ui, 'score', enManche ? vue.score : 0, 8);
  const pop = M.t - sc.t < 0.15;
  nombre(g, fmt(Math.round(sc.v)), xs + demi / 2, pop ? 15 : 16, demi - 12, { c: pop ? C.or3 : C.blanc, ombre: C.noir });
  rect(g, xs + 6, 35, demi - 12, 5, C.noir);
  const ratio = enManche && cible > 0 ? Math.min(1, sc.v / cible) : 0;
  rect(g, xs + 7, 36, Math.round((demi - 14) * ratio), 3, ratio >= 1 ? C.vert1 : C.or2);
  // Mains, défausses, louis, palier.
  const q = (W - 6) / 4;
  const cases = [['MAINS', vue.mains, C.bleu1, C.bleu2, 'Mains restantes dans cette manche.'], ['DÉFAUSSES', vue.defausses, C.rouge1, C.rouge2, 'Défausses restantes dans cette manche.']];
  cases.forEach(([lab, val, c1, c2, aide], i) => {
    const x = 4 + i * (q + 2);
    panneau(g, x, 47, q, 32, { fond: C.nuit2, clair: C.nuit4 });
    texte(g, lab, x + q / 2, 50, { c: C.gris2, a: 'c' });
    rrect(g, x + 12, 59, q - 24, 17, melange(c1, '#000000', 0.55), 1);
    texte(g, String(val), x + q / 2, 61, { c: c2, e: 2, a: 'c' });
    zone({ id: 'p-' + lab, x, y: 47, w: q, h: 32, bulle: { titre: lab === 'MAINS' ? 'Mains' : 'Défausses', corps: aide } });
  });
  {
    const x = 4 + 2 * (q + 2);
    panneau(g, x, 47, q, 32, { fond: C.nuit2, clair: C.nuit4 });
    texte(g, 'LOUIS', x + q / 2, 50, { c: C.gris2, a: 'c' });
    const ar = compteur(ui, 'argent', vue.argent, 12);
    const popA = M.t - ar.t < 0.2;
    const sA = fmt(Math.round(ar.v));
    const wA = largeurTexte(sA, 2);
    const xA = x + q / 2 - (wA + 16) / 2;
    g.drawImage(pieceGrande(), Math.round(xA), 60 - (popA ? 1 : 0));
    texte(g, sA, xA + 16, 61 - (popA ? 1 : 0), { c: ar.v < 0 ? C.rouge2 : C.or3, e: 2, ombre: C.noir });
    const plafond = Math.max(0, e.regles.interetMax + mod(e, 'interetMax'));
    zone({ id: 'p-louis', x, y: 47, w: q, h: 32, bulle: { titre: 'Louis', corps: 'Ta monnaie. À la fin de chaque manche, tu touches {l|1 louis} d\'intérêt par tranche de ' + e.regles.interetPar + ' louis gardés, jusqu\'à {l|' + plafond + '}.' } });
  }
  {
    const x = 4 + 3 * (q + 2);
    panneau(g, x, 47, q, 32, { fond: C.nuit2, clair: C.nuit4 });
    texte(g, 'PALIER ' + e.palier + (e.palier <= e.regles.paliers ? '/' + e.regles.paliers : ''), x + q / 2, 50, { c: C.or3, a: 'c' });
    for (let i = 0; i < 3; i++) {
      const et = ui.scene ? ui.scene.etats[i] : P_.etats[i];
      const cx = x + q / 2 - 20 + i * 20;
      const k = i === 2 ? TEINTES[PATRON[P_.patron].teinte] : i === 1 ? TEINTES.or : TEINTES.bleu;
      ell(g, cx, 67, 7, 7, C.noir);
      ell(g, cx, 67, 6, 6, et === 'a_venir' ? (i === idx ? k[1] : i === 2 ? k[0] : C.gris0) : et === 'battue' ? C.vert1 : C.gris1);
      if (et === 'battue') motif(g, ['....#', '...#.', '#.#..', '.#...'], cx - 2, 65, C.blanc);
      else if (i === idx && Math.floor(M.t * 2) % 2 === 0) rect(g, cx - 1, 66, 3, 3, C.blanc);
    }
    zone({ id: 'p-palier', x, y: 47, w: q, h: 32, bulle: { titre: 'Palier ' + e.palier, sous: 'Patron : ' + PATRON[P_.patron].nom, sousCoul: TEINTES[PATRON[P_.patron].teinte][2], corps: '{x|' + PATRON[P_.patron].nom + '} t\'attend en fin de palier : ' + PATRON[P_.patron].desc + ' Chaque palier compte 3 manches : petite mise, grande mise, puis le patron.' } });
  }
  // Effet du patron, ou le jeu et l'enjeu.
  panneau(g, 4, 82, W, 18, { fond: patron ? teinte[0] : C.nuit2 });
  const ligne = patron ? (m && m.patronAnnule ? 'Effet annulé' : patron.court) : JEU[e.regles.jeu].nom + ' · enjeu ' + ENJEUX[e.regles.enjeu].nom;
  texte(g, couperTexte(ligne, W - 60)[0], 10, 87, { c: patron ? teinte[2] : C.gris2 });
  const priv = e.privileges.length;
  texte(g, 'PRIV. ' + priv, W, 87, { c: priv ? C.or2 : C.gris1, a: 'd' });
  zone({ id: 'p-priv', x: W - 50, y: 82, w: 54, h: 18, bulle: { titre: 'Privilèges', corps: priv ? e.privileges.map((id) => PRIVILEGE[id].nom + ' : ' + PRIVILEGE[id].desc).join(' ') : 'Aucun pour l\'instant. La boutique en propose un par palier.' } });
  // Barre de service, tout en bas.
  const yb = H - 34;
  if (mentorActif(app)) {
    // Six boutons : le Mentor en or, au bout du pouce.
    const lab = [['b-infos', 'MAINS', () => ouvrirCalque(app, 'infos')], ['b-paquet', 'PAQUET', () => ouvrirCalque(app, 'paquet')], ['b-menu', 'MENU', () => app.pause()],
      ['b-son', app.meta.options.muet ? 'MUET' : 'SON', () => app.basculerSon()], ['b-vit', 'VIT.×' + app.meta.options.vitesse, () => app.changerVitesse()]];
    const bw6 = Math.floor((L - 8 - 5 * 3) / 6);
    lab.forEach(([id, t, f], i) => bouton(g, id, 4 + i * (bw6 + 3), yb, bw6, 20, t, { coul: id === 'b-son' && app.meta.options.muet ? 'gris' : 'nuit', clic: f }));
    bouton(g, 'b-mentor', 4 + 5 * (bw6 + 3), yb, L - 4 - (4 + 5 * (bw6 + 3)), 20, 'MENTOR', { coul: 'or', ctexte: C.noir, clic: () => conseiller(app) });
  } else {
  const bw = 66;
  bouton(g, 'b-infos', 4, yb, bw, 20, 'MAINS', { coul: 'nuit', clic: () => ouvrirCalque(app, 'infos') });
  bouton(g, 'b-paquet', 4 + (bw + 3), yb, bw, 20, 'PAQUET', { coul: 'nuit', clic: () => ouvrirCalque(app, 'paquet') });
  bouton(g, 'b-menu', 4 + 2 * (bw + 3), yb, bw, 20, 'MENU', { coul: 'nuit', clic: () => app.pause() });
  bouton(g, 'b-son', 4 + 3 * (bw + 3), yb, 70, 20, app.meta.options.muet ? 'SON COUPÉ' : 'SON', { coul: app.meta.options.muet ? 'gris' : 'nuit', clic: () => app.basculerSon() });
  bouton(g, 'b-vit', 4 + 3 * (bw + 3) + 73, yb, L - 4 - (4 + 3 * (bw + 3) + 73), 20, 'VIT. ×' + app.meta.options.vitesse, { coul: 'nuit', clic: () => app.changerVitesse() });
  }
  const pied = e.zen ? 'MODE ZEN : SANS ÉCHEC' : e.defi ? 'DÉFI DU ' + e.defi.date.slice(8) + '/' + e.defi.date.slice(5, 7) : app.demo ? 'DÉMONSTRATION' : e.atelier ? 'RÈGLES D\'ATELIER' : e.epreuve ? 'ÉPREUVE : ' + e.epreuve.nom.toUpperCase() : '';
  texte(g, 'GRAINE ' + e.graine + (pied ? ' · ' + pied : ''), L / 2, H - 11, { c: C.gris1, a: 'c' });
}

function hach(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

let pieceG = null;
function pieceGrande() {
  if (pieceG) return pieceG;
  const [cv, g] = toile(14, 14);
  ell(g, 7, 7, 6.5, 6.5, C.noir);
  ell(g, 7, 7, 5.5, 5.5, C.or1);
  ell(g, 6.5, 6.5, 4.5, 4.5, C.or2);
  rect(g, 4, 3, 3, 1, C.or3);
  rect(g, 3, 4, 1, 3, C.or3);
  motif(g, ['#..', '#..', '#..', '#..', '###'], 6, 5, C.or0);
  pieceG = cv;
  return cv;
}

// ------------------------------------------------- Jokers et consommables

function rangeeJokers(g, app, jokers, o = {}) {
  const e = app.etat;
  const ui = app.ui;
  const x0 = TX + 10;
  const largeur = PORTRAIT ? TW - 20 : 312;
  const n = jokers.length;
  const max = emplJokers(e);
  const pas = n > 1 ? Math.min(52, (largeur - LC) / (n - 1)) : 52;
  // Emplacements vides.
  const places = Math.min(Math.max(max, n), 6);
  for (let i = 0; i < places; i++) {
    const x = x0 + i * 52;
    g.globalAlpha = 0.35;
    rrect(g, x, Y_JOKERS, LC, HC, C.velours0, 3);
    g.globalAlpha = 1;
  }
  texte(g, 'JOKERS ' + jokersComptes(e) + '/' + max, x0, Y_JOKERS + HC + 4, { c: C.velours5 });
  const m = e.manche;
  const survolCarte = M.survol && M.survol.carte ? M.survol.carte : null;
  const survolJoker = M.survol && M.survol.joker ? M.survol.joker : null;
  const h = aides(e);
  let dessus = null;
  jokers.forEach((j, i) => {
    const cle = 'j' + j.uid;
    let tx = x0 + i * pas;
    let ty = Y_JOKERS;
    const glisse = M.glisse && M.glisse.actif && M.glisse.ref.type === 'joker' && M.glisse.ref.uid === j.uid;
    if (glisse) {
      tx = M.souris.x - M.glisse.dx;
      ty = M.souris.y - M.glisse.dy;
    } else if (ui.selJoker === j.uid) ty -= 4;
    const v = poser(cle, tx, ty, { depuis: { x: tx, y: -70 }, immediat: glisse });
    const d = JOKER[j.id];
    let lu = null;
    if (survolCarte && d.cible && d.cible(survolCarte, h)) lu = C.or3;
    if (survolJoker && survolJoker !== j && survolJoker.uid !== j.uid && compatibles(survolJoker, j)) lu = C.vert2;
    if (survolJoker && survolJoker.uid !== j.uid) {
      const ds = JOKER[survolJoker.id];
      const k = jokers.indexOf(jokers.find((q) => q.uid === survolJoker.uid));
      if (ds.copie && k >= 0 && ds.copie(jokers, k).includes(i)) lu = C.cyan1;
    }
    if (ui.selJoker === j.uid) lu = C.blanc;
    const dessin = () => dessinerJoker(g, j, v.x, v.y - v.saut, { muet: m && m.jokerMuet === j.uid && !ui.scene, lueur: lu });
    if (glisse) dessus = dessin;
    else dessin();
    // v5 : une ligne sous chaque joker, ce qu'il va apporter (aperçu) ou vient d'apporter (dernière main).
    if (!glisse) badgeApport(g, app, j, v.x, v.y - v.saut);
    if (!glisse) {
      zone({
        id: 'joker:' + j.uid, x: v.x, y: v.y, w: i < n - 1 ? Math.max(12, pas) : LC, h: HC, joker: j, bulleY: e.phase === 'manche' ? (PORTRAIT ? Y_CONSOS : Y_JEU - 8) : null, bulleBas: true,
        bulle: () => bulleJoker(j, e),
        clic: o.fige ? null : () => {
          ui.selJoker = ui.selJoker === j.uid ? null : j.uid;
          ui.selConso = null;
          son.choisir();
        },
        glisser: o.fige ? null : {
          type: 'joker', uid: j.uid,
          lacher: (x, y, gl) => {
            const vers = Math.round((x - gl.dx - x0) / pas);
            P.deplacerJoker(e, j.uid, vers);
            son.carte();
            app.apres();
          },
        },
      });
    }
  });
  if (dessus) dessus();
  dessinerCombos(g, app, jokers, x0, pas, o);
  // Actions sur le joker choisi.
  const sel = jokers.find((j) => j.uid === ui.selJoker);
  if (sel && !o.fige && !ui.occupe && e.jokers.includes(sel)) {
    const i = jokers.indexOf(sel);
    const bx = Math.min(x0 + i * pas - 4, TX + TW - 66);
    const val = valeurVenteJoker(e, sel);
    bouton(g, 'vendre-joker', bx, Y_JOKERS + HC + 1, 56, 15, { t: 'VENDRE', prix: val }, { coul: 'vert', clic: () => {
      P.vendreJoker(e, sel.uid);
      ui.selJoker = null;
      son.vente();
      popup(bx + 28, Y_JOKERS + HC, '+' + val, C.or3);
      app.apres();
    } });
    // v6 : en boutique, la répétition fait monter le joker d'un niveau (une par boutique).
    if (e.phase === 'boutique' && peutMonter(JOKER[sel.id]) && !JOKER[sel.id].pousse) {
      const v = P.peutRepeter(e, sel);
      const prix = P.prixNiveau(e, sel);
      const max = nivJoker(sel) >= NIV_MAX;
      const bx2 = bx + 58 + 64 > TX + TW ? bx - 66 : bx + 58;
      bouton(g, 'monter-joker', bx2, Y_JOKERS + HC + 1, 64, 15, max ? 'NIV MAX' : { t: 'NIV ' + (nivJoker(sel) + 1), prix }, {
        coul: 'or', ctexte: C.noir, actif: v.ok && P.peutPayer(e, prix),
        refus: () => {
          toast(ui, v.ok ? 'Pas assez de louis.' : v.raison, C.rouge2);
          son.refus();
        },
        clic: () => {
          const r = P.monterJoker(e, sel.uid);
          if (!r.ok) {
            toast(ui, r.raison, C.rouge2);
            son.refus();
            return;
          }
          celebrerNiveau(app, sel);
          app.apres();
        },
        bulle: { titre: 'Répétition', corps: 'Le joker monte au niveau ' + Math.min(NIV_MAX, nivJoker(sel) + 1) + ' : effets {v|×' + String(facteurNiv(Math.min(NIV_MAX, nivJoker(sel) + 1))).replace('.', ',') + '}. {g|Une répétition par boutique.}' },
      });
    }
  } else if (ui.selJoker && !sel) ui.selJoker = null;
}

// Couleurs des combos (voir noyau/combos.js).
const COUL_COMBO = { or: C.or3, cyan: C.cyan1, gris: C.gris3, bleu: C.bleu2, violet: C.violet2, rouge: C.rouge2, encre: '#8f9bd6', vert: C.vert2, bois: '#d9a87a', orange: '#ffc27a' };

// Les liens de la troupe : un fil coloré au-dessus des jokers qui forment un combo, et le nom du numéro.
// v6 : une synergie vient de se former (ou un joker de monter) : la salle le salue.
function celebrerSynergie(app, sy) {
  const ui = app.ui;
  toast(ui, '★ Synergie : ' + sy.nom, C.or3);
  popup(CX, PORTRAIT ? Y_TABLE + 10 : Y_METRE + 4, '★ ' + sy.nom.toUpperCase() + ' ★', C.or3, { fond: C.noir, vy: -6, duree: 2, groupe: 'synergie' });
  popup(CX, PORTRAIT ? Y_TABLE + 24 : Y_METRE + 18, sy.court, C.creme, { fond: C.noir, vy: -6, duree: 2, groupe: 'synergie2' });
  flasher(C.or3, 0.22);
  vibrer([20, 40, 30]);
  son.combo(3);
}
function celebrerNiveau(app, j) {
  const p = positionDe('j' + j.uid) || { x: CX, y: Y_JOKERS };
  popup(p.x + LC / 2, Y_JOKERS + 6, 'NIVEAU ' + nivJoker(j) + ' !', C.or3, { fond: C.noir, vy: -8, duree: 1.4 });
  eclats(p.x + LC / 2, Y_JOKERS + HC / 2, 24, [C.or3, C.blanc, C.or1], { vitesse: 80 });
  toast(app.ui, JOKER[j.id].nom + ' passe au niveau ' + nivJoker(j) + '.', C.or3);
  son.achat();
  son.combo(2);
}

function dessinerSynergies(g, app, jokers, x0, pas, o) {
  const ui = app.ui;
  const ss = synergiesRangee(jokers);
  const ids = ss.map((a) => a.id).join(',');
  if (!o.fige && ui.synVues !== undefined && ids !== ui.synVues) {
    const avant = new Set((ui.synVues || '').split(',').filter(Boolean));
    const neuve = ss.find((a) => !avant.has(a.id));
    if (neuve) celebrerSynergie(app, neuve.s);
  }
  if (!o.fige) ui.synVues = ids;
  // Un double fil d'or au-dessus des membres, qui scintille.
  ss.slice(0, 2).forEach((a, k) => {
    const xs = jokers.map((j, i) => (a.uids.includes(j.uid) ? (positionDe('j' + j.uid) || { x: x0 + i * pas }).x + LC / 2 : null)).filter((v) => v != null).map(Math.round);
    if (xs.length < 2) return;
    const y = Y_JOKERS - (PORTRAIT ? 5 : 6) - k * 3;
    const lo = Math.min(...xs), hi = Math.max(...xs);
    rect(g, lo, y, hi - lo + 1, 2, C.or1);
    rect(g, lo, y, hi - lo + 1, 1, C.or3);
    const sc = (Math.floor(M.t * 6) % Math.max(1, hi - lo)) + lo;
    rect(g, sc, y - 1, 3, 3, C.blanc);
    for (const x of xs) {
      rect(g, x - 2, y - 2, 5, 5, C.noir);
      rect(g, x - 1, y - 1, 3, 3, C.or3);
    }
  });
  return ss;
}

function dessinerCombos(g, app, jokers, x0, pas, o) {
  const ui = app.ui;
  const ss = synergiesRangee(jokers);
  const cs = combosActifs(jokers);
  // Un nouveau combo vient de se former : on le salue.
  const ids = cs.map((c) => c.id).join(',');
  if (!o.fige && ui.combosVus !== undefined && ids !== ui.combosVus) {
    const avant = new Set((ui.combosVus || '').split(',').filter(Boolean));
    const neuf = cs.find((c) => !avant.has(c.id));
    if (neuf) {
      toast(ui, 'Nouveau combo : ' + nomCombo(neuf), COUL_COMBO[neuf.couleur] || C.or3);
      son.combo(1);
    }
  }
  if (!o.fige) ui.combosVus = ids;
  if (!cs.length && !ss.length) {
    if (!o.fige) ui.synVues = '';
    return;
  }
  const sc = ui.scene;
  const vif = sc && sc.combo && M.t - sc.combo.t < 1.2;
  cs.slice(0, 3).forEach((c, k) => {
    const coul = COUL_COMBO[c.couleur] || C.or3;
    const xs = c.idx.map((i) => {
      const p = positionDe('j' + jokers[i].uid);
      return Math.round((p ? p.x : x0 + i * pas) + LC / 2);
    });
    const y = Y_JOKERS - 3 - k * 3;
    const a = Math.min(...xs);
    const b = Math.max(...xs);
    const pulse = vif && c.uids.some((u) => sc.combo.uids.includes(u)) ? (Math.floor(M.t * 10) % 2 ? C.blanc : coul) : coul;
    g.globalAlpha = 0.9;
    rect(g, a, y, b - a + 1, 1, pulse);
    for (const x of xs) rect(g, x - 1, y - 1, 3, 3, pulse);
    g.globalAlpha = 1;
  });
  dessinerSynergies(g, app, jokers, x0, pas, o);
  // Le nom, à côté du compte de jokers.
  const lab = 'JOKERS ' + jokersComptes(app.etat) + '/' + emplJokers(app.etat);
  const xl = x0 + largeurTexte(lab) + 8;
  const yl = Y_JOKERS + HC + 4;
  const principal = cs[0];
  // v6 : une synergie active passe devant les combos décoratifs, en or, avec son effet.
  const reste = ss.length + cs.length - 1;
  const s = ss.length ? '★ ' + ss[0].s.nom.toUpperCase() + (PORTRAIT ? '' : ' : ' + ss[0].s.court) + (reste > 0 ? ' +' + reste : '') : nomCombo(principal).toUpperCase() + (cs.length > 1 ? ' +' + (cs.length - 1) : '');
  if (ss.length) {
    const w = largeurTexte(s) + 6;
    g.globalAlpha = 0.85;
    rrect(g, xl - 3, yl - 2, w, 10, C.noir, 2);
    g.globalAlpha = 1;
  }
  texte(g, s, xl, yl, { c: ss.length ? (Math.floor(M.t * 2) % 2 ? C.or3 : C.or2) : COUL_COMBO[principal.couleur] || C.or3 });
  const corps = ss.map((a) => '{v|★ ' + a.s.nom + '} : ' + a.s.effet).concat(cs.map((c) => nomCombo(c) + ' : ' + c.desc)).join(' ');
  zone({ id: 'combos', x: xl - 2, y: yl - 3, w: largeurTexte(s) + 4, h: 12, bulleBas: true, bulle: { titre: ss.length ? (ss.length > 1 ? 'Tes synergies' : 'Synergie active') : cs.length > 1 ? 'Tes combos' : 'Combo', sous: ss.length ? 'Effets réels de ta troupe' : 'Les liens de ta troupe', sousCoul: C.or3, corps, pied: ss.length ? 'Une synergie reste active tant que ses membres sont sur scène (un joker muselé ne compte pas). Toutes les synergies : Collection, onglet Synergies.' : 'Les jokers reliés par un fil travaillent ensemble. Quand deux d\'entre eux agissent dans la même main, la salle crie le nom du combo, et la musique s\'étoffe.' } });
}

function rangeeConsos(g, app, o = {}) {
  const e = app.etat;
  const ui = app.ui;
  const max = emplConsos(e);
  const n = e.consommables.length;
  const places = Math.max(max, n, 1);
  const largeur = 112;
  const pas = places > 1 ? Math.min(54, (largeur - LC) / (places - 1)) : 54;
  const x0 = TX + TW - 10 - LC - (places - 1) * pas;
  for (let i = 0; i < Math.max(max, n); i++) {
    g.globalAlpha = 0.35;
    rrect(g, x0 + i * pas, Y_CONSOS, LC, HC, C.velours0, 3);
    g.globalAlpha = 1;
  }
  texte(g, (PORTRAIT ? 'CONSO. ' : 'CONSOMMABLES ') + n + '/' + max, TX + TW - 10, Y_CONSOS + HC + 4, { c: C.velours5, a: 'd' });
  e.consommables.forEach((c, i) => {
    let tx = x0 + i * pas;
    let ty = Y_CONSOS - (ui.selConso === c.uid ? 4 : 0);
    const glisse = M.glisse && M.glisse.actif && M.glisse.ref.type === 'conso' && M.glisse.ref.uid === c.uid;
    if (glisse) {
      tx = M.souris.x - M.glisse.dx;
      ty = M.souris.y - M.glisse.dy;
    }
    const v = poser('k' + c.uid, tx, ty, { depuis: { x: tx, y: -70 }, immediat: glisse });
    if (glisse) {
      // Dessiné plus tard, par-dessus la main (voir dessinerJeu).
      ui.consoGlisse = { id: c.id, x: Math.round(v.x), y: Math.round(v.y) };
      return;
    }
    ombreCarte(g, Math.round(v.x), Math.round(v.y));
    g.drawImage(spriteConso(c.id), Math.round(v.x), Math.round(v.y - v.saut));
    if (ui.selConso === c.uid) lueur(g, Math.round(v.x), Math.round(v.y), C.blanc);
    zone({
      glisser: o.fige || ui.occupe ? null : { type: 'conso', uid: c.uid, lacher: (x, y) => lacherConso(app, c, x, y) },
      id: 'conso:' + c.uid, x: v.x, y: v.y, w: i < n - 1 ? pas : LC, h: HC, bulleY: e.phase === 'manche' && !PORTRAIT ? Y_JEU - 8 : null, bulleBas: true,
      bulle: () => bulleConso(c.id, 'Revente : {l|' + P.valeurVenteConso(e, c) + ' louis}'),
      clic: o.fige ? null : () => {
        ui.selConso = ui.selConso === c.uid ? null : c.uid;
        ui.selJoker = null;
        son.choisir();
      },
    });
  });
  const sel = e.consommables.find((c) => c.uid === ui.selConso);
  if (sel && !o.fige && !ui.occupe) {
    const d = CONSO[sel.id];
    const v = P.peutUtiliser(e, d, ui.sel);
    const bx = TX + TW - 10 - 112;
    bouton(g, 'utiliser-conso', bx, Y_CONSOS + HC + 1, 58, 15, 'UTILISER', {
      coul: 'violet', actif: v.ok,
      refus: () => {
        toast(ui, v.raison, C.rouge2);
        son.refus();
      },
      clic: () => utiliserConso(app, sel),
      bulle: v.ok ? null : { titre: 'Impossible', corps: v.raison },
    });
    const val = P.valeurVenteConso(e, sel);
    bouton(g, 'vendre-conso', bx + 60, Y_CONSOS + HC + 1, 52, 15, { t: 'VENDRE', prix: val }, { coul: 'vert', clic: () => {
      P.vendreConso(e, sel.uid);
      ui.selConso = null;
      son.vente();
      app.apres();
    } });
  } else if (ui.selConso && !sel) ui.selConso = null;
}

function effetConso(app, d, res, x, y) {
  const ui = app.ui;
  if (d.cat === 'astre') {
    son.astre();
    eclats(x, y, 30, [C.bleu2, C.blanc, C.or3], { vitesse: 90 });
    if (res && res.niveau && MAIN[res.niveau]) {
      const m = MAIN[res.niveau];
      toast(ui, m.nom + ' passe au niveau ' + app.etat.niveaux[m.id].niveau, C.bleu2);
    } else if (res && res.niveau === 'toutes') toast(ui, 'Toutes tes mains montent d\'un niveau', C.bleu2);
  } else {
    son.arcane();
    eclats(x, y, 30, d.cat === 'ombre' ? [C.violet2, C.gris3, C.blanc] : [C.violet2, C.or3, C.blanc], { vitesse: 90 });
    if (res && res.texte) toast(ui, d.nom + ' : ' + res.texte, C.violet2);
  }
  flasher(d.cat === 'astre' ? C.bleu1 : C.violet1, 0.25);
}

// Carte de la main sous un point de l'écran, d'après les zones de l'image en cours.
function carteSous(x, y) {
  for (let i = M.zones.length - 1; i >= 0; i--) {
    const z = M.zones[i];
    if (z.id && z.id.startsWith('carte:') && x >= z.x && y >= z.y && x < z.x + z.w && y < z.y + z.h) return Number(z.id.slice(6));
  }
  return null;
}

// Quelles cartes vise un consommable lâché à cet endroit ? Renvoie null s'il retourne à sa place.
// Sur une carte déjà choisie : toute la sélection. Sur une autre carte : celle-là seule.
// Un consommable sans cible s'utilise en le lâchant sur la table, sous les rangées.
function cibleConso(app, c, x, y) {
  const d = CONSO[c.id];
  const id = app.etat.phase === 'manche' || app.etat.phase === 'paquet' ? carteSous(x, y) : null;
  if (d.max > 0) {
    if (id == null) return null;
    return app.ui.sel.includes(id) ? app.ui.sel.slice() : [id];
  }
  return y > (PORTRAIT ? Y_TABLE : Y_METRE) && x > TX ? [] : null;
}

function lacherConso(app, c, x, y) {
  const ui = app.ui;
  const sel = cibleConso(app, c, x, y);
  if (sel == null) {
    son.lacher();
    return;
  }
  utiliserConso(app, c, sel);
}

function utiliserConso(app, c, selIds) {
  const e = app.etat;
  const ui = app.ui;
  const pos = positionDe('k' + c.uid) || { x: CX, y: 60 };
  const r = P.utiliserConso(e, c.uid, selIds || ui.sel);
  if (!r.ok) {
    toast(ui, r.raison || 'Impossible.', C.rouge2);
    son.refus();
    return;
  }
  ui.sel = ui.sel.filter((id) => e.main.includes(id));
  ui.selConso = null;
  effetConso(app, r.def, r.res, pos.x + LC / 2, pos.y + HC / 2);
  app.apres();
}

// ------------------------------------------------------------------ Main

function positionsMain(n) {
  const largeur = PORTRAIT ? TW - 12 : 404;
  const pas = n > 1 ? Math.min(52, (largeur - LC) / (n - 1)) : 52;
  const total = LC + (n - 1) * pas;
  const x0 = TX + (PORTRAIT ? 6 : 10) + (largeur - total) / 2;
  return { x0, pas };
}

function dessinerMain(g, app, ids, o = {}) {
  const e = app.etat;
  const ui = app.ui;
  const m = e.manche;
  const { x0, pas } = positionsMain(ids.length);
  const cachees = new Set(m ? m.cachees : []);
  const survolJoker = M.survol && M.survol.joker ? M.survol.joker : null;
  const h = aides(e);
  const marq = ui.apercu && ui.apercu.marquantes && !ui.scene ? new Set(ui.apercu.marquantes) : null;
  let dessus = null;
  let neuves = 0;
  // Un consommable est en train d'être glissé : les cartes qu'il toucherait s'allument.
  let viseConso = null;
  if (M.glisse && M.glisse.actif && M.glisse.ref.type === 'conso' && !o.fige) {
    const c = e.consommables.find((k) => k.uid === M.glisse.ref.uid);
    if (c && CONSO[c.id].max > 0) viseConso = cibleConso(app, c, M.souris.x, M.souris.y);
  }
  ids.forEach((id, i) => {
    const c = carteParId(e, id) || (ui.scene && ui.scene.cartes[id]);
    if (!c) return;
    const sel = ui.sel.includes(id);
    let tx = x0 + i * pas;
    let ty = Y_MAIN - (sel ? 14 : 0);
    const glisse = M.glisse && M.glisse.actif && M.glisse.ref.type === 'carte' && M.glisse.ref.id === id;
    if (glisse) {
      tx = M.souris.x - M.glisse.dx;
      ty = Math.max(Y_MAIN - 30, Math.min(Y_MAIN + 10, M.souris.y - M.glisse.dy));
    } else if (!sel && survole('carte:' + id) && !o.fige) ty -= 3;
    if (!positionDe('c' + id)) neuves++;
    const v = poser('c' + id, tx, ty, { depuis: { x: X_PIOCHE, y: Y_PIOCHE }, immediat: glisse, retard: neuves * 0.045 });
    const cachee = cachees.has(id);
    const faible = !cachee && m && e.phase === 'manche' && estAffaiblie(e, c);
    let lu = null;
    if (survolJoker && !cachee) {
      const d = JOKER[survolJoker.id];
      if (d.cible && d.cible(c, h)) lu = C.or3;
    }
    if (sel && marq && marq.has(id)) lu = lu || C.bleu2;
    if (viseConso && viseConso.includes(id)) lu = C.violet2;
    const dessin = () => dessinerCarte(g, c, v.x, v.y - v.saut, { cachee, affaiblie: faible, lueur: lu });
    if (glisse) dessus = dessin;
    else dessin();
    if (!glisse) {
      zone({
        id: 'carte:' + id, x: v.x, y: Math.min(v.y, Y_MAIN - 14), w: i < ids.length - 1 ? pas : LC, h: HC + 14, carte: cachee ? null : c,
        bulle: () => bulleCarte(c, e, { cachee, affaiblie: faible }),
        clic: o.fige ? null : () => clicCarte(app, id),
        glisser: o.fige ? null : {
          type: 'carte', id,
          lacher: (x, y, gl) => {
            const vers = Math.round((x - gl.dx - x0) / pas);
            P.deplacerCarte(e, id, vers);
            // Un rangement à la main suspend le tri automatique.
            e.tri = null;
            son.carte();
            ui.rev++;
          },
        },
      });
    }
  });
  if (dessus) dessus();
}

function clicCarte(app, id) {
  const ui = app.ui;
  if (ui.occupe) return;
  const i = ui.sel.indexOf(id);
  if (i >= 0) {
    ui.sel.splice(i, 1);
    son.lacher();
  } else if (ui.sel.length >= 5) {
    toast(ui, '5 cartes au plus.', C.rouge2);
    son.refus();
  } else {
    ui.sel.push(id);
    son.choisir();
  }
  ui.rev++;
}

function dessinerPioche(g, app, o = {}) {
  const e = app.etat;
  const x = X_PIOCHE;
  const Y_MAIN = Y_PIOCHE; // la pioche a sa propre place en portrait
  const sc = app.ui.scene;
  const n = sc ? sc.pioche : e.pioche.length;
  const haut = Math.min(4, Math.ceil(n / 12));
  for (let i = haut; i >= 0; i--) {
    if (n === 0 && i === 0) {
      g.globalAlpha = 0.35;
      rrect(g, x, Y_MAIN, LC, HC, C.velours0, 3);
      g.globalAlpha = 1;
    } else if (n > 0) g.drawImage(spriteDos(), x + i, Y_MAIN - i);
  }
  texte(g, n + '/' + (sc ? sc.paquet : e.paquet.length), x + LC / 2, Y_MAIN + HC + 5, { c: C.velours5, a: 'c' });
  zone({ id: 'pioche', x, y: Y_MAIN - 4, w: LC + 4, h: HC + 16, clic: () => ouvrirCalque(app, 'paquet'), bulle: { titre: 'Ta pioche', corps: 'Il reste ' + n + ' carte' + (n > 1 ? 's' : '') + ' à piocher sur ' + e.paquet.length + '. Clique pour voir ton paquet.' } });
  // Longue-vue : les prochaines cartes.
  const vision = mod(e, 'vision');
  if (vision && e.phase === 'manche' && !o.fige) {
    const cachee = patronActif(e) && (patronActif(e).piocheCachee || patronActif(e).tetesCachees);
    e.pioche.slice(0, vision).forEach((id, i) => {
      const c = carteParId(e, id);
      const yy = Y_MAIN - 16 - i * 13;
      rrect(g, x + 8, yy, 32, 12, C.noir, 2);
      rrect(g, x + 9, yy + 1, 30, 10, C.creme, 1);
      if (cachee) texte(g, '?', x + 24, yy + 3, { c: C.gris1, a: 'c' });
      else {
        texte(g, lettreRang(c.rang), x + 13, yy + 3, { c: COUL_ENS[c.ens] });
        motif(g, PIPS5[c.ens], x + 29, yy + 4, COUL_ENS[c.ens]);
      }
    });
    texte(g, 'À VENIR', x + LC / 2, Y_MAIN - 16 - vision * 13 + 3, { c: C.or2, a: 'c' });
  }
}

// --------------------------------------------------------------- Compteur J x M

function metre(g, app, v) {
  const ui = app.ui;
  const y = Y_METRE;
  // Nom de la main.
  if (PORTRAIT) {
    if (v.type) {
      const s = MAIN[v.type].nom + '  ';
      const w = largeurTexte(s) + largeurTexte('NIV. ' + v.niveau);
      texte(g, s, CX - w / 2, y - 12, { c: C.creme, ombre: C.velours0 });
      texte(g, 'NIV. ' + v.niveau, CX - w / 2 + largeurTexte(s), y - 12, { c: v.niveau > 1 ? C.or3 : C.velours5 });
    } else if (v.cache) texte(g, 'MAIN SECRÈTE', CX, y - 12, { c: C.creme, a: 'c', ombre: C.velours0 });
  } else if (v.type) {
    texte(g, MAIN[v.type].nom, CX - 108, y + 2, { c: C.creme, a: 'd', ombre: C.velours0 });
    texte(g, 'NIVEAU ' + v.niveau, CX - 108, y + 12, { c: v.niveau > 1 ? C.or3 : C.velours5, a: 'd' });
  } else if (v.cache) {
    texte(g, 'MAIN SECRÈTE', CX - 108, y + 6, { c: C.creme, a: 'd', ombre: C.velours0 });
  }
  const cj = compteur(ui, 'mj', v.jetons || 0, 30);
  const cm = compteur(ui, 'mm', v.multi || 0, 30);
  const popJ = M.t - cj.t < 0.14 && v.vivant;
  const popM = M.t - cm.t < 0.14 && v.vivant;
  // Le feu : quand la main en cours suffit à battre la manche, les compteurs s'embrasent,
  // et la flamme grandit avec l'écart (deux fois, cinq fois le score demandé...).
  if (v.vivant && v.feu >= 1) {
    const hMax = Math.min(26, 6 + Math.log2(v.feu) * 6);
    const coul = [C.rouge0, C.rouge1, C.orange1, C.or2, C.or3, C.blanc];
    for (let x = CX - 102; x < CX + 102; x += 2) {
      const n = Math.sin(M.t * 13 + x * 0.61) * 0.5 + Math.sin(M.t * 7.3 - x * 0.23) * 0.5;
      const h = Math.max(2, Math.round(hMax * (0.55 + 0.45 * n)));
      for (let k = 0; k < h; k += 2) {
        const i = Math.min(coul.length - 1, Math.floor(((h - k) / h) * (coul.length - 1) * (v.feu >= 5 ? 1.1 : 0.9)));
        g.globalAlpha = 0.35 + 0.65 * (k / h);
        rect(g, x, y - k, 2, 2, coul[coul.length - 1 - i]);
      }
    }
    g.globalAlpha = 1;
    if (Math.random() < 0.5) eclats(CX - 100 + Math.random() * 200, y - hMax * 0.6, 1, [C.or3, C.orange1, C.rouge1], { vitesse: 20, gravite: -40, duree: 0.6 });
  }
  const boite = (x, w, c1, c2, val, pop, etiquette) => {
    const d = pop ? 2 : 0;
    rrect(g, x - d, y - d, w + 2 * d, 22 + 2 * d, C.noir, 2);
    rrect(g, x + 1 - d, y + 1 - d, w - 2 + 2 * d, 20 + 2 * d, pop ? melange(c1, '#ffffff', 0.3) : c1, 1);
    rect(g, x + 2 - d, y + 1 - d, w - 4 + 2 * d, 1, c2);
    rect(g, x + 2 - d, y + 19 + d, w - 4 + 2 * d, 1, melange(c1, '#000000', 0.35));
    const s = v.cache ? '???' : val;
    let e = pop ? 3 : 2;
    while (e > 1 && largeurTexte(s, e) > w - 6 + 2 * d) e--;
    texte(g, s, x + w / 2, y + 11 - Math.floor((7 * e) / 2), { c: C.blanc, e, a: 'c', ombre: melange(c1, '#000000', 0.5) });
    texte(g, etiquette, x + w / 2, y + 26, { c: c2, a: 'c', ombre: C.velours0 });
  };
  boite(CX - 100, 90, C.bleu1, C.bleu2, fmt(Math.round(v.vivant ? cj.cible : cj.v)), popJ, 'JETONS');
  boite(CX + 10, 90, C.rouge1, C.rouge2, fmtM(v.vivant ? cm.cible : Math.round(cm.v * 10) / 10), popM, 'MULTI');
  texte(g, '×', CX - 2, y + 4, { c: C.creme, e: 2, a: 'c', ombre: C.velours0 });
  // Aperçu du total.
  if (v.apercu && PORTRAIT) {
    const s = v.cache ? '= ???' : '= ' + fmt(v.total);
    const lab = v.cache ? '' : v.annulee ? 'DÉJÀ JOUÉE' : v.incertain ? 'AU MINIMUM' : v.suffit ? 'ÇA PASSE !' : v.manque > 0 ? 'MANQUE ' + fmt(v.manque) : 'PRÉVU';
    const w = largeurTexte(s, 2) + (lab ? largeurTexte(lab) + 8 : 0);
    texte(g, s, CX - w / 2, y + 36, { c: v.suffit ? C.vert2 : C.or3, e: 2, ombre: C.velours0 });
    if (lab) texte(g, lab, CX - w / 2 + largeurTexte(s, 2) + 8, y + 40, { c: v.suffit ? C.vert2 : C.velours5 });
  } else if (v.apercu) {
    const x = CX + 108;
    if (v.cache) texte(g, '= ???', x, y + 4, { c: C.or3, e: 2, ombre: C.velours0 });
    else {
      const s = '= ' + fmt(v.total);
      let e = 2;
      if (largeurTexte(s, 2) > TX + TW - 12 - x) e = 1;
      texte(g, s, x, y + (e === 2 ? 2 : 6), { c: v.suffit ? C.vert2 : C.or3, e, ombre: C.velours0 });
      texte(g, v.annulee ? 'DÉJÀ JOUÉE' : v.incertain ? 'PRÉVU, AU MINIMUM' : v.suffit ? 'ÇA PASSE !' : v.manque > 0 ? 'PRÉVU, IL MANQUE ' + fmt(v.manque) : 'SCORE PRÉVU', x, y + 20, { c: v.suffit ? C.vert2 : C.velours5 });
    }
  }
}

// --------------------------------------------------------------- Manche

// ----------------------------------------------------------------- Public


// Petite rose pixel : un rappel en réserve.
function rose(g, x, y) {
  rect(g, x + 1, y, 3, 1, C.rouge0);
  rect(g, x, y + 1, 5, 3, C.rouge1);
  rect(g, x + 1, y + 1, 2, 1, C.rose1);
  rect(g, x + 3, y + 2, 1, 1, C.rouge0);
  rect(g, x + 1, y + 4, 3, 1, C.rouge0);
  rect(g, x + 2, y + 5, 1, 4, C.vert1);
  rect(g, x + 3, y + 6, 2, 1, C.vert1);
}

// L'applaudimètre : dix ampoules de rampe, et les roses des rappels.
// o.jauge impose la valeur montrée (pendant un décompte), o.apercu la réaction attendue.
function jaugePublic(g, app, o = {}) {
  const e = app.etat;
  if (!publicActif(e)) return;
  const p = etatPublic(e);
  const X0 = o.x != null ? o.x : X_PUBLIC;
  const Y0 = o.y != null ? o.y : Y_PUBLIC;
  const jauge = o.jauge != null ? o.jauge : p.jauge;
  const gain = o.apercu ? o.apercu.gain : 0;
  const pat = e.phase === 'manche' ? patronActif(e) : null;
  const figee = !!(pat && pat.cabale);
  const clignote = Math.floor(M.t * 4) % 2 === 0;
  texte(g, 'PUBLIC', X0, Y0, { c: C.velours5 });
  const xr = X0 + largeurTexte('PUBLIC') + 5;
  for (let i = 0; i < p.rappels; i++) rose(g, xr + i * 8, Y0 - 2);
  if (figee) texte(g, 'FIGÉ', X0 + 70, Y0, { c: C.rouge2, a: 'd' });
  else if (gain) texte(g, (gain > 0 ? '+' : '') + gain, X0 + 70, Y0, { c: gain > 0 ? C.or3 : C.rouge2, a: 'd' });
  for (let i = 0; i < PUBLIC.taille; i++) {
    const x = X0 + i * 7;
    const y = Y0 + 10;
    const allumee = i < jauge;
    const promise = gain > 0 && i >= jauge && i < jauge + gain;
    const menacee = gain < 0 && i < jauge && i >= jauge + gain;
    rrect(g, x, y, 6, 6, C.noir, 2);
    let c = C.velours1;
    if (menacee) c = clignote ? C.rouge1 : C.or1;
    else if (allumee) c = figee ? C.gris2 : C.or3;
    else if (promise) c = clignote ? C.or1 : C.velours1;
    rrect(g, x + 1, y + 1, 4, 4, c, 1);
    if (allumee && !menacee) rect(g, x + 2, y + 2, 1, 1, C.blanc);
  }
  // Ovation toute proche : la rampe frémit.
  if (jauge + Math.max(0, gain) >= PUBLIC.taille && clignote) rect(g, X0, Y0 + 17, 69, 1, C.or3);
  zone({
    id: 'public', x: X0 - 2, y: Y0 - 3, w: 74, h: 22, bulleBas: !o.bulleHaut,
    bulle: () => ({
      titre: 'Le public',
      sous: 'Applaudimètre ' + p.jauge + '/' + PUBLIC.taille + ' · ' + p.rappels + ' rappel' + (p.rappels > 1 ? 's' : '') + ' en réserve sur ' + reserveMax(e),
      sousCoul: C.or3,
      corps: AIDE_PUBLIC,
      pied: figee ? 'La Cabale : la salle est achetée pour cette manche.' : o.apercu && o.apercu.raisons.length ? 'Cette main : ' + o.apercu.raisons.map((r) => r.nom + ' ' + (r.v > 0 ? '+' : '') + r.v).join(', ') : null,
    }),
  });
}

// Le crescendo : cinq marches qui s'allument quand chaque main bat la précédente.
// monte : l'aperçu de la main choisie ferait monter (true), rompre (false), ou rien à dire (null).
function jaugeCrescendo(g, app, n, t0, monte = null) {
  const e = app.etat;
  const m = e.manche;
  if (!m) return;
  const X0 = X_PUBLIC;
  const Y0 = Y_CRESC;
  const recent = t0 != null && M.t - t0 < 0.5;
  const clignote = Math.floor(M.t * 6) % 2 === 0;
  texte(g, 'CRESCENDO', X0, Y0, { c: n ? (recent && clignote ? C.blanc : C.or3) : C.velours5 });
  const xs = X0 + largeurTexte('CRESCENDO') + 4;
  for (let i = 0; i < CRESC_MAX; i++) {
    const h = 3 + i * 2;
    const x = xs + i * 5;
    const y = Y0 + 7 - h;
    const allumee = i < n;
    const promise = monte === true && i === n;
    rect(g, x, y, 4, h, C.noir);
    let c = C.velours1;
    if (allumee) c = n >= 2 && i === n - 1 && clignote ? C.blanc : i >= 2 ? C.rouge2 : C.or3;
    else if (promise) c = clignote ? C.or1 : C.velours1;
    rect(g, x + 1, y + 1, 2, h - 1, c);
  }
  if (monte === false && n > 0) texte(g, 'RISQUE', xs + CRESC_MAX * 5 + 2, Y0, { c: clignote ? C.rouge2 : C.rouge1 });
  // v7 : le bonus de la marche se lit à côté de la jauge.
  else if (n > 0) texte(g, n >= CRESC_MAX ? '×1,5' : '+' + BONUS_MARCHE * n + (PORTRAIT ? ' M' : ' MULTI'), xs + CRESC_MAX * 5 + 2, Y0, { c: n >= CRESC_MAX ? (clignote ? C.blanc : C.or3) : C.rouge2 });
  zone({
    id: 'crescendo', x: X0 - 2, y: Y0 - 3, w: 82, h: 12,
    bulle: () => ({
      titre: 'Le crescendo',
      sous: n + ' marche' + (n > 1 ? 's' : '') + ' sur ' + CRESC_MAX,
      sousCoul: C.or3,
      corps: 'Chaque main qui marque {v|plus que la précédente} gravit une marche, et le crescendo {v|se garde d\'une manche à l\'autre}. Chaque marche donne {m|+' + BONUS_MARCHE + ' multi} à toutes tes mains. À la marche 5, l\'{x|apothéose} : {x|×1,5 multi} et {l|5 louis}. Une main plus faible (ou égale) fait redescendre de {c|deux marches}. La musique s\'emballe à partir de 2 marches.',
    }),
  });
}

// L'or qui coule : des gouttes partent du bas du cadre, s'étirent puis tombent.
export function couleeOr(g, x0, y0, w, age, tier = 2) {
  const n = 6 + tier * 3;
  for (let i = 0; i < n; i++) {
    const h = ((i * 2654435761) >>> 0) / 4294967296;
    const t = age - h * 0.5;
    if (t <= 0) continue;
    const x = Math.round(x0 + 2 + h * (w - 4) + Math.sin(i * 7.3) * 2);
    const long = Math.min(10 + tier * 3, t * (18 + h * 22));
    const chute = t > 0.7 ? (t - 0.7) * (t - 0.7) * 260 : 0;
    const yb = y0 + 1;
    if (chute < 1) {
      rect(g, x, yb, 2, Math.round(long), C.or2);
      rect(g, x, yb, 1, Math.round(long), C.or3);
      ell(g, x + 1, yb + Math.round(long), 2, 2, C.or2);
    } else if (chute < 140) {
      g.globalAlpha = Math.max(0, 1 - chute / 140);
      rect(g, x, yb + Math.round(long + chute) - 3, 2, 4, C.or2);
      rect(g, x, yb + Math.round(long + chute) - 3, 1, 2, C.or3);
      g.globalAlpha = 1;
    }
  }
  // Un liseré qui dégouline le long du bord.
  rect(g, x0, y0, w, 2, C.or2);
}

// Compteur chiffre par chiffre : les `fixes` premiers chiffres sont justes, les autres tournent.
export function compteurPartiel(chiffres, fixes, graine = 0) {
  let out = '';
  for (let i = 0; i < chiffres.length; i++) out += i < fixes ? chiffres[i] : String((Number(chiffres[i]) + 3 + graine * 7 + i * 5 + Math.floor((typeof performance !== 'undefined' ? performance.now() : 0) / 40)) % 10);
  return Number(out);
}

// Badge d'apport d'un joker : aperçu de la sélection (en or pâle), sinon dernière main jouée (pendant 6 s).
function badgeApport(g, app, j, x, y) {
  const ui = app.ui;
  let a = null;
  let prevu = false;
  if (ui.scene && ui.scene.apports) a = ui.scene.apports[j.uid];
  else if (ui.apercu && ui.apercu.apports && !ui.apercu.cache) {
    a = ui.apercu.apports[j.uid];
    prevu = true;
  } else if (ui.apports && M.t - ui.apports.t < 6) a = ui.apports.par[j.uid];
  if (!a || !a.ligne) return;
  const s = largeurTexte(a.ligne) <= LC + 2 ? a.ligne : a.court;
  const w = largeurTexte(s) + 4;
  const bx = Math.round(x + LC / 2 - w / 2), by = Math.round(y + HC - 10);
  g.globalAlpha = 0.9;
  rect(g, bx, by, w, 9, C.noir);
  g.globalAlpha = 1;
  const coul = a.x !== 1 ? C.or3 : a.multi ? C.rouge2 : a.jetons ? C.bleu2 : C.vert2;
  texte(g, s, x + LC / 2, by + 1, { c: prevu ? melange(coul, C.creme, 0.35) : coul, a: 'c' });
}

function vueManche(app) {
  const e = app.etat;
  const ui = app.ui;
  const m = e.manche;
  if (ui.scene) return { score: ui.scene.score, cible: ui.scene.cible, mains: ui.scene.mains, defausses: ui.scene.defausses, argent: ui.scene.argent };
  return { score: m ? m.score : 0, cible: m ? m.cible : 0, mains: m && e.phase === 'manche' ? m.mains : mainsParManche(e), defausses: m && e.phase === 'manche' ? m.defausses : defaussesParManche(e), argent: e.argent };
}

function majApercu(app) {
  const ui = app.ui;
  const e = app.etat;
  const cle = ui.rev + '|' + ui.sel.join(',') + '|' + e.main.join(',');
  if (cle === ui.apercuCle) return;
  ui.apercuCle = cle;
  ui.sel = ui.sel.filter((id) => e.main.includes(id));
  ui.apercu = ui.sel.length && e.phase === 'manche' ? P.apercu(e, ui.sel) : null;
}

function ecranManche(g, app) {
  const e = app.etat;
  const ui = app.ui;
  const m = e.manche;
  const sc = ui.scene;
  rangeeJokers(g, app, sc ? sc.jokers : e.jokers, { fige: !!sc });
  rangeeConsos(g, app, { fige: !!sc });

  if (sc) {
    metre(g, app, { type: sc.type, niveau: sc.niveau, jetons: sc.J, multi: sc.M, vivant: true, feu: sc.total == null && sc.cible > sc.score ? (sc.J * sc.M) / Math.max(1, sc.cible - sc.score) : 0 });
    jaugePublic(g, app, { jauge: sc.publicJauge });
    jaugeCrescendo(g, app, sc.crescendo, sc.tCrescendo);
    // Cartes jouées, au centre.
    const n = sc.jouees.length;
    const pas = 54;
    const x0 = CX - (LC + (n - 1) * pas) / 2;
    sc.jouees.forEach((id, i) => {
      const c = sc.cartes[id];
      const marque = sc.marquantes.includes(id);
      const sortie = sc.sortie;
      const v = poser('c' + id, sortie ? TX + TW + 20 : x0 + i * pas, sortie ? Y_JEU - 10 : Y_JEU + (marque || !sc.leve ? 0 : 8), { raideur: sortie ? 9 : 16 });
      if (sc.brisees.includes(id)) return;
      dessinerCarte(g, c, v.x, v.y - v.saut, { affaiblie: sc.faibles.includes(id) });
      if (!marque && sc.leve) {
        g.globalAlpha = 0.45;
        rrect(g, Math.round(v.x) + 1, Math.round(v.y) + 1, LC - 2, HC - 2, C.velours0, 2);
        g.globalAlpha = 1;
      }
    });
    dessinerMain(g, app, sc.main, { fige: true });
    dessinerPioche(g, app, { fige: true });
    // Le grand total, au moment de la révélation.
    // La salle retient son souffle : la lumière baisse juste avant un gros total.
    if (sc.retenue) {
      g.globalAlpha = Math.min(0.45, (M.t - sc.retenue) * 2.2);
      rect(g, 0, 0, L, H, C.noir);
      g.globalAlpha = 1;
    }
    if (sc.total != null) {
      const s = fmt(sc.total);
      const age = M.t - sc.tTotal;
      let ech = 4 + (sc.tier >= 2 && age < 0.12 ? 1 : 0);
      while (ech > 2 && largeurTexte(s, ech) > TW - 60) ech--;
      const yy = Y_JEU + 14 - (age < 0.1 ? 4 : 0);
      const w = Math.max(largeurTexte(s, ech), sc.feu ? largeurTexte(sc.feu, 1) : 0);
      const hb = 7 * ech + 16 + (sc.feu ? 12 : 0);
      g.globalAlpha = 0.82;
      rrect(g, CX - w / 2 - 14, yy - 8, w + 28, hb, C.noir, 3);
      g.globalAlpha = 1;
      rect(g, CX - w / 2 - 11, yy - 6, w + 22, 1, C.or1);
      rect(g, CX - w / 2 - 11, yy - 11 + hb, w + 22, 1, C.or1);
      texte(g, s, CX, yy, { c: sc.feu ? C.or3 : C.blanc, e: ech, a: 'c', contour: C.noir, ce: 1 });
      // v5 : sur les gros coups, l'or coule du cadre du score.
      if (sc.tier >= 2 || sc.coule) couleeOr(g, CX - w / 2 - 11, yy - 11 + hb, w + 22, age, sc.tier);
      if (sc.feu) {
        const cf = sc.tier >= 4 ? [C.rose1, C.or3, C.blanc][Math.floor(M.t * 10) % 3] : sc.tier >= 3 ? (Math.floor(M.t * 8) % 2 ? C.or3 : C.rouge2) : C.rouge2;
        texte(g, sc.feu, CX, yy + 7 * ech + 6, { c: cf, a: 'c' });
      }
    }
    return;
  }

  majApercu(app);
  const a = ui.apercu;
  const reste = m.cible - m.score;
  if (a) metre(g, app, { type: a.type, niveau: a.niveau, jetons: a.jetons, multi: a.multi, total: a.total, apercu: true, cache: a.cache, incertain: a.incertain, annulee: a.annulee, suffit: !a.cache && a.total >= reste, manque: a.cache ? 0 : Math.max(0, reste - a.total) });
  else {
    metre(g, app, { type: null, jetons: 0, multi: 0 });
    const actif = patronActif(e);
    const msg = actif ? actif.court : 'Choisis 1 à 5 cartes, puis joue ou défausse';
    // Pendant le guide, la bulle du Régisseur occupe cette place.
    const guide = ui.guideVu && app.meta.guide && !app.meta.guide.fini;
    if (!guide) couperTexte(msg, TW - 24).slice(0, 2).forEach((l, i) => texte(g, l, CX, Y_JEU + 28 + i * 10, { c: actif ? C.or3 : C.velours5, a: 'c' }));
    if (!guide && m.mainsJouees === 0 && m.defaussesUtilisees === 0 && !actif) texte(g, PORTRAIT ? 'Glisse pour réordonner' : 'Glisse les cartes et les jokers pour les réordonner', CX, Y_JEU + (PORTRAIT && largeurTexte(msg) > TW - 24 ? 52 : 40), { c: C.velours4, a: 'c' });
  }
  jaugePublic(g, app, { apercu: a && a.type && !a.cache ? reactionPublic(e, a.type, a.total) : null });
  jaugeCrescendo(g, app, m.crescendo || 0, null, a && !a.cache && m.refCrescendo != null ? a.total > m.refCrescendo : null);
  dessinerMain(g, app, e.main);
  dessinerPioche(g, app);

  // Boutons.
  const peutJouer = a && a.ok && !ui.occupe;
  const peutDef = ui.sel.length > 0 && m.defausses > 0 && !ui.occupe;
  // Portrait : deux grands boutons sous le pouce, le tri entre les deux.
  const BJ = PORTRAIT ? { x: TX + 4, w: 132, h: 32 } : { x: TX + 70, w: 104, h: 24 };
  const BD = PORTRAIT ? { x: TX + TW - 136, w: 132 } : { x: TX + 246, w: 104 };
  const XT = PORTRAIT ? CX - 30 : TX + 180;
  bouton(g, 'jouer', BJ.x, Y_BOUTONS, BJ.w, BJ.h, PORTRAIT ? 'JOUER' : 'JOUER LA MAIN', {
    coul: 'bleu', actif: !!peutJouer, clic: () => actionJouer(app),
    refus: () => {
      toast(ui, a && a.raison ? a.raison : 'Choisis d\'abord des cartes.', C.rouge2);
      son.refus();
    },
    bulle: a && !a.ok ? { titre: 'Main refusée', corps: a.raison } : null,
  });
  texte(g, 'TRIER', XT + 30, Y_BOUTONS - 1, { c: C.velours5, a: 'c' });
  bouton(g, 'tri-rang', XT, Y_BOUTONS + 8, 29, BJ.h - 8, 'RANG', { coul: e.tri === 'rang' ? 'or' : 'nuit', clic: () => trier(app, 'rang') });
  bouton(g, 'tri-ens', XT + 31, Y_BOUTONS + 8, 29, BJ.h - 8, 'ENS.', { coul: e.tri === 'enseigne' ? 'or' : 'nuit', clic: () => trier(app, 'enseigne'), bulle: { titre: 'Trier par enseigne', corps: 'L\'ordre des cartes jouées suit celui de ta main, de gauche à droite.' } });
  bouton(g, 'defausser', BD.x, Y_BOUTONS, BD.w, BJ.h, 'DÉFAUSSER', {
    coul: 'rouge', actif: !!peutDef, clic: () => actionDefausser(app),
    refus: () => {
      toast(ui, m.defausses <= 0 ? 'Plus de défausse.' : 'Choisis d\'abord des cartes.', C.rouge2);
      son.refus();
    },
  });
}

function trier(app, mode) {
  P.trier(app.etat, mode);
  son.carte();
  app.ui.rev++;
}

function viderEvts(app) {
  const e = app.etat;
  for (const ev of e.evts || []) {
    if (ev.t === 'joker') {
      const p = positionDe('j' + ev.uid);
      if (p) {
        popup(p.x + LC / 2, p.y + HC + 2, ev.txt, C.or3, { vy: 14 });
        sauter('j' + ev.uid, 5);
      }
    } else if (ev.t === 'carte') {
      const p = positionDe('c' + ev.id);
      if (p) popup(p.x + LC / 2, p.y - 8, ev.txt, C.violet2);
    } else if (ev.t === 'info') toast(app.ui, ev.txt, C.bleu2);
  }
  e.evts = [];
}
export { viderEvts };

function actionDefausser(app) {
  const e = app.etat;
  const ui = app.ui;
  if (ui.occupe || e.phase !== 'manche') return;
  const ids = ui.sel.slice();
  for (const id of ids) {
    const p = positionDe('c' + id);
    if (p) eclats(p.x + LC / 2, p.y + HC / 2, 5, [C.creme, C.gris3], { vitesse: 40, duree: 0.4 });
  }
  const cibleAvant = e.manche.cible;
  cacherMentor(app);
  const r = P.defausser(e, ids);
  if (!r.ok) {
    toast(ui, r.raison, C.rouge2);
    son.refus();
    return;
  }
  ui.sel = [];
  son.defausse(ids.length);
  son.pioche(1);
  son.pioche(2);
  if (e.manche.cible > cibleAvant) toast(ui, 'L\'Inflation : le score demandé grimpe', C.rouge2);
  app.apres();
  if (r.perdu) app.finDePartie('fin');
}

const COUL_EVT = { j: C.bleu2, m: C.rouge2, x: C.or3, l: C.or3 };

async function actionJouer(app) {
  // Le calcul est déjà fait quand l'animation commence : si elle échoue, on rend la main proprement.
  try {
    await jouerEtAnimer(app);
  } catch (err) {
    console.error(err);
    app.ui.scene = null;
    app.ui.occupe = false;
    app.apres();
    const e = app.etat;
    if (e.phase === 'victoire') app.finDePartie('victoire');
    else if (e.phase === 'defaite') app.finDePartie('fin');
  }
}

async function jouerEtAnimer(app) {
  const e = app.etat;
  const ui = app.ui;
  if (ui.occupe || e.phase !== 'manche') return;
  const ids = ui.sel.slice();
  const m = e.manche;
  // Photographie de la table avant le calcul.
  const cartes = {};
  for (const id of e.main) cartes[id] = Object.assign({}, carteParId(e, id));
  const ordre = e.main.filter((id) => ids.includes(id));
  // Mode Mentor : une copie de la table, pour rejouer la main après coup.
  const avantMentor = mentorActif(app) ? JSON.parse(JSON.stringify(e, (k, v) => (k === 'evts' ? [] : v))) : null;
  cacherMentor(app);
  const scene = {
    cartes, jouees: ordre, main: e.main.filter((id) => !ids.includes(id)), marquantes: [], faibles: [], brisees: [],
    jokers: e.jokers.map((j) => Object.assign({}, j)),
    J: 0, M: 0, type: null, niveau: 1, score: m.score, cible: m.cible, mains: m.mains - 1, defausses: m.defausses, argent: e.argent,
    total: null, leve: false, sortie: false,
    etats: P.infoPalier(e).etats.slice(), pioche: e.pioche.length, paquet: e.paquet.length, palier: e.palier,
    publicJauge: publicActif(e) ? etatPublic(e).jauge : 0,
    crescendo: m.crescendo || 0,
  };
  const out = P.jouerMain(e, ids);
  if (!out.ok) {
    toast(ui, out.raison, C.rouge2);
    son.refus();
    return;
  }
  const R = out.resultat;
  ui.occupe = true;
  ui.sel = [];
  ui.selJoker = null;
  ui.selConso = null;
  ui.scene = scene;
  scene.type = R.type;
  scene.niveau = R.niveau;
  scene.apportsFinal = apportsJokers(R.evts);
  scene.apports = {};
  scene.argent -= out.taxe || 0;
  if (out.taxe) toast(ui, 'Le Percepteur prélève ' + out.taxe + ' louis', C.rouge2);
  ordre.forEach((_, i) => son.pioche(i));
  await attendre(320);
  scene.marquantes = R.marquantes;
  scene.leve = true;
  await attendre(160);

  let n = 0;
  const pause = () => {
    reglerMulti(scene.M); // v5 : l'orchestre s'étoffe à mesure que le multi grimpe
    return attendre(Math.max(70, 250 - n * 7));
  };
  for (const ev of R.evts) {
    scene.apports = apportsJokers(R.evts.slice(0, R.evts.indexOf(ev) + 1));
    const pc = ev.id != null ? positionDe('c' + ev.id) : null;
    const pj = ev.uid != null ? positionDe('j' + ev.uid) : null;
    if (ev.t === 'base') {
      scene.J = ev.jetons;
      scene.M = ev.multi;
      son.jetons(0);
      await attendre(300);
      continue;
    }
    if (ev.t === 'brise') {
      if (pc) eclats(pc.x + LC / 2, pc.y + HC / 2, 40, [C.cyan1, C.blanc, '#b2e4e2'], { vitesse: 110 });
      scene.brisees.push(ev.id);
      son.brise();
      secouer(3);
      if (pc) popup(pc.x + LC / 2, pc.y - 6, 'BRISÉE', C.cyan1);
      await attendre(320);
      continue;
    }
    if (ev.t === 'devore') {
      if (pc) eclats(pc.x + LC / 2, pc.y + HC / 2, 30, [C.rouge1, C.rouge2, C.creme], { vitesse: 90 });
      scene.brisees.push(ev.id);
      son.brise();
      await attendre(260);
      continue;
    }
    if (ev.t === 'regle') {
      if (ev.multi !== undefined) scene.M = ev.multi;
      const txtR = ev.dm ? ev.nom + ' +' + ev.dm + ' MULTI' : ev.nom + ' ×' + String(ev.xm).replace('.', ',');
      popup(CX, Y_METRE - 10, txtR, ev.nom === 'APOTHÉOSE' ? C.or3 : ev.dm ? C.rouge2 : C.violet2 || C.cyan1, { e: 2 });
      if (ev.nom === 'APOTHÉOSE') {
        flasher(C.or3, 0.25);
        son.embrase();
      } else if (ev.dm) son.multi(n);
      else son.xmulti(n);
      await attendre(380);
      continue;
    }
    if (ev.t === 'bascule') {
      scene.J = ev.jetons;
      scene.M = ev.multi;
      popup(CX, Y_METRE - 10, 'BASCULE', C.cyan1, { e: 2 });
      son.xmulti(n);
      await attendre(380);
      continue;
    }
    if (ev.t === 'rejoue') {
      if (pc) popup(pc.x + LC / 2, pc.y - 4, 'ENCORE !', C.vert2, { fond: C.noir, vy: 0, duree: 0.7, pile: 'bas', groupe: 'c' + ev.id });
      if (pj) sauter('j' + ev.uid, 6);
      if (pc) sauter('c' + ev.id, 6);
      son.rejoue();
      await attendre(200);
      continue;
    }
    // Effets chiffrés : sur une carte (jouée ou tenue) ou sur un joker.
    let txt = ev.txt || '';
    let coul = C.creme;
    if (ev.dj) {
      txt = (ev.dj > 0 ? '+' : '') + fmt(ev.dj);
      coul = COUL_EVT.j;
      son.jetons(n);
    } else if (ev.dm) {
      txt = (ev.dm > 0 ? '+' : '') + fmtM(ev.dm) + ' MULTI';
      coul = COUL_EVT.m;
      son.multi(n);
    } else if (ev.xm) {
      txt = '×' + fmtM(ev.xm);
      coul = COUL_EVT.x;
      son.xmulti(n);
      secouer(2);
    } else if (ev.argent) {
      txt = (ev.argent > 0 ? '+' : '') + ev.argent + ' $';
      coul = COUL_EVT.l;
      scene.argent += ev.argent;
      son.piece();
    } else if (ev.faible) {
      coul = C.rouge2;
      scene.faibles.push(ev.id);
      son.refus();
    } else son.clic();
    scene.J = ev.jetons;
    scene.M = ev.multi;
    // La main s'embrase : elle suffit désormais à battre la manche.
    if (!scene.enFeu && scene.cible > scene.score && scene.J * scene.M >= scene.cible - scene.score) {
      scene.enFeu = true;
      son.embrase();
      flasher(C.orange1, 0.22);
      secouer(2);
    }
    const fond = ev.xm ? C.rouge0 : null;
    if (ev.t === 'joker') {
      son.joker(n);
      if (pj) {
        sauter('j' + ev.uid, 7);
        popup(pj.x + LC / 2, pj.y + HC - 21, txt, coul, { vy: 0, fond: fond || C.noir, duree: 0.8, groupe: 'j' + ev.uid });
        if (ev.xm) eclats(pj.x + LC / 2, pj.y + HC / 2, 10, [C.or3, C.rouge2], { vitesse: 70 });
      }
    } else {
      if (pc) {
        sauter('c' + ev.id, 7);
        popup(pc.x + LC / 2, pc.y - 4, txt, coul, { fond: fond || C.noir, vy: 0, duree: 0.8, pile: 'bas', groupe: 'c' + ev.id });
        if (ev.xm) eclats(pc.x + LC / 2, pc.y + HC / 2, 10, [C.or3, C.rouge2], { vitesse: 70 });
      }
      if (pj) sauter('j' + ev.uid, 5);
    }
    n++;
    await pause();
  }

  // Anticipation, puis le total. Plus la main est grosse, plus la salle retient son souffle.
  const ratio = R.total / Math.max(1, scene.cible);
  const force = Math.min(3, 0.6 + Math.log10(1 + ratio * 9));
  const recordAvant = Math.max(app.meta.stats.meilleureMain || 0, ui.recordPartie || 0);
  const record = !app.demo && recordAvant > 0 && R.total > recordAvant && R.total >= 1000;
  ui.recordPartie = Math.max(ui.recordPartie || 0, R.total);
  const tier = R.annulee ? 0 : record ? 4 : ratio >= 5 ? 3 : ratio >= 2 ? 2 : ratio >= 1 ? 1 : 0;
  // Combos : si deux membres d'un même numéro ont agi, la salle le reconnaît et le nomme.
  // v6 : synergies qui ont joué sur cette main.
  (R.synergies || []).slice(0, 2).forEach((id, i) => {
    const sy = SYNERGIE[id];
    if (sy) popup(CX, Y_METRE - 42 - i * 12, '★ ' + sy.nom.toUpperCase(), C.or3, { fond: C.noir, vy: -4, duree: 1.5, groupe: 'syn' + i });
  });
  const combosMain = combosDeclenches(scene.jokers, R.evts).slice(0, 2);
  if (combosMain.length) {
    combosMain.forEach((c, i) => popup(CX, Y_METRE - 18 - i * 12, 'COMBO : ' + nomCombo(c).toUpperCase(), COUL_COMBO[c.couleur] || C.or3, { fond: C.noir, vy: -4, duree: 1.3, groupe: 'combo' + i }));
    son.combo(combosMain.length);
    scene.combo = { t: M.t, uids: combosMain.flatMap((c) => c.uids) };
    scene.coule = true;
    await attendre(320);
  }
  const roul = 5 + tier * 2;
  for (let i = 0; i < roul; i++) {
    son.roulement(Math.min(9, i));
    secouer(0.5 + i * 0.18);
    await attendre(Math.max(40, 75 - i * 3));
  }
  if (tier >= 1) {
    // Le silence avant l'impact : tout se fige une fraction de seconde.
    etoufferMusique(0.6 + tier * 0.15);
    son.souffle(0.25 + tier * 0.08);
    scene.retenue = M.t;
    await attendre(260 + tier * 70);
    scene.retenue = null;
  }
  scene.tTotal = M.t;
  scene.tier = tier;
  scene.feu = R.annulee ? 'LE MONOTONE BÂILLE : DÉJÀ JOUÉE' : record ? 'NOUVEAU RECORD !' : ratio >= 5 ? 'RAZ DE MARÉE !' : ratio >= 2 ? 'DOUBLÉ D\'UN COUP !' : ratio >= 1 ? 'EN UNE SEULE MAIN !' : ratio >= 0.5 ? 'JOLI COUP' : null;
  // v5 : le compteur grimpe chiffre par chiffre. Les chiffres tournent, puis se fixent un à un, de gauche à droite.
  const chiffres = String(Math.max(0, R.total));
  for (let i = 1; i <= chiffres.length; i++) {
    for (let r = 0; r < 3; r++) {
      scene.total = compteurPartiel(chiffres, i - 1, r);
      await attendre(16);
    }
    scene.total = compteurPartiel(chiffres, i, 0);
    son.compte(i * 2);
    if (i < chiffres.length) secouer(0.4 + i * 0.15);
    await attendre(Math.max(26, 70 - chiffres.length * 4));
  }
  scene.total = R.total;
  scene.tTotal = M.t;
  // v5 : arrêt sur image et vibration au moment de l'impact, plus forts sur les gros coups.
  if (tier >= 1 || force >= 1.6) figer(60 + tier * 35);
  if (tier >= 1) vibrer(tier >= 3 ? [40, 30, 60] : tier >= 2 ? [30, 20, 30] : 25);
  son.total(force);
  if (tier >= 1) son.palier(tier);
  if (record) son.record();
  secouer(2 + force * 2.5 + tier);
  flasher(record ? C.rose1 : ratio >= 0.5 ? C.or3 : C.blanc, 0.18 + force * 0.12 + tier * 0.05);
  eclats(CX, Y_JEU + 30, Math.round(20 + force * 30 + tier * 25), [C.or3, C.or2, C.blanc, C.rouge2], { vitesse: 80 + force * 50 + tier * 20, duree: 0.9 + tier * 0.2 });
  if (tier >= 3) for (let i = 0; i < 4; i++) eclats(TX + 30 + i * (TW - 60) / 3, 40, 18, [C.or3, C.rose1, C.blanc], { vitesse: 110, duree: 1.4 });
  if (tier >= 2 || ['quinte_flush', 'quinte_royale', 'cinq', 'full_couleur', 'cinq_couleur', 'carre'].includes(R.type)) zoomer(0.04 + tier * 0.012);
  await attendre(650 + tier * 180);
  // Le total rejoint le score de la manche.
  scene.score = e.manche ? e.manche.score : scene.score + R.total;
  if (out.resultat && patronActif(e) && patronActif(e).juge) scene.score = e.manche.score;
  for (let i = 0; i < 5; i++) {
    son.compte(10 + i * 2);
    await attendre(50);
  }
  // La salle réagit.
  const pb = out.public;
  if (pb && pb.raisons.length) {
    pb.raisons.forEach((r, i) => popup(X_PUBLIC + 35, Y_PUBLIC + 22 + i * 10, r.nom.toUpperCase() + ' ' + (r.v > 0 ? '+' : '') + r.v, r.v > 0 ? C.or3 : C.rouge2, { fond: C.noir, vy: 0, duree: 1.3, groupe: 'public' + i }));
    if (pb.gain > 0) son.bravo(pb.gain);
    else if (pb.gain < 0) son.murmure();
    scene.publicJauge = pb.ovation ? PUBLIC.taille : pb.apres;
    await attendre(pb.ovation ? 420 : 260);
    if (pb.ovation) {
      son.ovation();
      flasher(C.or3, 0.35);
      eclats(X_PUBLIC + 35, Y_PUBLIC + 13, 36, [C.rouge1, C.rose1, C.or3, C.blanc], { vitesse: 120, duree: 1.2 });
      toast(ui, pb.rappelGagne ? 'Ovation ! Un rappel en réserve' : 'Ovation ! La salle te couvre de louis : +' + pb.louis, C.or3);
      if (pb.louis) {
        scene.argent += pb.louis;
        son.piece();
      }
      for (const k of pb.cachets || []) {
        const pj = positionDe('j' + k.uid);
        if (pj) {
          sauter('j' + k.uid, 7);
          popup(pj.x + LC / 2, pj.y + HC - 21, '+' + k.argent + ' $', C.or3, { vy: 0, fond: C.noir, duree: 0.9, groupe: 'j' + k.uid });
        }
        scene.argent += k.argent;
        son.piece();
      }
      await attendre(500);
      scene.publicJauge = pb.apres;
    }
  }
  // Le crescendo : la marche gravie s'allume, la musique s'emballe.
  const cr = out.crescendo;
  if (cr && cr.monte) {
    scene.crescendo = cr.apres;
    scene.tCrescendo = M.t;
    son.elan(cr.apres);
    secouer(1 + cr.apres);
    flasher(cr.apres >= 3 ? C.rouge2 : C.or3, 0.12 + cr.apres * 0.04);
    eclats(X_PUBLIC + 30, Y_CRESC + 6, 10 + cr.apres * 6, [C.or3, C.rouge2, C.blanc], { vitesse: 60 + cr.apres * 15 });
    popup(CX, Y_JEU - 4, 'CRESCENDO ' + cr.apres + (cr.apres >= 5 ? ' : SOMMET !' : ''), cr.apres >= 3 ? C.rouge2 : C.or3, { e: 2, fond: C.noir, vy: -6, duree: 1.1, groupe: 'cresc' });
    if (cr.louis) {
      scene.argent += cr.louis;
      son.piece(1);
      toast(ui, 'La Montée des marches : +' + cr.louis + ' louis', C.or3);
    }
    await attendre(380);
  } else if (cr && cr.souffle) {
    toast(ui, 'La Souffleuse rattrape ton crescendo', C.vert2);
    son.rejoue();
    await attendre(200);
  } else if (cr && cr.rompu) {
    scene.crescendo = 0;
    if (cr.avant >= 2) toast(ui, 'Le crescendo retombe', C.velours5);
    son.murmure();
  }
  scene.total = null;
  reglerMulti(0);
  ui.apports = { t: M.t, par: scene.apportsFinal };
  scene.sortie = true;
  son.carte();
  await attendre(260);
  if (out.rappel) {
    toast(ui, 'Rappel ! Le public en redemande : une main de plus', C.rose1);
    son.rappel();
    flasher(C.rose1, 0.3);
  }
  for (const t of out.effetsPatron || []) toast(ui, t, C.rouge2);
  if (out.issue === 'sauve') {
    toast(ui, out.zen ? 'Mode zen : on continue, sans échec.' : 'Sauvé de justesse par ' + JOKER[out.sauveur].nom, C.vert2);
    flasher(C.vert1, 0.4);
  }
  ui.scene = null;
  ui.occupe = false;
  ui.compteurs.mj = null;
  ui.compteurs.mm = null;
  app.apres();
  if (avantMentor) revueMentor(app, avantMentor, ids, R.total);
  if (out.issue === 'gagne' || out.issue === 'sauve') {
    vibrer([20, 40, 20]);
    son.victoireManche();
    if (e.phase !== 'victoire') son.stinger(m && m.patron ? 'patron' : 'manche');
    ui.encT0 = M.t;
    eclats(PX + PW / 2, 120, 40, [C.vert2, C.or3, C.blanc], { vitesse: 90 });
    if (e.phase === 'victoire') app.finDePartie('victoire');
  } else if (out.issue === 'perdu') {
    app.finDePartie('fin');
  } else e.main.forEach((_, i) => i < ordre.length && son.pioche(i));
}

// ---------------------------------------------------------- Choix de mise

function ecranChoix(g, app) {
  const e = app.etat;
  const ui = app.ui;
  rangeeJokers(g, app, e.jokers);
  rangeeConsos(g, app);
  const P_ = P.infoPalier(e);
  const w = PORTRAIT ? 112 : 150;
  const y = PORTRAIT ? Y_TABLE + 4 : 98;
  const h = PORTRAIT ? Math.min(300, H - 40 - y) : 246;
  for (let i = 0; i < 3; i++) {
    const x = PORTRAIT ? TX + i * (w + 8) : TX + 9 + i * (w + 6);
    const et = P_.etats[i];
    const courant = i === e.mancheIdx;
    const patron = i === 2 ? PATRON[P_.patron] : null;
    const k = patron ? TEINTES[patron.teinte] : i === 1 ? TEINTES.or : TEINTES.bleu;
    const dy = courant ? Math.round(Math.sin(M.t * 3) * 1.2) - 2 : 4;
    const yy = y + dy;
    panneau(g, x, yy, w, h, { fond: C.nuit2, clair: C.nuit4 });
    rrect(g, x + 2, yy + 2, w - 4, 16, k[0], 1);
    rect(g, x + 3, yy + 2, w - 6, 1, k[1]);
    texte(g, patron ? patron.nom : P.NOMS_MANCHE[i], x + w / 2, yy + 7, { c: C.blanc, a: 'c', ombre: C.noir });
    if (patron) {
      rrect(g, x + w / 2 - 34, yy + 23, 68, 68, C.noir, 2);
      g.drawImage(spritePatron(patron, 64), x + w / 2 - 32, yy + 25);
      zone({ id: 'choix-patron', x: x + w / 2 - 34, y: yy + 23, w: 68, h: 68, bulle: { titre: patron.nom, sous: 'Patron', sousCoul: k[2], corps: patron.desc } });
    } else g.drawImage(spriteJeton(i === 1 ? 'or' : 'bleu', 56), x + w / 2 - 28, yy + 30);
    texte(g, 'SCORE À BATTRE', x + w / 2, yy + 97, { c: C.gris2, a: 'c' });
    nombre(g, fmt(P.cibleManche(e, i)), x + w / 2, yy + 107, w - 12, { c: C.rouge2, ombre: C.noir });
    const gain = P.gainManche(e, i);
    const wg = largeurTexte('GAIN') + 4 + gain * 8;
    texte(g, 'GAIN', x + (w - wg) / 2, yy + 127, { c: C.gris2 });
    for (let q = 0; q < gain; q++) louis(g, x + (w - wg) / 2 + largeurTexte('GAIN') + 4 + q * 8, yy + 127);
    rect(g, x + 8, yy + 140, w - 16, 1, C.nuit4);
    if (patron) {
      const lignes = couperTexte(patron.desc, w - 16);
      lignes.slice(0, PORTRAIT ? Math.floor((h - 205) / 10) : 5).forEach((l, q) => texte(g, l, x + w / 2, yy + 147 + q * 10, { c: k[2], a: 'c' }));
    } else {
      const t = TICKET[P_.tickets[i]];
      texte(g, 'OU PASSE ET REÇOIS', x + w / 2, yy + 144, { c: C.gris2, a: 'c' });
      g.drawImage(spriteTicket(t.id), x + w / 2 - 20, yy + 154);
      texte(g, t.nom, x + w / 2, yy + 179, { c: C.or3, a: 'c' });
      zone({ id: 'ticket' + i, x: x + 8, y: yy + 142, w: w - 16, h: 52, bulle: { titre: t.nom, sous: 'Ticket', sousCoul: C.or3, corps: t.desc } });
    }
    if (et !== 'a_venir') {
      g.globalAlpha = 0.6;
      rrect(g, x + 1, yy + 1, w - 2, h - 2, C.nuit, 2);
      g.globalAlpha = 1;
      const lab = et === 'battue' ? 'BATTUE' : 'PASSÉE';
      rrect(g, x + w / 2 - 34, yy + 106, 68, 20, C.noir, 2);
      texte(g, lab, x + w / 2, yy + 110, { c: et === 'battue' ? C.vert2 : C.gris3, e: 2, a: 'c' });
    } else if (!courant) {
      g.globalAlpha = 0.45;
      rrect(g, x + 1, yy + 1, w - 2, h - 2, C.nuit, 2);
      g.globalAlpha = 1;
      texte(g, 'À VENIR', x + w / 2, yy + h - 22, { c: C.gris2, a: 'c' });
    } else if (!ui.occupe) {
      const peutPasser = i < 2;
      bouton(g, 'jouer-mise', x + 8, yy + h - 52, w - 16, 24, patron ? 'AFFRONTER' : 'JOUER', { coul: patron ? 'rouge' : 'bleu', e: 1, clic: () => lancerManche(app) });
      if (peutPasser) bouton(g, 'passer-mise', x + 8, yy + h - 25, w - 16, 18, 'PASSER', { coul: 'nuit', clic: () => {
        const r = P.passerManche(e);
        if (r.ok) {
          son.achat();
          toast(ui, TICKET[r.ticket].nom + ' reçu', C.or3);
          if (e.phase === 'paquet') son.paquet();
          app.apres();
        }
      } });
    }
  }
}

async function lancerManche(app) {
  const e = app.etat;
  const ui = app.ui;
  if (ui.occupe) return;
  const P_ = P.infoPalier(e);
  if (e.mancheIdx === 2) {
    // Annonce du patron.
    ui.occupe = true;
    ui.annonce = { patron: PATRON[P_.patron], t0: M.t, cible: P.cibleManche(e, 2) };
    son.patron();
    secouer(5);
    flasher(TEINTES[ui.annonce.patron.teinte][1], 0.5);
    await new Promise((ok) => (ui.annonce.ok = ok));
    ui.annonce = null;
    ui.occupe = false;
  }
  son.carte();
  P.commencerManche(e);
  ui.sel = [];
  ui.compteurs.score = null;
  e.main.forEach((_, i) => son.pioche(i));
  app.apres();
}

function dessinerAnnonce(g, app) {
  const a = app.ui.annonce;
  const p = a.patron;
  const k = TEINTES[p.teinte];
  const age = M.t - a.t0;
  const ouv = Math.min(1, age / 0.25);
  M.zones.length = 0;
  g.globalAlpha = 0.86 * ouv;
  rect(g, 0, 0, L, H, C.noir);
  g.globalAlpha = 1;
  const hb = Math.round((PORTRAIT ? 230 : 150) * ouv);
  rect(g, 0, H / 2 - hb, L, hb * 2, k[0]);
  rect(g, 0, H / 2 - hb, L, 3, k[1]);
  rect(g, 0, H / 2 + hb - 3, L, 3, k[1]);
  rect(g, 0, H / 2 - hb + 5, L, 1, k[2]);
  rect(g, 0, H / 2 + hb - 6, L, 1, k[2]);
  if (ouv < 1) return;
  // Rayons tournants derrière le portrait.
  const cx = PORTRAIT ? L / 2 : 170;
  const cy = PORTRAIT ? H / 2 - 70 : H / 2;
  g.save();
  g.beginPath();
  g.rect(0, H / 2 - hb + 6, L, hb * 2 - 12);
  g.clip();
  g.globalAlpha = 0.25;
  g.fillStyle = k[1];
  for (let i = 0; i < 12; i++) {
    const a1 = (i / 12) * Math.PI * 2 + M.t * 0.3;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a1) * 500, cy + Math.sin(a1) * 500);
    g.lineTo(cx + Math.cos(a1 + 0.26) * 500, cy + Math.sin(a1 + 0.26) * 500);
    g.fill();
  }
  g.globalAlpha = 1;
  g.restore();
  const t = 128;
  const px = Math.round(cx - t / 2 - (PORTRAIT ? 0 : Math.max(0, 40 * (1 - (age - 0.25) / 0.2))));
  rrect(g, px - 4, cy - t / 2 - 4, t + 8, t + 8, C.noir, 3);
  rrect(g, px - 2, cy - t / 2 - 2, t + 4, t + 4, k[2], 2);
  g.drawImage(spritePatron(p, t), px, cy - t / 2);
  if (PORTRAIT) {
    // Portrait : le visage en haut, le texte centré dessous.
    const ty = cy + t / 2 + 12;
    texte(g, 'LE PATRON ENTRE EN SCÈNE', L / 2, ty, { c: k[2], a: 'c' });
    let e2 = 3;
    while (e2 > 1 && largeurTexte(p.nom, e2) > L - 20) e2--;
    texte(g, p.nom, L / 2, ty + 12, { c: C.blanc, e: e2, a: 'c', ombre: C.noir });
    const ls = couperTexte(p.desc, L - 30);
    ls.slice(0, 4).forEach((l, i) => texte(g, l, L / 2, ty + 20 + 7 * e2 + i * 10, { c: C.or3, a: 'c', ombre: C.noir }));
    const yS = ty + 30 + 7 * e2 + Math.min(4, ls.length) * 10;
    texte(g, 'SCORE À BATTRE', L / 2, yS, { c: k[2], a: 'c' });
    texte(g, fmt(a.cible), L / 2, yS + 12, { c: C.rouge2, e: 3, a: 'c', ombre: C.noir });
    if (app.etat.jokers.some((j) => JOKER[j.id].regles && JOKER[j.id].regles.sansPatron)) texte(g, 'TON PASSE-MURAILLE ANNULE SON EFFET', L / 2, yS + 40, { c: C.vert2, a: 'c' });
    if (age > 0.7) {
      if (Math.floor(M.t * 2) % 2 === 0) texte(g, 'TOUCHE POUR COMMENCER', L / 2, yS + 56, { c: C.creme, a: 'c' });
      zone({ id: 'annonce', x: 0, y: 0, w: L, h: H, muet: true, clic: () => a.ok && a.ok() });
    }
    if (age > 4.5 && a.ok && !M.fige) a.ok();
    return;
  }
  const tx = 270;
  texte(g, 'LE PATRON ENTRE EN SCÈNE', tx, cy - 92, { c: k[2] });
  let ech = 4;
  while (ech > 2 && largeurTexte(p.nom, ech) > L - tx - 16) ech--;
  texte(g, p.nom, tx, cy - 76, { c: C.blanc, e: ech, ombre: C.noir });
  const lignes = couperTexte(p.desc, (L - tx - 20) / 2, 1);
  const l2 = couperTexte(p.desc, L - tx - 20, 2).length <= 3 ? couperTexte(p.desc, L - tx - 20, 2) : null;
  if (l2) l2.forEach((l, i) => texte(g, l, tx, cy - 30 + i * 18, { c: C.or3, e: 2, ombre: C.noir }));
  else lignes.forEach((l, i) => texte(g, l, tx, cy - 30 + i * 10, { c: C.or3, ombre: C.noir }));
  texte(g, 'SCORE À BATTRE', tx, cy + 34, { c: k[2] });
  texte(g, fmt(a.cible), tx, cy + 46, { c: C.rouge2, e: 3, ombre: C.noir });
  if (app.etat.jokers.some((j) => JOKER[j.id].regles && JOKER[j.id].regles.sansPatron)) texte(g, 'TON PASSE-MURAILLE ANNULE SON EFFET', tx, cy + 76, { c: C.vert2 });
  if (age > 0.7) {
    if (Math.floor(M.t * 2) % 2 === 0) texte(g, 'CLIQUE POUR COMMENCER', tx, cy + 96, { c: C.creme });
    zone({ id: 'annonce', x: 0, y: 0, w: L, h: H, muet: true, clic: () => a.ok && a.ok() });
  }
  if (age > 4.5 && a.ok && !M.fige) a.ok();
}

// ---------------------------------------------------------- Encaissement

function ecranEncaissement(g, app) {
  const e = app.etat;
  const ui = app.ui;
  rangeeJokers(g, app, e.jokers);
  rangeeConsos(g, app);
  jaugePublic(g, app);
  const enc = e.encaissement;
  if (!enc) return;
  const n = enc.lignes.length;
  const w = PORTRAIT ? TW - 40 : 300;
  const x = PORTRAIT ? TX + 20 : TX + 90;
  const h = 76 + n * 13;
  const y = PORTRAIT ? Y_TABLE + 20 : Math.max(92, 100 + Math.round((230 - h) / 2));
  panneau(g, x, y, w, h, { fond: C.nuit2, clair: C.nuit4 });
  rrect(g, x + 2, y + 2, w - 4, 16, C.vert0, 1);
  texte(g, enc.sauve ? 'SAUVÉ DE JUSTESSE' : e.manche && e.manche.type === 2 ? 'PATRON BATTU' : 'MISE BATTUE', x + w / 2, y + 7, { c: C.blanc, a: 'c', ombre: C.noir });
  const age = M.t - ui.encT0;
  const vus = Math.min(n, Math.floor(age / 0.22));
  if (vus > (ui.encVus || 0) && vus <= n) son.piece();
  ui.encVus = vus;
  let somme = 0;
  enc.lignes.forEach((l, i) => {
    if (i >= vus) return;
    somme += l.montant;
    const yy = y + 26 + i * 13;
    texte(g, l.label, x + 14, yy, { c: C.creme });
    const s = String(l.montant);
    texte(g, s, x + w - 26, yy, { c: C.or3, a: 'd' });
    louis(g, x + w - 22, yy);
    for (let q = x + 18 + largeurTexte(l.label); q < x + w - 32 - largeurTexte(s); q += 4) rect(g, q, yy + 6, 1, 1, C.nuit4);
  });
  if (vus >= n) {
    rect(g, x + 12, y + 28 + n * 13, w - 24, 1, C.nuit4);
    bouton(g, 'encaisser', x + 40, y + h - 38, w - 80, 26, { t: 'ENCAISSER', prix: enc.total }, { coul: 'or', ctexte: C.noir, e: 1, clic: () => {
      son.achat();
      for (let i = 0; i < Math.min(8, enc.total); i++) son.piece(i);
      eclats(PX + PW / 2, 195, 24, [C.or3, C.or2, C.blanc], { vitesse: 70 });
      P.encaisser(e);
      ui.selArticle = null;
      app.apres();
    } });
  }
}

// --------------------------------------------------------------- Boutique

function ecranBoutique(g, app) {
  const e = app.etat;
  const ui = app.ui;
  const b = e.boutique;
  rangeeJokers(g, app, e.jokers);
  rangeeConsos(g, app);
  if (!b) return;
  const x = PORTRAIT ? TX : TX + 9;
  const y = PORTRAIT ? Y_TABLE : 92;
  const w = PORTRAIT ? TW : TW - 18;
  const h = PORTRAIT ? Y_BOUTONS - 6 - y : 256;
  panneau(g, x, y, w, h, { fond: C.nuit2, clair: C.nuit4 });
  rrect(g, x + 2, y + 2, w - 4, 15, C.velours2, 1);
  rect(g, x + 3, y + 2, w - 6, 1, C.velours4);
  texte(g, 'LA BOUTIQUE', x + 10, y + 6, { c: C.or3, ombre: C.noir });
  texte(g, (PORTRAIT ? 'ENSUITE : ' : 'PALIER ' + e.palier + ' · PROCHAINE : ') + (e.mancheIdx === 2 ? PATRON[P.infoPalier(e).patron].nom : P.NOMS_MANCHE[e.mancheIdx]), x + w - 10, y + 6, { c: C.creme, a: 'd' });

  // Colonne de gauche : partir, relancer.
  const BS = PORTRAIT ? { x: TX + 4, y: Y_BOUTONS, w: 168, h: 32, y2: Y_BOUTONS, x2: TX + TW - 172 } : { x: x + 8, y: y + 26, w: 84, h: 34, y2: y + 64, x2: x + 8 };
  bouton(g, 'suivant', BS.x, BS.y, BS.w, BS.h, PORTRAIT ? 'MANCHE SUIVANTE' : ['MANCHE', 'SUIVANTE'], { coul: 'rouge', clic: () => {
    P.quitterBoutique(e);
    ui.selArticle = null;
    son.clic();
    app.apres();
  } });
  const pr = P.prixRelance(e);
  bouton(g, 'relancer', BS.x2, BS.y2, BS.w, BS.h, pr === 0 ? (PORTRAIT ? 'RELANCER : OFFERT' : ['RELANCER', 'OFFERT']) : PORTRAIT ? { t: 'RELANCER', prix: pr } : ['RELANCER', { t: '', prix: pr }], {
    coul: 'vert', actif: P.peutPayer(e, pr),
    refus: () => {
      toast(ui, 'Pas assez de louis.', C.rouge2);
      son.refus();
    },
    clic: () => {
      const r = P.relancer(e);
      if (r.ok) {
        son.relance();
        ui.selArticle = null;
        app.apres();
      }
    },
    bulle: { titre: 'Relancer', corps: 'Remplace les articles du haut. Le prix grimpe de {l|1 louis} à chaque relance.' },
  });

  // v6 : la retouche (une carte de ton paquet gagne un niveau), une par boutique.
  const prt = P.prixRetouche(e);
  const vr = P.peutRetoucher(e);
  const RT = PORTRAIT ? { x: x + w - 66, y: y + 146 - 10, w: 60, h: 40 } : { x: x + 8, y: y + 100, w: 84, h: 30 };
  bouton(g, 'retouche', RT.x, RT.y, RT.w, RT.h, b.retouchee ? (PORTRAIT ? ['RETOUCHE', 'FAITE'] : ['RETOUCHE', 'FAITE']) : ['RETOUCHE', { t: '', prix: prt }], {
    coul: 'violet', actif: vr.ok && P.peutPayer(e, prt),
    refus: () => {
      toast(ui, vr.ok ? 'Pas assez de louis.' : vr.raison, C.rouge2);
      son.refus();
    },
    clic: () => {
      const r = P.acheterRetouche(e);
      if (!r.ok) {
        toast(ui, r.raison, C.rouge2);
        son.refus();
        return;
      }
      son.paquet();
      flasher(C.violet2, 0.2);
      ui.selArticle = null;
      ui.selChoix = null;
      app.apres();
    },
    bulle: { titre: 'La retouche', corps: 'Choisis une carte de ton paquet parmi quatre : elle gagne un niveau (3 au plus), soit {j|+15 jetons} et {m|+2 multi} par niveau quand elle marque. {g|Une retouche par boutique.}' },
  });

  // Encart : ce qui t'attend (en portrait, le bandeau du haut le montre déjà).
  if (!PORTRAIT) {
    const iw = 132;
    const ix = x + w - iw - 8;
    const idx = e.mancheIdx;
    const pat = idx === 2 ? PATRON[P.infoPalier(e).patron] : null;
    const k = pat ? TEINTES[pat.teinte] : idx === 1 ? TEINTES.or : TEINTES.bleu;
    panneau(g, ix, y + 22, iw, 110, { fond: C.nuit, clair: C.nuit3 });
    texte(g, 'PROCHAINE MANCHE', ix + iw / 2, y + 27, { c: C.gris2, a: 'c' });
    rrect(g, ix + 3, y + 37, iw - 6, 13, k[0], 1);
    texte(g, pat ? pat.nom : P.NOMS_MANCHE[idx], ix + iw / 2, y + 40, { c: C.blanc, a: 'c' });
    if (pat) g.drawImage(spritePatron(pat, 32), ix + 8, y + 55);
    else g.drawImage(spriteJeton(idx === 1 ? 'or' : 'bleu', 32), ix + 8, y + 55);
    texte(g, 'À BATTRE', ix + 46, y + 57, { c: C.gris2 });
    nombre(g, fmt(P.cibleManche(e, idx)), ix + 86, y + 68, 78, { c: C.rouge2, ombre: C.noir });
    if (pat) couperTexte(pat.court, iw - 12).slice(0, 2).forEach((l, i) => texte(g, l, ix + iw / 2, y + 96 + i * 9, { c: k[2], a: 'c' }));
    else texte(g, 'GAIN ' + P.gainManche(e, idx) + ' LOUIS', ix + iw / 2, y + 100, { c: C.or2, a: 'c' });
    zone({ id: 'prochaine', x: ix, y: y + 22, w: iw, h: 110, bulle: pat ? { titre: pat.nom, sous: 'Patron', sousCoul: k[2], corps: pat.desc } : { titre: P.NOMS_MANCHE[idx], corps: 'Pas de règle spéciale. Tu pourras aussi la passer contre un ticket.' } });
    // Résumé du paquet par enseigne.
    panneau(g, ix, y + 136, iw, 50, { fond: C.nuit, clair: C.nuit3 });
    texte(g, 'TON PAQUET : ' + e.paquet.length, ix + iw / 2, y + 141, { c: C.gris2, a: 'c' });
    ['P', 'C', 'T', 'K'].forEach((ens, i) => {
      const n = e.paquet.filter((c) => c.ens === ens).length;
      const cx = ix + 18 + i * 31;
      motif(g, PIPS5[ens], cx - 8, y + 157, COUL_ENS_CLAIR[ens]);
      texte(g, String(n), cx, y + 156, { c: C.creme });
    });
    const amel = e.paquet.filter((c) => c.amel || c.edition || c.sceau).length;
    texte(g, amel + ' CARTE' + (amel > 1 ? 'S' : '') + ' TRAVAILLÉE' + (amel > 1 ? 'S' : ''), ix + iw / 2, y + 172, { c: C.gris1, a: 'c' });
    zone({ id: 'resume-paquet', x: ix, y: y + 136, w: iw, h: 50, clic: () => ouvrirCalque(app, 'paquet'), bulle: { titre: 'Ton paquet', corps: 'Clique pour voir toutes tes cartes.' } });
    // L'état de la salle, pour choisir ses jokers en connaissance de cause.
    if (publicActif(e)) {
      panneau(g, ix, y + 190, iw, 32, { fond: C.nuit, clair: C.nuit3 });
      jaugePublic(g, app, { x: ix + Math.round((iw - 70) / 2), y: y + 197, bulleHaut: true });
    }
  }

  // Articles.
  const xa = PORTRAIT ? x + 6 : x + 108;
  texte(g, 'ARTICLES', xa, y + 22, { c: C.gris2 });
  const na = b.articles.length;
  const pasA = na > 1 ? Math.min(62, ((PORTRAIT ? w - 24 : w - 124 - 144) - LC) / (na - 1)) : 62;
  b.articles.forEach((a, i) => {
    const sel = ui.selArticle === a.uid;
    const tx = xa + 6 + i * pasA;
    const ty = y + 34 - (sel ? 4 : 0);
    const v = poser('a' + a.uid, tx, ty, { depuis: { x: tx, y: y + 34 - 30 } });
    const prix = P.prixArticle(e, a);
    const peut = P.peutPayer(e, prix);
    const place = a.sorte === 'joker' ? a.edition === 'inverte' || jokersComptes(e) < emplJokers(e) || !!P.cibleDoublon(e, a) : placeConso(e);
    const doublon = P.cibleDoublon(e, a);
    if (a.sorte === 'joker') dessinerJoker(g, { id: a.id, edition: a.edition, uid: a.uid, etat: {}, niv: doublon ? nivJoker(doublon) + 1 : 1 }, v.x, v.y, { lueur: sel ? C.blanc : null });
    else {
      ombreCarte(g, Math.round(v.x), Math.round(v.y));
      g.drawImage(spriteConso(a.id), Math.round(v.x), Math.round(v.y));
      if (sel) lueur(g, Math.round(v.x), Math.round(v.y), C.blanc);
    }
    // v6 : ce que l'article apporte à ta troupe (niveau, synergie).
    if (a.sorte === 'joker') {
      const ap = doublon ? null : apportSynergie(e.jokers, a.id);
      const marque = doublon ? 'NIV +' : ap.complete.length ? '★ SYNERGIE' : ap.avance.length ? '★ ' + ap.avance[0].nom.split(' ').slice(-1)[0].toUpperCase() : null;
      if (marque) {
        const mw = largeurTexte(marque) + 4;
        const mx = Math.round(v.x + LC / 2 - mw / 2), my = Math.round(v.y) + HC - 12;
        rrect(g, mx, my, mw, 9, doublon || ap.complete.length ? C.or2 : C.noir, 2);
        texte(g, marque, mx + mw / 2, my + 1, { c: doublon || ap.complete.length ? C.noir : C.or3, a: 'c' });
      }
    }
    etiquettePrix(g, tx + LC / 2, y + 34 + HC + 3, prix, peut);
    zone({
      id: 'article:' + a.uid, x: v.x, y: v.y, w: LC, h: HC + 14,
      joker: a.sorte === 'joker' ? { id: a.id, uid: a.uid } : null,
      bulle: () => {
        if (a.sorte !== 'joker') return bulleConso(a.id, 'Clique pour choisir, puis achète.');
        const db = P.cibleDoublon(e, a);
        if (db) return bulleJoker(Object.assign({}, db, { niv: nivJoker(db) + 1 }), e, { pied: '{v|Doublon} : ton ' + JOKER[db.id].nom + ' passe au niveau ' + (nivJoker(db) + 1) + ', sans prendre de place.' });
        return bulleJoker(Object.assign({ etat: {}, bonusVente: 0 }, initJoker(a)), e, { pied: 'Clique pour choisir, puis achète.' });
      },
      clic: () => {
        ui.selArticle = sel ? null : a.uid;
        son.choisir();
      },
    });
    if (sel) {
      bouton(g, 'acheter', tx - 8, y + 34 + HC + 16, LC + 16, 16, place ? 'ACHETER' : 'COMPLET', {
        coul: 'or', ctexte: C.noir, actif: peut && place,
        refus: () => {
          toast(ui, !place ? (a.sorte === 'joker' ? 'Plus de place : vends d\'abord un joker.' : 'Plus de place pour un consommable.') : 'Pas assez de louis.', C.rouge2);
          son.refus();
        },
        clic: () => {
          const r = P.acheterArticle(e, a.uid);
          if (!r.ok) {
            toast(ui, r.raison, C.rouge2);
            son.refus();
            return;
          }
          son.achat();
          eclats(tx + LC / 2, ty + HC / 2, 16, [C.or3, C.blanc], { vitesse: 60 });
          ui.selArticle = null;
          // v7 : le joker se présente en entrant dans la troupe.
          if (a.sorte === 'joker' && !r.monte && repliqueDe(a.id)) toast(ui, '"' + repliqueDe(a.id) + '"', COUL_RARETE[JOKER[a.id].r][1]);
          if (r.monte) {
            const jm = e.jokers.find((k) => k.uid === r.monte);
            if (jm) celebrerNiveau(app, jm);
          }
          app.apres();
        },
      });
    }
  });

  // Privilège du palier.
  const y2 = y + 146;
  texte(g, 'PRIVILÈGE', x + 12, y2 - 10, { c: C.gris2 });
  if (b.privilege) {
    const id = b.privilege;
    const sel = ui.selArticle === 'priv';
    const tx = x + 28;
    const prix = P.prixPrivilege(e, id);
    const peut = P.peutPayer(e, prix);
    ombreCarte(g, tx, y2 - (sel ? 4 : 0));
    g.drawImage(spritePrivilege(id), tx, y2 - (sel ? 4 : 0));
    if (sel) lueur(g, tx, y2 - 4, C.blanc);
    etiquettePrix(g, tx + LC / 2, y2 + HC + 3, prix, peut);
    zone({ id: 'article:priv', x: tx, y: y2 - 4, w: LC, h: HC + 16, bulle: { titre: PRIVILEGE[id].nom, sous: 'Privilège permanent', sousCoul: C.or3, corps: PRIVILEGE[id].desc }, clic: () => {
      ui.selArticle = sel ? null : 'priv';
      son.choisir();
    } });
    if (sel) bouton(g, 'acheter', tx - 8, y2 + HC + 16, LC + 16, 16, 'ACHETER', { coul: 'or', ctexte: C.noir, actif: peut, refus: () => son.refus(), clic: () => {
      if (P.acheterPrivilege(e).ok) {
        son.achat();
        flasher(C.or3, 0.25);
        ui.selArticle = null;
        app.apres();
      }
    } });
  } else {
    g.globalAlpha = 0.4;
    rrect(g, x + 28, y2, LC, HC, C.noir, 3);
    g.globalAlpha = 1;
    texte(g, 'ACQUIS', x + 28 + LC / 2, y2 + 30, { c: C.gris1, a: 'c' });
  }

  // Paquets.
  const xp = PORTRAIT ? x + 104 : xa;
  texte(g, 'PAQUETS', xp, y2 - 10, { c: C.gris2 });
  b.paquets.forEach((p, i) => {
    const sel = ui.selArticle === p.uid;
    const tx = xp + 6 + i * (PORTRAIT ? 62 : 70);
    const prix = P.prixPaquet(e, p);
    const peut = P.peutPayer(e, prix);
    const ty = y2 - (sel ? 4 : 0) + Math.round(Math.sin(M.t * 2 + i) * 1);
    ombreCarte(g, tx, ty);
    g.drawImage(spritePaquet(p.type, p.taille), tx, ty);
    if (sel) lueur(g, tx, ty, C.blanc);
    etiquettePrix(g, tx + LC / 2, y2 + HC + 3, prix, peut);
    const cont = contenuPaquet(p.type, p.taille);
    zone({ id: 'article:' + p.uid, x: tx, y: y2 - 4, w: LC, h: HC + 16, bulle: { titre: nomPaquet(p.type, p.taille), sous: 'Paquet', sousCoul: C.creme, corps: TYPES_PAQUET[p.type].desc + ' Choisis ' + cont.prend + ' parmi ' + cont.montre + '.' }, clic: () => {
      ui.selArticle = sel ? null : p.uid;
      son.choisir();
    } });
    if (sel) bouton(g, 'acheter', tx - 8, y2 + HC + 16, LC + 16, 16, 'OUVRIR', { coul: 'or', ctexte: C.noir, actif: peut, refus: () => {
      toast(ui, 'Pas assez de louis.', C.rouge2);
      son.refus();
    }, clic: () => {
      const r = P.acheterPaquet(e, p.uid);
      if (r.ok) {
        son.paquet();
        flasher(C.blanc, 0.3);
        ui.selArticle = null;
        ui.sel = [];
        app.apres();
      }
    } });
  });
  // Rappel discret.
  texte(g, PORTRAIT ? 'Touche un de tes jokers pour le vendre' : 'Clique sur un joker de ta rangée pour le vendre', x + w - 10, y + h - 14, { c: C.gris1, a: 'd' });
}

function initJoker(a) {
  const j = { id: a.id, edition: a.edition, uid: a.uid, etat: {}, bonusVente: 0 };
  const d = JOKER[a.id];
  if (d.init) d.init(j, null);
  return j;
}

// ----------------------------------------------------------------- Paquet

function ecranPaquet(g, app) {
  const e = app.etat;
  const ui = app.ui;
  const p = e.paquetOuvert;
  rangeeJokers(g, app, e.jokers);
  rangeeConsos(g, app);
  if (!p) return;
  const avecMain = e.main.length > 0;
  const titre = p.type === 'retouche' ? 'La retouche' : nomPaquet(p.type, p.taille);
  texte(g, titre, CX, PORTRAIT ? Y_TABLE + 2 : 92, { c: C.or3, e: 2, a: 'c', ombre: C.velours0 });
  texte(g, 'Choisis encore ' + p.restant + (p.restant > 1 ? ' éléments' : ' élément'), CX, PORTRAIT ? Y_TABLE + 20 : 110, { c: C.creme, a: 'c' });
  const n = p.choix.length;
  const pas = 60;
  const x0 = CX - (LC + (n - 1) * pas) / 2;
  const yc = PORTRAIT ? Y_TABLE + (avecMain ? 36 : 60) : avecMain ? 124 : 150;
  p.choix.forEach((c, i) => {
    const sel = ui.selChoix === c.uid;
    const tx = x0 + i * pas;
    const ty = yc - (sel ? 6 : 0) + Math.round(Math.sin(M.t * 2.2 + i * 0.9) * 1.5);
    const v = poser('q' + c.uid, tx, ty, { depuis: { x: CX - LC / 2, y: yc - 40 } });
    if (c.sorte === 'carte') dessinerCarte(g, c.carte, v.x, v.y, { lueur: sel ? C.blanc : null });
    else if (c.sorte === 'retouche') {
      const k = carteParId(e, c.carteId);
      if (k) dessinerCarte(g, Object.assign({}, k, { niv: sel ? (k.niv || 0) + 1 : k.niv }), v.x, v.y, { lueur: sel ? C.or3 : null });
    } else if (c.sorte === 'joker') dessinerJoker(g, { id: c.id, edition: c.edition, uid: c.uid }, v.x, v.y, { lueur: sel ? C.blanc : null });
    else {
      ombreCarte(g, Math.round(v.x), Math.round(v.y));
      g.drawImage(spriteConso(c.id), Math.round(v.x), Math.round(v.y));
      if (sel) lueur(g, Math.round(v.x), Math.round(v.y), C.blanc);
    }
    zone({
      id: 'choix:' + c.uid, x: v.x, y: v.y - 4, w: LC, h: HC + 8,
      joker: c.sorte === 'joker' ? { id: c.id, uid: c.uid } : null,
      bulle: () => {
        if (c.sorte === 'retouche') {
          const k = carteParId(e, c.carteId);
          const b2 = bulleCarte(k, e);
          b2.pied = 'Retouchée, elle passera au niveau ' + ((k.niv || 0) + 1) + ' : {j|+' + 15 * ((k.niv || 0) + 1) + ' jetons} et {m|+' + 2 * ((k.niv || 0) + 1) + ' multi} quand elle marque.';
          return b2;
        }
        return c.sorte === 'carte' ? bulleCarte(c.carte, e) : c.sorte === 'joker' ? bulleJoker(initJoker(c), e, { pied: ' ' }) : bulleConso(c.id);
      },
      clic: () => {
        ui.selChoix = sel ? null : c.uid;
        son.choisir();
      },
    });
  });
  if (avecMain) dessinerMain(g, app, e.main);
  const sel = p.choix.find((c) => c.uid === ui.selChoix);
  const yb = avecMain || PORTRAIT ? Y_BOUTONS : 240;
  const prendre = (garder) => {
    const pos = positionDe('q' + sel.uid) || { x: CX, y: yc };
    const r = P.choisirDansPaquet(e, sel.uid, ui.sel, garder);
    if (!r.ok) {
      toast(ui, r.raison || 'Impossible.', C.rouge2);
      son.refus();
      return;
    }
    if (sel.sorte === 'conso' && !garder) effetConso(app, CONSO[sel.id], r.res, pos.x + LC / 2, pos.y + HC / 2);
    else {
      son.achat();
      eclats(pos.x + LC / 2, pos.y + HC / 2, 20, [C.or3, C.blanc], { vitesse: 70 });
    }
    ui.selChoix = null;
    ui.sel = ui.sel.filter((id) => e.main.includes(id));
    app.apres();
  };
  if (sel) {
    if (sel.sorte === 'conso') {
      const d = CONSO[sel.id];
      const v = P.peutUtiliser(e, d, ui.sel);
      bouton(g, 'paquet-utiliser', CX - 170, yb, 96, 24, 'UTILISER', { coul: 'violet', actif: v.ok, clic: () => prendre(false), refus: () => {
        toast(ui, v.raison, C.rouge2);
        son.refus();
      }, bulle: v.ok ? null : { titre: 'Pas encore', corps: v.raison } });
      bouton(g, 'paquet-garder', CX - 68, yb, 96, 24, 'GARDER', { coul: 'bleu', actif: placeConso(e), clic: () => prendre(true), refus: () => {
        toast(ui, 'Plus de place pour un consommable.', C.rouge2);
        son.refus();
      }, bulle: { titre: 'Garder pour plus tard', corps: 'Range ce consommable dans tes emplacements au lieu de l\'utiliser tout de suite.' } });
    } else bouton(g, 'paquet-prendre', CX - 120, yb, 96, 24, sel.sorte === 'retouche' ? 'RETOUCHER' : 'PRENDRE', { coul: sel.sorte === 'retouche' ? 'violet' : 'bleu', clic: () => prendre(false) });
  } else texte(g, PORTRAIT ? 'Choisis un élément' : avecMain ? 'Choisis un élément du paquet, puis les cartes à transformer' : 'Clique sur un élément pour le choisir', PORTRAIT ? CX - 60 : CX - 46, yb + 8, { c: C.velours5, a: 'c' });
  bouton(g, 'paquet-passer', TX + TW - 110, yb, 90, 24, 'PASSER', { coul: 'nuit', clic: () => {
    P.passerPaquet(e);
    ui.selChoix = null;
    ui.sel = [];
    son.clic();
    app.apres();
  } });
}

// ----------------------------------------------------------------- Calques

function ouvrirCalque(app, nom) {
  if (app.ui.occupe) return;
  app.ui.calque = nom;
  son.clic();
}

function dessinerCalque(g, app) {
  const e = app.etat;
  const ui = app.ui;
  M.zones.length = 0;
  g.globalAlpha = 0.8;
  rect(g, 0, 0, L, H, C.noir);
  g.globalAlpha = 1;
  zone({ id: 'calque-fond', x: 0, y: 0, w: L, h: H, muet: true, clic: () => {
    ui.calque = null;
  } });
  const x = PORTRAIT ? 6 : 40;
  const y = 14;
  const w = L - 2 * x;
  const h = PORTRAIT ? Math.min(H - 28, 470) : H - 28;
  panneau(g, x, y, w, h, { fond: C.nuit2, clair: C.nuit4 });
  zone({ id: 'calque-corps', x, y, w, h, muet: true });
  // Colonnes du tableau des mains : resserrées en portrait.
  const K = PORTRAIT ? { niv: 168, jet: 214, fois: 316, fav: 112 } : { niv: 190, jet: 256, fois: 400, fav: 120 };
  rrect(g, x + 2, y + 2, w - 4, 16, C.velours2, 1);
  bouton(g, 'calque-fermer', x + w - 64, y + 3, 60, 14, 'FERMER', { coul: 'rouge', clic: () => {
    ui.calque = null;
    son.clic();
  } });
  if (ui.calque === 'infos') {
    texte(g, 'TES MAINS', x + 10, y + 6, { c: C.or3, ombre: C.noir });
    const fav = Object.keys(e.niveaux).reduce((a, b) => (e.niveaux[b].jouees > e.niveaux[a].jouees ? b : a), 'carte_haute');
    texte(g, 'MAIN', x + 14, y + 26, { c: C.gris2 });
    texte(g, 'NIV.', x + K.niv, y + 26, { c: C.gris2, a: 'c' });
    texte(g, PORTRAIT ? 'J × M' : 'JETONS × MULTI', x + K.jet + 34, y + 26, { c: C.gris2, a: 'c' });
    texte(g, 'JOUÉE', x + K.fois, y + 26, { c: C.gris2, a: 'c' });
    const visibles = MAINS.filter((m) => !m.cachee || e.niveaux[m.id].jouees > 0).reverse();
    visibles.forEach((m, i) => {
      const yy = y + 38 + i * 21;
      const nv = e.niveaux[m.id];
      const b = baseDeMain(m.id, nv.niveau);
      rrect(g, x + 8, yy, w - 16, 19, i % 2 ? C.nuit3 : '#1d1c3d', 1);
      texte(g, m.nom, x + 14, yy + 6, { c: C.creme });
      if (m.id === fav && nv.jouees > 0) texte(g, PORTRAIT ? '*' : 'FAVORITE', x + K.fav, yy + 6, { c: C.or1 });
      rrect(g, x + K.niv - 16, yy + 3, 32, 13, nv.niveau > 1 ? C.or1 : C.gris0, 1);
      texte(g, String(nv.niveau), x + K.niv, yy + 6, { c: nv.niveau > 1 ? C.noir : C.gris3, a: 'c' });
      const bwj = PORTRAIT ? 36 : 52;
      rrect(g, x + K.jet - bwj / 2, yy + 3, bwj, 13, C.bleu1, 1);
      texte(g, String(b.jetons), x + K.jet, yy + 6, { c: C.blanc, a: 'c' });
      texte(g, '×', x + K.jet + bwj / 2 + 4, yy + 6, { c: C.creme });
      rrect(g, x + K.jet + bwj / 2 + 14, yy + 3, bwj, 13, C.rouge1, 1);
      texte(g, String(b.multi), x + K.jet + bwj + 14, yy + 6, { c: C.blanc, a: 'c' });
      texte(g, String(nv.jouees), x + K.fois, yy + 6, { c: C.creme, a: 'c' });
      if (!PORTRAIT) texte(g, '+' + m.pasJ + ' / +' + m.pasM + ' PAR NIVEAU', x + w - 16, yy + 6, { c: C.gris1, a: 'd' });
    });
    // Rappel des règles de la partie, en bas.
    const brut = (t) => t.replace(/\{\w\|([^}]*)\}/g, '$1');
    let yr = y + h - 44;
    rect(g, x + 8, yr - 5, w - 16, 1, C.nuit4);
    texte(g, couperTexte(JEU[e.regles.jeu].nom + ' : ' + brut(JEU[e.regles.jeu].desc), w - 28)[0], x + 14, yr, { c: C.or2 });
    yr += 11;
    const malus = ENJEUX.slice(1, e.regles.enjeu + 1).map((q) => q.nom).join(', ');
    texte(g, 'ENJEU ' + ENJEUX[e.regles.enjeu].nom + (malus ? ' (MALUS CUMULÉS : ' + malus + ')' : ' : AUCUN MALUS'), x + 14, yr, { c: C.gris3 });
    yr += 11;
    const privs = e.privileges.map((id) => PRIVILEGE[id].nom).join(', ');
    texte(g, couperTexte('PRIVILÈGES : ' + (privs || 'AUCUN'), w - 28)[0], x + 14, yr, { c: C.gris3 });
    if (e.defi) texte(g, 'DÉFI : ' + e.defi.nom, x + w - 14, yr, { c: C.or1, a: 'd' });
  } else {
    texte(g, 'TON PAQUET : ' + e.paquet.length + ' CARTES', x + 10, y + 6, { c: C.or3, ombre: C.noir });
    const dansPioche = new Set(e.pioche);
    const enJeu = e.phase === 'manche' || (e.phase === 'paquet' && e.main.length);
    const ordre = ['P', 'C', 'T', 'K'];
    ordre.forEach((ens, r) => {
      const cs = e.paquet.filter((c) => c.ens === ens).sort((a, b) => b.rang - a.rang || a.id - b.id);
      const yy = y + 26 + r * 74;
      const pas = cs.length > 1 ? Math.min(40, (w - 30 - LC) / (cs.length - 1)) : 40;
      texte(g, String(cs.length), x + 8, yy + 28, { c: COUL_ENS_CLAIR[ens] });
      cs.forEach((c, i) => {
        const cx = x + 24 + i * pas;
        dessinerCarte(g, c, cx, yy, { sansOmbre: true });
        const cachee = e.manche && e.manche.cachees.includes(c.id);
        if (enJeu && !dansPioche.has(c.id)) {
          g.globalAlpha = 0.62;
          rrect(g, Math.round(cx), yy, LC, HC, C.nuit, 3);
          g.globalAlpha = 1;
        }
        zone({ id: 'vue:' + c.id, x: cx, y: yy, w: i < cs.length - 1 ? pas : LC, h: HC, muet: true, bulle: () => {
          const b = bulleCarte(c, e, { cachee: false });
          if (enJeu) b.pied = dansPioche.has(c.id) && !cachee ? 'Encore dans la pioche.' : 'Déjà sortie de la pioche.';
          return b;
        } });
      });
    });
    if (enJeu) texte(g, 'LES CARTES SOMBRES SONT DÉJÀ SORTIES DE LA PIOCHE', x + w / 2, y + h - 12, { c: C.gris2, a: 'c' });
  }
}

// --------------------------------------------------------------- Fin

function dessinerFin(g, app) {
  const e = app.etat;
  const ui = app.ui;
  const f = ui.fin;
  M.zones.length = 0;
  const age = M.t - f.t0;
  g.globalAlpha = Math.min(0.85, age * 2);
  rect(g, 0, 0, L, H, f.type === 'victoire' ? '#1a1004' : C.noir);
  g.globalAlpha = 1;
  if (age < 0.3) return;
  const vic = f.type === 'victoire';
  const x = PORTRAIT ? 8 : 120;
  const w = L - 2 * x;
  const y = PORTRAIT ? 40 : 22;
  const h = PORTRAIT ? Math.min(H - 80, 470) : H - 44;
  panneau(g, x, y, w, h, { fond: C.nuit2, clair: C.nuit4 });
  rrect(g, x + 2, y + 2, w - 4, 44, vic ? C.or1 : C.velours2, 1);
  rect(g, x + 3, y + 2, w - 6, 1, vic ? C.or3 : C.velours4);
  texte(g, vic ? 'VICTOIRE' : 'PARTIE PERDUE', L / 2, y + 10, { c: vic ? C.blanc : C.creme, e: vic ? 4 : 3, a: 'c', ombre: C.noir });
  if (e.mentor) texte(g, 'AVEC LE MENTOR (' + e.mentor + ' CONSEIL' + (e.mentor > 1 ? 'S' : '') + ')', L / 2, y + 36, { c: C.vert2, a: 'c' });
  if (vic && Math.random() < 0.3) eclats(x + Math.random() * w, y, 2, [C.or3, C.rouge2, C.blanc, C.bleu2], { vitesse: 30, gravite: 60, duree: 2.2 });
  const m = e.manche;
  const sous = vic ? 'Tu as fait sauter la banque au palier ' + e.regles.paliers + '.' : m && m.patron ? PATRON[m.patron].nom + ' t\'a eu au palier ' + e.palier + '.' : 'Arrêté au palier ' + e.palier + ', ' + P.NOMS_MANCHE[m ? m.type : 0].toLowerCase() + '.';
  texte(g, sous, L / 2, y + 52, { c: vic ? C.or3 : C.rouge2, a: 'c' });
  // Si près du but : on le dit, c'est ce qui donne envie de relancer.
  if (!vic && f.manque > 0 && f.cible > 0) {
    const pc = Math.round((1 - f.manque / f.cible) * 100);
    texte(g, 'Il te manquait ' + fmt(f.manque) + ' points (' + pc + ' % du score)', L / 2, y + 62, { c: pc >= 80 ? C.or3 : C.gris3, a: 'c' });
  }
  const lignes = [
    ['Meilleure main', fmt(e.stats.meilleureMain) + (e.stats.meilleureMainType ? ' (' + MAIN[e.stats.meilleureMainType].nom + ')' : '')],
    ['Total marqué', fmt(e.stats.totalMarque)],
    ...(e.stats.journal && e.stats.journal.combo ? [['Plus beau combo', e.stats.journal.combo.n + ' jokers, ' + fmt(e.stats.journal.combo.total)]] : []),
    ...(e.stats.crescendoMax ? [['Crescendo atteint', 'marche ' + e.stats.crescendoMax + (e.stats.crescendoMax >= 5 ? ', apothéose' : '')]] : []),
    ['Mains jouées, défausses', e.stats.mainsJouees + ', ' + e.stats.defausses],
    ['Manches gagnées', String(e.stats.manchesGagnees)],
    ['Jeu et enjeu', JEU[e.regles.jeu].nom + ', ' + ENJEUX[e.regles.enjeu].nom],
    ['Graine', e.graine],
  ];
  if (publicActif(e)) {
    const p = etatPublic(e);
    lignes.splice(4, 0, ['Le public', p.ovations + ' ovation' + (p.ovations > 1 ? 's' : '') + ', ' + p.rappelsJoues + ' rappel' + (p.rappelsJoues > 1 ? 's' : '') + ' joué' + (p.rappelsJoues > 1 ? 's' : '')]);
  }
  if (e.defi) lignes.splice(2, 0, ['Score de la maison', fmt(e.defi.scoreMaison) + (e.stats.totalMarque >= e.defi.scoreMaison ? ' : BATTU !' : '')]);
  lignes.forEach(([a, b], i) => {
    const yy = y + 74 + i * 12;
    texte(g, a, x + 24, yy, { c: C.gris3 });
    texte(g, b, x + w - 24, yy, { c: C.creme, a: 'd' });
  });
  // Les jokers de la partie.
  const yj = y + 74 + lignes.length * 12 + 4;
  const js = e.jokers.slice(0, 7);
  js.forEach((j, i) => {
    const jx = L / 2 - (js.length * 26) / 2 + i * 26;
    g.drawImage(spriteJoker(j.id), 4, 4, LC - 8, 44, Math.round(jx), yj, 22, 24);
    zone({ id: 'fin-j' + j.uid, x: jx, y: yj, w: 22, h: 24, muet: true, bulle: () => bulleJoker(j, null, { pied: ' ' }) });
  });
  let yn = yj + 32;
  if (f.nouveautes && f.nouveautes.length) {
    texte(g, 'DÉBLOQUÉ', L / 2, yn, { c: C.vert2, a: 'c' });
    const liste = f.nouveautes.slice(0, 3).map((n) => n.nom + (n.sorte === 'joker' ? ' (joker)' : n.sorte === 'jeu' ? ' (jeu)' : ''));
    if (f.nouveautes.length > 3) liste[2] += ' et ' + (f.nouveautes.length - 2) + ' autres';
    liste.forEach((t, i) => texte(g, t, L / 2, yn + 10 + i * 10, { c: C.creme, a: 'c' }));
  }
  // Renommée : la jauge se remplit sous tes yeux, puis le prochain objectif.
  if (f.renApres && !app.demo) {
    const yr = y + h - 64;
    const k = Math.max(0, Math.min(1, (age - 0.7) / 1.1));
    const a0 = f.renAvant;
    const a1 = f.renApres;
    const monte = a1.niveau > a0.niveau;
    let frac;
    let niv;
    if (!monte) {
      frac = (a0.dans + (a1.dans - a0.dans) * k) / a1.besoin;
      niv = a1.niveau;
    } else if (k < 0.5) {
      frac = (a0.dans + (a0.besoin - a0.dans) * k * 2) / a0.besoin;
      niv = a0.niveau;
    } else {
      frac = (a1.dans * (k - 0.5) * 2) / a1.besoin;
      niv = a1.niveau;
    }
    texte(g, 'RENOMMÉE ' + niv + ' : ' + rangLisible(niv), x + 24, yr, { c: monte && k >= 0.5 ? (Math.floor(M.t * 6) % 2 ? C.or3 : C.blanc) : C.or3 });
    texte(g, '+' + f.gain + ' points', x + w - 24, yr, { c: C.vert2, a: 'd' });
    rrect(g, x + 24, yr + 10, w - 48, 7, C.noir, 2);
    rrect(g, x + 25, yr + 11, Math.max(0, Math.round((w - 50) * Math.min(1, frac))), 5, monte && k >= 0.5 ? C.or3 : C.or2, 1);
    if (k > 0 && k < 1 && Math.random() < 0.4) eclats(x + 25 + (w - 50) * Math.min(1, frac), yr + 13, 1, [C.or3, C.blanc], { vitesse: 25, duree: 0.5 });
    const obj = f.objectif;
    const pied = obj ? 'Objectif : ' + obj.nom + ', ' + obj.cond.replace(/\.$/, '').toLowerCase() + ' (' + Math.round(obj.avance * 100) + ' %)' : a1.prochainTapis ? 'Prochain tapis : ' + a1.prochainTapis.nom + ' au niveau ' + a1.prochainTapis.niveau : '';
    if (pied) texte(g, pied, L / 2, yr + 21, { c: C.gris3, a: 'c' });
  }
  const yb = y + h - 34;
  const hb = PORTRAIT ? 28 : 24;
  const ybb = PORTRAIT ? yb - 4 : yb;
  if (vic && !app.demo) {
    const xs = PORTRAIT ? [x + 8, 130, x + 142, 120, x + 266, w - 274] : [x + 16, 124, x + 146, 108, x + 260, w - 276];
    bouton(g, 'fin-continuer', xs[0], ybb, xs[1], hb, 'CONTINUER SANS FIN', { coul: 'violet', clic: () => app.continuerSansFin() });
    bouton(g, 'fin-rejouer', xs[2], ybb, xs[3], hb, 'NOUVELLE PARTIE', { coul: 'bleu', clic: () => app.rejouer() });
    bouton(g, 'fin-menu', xs[4], ybb, xs[5], hb, 'MENU', { coul: 'nuit', clic: () => app.retourTitre() });
  } else {
    // « Encore une » : le bouton principal, qui relance tout de suite avec le même jeu et le même enjeu.
    const xs = PORTRAIT ? [x + 8, 220, x + 234, w - 242] : [x + 24, 190, x + 222, w - 246];
    bouton(g, 'fin-rejouer', xs[0], ybb, xs[1], hb, age > 1.6 && Math.floor(M.t * 2) % 2 ? 'ENCORE UNE !' : 'ENCORE UNE PARTIE', { coul: 'bleu', e: 1, clic: () => app.rejouer() });
    bouton(g, 'fin-menu', xs[2], ybb, xs[3], hb, 'MENU', { coul: 'nuit', clic: () => app.retourTitre() });
  }
}

// ------------------------------------------------------------- Principal

export function dessinerJeu(g, app) {
  const e = app.etat;
  const ui = app.ui;
  majFormat();
  g.drawImage(fondTable(), 0, 0);
  if (ui.phaseVue !== e.phase) {
    ui.phaseVue = e.phase;
    ui.selArticle = null;
    ui.selChoix = null;
    if (e.phase === 'encaissement') {
      if (!ui.encT0 || M.t - ui.encT0 > 5) ui.encT0 = M.t;
      ui.encVus = 0;
    }
  }
  panneauGauche(g, app, vueManche(app));
  if (ui.scene || e.phase === 'manche') ecranManche(g, app);
  else if (e.phase === 'choix') ecranChoix(g, app);
  else if (e.phase === 'encaissement') ecranEncaissement(g, app);
  else if (e.phase === 'boutique') ecranBoutique(g, app);
  else if (e.phase === 'paquet') ecranPaquet(g, app);
  else {
    rangeeJokers(g, app, e.jokers, { fige: true });
    rangeeConsos(g, app, { fige: true });
    if (e.phase === 'defaite' && e.main.length) dessinerMain(g, app, e.main, { fige: true });
  }
  // Messages.
  ui.toasts = ui.toasts.filter((t) => M.t - t.t0 < 2.6);
  ui.toasts.forEach((t, i) => {
    const w = largeurTexte(t.txt) + 16;
    const yy = (PORTRAIT ? Y_MAIN - 22 : 326 + (e.phase === 'boutique' ? 18 : 0)) - (ui.toasts.length - 1 - i) * 14;
    const age = M.t - t.t0;
    g.globalAlpha = age > 2.2 ? Math.max(0, (2.6 - age) / 0.4) : 1;
    rrect(g, CX - w / 2, yy, w, 13, C.noir, 2);
    rrect(g, CX - w / 2 + 1, yy + 1, w - 2, 11, C.nuit2, 1);
    texte(g, t.txt, CX, yy + 3, { c: t.coul, a: 'c' });
    g.globalAlpha = 1;
  });
  // Consommable tenu à la souris : par-dessus la main, avec sa consigne.
  if (ui.consoGlisse) {
    const k = ui.consoGlisse;
    ui.consoGlisse = null;
    if (M.glisse && M.glisse.actif && M.glisse.ref.type === 'conso') {
      const d = CONSO[k.id];
      ombreCarte(g, k.x + 2, k.y + 3);
      g.drawImage(spriteConso(k.id), k.x, k.y);
      lueur(g, k.x, k.y, C.violet2);
      const msg = d.max > 0 ? (d.max > 1 ? 'Lâche sur une carte, ou sur ta sélection' : 'Lâche sur une carte') : 'Lâche sur la table pour utiliser';
      const w = largeurTexte(msg) + 10;
      const bx = Math.max(TX + 4, Math.min(L - w - 4, k.x + LC / 2 - w / 2));
      rrect(g, bx, k.y - 14, w, 11, C.noir, 2);
      texte(g, msg, bx + 5, k.y - 12, { c: C.violet2 });
    }
  }
  majGuide(g, app);
  if (mentorActif(app)) {
    dessinerMentor(g, app);
    if (!ui.occupe && !ui.scene && !ui.annonce && !ui.calque && !ui.fin && (app.etat.phase === 'manche' || app.etat.phase === 'boutique')) astuceAuto(app);
    if (ui.mentor && (ui.annonce || ui.calque || ui.fin || (ui.mentor.quoi && ui.mentor.quoi !== app.etat.phase))) cacherMentor(app);
  }
  if (ui.annonce) dessinerAnnonce(g, app);
  if (ui.calque) dessinerCalque(g, app);
  if (ui.fin) dessinerFin(g, app);
}

export function clavierJeu(app, touche) {
  const e = app.etat;
  const ui = app.ui;
  if (!e) return false;
  if (touche === 'Escape') {
    if (ui.calque) ui.calque = null;
    else if (!ui.fin) app.pause();
    return true;
  }
  if (ui.fin && ui.fin.type !== 'victoire' && touche === 'Enter' && M.t - ui.fin.t0 > 1) {
    app.rejouer();
    return true;
  }
  if (ui.fin || ui.calque || ui.occupe) {
    if (ui.annonce && (touche === 'Enter' || touche === ' ') && ui.annonce.ok) ui.annonce.ok();
    return false;
  }
  if (touche === 'm' || touche === 'M') {
    app.basculerSon();
    toast(ui, app.meta.options.muet ? 'Son coupé' : 'Son actif', C.creme);
    return true;
  }
  if (touche === 'ClicDroit') {
    ui.sel = [];
    ui.selJoker = null;
    ui.selConso = null;
    ui.rev++;
    return true;
  }
  if (e.phase === 'manche') {
    if (touche === 'Enter' || touche === ' ') {
      majApercu(app);
      if (ui.apercu && ui.apercu.ok) actionJouer(app);
      else if (ui.apercu && ui.apercu.raison) {
        toast(ui, ui.apercu.raison, C.rouge2);
        son.refus();
      }
      return true;
    }
    if (touche === 'd' || touche === 'D' || touche === 'Backspace') {
      if (ui.sel.length && e.manche.defausses > 0) actionDefausser(app);
      return true;
    }
    if (touche === 'r' || touche === 'R') {
      trier(app, 'rang');
      return true;
    }
    if (touche === 'e' || touche === 'E') {
      trier(app, 'enseigne');
      return true;
    }
    if (touche >= '1' && touche <= '9') {
      const id = e.main[Number(touche) - 1];
      if (id != null) clicCarte(app, id);
      return true;
    }
  }
  return false;
}

export { actionJouer, lancerManche };

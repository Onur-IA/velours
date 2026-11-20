// Moteur de score. Ordre strict :
//  A. base de la main (jetons et multi selon son niveau)
//  B. chaque carte marquante, de gauche à droite :
//       jetons du rang -> amélioration -> édition -> sceau -> jokers "par carte" (gauche à droite)
//       puis les rejoues éventuelles répètent tout le bloc de la carte
//  C. cartes gardées en main (Enclume, jokers "en main"), puis leurs rejoues
//  D. jokers, de gauche à droite : édition Brillant/Irisé, effet, puis édition Prisme
//  E. règle finale du jeu de départ (Bascule), puis total = jetons × multi

import { evaluer, aEnseigne } from './mains.js';
import { baseDeMain, jetonsDeRang, AMELIORATIONS, EDITIONS, SCEAUX } from './donnees.js';
import { REG, reglesActives, estTete, estAffaiblie, patronActif, mod, chanceBrute, mainLaPlusJouee, niveler, nivJoker, synergiesActives } from './outils.js';
import { effectifs, JOKER } from './jokers.js';

// v7 : multi gagné par marche du crescendo.
const ENV_ = (typeof process !== 'undefined' && process.env) || {};
export const BONUS_MARCHE = ENV_.VC_B != null ? Number(ENV_.VC_B) : 1;
export const X_APOTHEOSE = ENV_.VC_X != null ? Number(ENV_.VC_X) : 1.5;

export function evaluerMain(etat, cartes) {
  const regles = reglesActives(etat);
  return Object.assign(evaluer(cartes, regles), { regles });
}

// Calcule une main. Modifie l'état (argent, jokers qui grandissent) : pour un aperçu,
// passer une copie de l'état avec opts.apercu = true.
export function calculerMain(etat, jouees, enMain, opts = {}) {
  const apercu = !!opts.apercu;
  const m = etat.manche;
  const regles = reglesActives(etat);
  const ev = evaluer(jouees, regles);
  const patron = regles.sansPatron ? null : patronActif(etat);
  const R = { type: ev.type, jetons: 0, multi: 0, total: 0, evts: [], incertain: false, detruites: [], jokersDetruits: [] };

  const affaiblie = (c) => !regles.rebouteux && patron && patron.affaiblit && !!patron.affaiblit(etat, c, regles);

  let marquantes = (regles.toutMarque ? jouees.slice() : ev.marquantes.map((i) => jouees[i]));
  if (patron && patron.goulot) marquantes = marquantes.slice(0, patron.goulot);

  const ctx = {
    etat, m, apercu, regles,
    jouees, marquantes, enMain,
    type: ev.type, contient: ev.contient,
    premiereMain: m.mainsJouees === 0,
    derniereMain: m.mains === 0,
    tete: (c) => estTete(etat, c, regles),
    ens: (c, e) => aEnseigne(c, e, regles),
    rouge: (c) => aEnseigne(c, 'C', regles) || aEnseigne(c, 'K', regles),
    noir: (c) => aEnseigne(c, 'P', regles) || aEnseigne(c, 'T', regles),
    incertain: () => {
      R.incertain = true;
    },
    chance: (num, den) => {
      if (apercu) {
        R.incertain = true;
        return false;
      }
      return chanceBrute(etat, num, den, regles);
    },
  };

  const pousser = (e) => {
    e.jetons = R.jetons;
    e.multi = R.multi;
    R.evts.push(e);
  };
  // Applique un effet { jetons, multi, xmulti, argent, texte } ou une liste d'effets.
  const appliquer = (eff, cible) => {
    if (!eff) return;
    if (Array.isArray(eff)) {
      eff.forEach((e) => appliquer(e, cible));
      return;
    }
    if (eff.jetons) {
      R.jetons += eff.jetons;
      pousser(Object.assign({ dj: eff.jetons }, cible));
    }
    if (eff.multi) {
      R.multi += eff.multi;
      pousser(Object.assign({ dm: eff.multi }, cible));
    }
    if (eff.xmulti && eff.xmulti !== 1) {
      R.multi = Math.round(R.multi * eff.xmulti * 1000) / 1000;
      pousser(Object.assign({ xm: eff.xmulti }, cible));
    }
    if (eff.argent) {
      etat.argent += eff.argent;
      pousser(Object.assign({ argent: eff.argent }, cible));
    }
    if (eff.texte && !eff.jetons && !eff.multi && !eff.xmulti && !eff.argent) {
      pousser(Object.assign({ txt: eff.texte }, cible));
    }
  };

  const jokers = etat.jokers;
  const actif = (j) => j.uid !== m.jokerMuet;
  // Parcourt les jokers de gauche à droite et appelle un crochet de score (copies comprises).
  const pourJokers = (crochet, fn) => {
    for (let i = 0; i < jokers.length; i++) {
      const j = jokers[i];
      if (!actif(j)) continue;
      for (const { def, inst } of effectifs(jokers, i)) {
        if (!def[crochet] || !actif(inst)) continue;
        fn(j, def, inst);
      }
    }
  };
  // Crochets d'état : jamais copiés.
  const pourJokersPropres = (crochet, fn) => {
    for (const j of jokers.slice()) {
      if (!actif(j) || !jokers.includes(j)) continue;
      const def = JOKER[j.id];
      if (def && def[crochet]) fn(j, def);
    }
  };

  // --- Avant : effets préparatoires (jokers qui grandissent, transmutations).
  pourJokersPropres('avant', (j, def) => {
    const r = def.avant(ctx, j);
    if (r && r.texte) pousser({ t: 'joker', uid: j.uid, txt: r.texte });
  });

  // --- A. Base de la main.
  let niveau = etat.niveaux[ev.type] ? etat.niveaux[ev.type].niveau : 1;
  if (patron && patron.rabot) niveau = 1;
  const base = baseDeMain(ev.type, niveau);
  if (patron && patron.moitieFavorite && mainLaPlusJouee(etat) === ev.type) {
    base.jetons = Math.ceil(base.jetons / 2);
    base.multi = Math.ceil(base.multi / 2);
    R.saisie = true;
  }
  R.jetons = base.jetons;
  R.multi = base.multi;
  R.niveau = niveau;
  pousser({ t: 'base', type: ev.type, niveau });

  const coeurMulti = mod(etat, 'coeurMulti');
  // v6 : synergies complètes de la rangée.
  const syn = new Set(synergiesActives(etat).map((s) => s.id));
  R.synergies = [...syn];
  if (!apercu && etat.vus && syn.size) {
    if (!etat.vus.synergies) etat.vus.synergies = {};
    for (const id of syn) etat.vus.synergies[id] = 1;
  }

  // --- B. Cartes marquantes.
  const blocCarte = (c) => {
    const cible = { t: 'carte', id: c.id };
    appliquer({ jetons: jetonsDeRang(c.rang) + (c.bonus || 0) }, cible);
    const a = c.amel ? AMELIORATIONS[c.amel] : null;
    if (c.amel === 'lestee') appliquer({ jetons: a.jetons }, cible);
    else if (c.amel === 'ardente') appliquer({ multi: a.multi }, cible);
    else if (c.amel === 'cristal') appliquer({ xmulti: a.xmulti }, cible);
    else if (c.amel === 'veinarde') {
      if (ctx.chance(a.chanceMulti[0], a.chanceMulti[1])) appliquer({ multi: a.multi }, cible);
      if (ctx.chance(a.chanceArgent[0], a.chanceArgent[1])) appliquer({ argent: a.argent }, cible);
    }
    if (c.edition && EDITIONS[c.edition]) {
      const e = EDITIONS[c.edition];
      appliquer({ jetons: e.jetons, multi: e.multi, xmulti: e.xmulti }, cible);
    }
    if (c.sceau === 'ambre') appliquer({ argent: SCEAUX.ambre.argent }, cible);
    // v6 : carte retouchée en boutique (+15 jetons et +2 multi par niveau).
    if (c.niv > 0) appliquer({ jetons: 15 * c.niv, multi: 2 * c.niv }, cible);
    if (coeurMulti && aEnseigne(c, 'C', regles)) appliquer({ multi: coeurMulti }, cible);
    pourJokers('carte', (j, def, inst) => {
      appliquer(niveler(def.carte(ctx, c, inst), inst), { t: 'carte', id: c.id, uid: j.uid });
    });
    // v6 : synergie des Têtes couronnées.
    if (syn.has('couronnes') && ctx.tete(c)) appliquer({ xmulti: 1.2 }, { t: 'carte', id: c.id, syn: 'couronnes' });
  };
  for (const c of marquantes) {
    if (affaiblie(c)) {
      pousser({ t: 'carte', id: c.id, txt: 'Affaiblie', faible: true });
      continue;
    }
    blocCarte(c);
    const rejoues = [];
    if (c.sceau === 'carmin') rejoues.push(null);
    pourJokers('rejoue', (j, def, inst) => {
      let n = def.rejoue(ctx, c, inst) || 0;
      if (n > 0 && nivJoker(inst) >= 3) n++; // v6 : niveau 3, une fois de plus
      for (let k = 0; k < n; k++) rejoues.push(j.uid);
    });
    for (const src of rejoues) {
      pousser({ t: 'rejoue', id: c.id, uid: src });
      blocCarte(c);
      if (syn.has('glaces')) appliquer({ multi: 4 }, { t: 'carte', id: c.id, syn: 'glaces' });
    }
  }

  // --- C. Cartes gardées en main.
  const blocEnMain = (c) => {
    const cible = { t: 'tenue', id: c.id };
    if (c.amel === 'enclume') appliquer({ xmulti: AMELIORATIONS.enclume.xmulti }, cible);
    pourJokers('enMain', (j, def, inst) => {
      appliquer(niveler(def.enMain(ctx, c, inst), inst), { t: 'tenue', id: c.id, uid: j.uid });
    });
  };
  for (const c of enMain) {
    if (affaiblie(c)) continue;
    const avant = R.evts.length;
    blocEnMain(c);
    if (R.evts.length === avant) continue; // rien à rejouer
    const rejoues = [];
    if (c.sceau === 'carmin') rejoues.push(null);
    pourJokers('rejoueEnMain', (j, def, inst) => {
      let n = def.rejoueEnMain(ctx, c, inst) || 0;
      if (n > 0 && nivJoker(inst) >= 3) n++;
      for (let k = 0; k < n; k++) rejoues.push(j.uid);
    });
    for (const src of rejoues) {
      pousser({ t: 'rejoue', id: c.id, uid: src, tenue: true });
      blocEnMain(c);
    }
  }

  // --- v7 : le crescendo paie par lui-même. +BONUS_MARCHE multi par marche, et l'apothéose (marche 5) multiplie tout par 1,5.
  const marchesC = Math.max(0, m.crescendo || 0);
  if (marchesC > 0 && !regles.sansCrescendo) {
    R.multi += BONUS_MARCHE * marchesC;
    pousser({ t: 'regle', nom: 'CRESCENDO ' + marchesC, dm: BONUS_MARCHE * marchesC });
  }

  // --- D. Jokers, de gauche à droite.
  for (let i = 0; i < jokers.length; i++) {
    const j = jokers[i];
    if (!actif(j)) continue;
    const cible = { t: 'joker', uid: j.uid };
    if (j.edition === 'brillant') appliquer({ jetons: EDITIONS.brillant.jetons }, cible);
    if (j.edition === 'irise') appliquer({ multi: EDITIONS.irise.multi }, cible);
    for (const { def, inst } of effectifs(jokers, i)) {
      if (!def.main || !actif(inst)) continue;
      appliquer(niveler(def.main(ctx, inst), inst), cible);
    }
    if (j.edition === 'prisme') appliquer({ xmulti: EDITIONS.prisme.xmulti }, cible);
  }

  // --- E. Règle finale et total.
  if (marchesC >= 5 && !regles.sansCrescendo && X_APOTHEOSE > 1) {
    R.multi = Math.round(R.multi * X_APOTHEOSE * 1000) / 1000;
    pousser({ t: 'regle', nom: 'APOTHÉOSE', xm: X_APOTHEOSE });
  }
  // Jeu du Soliste (v4) : la main unique compte plusieurs fois.
  const xr = mod(etat, 'xmultiMain');
  if (xr) {
    R.multi = Math.round(R.multi * (1 + xr) * 1000) / 1000;
    pousser({ t: 'regle', nom: 'SOLISTE', xm: 1 + xr, multi: R.multi });
  }
  if (mod(etat, 'bascule')) {
    const moy = Math.floor((R.jetons + R.multi) / 2);
    R.jetons = moy;
    R.multi = moy;
    pousser({ t: 'bascule' });
  }
  R.jetons = Math.max(0, R.jetons);
  R.multi = Math.max(0, R.multi);
  R.total = Math.floor(R.jetons * R.multi);
  // Le Monotone : un type de main déjà joué dans la manche ne vaut plus rien.
  if (patron && patron.monotone && m.typesJoues.includes(ev.type)) {
    R.total = 0;
    R.annulee = true;
  }

  // --- Après : casse des Cristal, jokers qui réagissent.
  for (const c of marquantes) {
    if (c.amel !== 'cristal' || affaiblie(c) || regles.cristalSolide) continue;
    const a = AMELIORATIONS.cristal;
    if (apercu) continue;
    if (ctx.chance(a.casse[0], a.casse[1])) {
      R.detruites.push({ id: c.id, raison: 'brise' });
      R.evts.push({ t: 'brise', id: c.id, jetons: R.jetons, multi: R.multi });
    }
  }
  pourJokersPropres('apres', (j, def) => {
    const r = def.apres(ctx, j);
    if (!r) return;
    if (r.detruire) for (const id of r.detruire) if (!R.detruites.some((d) => d.id === id)) R.detruites.push({ id, raison: 'joker' });
    if (r.detruitJoker) R.jokersDetruits.push(j.uid);
    if (r.texte) R.evts.push({ t: 'joker', uid: j.uid, txt: r.texte, apres: true, jetons: R.jetons, multi: R.multi });
    if (r.detruire) for (const id of r.detruire) R.evts.push({ t: 'devore', id, uid: j.uid, jetons: R.jetons, multi: R.multi });
  });
  pourJokersPropres('total', (j, def) => {
    const r = def.total(ctx, j, R.total);
    if (r && r.texte) R.evts.push({ t: 'joker', uid: j.uid, txt: r.texte, apres: true, jetons: R.jetons, multi: R.multi });
  });

  R.marquantes = marquantes.map((c) => c.id);
  return R;
}

export { REG, estAffaiblie, SCEAUX };

// v5 : ce que chaque joker a apporté à une main, en une ligne. evts : les événements de calculerMain.
// Renvoie { uid: { jetons, multi, x, argent, rejoues, ligne } } pour les jokers qui ont agi.
export function apportsJokers(evts) {
  const out = {};
  for (const e of evts || []) {
    if (e.uid == null) continue;
    const a = out[e.uid] || (out[e.uid] = { jetons: 0, multi: 0, x: 1, argent: 0, rejoues: 0, texte: null });
    if (e.dj) a.jetons += e.dj;
    if (e.dm) a.multi += e.dm;
    if (e.xm) a.x *= e.xm;
    if (e.argent) a.argent += e.argent;
    if (e.t === 'rejoue') a.rejoues++;
    if (e.txt && !a.texte) a.texte = e.txt;
  }
  for (const a of Object.values(out)) {
    a.ligne = ligneApport(a);
    a.court = ligneApport(a, 1);
  }
  return out;
}

const fmtNb = (v) => {
  const r = Math.abs(v) >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100;
  return String(r).replace('.', ',');
};
export function ligneApport(a, n = 2) {
  const p = [];
  if (a.x && Math.abs(a.x - 1) > 1e-9) p.push('×' + fmtNb(a.x));
  if (a.multi) p.push((a.multi > 0 ? '+' : '') + fmtNb(a.multi) + ' M');
  if (a.jetons) p.push((a.jetons > 0 ? '+' : '') + Math.round(a.jetons) + ' J');
  if (a.argent) p.push('+' + a.argent + ' $');
  if (a.rejoues) p.push('REJOUE ' + a.rejoues);
  if (!p.length && a.texte) p.push(String(a.texte).toUpperCase().slice(0, 10));
  return p.slice(0, n).join(' ');
}

// Outils partagés par le moteur : registres, modificateurs, création et destruction.

import { alea } from './rng.js';
import { aEnseigne } from './mains.js';

// Les modules de données s'inscrivent ici (évite les imports circulaires).
export const REG = { JOKER: {}, PRIVILEGE: {}, JEU: {}, ENJEUX: [], CONSO: {}, PATRON: {}, SYNERGIES: [] };

// ------------------------------------------------------------ Synergies (v6)
// Une synergie réunit des jokers précis (et parfois « n autres » d'une étiquette ou d'une famille).
// Complète, elle débloque un effet réel. Données dans synergies.js, calcul ici (pas d'import circulaire).

function membreSyn(s, d) {
  if (!d) return false;
  if (s.fam) return d.fam === s.fam;
  if (s.tag) return (d.tags || []).includes(s.tag);
  return false;
}

// État d'une synergie pour une rangée : { actif, uids, presents, manquants, besoin, n }.
export function etatSynergie(s, jokers) {
  const presents = [];
  const uids = [];
  for (const id of s.membres) {
    const j = jokers.find((k) => k.id === id);
    if (j) {
      presents.push(id);
      uids.push(j.uid);
    }
  }
  const min = s.min || s.membres.length;
  let autres = 0;
  if (s.plus) {
    for (const j of jokers) {
      if (s.membres.includes(j.id)) continue;
      if (membreSyn(s, REG.JOKER[j.id])) {
        if (autres < s.plus) uids.push(j.uid);
        autres++;
      }
    }
  }
  const okMembres = presents.length >= min;
  const okPlus = !s.plus || autres >= s.plus;
  const manquants = s.membres.filter((id) => !presents.includes(id));
  return {
    id: s.id, actif: okMembres && okPlus, uids, presents, manquants,
    manqueMembres: Math.max(0, min - presents.length), manquePlus: s.plus ? Math.max(0, s.plus - autres) : 0,
    n: presents.length + Math.min(autres, s.plus || 0), besoin: min + (s.plus || 0),
  };
}

let cacheSyn = { cle: null, val: [] };
// Les synergies complètes de la rangée (jokers muselés exclus).
export function synergiesActives(etat) {
  if (!etat || !etat.jokers) return [];
  const js = jokersActifs(etat);
  const cle = js.map((j) => j.id + ':' + j.uid).join(',');
  if (cacheSyn.cle === cle) return cacheSyn.val;
  const val = REG.SYNERGIES.filter((s) => etatSynergie(s, js).actif);
  cacheSyn = { cle, val };
  return val;
}
export function synergieActive(etat, id) {
  return synergiesActives(etat).some((s) => s.id === id);
}

// ------------------------------------------------------------ Niveaux (v6)
// Un joker monte jusqu'au niveau 3 (doublon acheté, ou répétition payée en boutique).
// Niveau 2 : effets ×1,4 ; niveau 3 : effets ×1,8 (jetons, multi, louis ; la part au-delà de ×1 pour les ×multi).
export const NIV_MAX = 3;
export function nivJoker(j) {
  return Math.max(1, Math.min(NIV_MAX, (j && j.niv) || 1));
}
export function facteurNiv(n) {
  return Math.round((1 + 0.4 * (Math.max(1, n) - 1)) * 10) / 10;
}
// Un joker peut monter s'il a un effet chiffré (score ou gain de fin de manche).
export function peutMonter(d) {
  return !!(d && (d.main || d.carte || d.enMain || d.gain || d.rejoue || d.rejoueEnMain));
}
// Applique le niveau d'un joker à un effet { jetons, multi, xmulti, argent } (ou une liste).
export function niveler(eff, inst) {
  const n = nivJoker(inst);
  if (!eff || n <= 1) return eff;
  if (Array.isArray(eff)) return eff.map((e) => niveler(e, inst));
  const f = facteurNiv(n);
  const out = Object.assign({}, eff);
  if (out.jetons) out.jetons = Math.round(out.jetons * f);
  if (out.multi) out.multi = Math.round(out.multi * f * 10) / 10;
  if (out.xmulti && out.xmulti !== 1) out.xmulti = Math.round((1 + (out.xmulti - 1) * f) * 100) / 100;
  if (out.argent && out.argent > 0) out.argent = Math.round(out.argent * f);
  return out;
}

export function manche(etat) {
  return etat.manche || null;
}

export function jokersActifs(etat) {
  const m = etat.manche;
  const muet = m ? m.jokerMuet : null;
  return etat.jokers.filter((j) => j.uid !== muet);
}

export function reglesActives(etat) {
  const r = {};
  // Règles portées par le jeu de départ ou l'épreuve (v4), puis par les jokers.
  const jeu = REG.JEU && etat.regles ? REG.JEU[etat.regles.jeu] : null;
  if (jeu && jeu.regles) Object.assign(r, jeu.regles);
  if (etat.epreuve && etat.epreuve.regles) Object.assign(r, etat.epreuve.regles);
  for (const j of jokersActifs(etat)) {
    const d = REG.JOKER[j.id];
    if (d && d.regles) Object.assign(r, d.regles);
  }
  for (const s of synergiesActives(etat)) if (s.regles) Object.assign(r, s.regles);
  return r;
}

// Somme d'un modificateur (tailleMain, mains, defausses, ...) toutes sources confondues.
export function mod(etat, cle) {
  let s = 0;
  for (const j of jokersActifs(etat)) {
    const d = REG.JOKER[j.id];
    if (!d || !d.passif) continue;
    const p = typeof d.passif === 'function' ? d.passif(etat, j) : d.passif;
    if (p && p[cle]) s += p[cle];
  }
  for (const id of etat.privileges) {
    const p = REG.PRIVILEGE[id];
    if (p && p.effets && p.effets[cle]) s += p.effets[cle];
  }
  const jeu = REG.JEU[etat.regles.jeu];
  if (jeu && jeu.effets && jeu.effets[cle]) s += jeu.effets[cle];
  for (let i = 0; i <= etat.regles.enjeu && i < REG.ENJEUX.length; i++) {
    const e = REG.ENJEUX[i];
    if (e.effets && e.effets[cle]) s += e.effets[cle];
  }
  for (const sy of synergiesActives(etat)) if (sy.effets && sy.effets[cle]) s += sy.effets[cle];
  if (etat.bonus && etat.bonus[cle]) s += etat.bonus[cle];
  if (etat.defi && etat.defi.effets && etat.defi.effets[cle]) s += etat.defi.effets[cle];
  if (etat.epreuve && etat.epreuve.effets && etat.epreuve.effets[cle]) s += etat.epreuve.effets[cle];
  return s;
}

export function tailleMain(etat) {
  const m = etat.manche;
  return Math.max(1, etat.regles.tailleMain + mod(etat, 'tailleMain') + (m ? m.tailleMainMod || 0 : 0));
}
export function mainsParManche(etat) {
  return Math.max(1, etat.regles.mains + mod(etat, 'mains'));
}
export function defaussesParManche(etat) {
  return Math.max(0, etat.regles.defausses + mod(etat, 'defausses'));
}
export function emplJokers(etat) {
  return Math.max(0, etat.regles.emplJokers + mod(etat, 'emplJokers'));
}
export function emplConsos(etat) {
  return Math.max(0, etat.regles.emplConsos + mod(etat, 'emplConsos'));
}
export function jokersComptes(etat) {
  return etat.jokers.filter((j) => j.edition !== 'inverte').length;
}
export function placeJoker(etat) {
  return jokersComptes(etat) < emplJokers(etat);
}
export function placeConso(etat) {
  return etat.consommables.length < emplConsos(etat);
}
export function detteMax(etat) {
  return mod(etat, 'dette');
}

export function patronActif(etat) {
  const m = etat.manche;
  if (!m || !m.patron || m.patronAnnule) return null;
  return REG.PATRON[m.patron] || null;
}

export function estTete(etat, carte, regles) {
  const r = regles || reglesActives(etat);
  return r.toutesTetes || (carte.rang >= 11 && carte.rang <= 13);
}

export function estAffaiblie(etat, carte, regles) {
  const p = patronActif(etat);
  if (!p || !p.affaiblit) return false;
  const r = regles || reglesActives(etat);
  if (r.rebouteux) return false;
  return !!p.affaiblit(etat, carte, r);
}

// Aides pour les prédicats de cartes (jokers, surbrillance des synergies).
export function aides(etat, regles) {
  const r = regles || reglesActives(etat);
  return {
    regles: r,
    tete: (c) => estTete(etat, c, r),
    ens: (c, e) => aEnseigne(c, e, r),
    rouge: (c) => aEnseigne(c, 'C', r) || aEnseigne(c, 'K', r),
    noir: (c) => aEnseigne(c, 'P', r) || aEnseigne(c, 'T', r),
  };
}

export function chanceBrute(etat, num, den, regles) {
  const r = regles || reglesActives(etat);
  const p = (num * (r.chancesX2 ? 2 : 1)) / den;
  return alea(etat, 'chance') < p;
}

export function nouvelUid(etat) {
  etat.prochainId = (etat.prochainId || 1) + 1;
  return etat.prochainId;
}

export function creerCarte(etat, rang, ens, extras) {
  const c = { id: nouvelUid(etat), rang, ens, amel: null, edition: null, sceau: null, bonus: 0 };
  if (extras) Object.assign(c, extras);
  return c;
}

export function carteParId(etat, id) {
  return etat.paquet.find((c) => c.id === id);
}

export function note(etat, evt) {
  if (!etat.evts) etat.evts = [];
  etat.evts.push(evt);
}

export function ajouterJoker(etat, id, edition) {
  const d = REG.JOKER[id];
  const j = { uid: nouvelUid(etat), id, edition: edition || null, etat: {}, bonusVente: 0 };
  if (d && d.init) d.init(j, etat);
  etat.jokers.push(j);
  if (etat.vus) etat.vus.jokers[id] = 1;
  return j;
}

export function valeurVenteJoker(etat, j) {
  const d = REG.JOKER[j.id];
  if (d && d.pousse) return 0;
  let prix = d ? d.prix : 4;
  // v6 : le Faussaire fait monter les reventes.
  if (etat && etat.jokers && etat.jokers.some((k) => k.id === 'sy_faussaire' && k !== j)) prix += 4;
  if (j.edition === 'brillant') prix += 2;
  if (j.edition === 'irise') prix += 3;
  if (j.edition === 'prisme' || j.edition === 'inverte') prix += 5;
  return Math.max(1, Math.floor(prix / 2)) + (j.bonusVente || 0);
}

// Appelle un crochet sur chaque joker actif, de gauche à droite.
export function appeler(etat, crochet, ...args) {
  const res = [];
  for (const j of jokersActifs(etat).slice()) {
    const d = REG.JOKER[j.id];
    if (!d || !d[crochet]) continue;
    if (!etat.jokers.includes(j)) continue;
    const r = d[crochet](etat, j, ...args);
    if (r) res.push({ j, r });
  }
  return res;
}

export function retirerJoker(etat, uid) {
  const i = etat.jokers.findIndex((j) => j.uid === uid);
  if (i >= 0) etat.jokers.splice(i, 1);
}

// Détruit des cartes du paquet, où qu'elles soient.
export function detruireCartes(etat, ids, raison) {
  const cartes = ids.map((id) => carteParId(etat, id)).filter(Boolean);
  if (!cartes.length) return [];
  const set = new Set(cartes.map((c) => c.id));
  etat.paquet = etat.paquet.filter((c) => !set.has(c.id));
  etat.pioche = etat.pioche.filter((id) => !set.has(id));
  etat.main = etat.main.filter((id) => !set.has(id));
  etat.defausse = etat.defausse.filter((id) => !set.has(id));
  etat.stats.cartesDetruites = (etat.stats.cartesDetruites || 0) + cartes.length;
  for (const { j, r } of appeler(etat, 'carteDetruite', cartes, raison)) {
    if (r.texte) note(etat, { t: 'joker', uid: j.uid, txt: r.texte });
  }
  return cartes;
}

// Ajoute une carte au paquet (et éventuellement à la main).
export function ajouterCarte(etat, carte, ou) {
  etat.paquet.push(carte);
  if (ou === 'main') etat.main.push(carte.id);
  else if (ou === 'pioche') etat.pioche.splice(Math.floor(alea(etat, 'divers') * (etat.pioche.length + 1)), 0, carte.id);
  else if (ou === 'defausse') etat.defausse.push(carte.id);
  appeler(etat, 'carteAjoutee', carte);
  return carte;
}

// ------------------------------------------------------------ Tirages

import { pondere, choisir } from './rng.js';

export function jokerPermis(etat, d) {
  const f = etat.regles.familles || {};
  if (f[d.fam] === false) return false;
  if (d.sig && f.signature === false) return false;
  // Les jokers de la salle n'ont pas de sens sans public.
  if (d.fam === 'public' && etat.regles.public === false) return false;
  if (etat.verrouilles && etat.verrouilles.includes(d.id)) return false;
  return true;
}

const POIDS_RARETE = { C: 66.5, U: 26, R: 6, E: 1.6, L: 0.35 };
export const ORDRE_RARETES = ['C', 'U', 'R', 'E', 'L'];

// Tire un joker : rareté au hasard (ou imposée), sans doublon si possible.
export function tirerJoker(etat, flux, opts = {}) {
  const tous = Object.values(REG.JOKER);
  let rarete = opts.rarete;
  if (!rarete) {
    const bonusRare = 1 + mod(etat, 'raresX');
    rarete = pondere(etat, flux, ORDRE_RARETES, (r) => (r === 'C' || r === 'U' ? POIDS_RARETE[r] : POIDS_RARETE[r] * bonusRare));
  }
  const exclus = new Set(etat.jokers.map((j) => j.id).concat(opts.exclus || []));
  let pool = tous.filter((d) => d.r === rarete && jokerPermis(etat, d) && !exclus.has(d.id));
  if (!pool.length) pool = tous.filter((d) => d.r === rarete && jokerPermis(etat, d));
  if (!pool.length) pool = tous.filter((d) => d.r === 'C' && !exclus.has(d.id));
  if (!pool.length) pool = [REG.JOKER.figurant];
  const d = choisir(etat, flux, pool);
  if (etat.vus) etat.vus.jokers[d.id] = 1;
  return d;
}

// Édition au hasard pour un joker de boutique ou de paquet.
export function tirerEdition(etat, flux, facteur = 1) {
  const k = facteur * (1 + mod(etat, 'editionsX'));
  const v = alea(etat, flux);
  if (v < 0.004 * k) return 'inverte';
  if (v < 0.01 * k) return 'prisme';
  if (v < 0.03 * k) return 'irise';
  if (v < 0.06 * k) return 'brillant';
  return null;
}

// Crée un consommable d'une catégorie (arcane, astre, ombre) ou d'un id précis.
export function creerConso(etat, cat, opts = {}) {
  if (!opts.force && !placeConso(etat)) return null;
  let id = opts.id;
  if (!id) {
    const d = tirerConso(etat, cat, 'conso');
    if (!d) return null;
    id = d.id;
  }
  const c = { uid: nouvelUid(etat), id };
  etat.consommables.push(c);
  if (etat.vus) etat.vus.consos[id] = 1;
  return c;
}

export function tirerConso(etat, cat, flux, exclus = []) {
  const ex = new Set(exclus.concat(etat.consommables.map((c) => c.id)));
  const rare = cat === 'ombre' && alea(etat, flux) < 0.1;
  let pool = Object.values(REG.CONSO).filter((d) => d.cat === cat && !!d.rare === rare && !ex.has(d.id));
  if (cat === 'astre') {
    // Les astres des mains cachées n'apparaissent qu'une fois la main jouée.
    pool = pool.filter((d) => !d.cachee || (etat.niveaux[d.main] && etat.niveaux[d.main].jouees > 0));
  }
  if (!pool.length) pool = Object.values(REG.CONSO).filter((d) => d.cat === cat && !d.cachee);
  const d = choisir(etat, flux, pool);
  if (d && etat.vus) etat.vus.consos[d.id] = 1;
  return d;
}

export function mainLaPlusJouee(etat) {
  let best = 'carte_haute';
  let n = -1;
  for (const id of Object.keys(etat.niveaux)) {
    const v = etat.niveaux[id];
    if (v.jouees > n) {
      n = v.jouees;
      best = id;
    }
  }
  return n > 0 ? best : null;
}

export function monterMain(etat, id, n = 1) {
  if (!etat.niveaux[id]) etat.niveaux[id] = { niveau: 1, jouees: 0 };
  etat.niveaux[id].niveau = Math.max(1, etat.niveaux[id].niveau + n);
}

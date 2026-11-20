// Reconnaissance des mains de poker.
// evaluer(cartes, regles) -> { type, marquantes: [indices], contient: {type: true} }
// regles : { suiteDe4, couleurDe4, saut, daltonien }

import { ENSEIGNES } from './donnees.js';

// Enseignes auxquelles une carte appartient (Caméléon = toutes).
export function enseignesDe(carte, regles) {
  if (carte.amel === 'cameleon') return ENSEIGNES.slice();
  if (regles && regles.daltonien) {
    return carte.ens === 'P' || carte.ens === 'T' ? ['P', 'T'] : ['C', 'K'];
  }
  return [carte.ens];
}

export function aEnseigne(carte, ens, regles) {
  return enseignesDe(carte, regles).includes(ens);
}

function chercherCouleur(cartes, regles, besoin) {
  let meilleur = null;
  for (const e of ENSEIGNES) {
    const idx = [];
    cartes.forEach((c, i) => {
      if (aEnseigne(c, e, regles)) idx.push(i);
    });
    if (idx.length >= besoin && (!meilleur || idx.length > meilleur.length)) meilleur = idx;
  }
  return meilleur;
}

function chercherSuite(cartes, regles, besoin) {
  // Valeurs uniques, l'As vaut aussi 1.
  const parValeur = new Map();
  cartes.forEach((c, i) => {
    if (!parValeur.has(c.rang)) parValeur.set(c.rang, i);
    if (c.rang === 14 && !parValeur.has(1)) parValeur.set(1, i);
  });
  const vals = [...parValeur.keys()].sort((a, b) => a - b);
  const pasMax = regles && regles.saut ? 2 : 1;
  let meilleure = null;
  for (let d = 0; d < vals.length; d++) {
    const chaine = [vals[d]];
    for (let k = d + 1; k < vals.length; k++) {
      const ecart = vals[k] - chaine[chaine.length - 1];
      if (ecart >= 1 && ecart <= pasMax) chaine.push(vals[k]);
      else if (ecart > pasMax) break;
    }
    // Une suite ne peut pas contenir l'As deux fois (1 et 14).
    if (chaine.includes(1) && chaine.includes(14)) chaine.pop();
    if (chaine.length >= besoin) {
      if (!meilleure || chaine.length > meilleure.length || (chaine.length === meilleure.length && chaine[chaine.length - 1] > meilleure[meilleure.length - 1])) {
        meilleure = chaine;
      }
    }
  }
  if (!meilleure) return null;
  const idx = meilleure.map((v) => parValeur.get(v));
  return { idx: [...new Set(idx)], haut: meilleure[meilleure.length - 1], bas: meilleure[0] };
}

export function evaluer(cartes, regles = {}) {
  const n = cartes.length;
  const contient = {};
  if (n === 0) return { type: null, marquantes: [], contient };

  const groupes = new Map();
  cartes.forEach((c, i) => {
    if (!groupes.has(c.rang)) groupes.set(c.rang, []);
    groupes.get(c.rang).push(i);
  });
  // Groupes triés : taille décroissante, puis rang décroissant.
  const gs = [...groupes.entries()]
    .map(([rang, idx]) => ({ rang, idx }))
    .sort((a, b) => b.idx.length - a.idx.length || b.rang - a.rang);

  const besoinC = regles.couleurDe4 ? 4 : 5;
  const besoinS = regles.suiteDe4 ? 4 : 5;
  const couleur = chercherCouleur(cartes, regles, besoinC);
  const suite = chercherSuite(cartes, regles, besoinS);

  const g0 = gs[0].idx.length;
  const g1 = gs[1] ? gs[1].idx.length : 0;

  if (g0 >= 2) contient.paire = true;
  if (g0 >= 2 && g1 >= 2) contient.double_paire = true;
  if (g0 >= 3) contient.brelan = true;
  if (g0 >= 4) contient.carre = true;
  if (g0 >= 5) contient.cinq = true;
  if (g0 >= 3 && g1 >= 2) contient.full = true;
  if (couleur) contient.couleur = true;
  if (suite) contient.suite = true;
  contient.carte_haute = true;

  const tout = cartes.map((_, i) => i);
  const union = (a, b) => [...new Set([...a, ...b])].sort((x, y) => x - y);
  const couleurTotale = couleur && couleur.length === n;

  let type;
  let marquantes;
  if (g0 >= 5 && couleurTotale) {
    type = 'cinq_couleur';
    marquantes = tout;
  } else if (g0 >= 3 && g1 >= 2 && n === 5 && couleurTotale) {
    type = 'full_couleur';
    marquantes = tout;
  } else if (g0 >= 5) {
    type = 'cinq';
    marquantes = gs[0].idx.slice(0, 5);
  } else if (suite && couleur) {
    type = suite.haut === 14 && suite.bas >= 10 ? 'quinte_royale' : 'quinte_flush';
    marquantes = union(suite.idx, couleur);
  } else if (g0 >= 4) {
    type = 'carre';
    marquantes = gs[0].idx.slice(0, 4);
  } else if (g0 >= 3 && g1 >= 2) {
    type = 'full';
    marquantes = union(gs[0].idx.slice(0, 3), gs[1].idx.slice(0, 2));
  } else if (couleur) {
    type = 'couleur';
    marquantes = couleur;
  } else if (suite) {
    type = 'suite';
    marquantes = suite.idx;
  } else if (g0 >= 3) {
    type = 'brelan';
    marquantes = gs[0].idx.slice(0, 3);
  } else if (g0 >= 2 && g1 >= 2) {
    type = 'double_paire';
    marquantes = union(gs[0].idx.slice(0, 2), gs[1].idx.slice(0, 2));
  } else if (g0 >= 2) {
    type = 'paire';
    marquantes = gs[0].idx.slice(0, 2);
  } else {
    type = 'carte_haute';
    // La plus haute, la plus à gauche en cas d'égalité.
    let best = 0;
    cartes.forEach((c, i) => {
      if (c.rang > cartes[best].rang) best = i;
    });
    marquantes = [best];
  }
  if (type === 'quinte_flush' || type === 'quinte_royale') contient.quinte_flush = true;
  if (type === 'quinte_royale') contient.quinte_royale = true;
  if (type === 'full_couleur') contient.full_couleur = true;
  if (type === 'cinq_couleur') contient.cinq_couleur = true;
  marquantes = marquantes.slice().sort((a, b) => a - b);
  return { type, marquantes, contient };
}

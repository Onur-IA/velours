// Règles de partie, jeux de départ (paquets), enjeux de difficulté.

import { REG, creerCarte } from './outils.js';
import { ENSEIGNES, RANGS } from './donnees.js';

export const COURBES = {
  douce: { nom: 'Douce', desc: 'Pour apprendre, les derniers paliers restent abordables.', table: [250, 620, 1400, 3100, 6500, 12000, 20000, 31000], suite: 1.5 },
  classique: { nom: 'Classique', desc: 'Le rythme de référence.', table: [290, 840, 2200, 5400, 12500, 25000, 44000, 71000], suite: 1.7 },
  raide: { nom: 'Raide', desc: 'Ça grimpe très vite. Pour les rangées bien huilées.', table: [300, 900, 2600, 7000, 18000, 42000, 90000, 180000], suite: 2.1 },
};

export const REGLES_DEFAUT = {
  paliers: 8,
  courbe: 'classique',
  facteurCible: 1,
  mains: 4,
  defausses: 3,
  tailleMain: 8,
  emplJokers: 5,
  emplConsos: 2,
  argentDepart: 4,
  interetPar: 5,
  interetMax: 5,
  coutRelance: 5,
  jeu: 'carmin',
  enjeu: 0,
  familles: {},
  public: true, // l'applaudimètre et les rappels (voir public.js)
};

export const BORNES = {
  paliers: [1, 16], facteurCible: [0.25, 4], mains: [1, 8], defausses: [0, 8], tailleMain: [4, 12],
  emplJokers: [1, 10], emplConsos: [0, 6], argentDepart: [0, 100], interetPar: [1, 20], interetMax: [0, 30], coutRelance: [0, 20],
};

export function normaliserRegles(r) {
  const out = Object.assign({}, REGLES_DEFAUT, r || {});
  out.familles = Object.assign({}, (r && r.familles) || {});
  for (const k of Object.keys(BORNES)) {
    let v = Number(out[k]);
    if (!isFinite(v)) v = REGLES_DEFAUT[k];
    if (k !== 'facteurCible') v = Math.round(v);
    out[k] = Math.min(BORNES[k][1], Math.max(BORNES[k][0], v));
  }
  out.public = out.public !== false;
  if (!COURBES[out.courbe]) out.courbe = 'classique';
  if (!REG.JEU[out.jeu]) out.jeu = 'carmin';
  out.enjeu = Math.min(ENJEUX.length - 1, Math.max(0, Math.round(Number(out.enjeu) || 0)));
  return out;
}

export function estClassique(r) {
  const n = normaliserRegles(r);
  return Object.keys(BORNES).every((k) => n[k] === REGLES_DEFAUT[k]) && n.courbe === 'classique' && n.public && !Object.values(n.familles).some((v) => v === false);
}

// Score de base d'un palier, avant le facteur de la manche.
export function basePalier(regles, palier) {
  const c = COURBES[regles.courbe] || COURBES.classique;
  const t = c.table;
  let v;
  if (palier <= t.length) v = t[Math.max(0, palier - 1)];
  else v = t[t.length - 1] * Math.pow(c.suite, palier - t.length);
  return v * (regles.facteurCible || 1);
}

// ------------------------------------------------------------------ Jeux

function standard(etat, filtre) {
  const cs = [];
  for (const e of ENSEIGNES) for (const r of RANGS) if (!filtre || filtre(r, e)) cs.push(creerCarte(etat, r, e));
  return cs;
}

export const JEUX = [
  { id: 'carmin', nom: 'Jeu Carmin', desc: '{c|+1 défausse} par manche. Le jeu pour commencer.', effets: { defausses: 1 }, teinte: 'rouge' },
  { id: 'nuit', nom: 'Jeu de Nuit', desc: '{c|+1 main} par manche.', effets: { mains: 1 }, teinte: 'bleu' },
  { id: 'rentier', nom: 'Jeu du Rentier', desc: 'Commence avec {l|10 louis} de plus.', effets: {}, argent: 10, teinte: 'or' },
  { id: 'roturier', nom: 'Jeu Roturier', desc: 'Aucune tête dans le paquet : 40 cartes.', effets: {}, teinte: 'vert', paquet: (etat) => standard(etat, (r) => r < 11 || r === 14), deblocage: 'Atteins le palier 3.' },
  { id: 'bicolore', nom: 'Jeu Bicolore', desc: 'Seulement des Piques et des Cœurs, en double.', effets: {}, teinte: 'violet', paquet: (etat) => standard(etat, (r, e) => e === 'P' || e === 'C').concat(standard(etat, (r, e) => e === 'P' || e === 'C')), deblocage: 'Atteins le palier 4.' },
  { id: 'ecarlate', nom: 'Jeu Écarlate', desc: 'Enseigne favorite : chaque Cœur marqué donne {m|+2 multi}.', effets: { coeurMulti: 2 }, teinte: 'rouge', deblocage: 'Atteins le palier 5.' },
  { id: 'fourmi', nom: 'Jeu de la Fourmi', desc: 'Intérêts jusqu\'à {l|10 louis}. Les mains restantes ne rapportent plus rien.', effets: { interetMax: 5, sansBonusMains: 1 }, teinte: 'bois', deblocage: 'Gagne une partie.' },
  { id: 'bascule', nom: 'Jeu Bascule', desc: 'Avant le total, jetons et multi sont mis à égalité. Les mises demandent {c|deux fois plus}.', effets: { bascule: 1, cible: 1 }, teinte: 'cyan', deblocage: 'Gagne une partie avec l\'enjeu Os ou plus.' },
  { id: 'astronome', nom: "Jeu de l'Astronome", desc: 'Commence avec le Télescope et 2 Astres. {c|-1 emplacement} de joker.', effets: { emplJokers: -1 }, privileges: ['telescope'], astres: 2, teinte: 'bleu', deblocage: 'Utilise 20 Astres au total.' },
  { id: 'miniature', nom: 'Jeu Miniature', desc: 'Pas de 2, 3, 4, 5 : 36 cartes. {c|-1 carte} en main.', effets: { tailleMain: -1 }, teinte: 'orange', paquet: (etat) => standard(etat, (r) => r > 5), deblocage: 'Gagne 3 parties.' },
  // v4 : quatre jeux à règle forte.
  { id: 'soliste', nom: 'Jeu du Soliste', desc: 'Une seule main par manche, mais elle compte {m|×3}. {c|+1 défausse}.', effets: { mains: -3, defausses: 1, xmultiMain: 2 }, teinte: 'violet', deblocage: 'Atteins le palier 6.' },
  { id: 'parrain', nom: 'Jeu du Parrain', desc: 'Plus d\'intérêts du tout, mais chaque main jouée rapporte {l|2 louis} en fin de manche.', effets: { interetMax: -30, argentMain: 2 }, teinte: 'or', deblocage: 'Gagne une partie avec le Jeu du Rentier.' },
  { id: 'crepuscule', nom: 'Jeu du Crépuscule', desc: 'Les Cœurs et les Carreaux se confondent, les Piques et les Trèfles aussi. Les mises demandent {c|25 % de plus}.', effets: { cible: 0.25 }, regles: { daltonien: true }, teinte: 'encre', deblocage: 'Joue 10 Couleurs au total.' },
  { id: 'geant', nom: 'Jeu du Géant', desc: '{c|+2 cartes} en main, mais {c|-1 main} par manche.', effets: { tailleMain: 2, mains: -1 }, teinte: 'vert', deblocage: 'Bats 25 patrons au total.' },
  { id: 'ombres', nom: 'Jeu des Ombres', desc: 'Commence avec une Ombre. Les paquets d\'Ombres sont 4 fois plus fréquents.', effets: { ombresX: 3 }, ombre: 1, teinte: 'encre', deblocage: 'Découvre 60 jokers.' },
];
export const JEU = REG.JEU;
for (const j of JEUX) JEU[j.id] = j;

export function construirePaquet(etat, jeuId) {
  const j = JEU[jeuId] || JEU.carmin;
  return j.paquet ? j.paquet(etat) : standard(etat);
}

// ---------------------------------------------------------------- Enjeux
// Chaque enjeu ajoute son malus à tous les précédents.

export const ENJEUX = [
  { id: 'bois', nom: 'Bois', desc: 'Aucun malus.', effets: {} },
  { id: 'os', nom: 'Os', desc: 'La petite mise ne rapporte plus de louis.', effets: { petiteSansGain: 1 } },
  { id: 'cuivre', nom: 'Cuivre', desc: 'Toutes les mises demandent 15 % de jetons en plus.', effets: { cible: 0.15 } },
  { id: 'argent', nom: 'Argent', desc: '1 défausse de moins par manche.', effets: { defausses: -1 } },
  { id: 'jade', nom: 'Jade', desc: 'Tes intérêts sont plafonnés 2 louis plus bas.', effets: { interetMax: -2 } },
  { id: 'onyx', nom: 'Onyx', desc: 'Les mises demandent encore 20 % de jetons en plus.', effets: { cible: 0.2 } },
  { id: 'or', nom: 'Or', desc: 'Tout coûte 1 louis de plus en boutique.', effets: { surcout: 1 } },
  { id: 'rubis', nom: 'Rubis', desc: 'Les patrons demandent 25 % de jetons en plus.', effets: { ciblePatron: 0.25 } },
  { id: 'velours_noir', nom: 'Velours noir', desc: '1 main de moins par manche.', effets: { mains: -1 } },
  // v4 : trois enjeux de plus, chacun avec une règle forte.
  { id: 'cristal', nom: 'Cristal', desc: 'La boutique propose un article de moins.', effets: { emplBoutique: -1 } },
  { id: 'ebene', nom: 'Ébène', desc: 'Une carte de moins en main.', effets: { tailleMain: -1 } },
  { id: 'diamant', nom: 'Diamant', desc: 'Les mains restantes ne rapportent plus rien et les patrons demandent encore 25 % de plus.', effets: { sansBonusMains: 1, ciblePatron: 0.25 } },
];
REG.ENJEUX = ENJEUX;

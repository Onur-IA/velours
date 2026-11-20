// Épreuves (v4) : des parties scénarisées, chacune avec une contrainte forte et un départ imposé.
// Une épreuve fixe les règles de la partie (`partie`), ajoute des modificateurs (`effets`, lus par mod),
// des drapeaux de règle (`regles`, lus par reglesActives) et un départ (`depart`, comme un défi).

import { FAMILLES } from './jokers.js';
import { REGLES_DEFAUT } from './regles.js';

const seules = (...gardees) => Object.fromEntries(Object.keys(FAMILLES).filter((f) => !gardees.includes(f)).map((f) => [f, false]));

export const EPREUVES = [
  {
    id: 'repetition', nom: 'La Répétition', niveau: 1,
    desc: 'Trois paliers en pente douce, le Figurant déjà sur scène. Pour se faire la main.',
    partie: { paliers: 3, courbe: 'douce' },
    depart: { jokers: ['figurant'] },
  },
  {
    id: 'sans_le_sou', nom: 'Sans le sou', niveau: 2,
    desc: 'Aucun louis au départ, aucun intérêt. Chaque achat se mérite. Cinq paliers.',
    partie: { paliers: 5, argentDepart: 0, interetMax: 0 },
    effets: { cible: -0.15 },
  },
  {
    id: 'nuit_couleurs', nom: 'La Nuit des couleurs', niveau: 2,
    desc: 'Rouges et noires se confondent : les Couleurs viennent toutes seules, mais les mises montent de 40 %. Cinq paliers.',
    partie: { paliers: 5 },
    effets: { cible: 0.4 },
    regles: { daltonien: true },
    depart: { jokers: ['monochrome'] },
  },
  {
    id: 'cuivres', nom: 'Les Cuivres seuls', niveau: 3,
    desc: 'Seuls les jokers de jetons et multi et ceux des rangs montent sur scène. Six paliers.',
    partie: { paliers: 6, familles: seules('base', 'rangs') },
    depart: { jokers: ['duo'] },
  },
  {
    id: 'main_de_fer', nom: 'La Main de fer', niveau: 3,
    desc: 'Six cartes en main seulement, mais une main de plus par manche. Cinq paliers.',
    partie: { paliers: 5, tailleMain: 6, mains: 5 },
  },
  {
    id: 'sprint', nom: 'Le Sprint', niveau: 4,
    desc: 'Deux mains par manche, cinq défausses, et le Cannibale pour éclaircir le paquet. Six paliers.',
    partie: { paliers: 6, mains: 2, defausses: 5 },
    effets: { cible: -0.2 },
    depart: { jokers: ['cannibale'] },
  },
  {
    id: 'grand_huit', nom: 'Le Grand Huit', niveau: 5,
    desc: 'La courbe raide sur huit paliers. Tu pars avec l\'Astrologue, 10 louis et deux Astres.',
    partie: { paliers: 8, courbe: 'raide' },
    depart: { jokers: ['astrologue'], argent: 10, astres: 2 },
  },
  // Défis à contrainte (v5) : ouverts d'emblée, chacun débloque une carte de la troupe.
  {
    id: 'sans_coeurs', nom: 'Cœurs brisés', niveau: 2, contrainte: true, recompense: 'du_muse',
    desc: 'Plus un seul Cœur dans le paquet : 39 cartes, et les Couleurs se méritent. Cinq paliers.',
    partie: { paliers: 5 },
    retirer: 'C',
  },
  {
    id: 'trois_jokers', nom: 'Petite troupe', niveau: 2, contrainte: true, recompense: 'ec_canon',
    desc: 'Trois jokers au plus sur scène. Chaque place compte. Cinq paliers.',
    partie: { paliers: 5 },
    effets: { emplJokers: -2, cible: -0.1 },
  },
  {
    id: 'sans_defausse', nom: 'Sans repentir', niveau: 2, contrainte: true, recompense: 'mo_masque',
    desc: 'Aucune défausse, sauf celles que tes jokers t\'offrent, mais une main de plus par manche. Cinq paliers.',
    partie: { paliers: 5, defausses: 0, mains: 5 },
    effets: { defausses: -1 },
  },
];

export const EPREUVE = Object.fromEntries(EPREUVES.map((e) => [e.id, e]));

// Règles de partie d'une épreuve (toujours sur le jeu de départ classique, enjeu de bois).
export function reglesEpreuve(id) {
  const ep = EPREUVE[id];
  if (!ep) return null;
  return Object.assign({}, REGLES_DEFAUT, { jeu: 'carmin', enjeu: 0, familles: {} }, ep.partie || {});
}

// Ce que la partie garde de l'épreuve (sérialisable, sans fonctions).
export function etatEpreuve(id) {
  const ep = EPREUVE[id];
  if (!ep) return null;
  return { id: ep.id, nom: ep.nom, retirer: ep.retirer || null, effets: Object.assign({}, ep.effets), regles: Object.assign({}, ep.regles), depart: Object.assign({}, ep.depart) };
}

// Une épreuve s'ouvre quand la précédente (au niveau inférieur) a été réussie une fois.
export function epreuveOuverte(meta, id) {
  const ep = EPREUVE[id];
  if (!ep) return false;
  if (ep.niveau <= 2 || (meta && meta.options && meta.options.toutDebloque)) return true;
  return EPREUVES.some((o) => o.niveau === ep.niveau - 1 && meta.epreuves && meta.epreuves[o.id] && meta.epreuves[o.id].gagne);
}

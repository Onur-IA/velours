// Les synergies (v6) : des jokers précis réunis dans la rangée débloquent un effet réel.
// À la différence des combos (liens décoratifs, combos.js), une synergie change le jeu.
// Données pures ; le calcul (etatSynergie, synergiesActives) est dans outils.js, les effets
// sont lus par score.js (figures, rejoues), partie.js (crescendo, gains) et mod()/reglesActives().

import { REG, etatSynergie, jokersActifs } from './outils.js';

// membres : jokers nommés ; min : combien d'entre eux il faut (par défaut tous).
// plus + tag/fam : en plus, n autres jokers de cette étiquette ou famille.
export const SYNERGIES = [
  {
    id: 'couronnes', nom: 'Les Têtes couronnées', couleur: 'or',
    membres: ['sy_roi', 'sy_reine', 'sy_valet'],
    effet: 'Chaque figure marquée donne {x|×1,2 multi}.', court: 'FIGURES ×1,2',
  },
  {
    id: 'orchestre', nom: "L'Orchestre", couleur: 'rouge',
    membres: ['maestro', 'metronome', 'sy_contrebasse'],
    effet: 'Une main plus faible ne fait retomber le crescendo que d\'{v|une marche}, et chaque marche gravie donne {l|1 louis}.', court: 'CRESCENDO TENU',
  },
  {
    id: 'silence', nom: 'Le Vœu de silence', couleur: 'bleu',
    membres: ['sy_ermite', 'sy_moine'],
    effet: '{v|+1 main} à chaque manche.', court: '+1 MAIN',
    effets: { mains: 1 },
  },
  {
    id: 'casse', nom: 'Le Casse du siècle', couleur: 'vert',
    membres: ['sy_pickpocket', 'sy_faussaire'],
    effet: '{l|+4 louis} à chaque manche gagnée, et {v|+2} au plafond des intérêts.', court: '+4 LOUIS',
    effets: { interetMax: 2 },
  },
  {
    id: 'glaces', nom: 'La Galerie des glaces', couleur: 'cyan',
    membres: ['sy_reflet'], plus: 1, tag: 'rejoue', autres: 'un autre joker qui rejoue des cartes',
    effet: 'Chaque carte rejouée donne aussi {m|+4 multi}.', court: 'REJOUES +4 M',
  },
  {
    id: 'bouquet', nom: 'Le Bouquet', couleur: 'vert',
    membres: ['sy_fleuriste'], plus: 2, fam: 'pousses', autres: 'deux Pousses',
    effet: 'Les Pousses grandissent de {v|deux manches} à la fois.', court: 'POUSSES ×2',
  },
  {
    id: 'blason', nom: 'Le Blason', couleur: 'violet',
    membres: ['fossoyeur', 'entremetteuse', 'preteur', 'jardinier'], min: 3,
    effet: 'Piques et Trèfles, Cœurs et Carreaux comptent pour {v|la même enseigne}.', court: 'ENSEIGNES LIÉES',
    regles: { daltonien: true },
  },
];
export const SYNERGIE = {};
for (const s of SYNERGIES) SYNERGIE[s.id] = s;
REG.SYNERGIES.push(...SYNERGIES);

const nomJ = (id) => (REG.JOKER[id] ? REG.JOKER[id].nom : id);

// Composition lisible : « Le Roi, La Reine et Le Valet », « 3 parmi … », « Le Reflet et un autre joker qui rejoue ».
export function compositionSynergie(s) {
  const noms = s.membres.map(nomJ);
  const liste = noms.length > 1 ? noms.slice(0, -1).join(', ') + ' et ' + noms[noms.length - 1] : noms[0];
  let t = s.min && s.min < s.membres.length ? s.min + ' parmi ' + liste : liste;
  if (s.plus) t += ', avec ' + s.autres;
  return t;
}

// Toutes les synergies, avec leur avancement pour une rangée de jokers (interface, boutique, codex).
export function avancementSynergies(jokers) {
  return SYNERGIES.map((s) => Object.assign({ s }, etatSynergie(s, jokers || [])));
}

// Synergies complètes d'une rangée (sans tenir compte des jokers muselés) : pour l'affichage.
export function synergiesRangee(jokers) {
  return avancementSynergies(jokers).filter((a) => a.actif);
}

// Synergies auxquelles un joker participe (ou pourrait participer).
export function synergiesDuJoker(id) {
  const d = REG.JOKER[id];
  return SYNERGIES.filter((s) => s.membres.includes(id) || (s.plus && d && (s.fam ? d.fam === s.fam : (d.tags || []).includes(s.tag))));
}

// Ce qu'apporterait l'ajout d'un joker : complète une synergie ? la fait avancer ?
// Renvoie { complete: [s], avance: [s] } (pour la boutique et le Mentor).
export function apportSynergie(jokers, id) {
  const avant = avancementSynergies(jokers);
  if (jokers.some((j) => j.id === id)) return { complete: [], avance: [] };
  const apres = avancementSynergies(jokers.concat([{ id, uid: -1 }]));
  const complete = [];
  const avance = [];
  apres.forEach((a, i) => {
    const b = avant[i];
    if (a.actif && !b.actif) complete.push(a.s);
    else if (!a.actif && a.n > b.n) avance.push(a.s);
  });
  return { complete, avance };
}

export function synergiesDe(etat) {
  return avancementSynergies(jokersActifs(etat)).filter((a) => a.actif);
}

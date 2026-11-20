// Les combos : quand plusieurs jokers de la rangée travaillent ensemble, la troupe forme un numéro qui porte un nom.
// Purement lisible : rien ne change au score, mais les liens se voient, le nom s'affiche, la musique s'étoffe.
// Pur (sans DOM), testé dans tests/combos.test.js.

import { REG } from './outils.js';

// Chaque combo réunit au moins `min` jokers qui partagent une étiquette (tags) ou une famille.
// couleur : indice dans la palette d'affichage (table.js), instrument : la voix ajoutée à la musique (son.js).
export const COMBOS = [
  { id: 'couronnes', nom: 'Le Salon des figures', tag: 'tetes', min: 2, couleur: 'or', desc: 'Des jokers qui aiment les figures.' },
  { id: 'echo', nom: "L'Écho sans fin", tag: 'rejoue', min: 2, couleur: 'cyan', desc: 'Des cartes rejouées, encore et encore.' },
  { id: 'poigne', nom: 'La Poigne de fer', tag: 'main_tenue', min: 2, couleur: 'gris', desc: 'Ce que tu gardes en main compte double.' },
  { id: 'grande_rue', nom: 'La Grande rue', tag: 'suite', min: 2, couleur: 'bleu', desc: 'Tout pour les suites.' },
  { id: 'nuancier', nom: 'Le Nuancier', tag: 'couleur', min: 2, couleur: 'violet', desc: 'Tout pour les couleurs.' },
  { id: 'bande', nom: 'La Bande organisée', tags: ['paire', 'brelan'], min: 2, couleur: 'rouge', desc: 'Paires et brelans, la base du métier.' },
  { id: 'blason', nom: 'Les Armoiries', fam: 'enseignes', min: 2, couleur: 'encre', desc: 'Deux jokers qui misent sur les enseignes.' },
  { id: 'menu_peuple', nom: 'Le Menu peuple', tag: 'petites', min: 2, couleur: 'bois', desc: 'Les petites cartes prennent leur revanche.' },
  { id: 'tri_selectif', nom: 'Le Tri sélectif', tag: 'defausse', min: 2, couleur: 'vert', desc: 'Chaque défausse rapporte.' },
  { id: 'ordre', nom: "L'Ordre de bataille", tag: 'ordre', min: 2, couleur: 'cyan', desc: 'La place de chaque carte compte.' },
  { id: 'crescendo', nom: 'Le Grand crescendo', tag: 'crescendo', min: 2, couleur: 'rouge', desc: 'Chaque main doit battre la précédente.' },
  { id: 'claque', nom: 'La Claque', tag: 'public', min: 2, couleur: 'or', desc: 'La salle est avec toi.' },
  { id: 'chasseurs', nom: 'Les Chasseurs de patrons', tag: 'patron', min: 2, couleur: 'violet', desc: 'Les patrons n\'ont qu\'à bien se tenir.' },
  { id: 'atelier', nom: "L'Atelier", tags: ['lestee', 'cristal', 'enclume', 'doree', 'cameleon', 'edition', 'sceau'], min: 2, couleur: 'gris', desc: 'Matières, éditions et sceaux.' },
  { id: 'coffre', nom: 'Le Coffre-fort', tag: 'argent', min: 3, couleur: 'or', desc: 'Trois jokers qui font rentrer les louis.' },
  { id: 'jardin', nom: 'Le Jardin', fam: 'croissance', min: 2, couleur: 'vert', desc: 'Deux jokers qui grandissent au fil de la partie.' },
  { id: 'casse_cou', nom: 'Les Casse-cou', fam: 'risque', min: 2, couleur: 'rouge', desc: 'Conditions et sacrifices : ça passe ou ça casse.' },
  { id: 'gros_bras', nom: 'Les Gros bras', fam: 'base', min: 3, couleur: 'bleu', desc: 'Trois jokers de jetons et de multi purs.' },
];
export const COMBO = {};
for (const c of COMBOS) COMBO[c.id] = c;

function membre(c, d) {
  if (!d) return false;
  if (c.fam) return d.fam === c.fam;
  const tags = d.tags || [];
  if (c.tags) return c.tags.some((t) => tags.includes(t));
  return tags.includes(c.tag);
}

// Les combos formés par une rangée de jokers : [{ id, nom, couleur, desc, uids, idx }], du plus fourni au moins fourni.
export function combosActifs(jokers) {
  const out = [];
  for (const c of COMBOS) {
    const idx = [];
    jokers.forEach((j, i) => {
      if (membre(c, REG.JOKER[j.id])) idx.push(i);
    });
    if (idx.length >= c.min) out.push({ id: c.id, nom: c.nom, couleur: c.couleur, desc: c.desc, idx, uids: idx.map((i) => jokers[i].uid), n: idx.length });
  }
  // Un même joker peut appartenir à plusieurs combos ; on garde l'ordre : plus de membres d'abord.
  return out.sort((a, b) => b.n - a.n || COMBOS.findIndex((c) => c.id === a.id) - COMBOS.findIndex((c) => c.id === b.id));
}

// Le nom affiché : « La Bande organisée », ou « La Bande organisée ×3 » à partir de trois membres.
export function nomCombo(c) {
  return c.n >= 3 ? c.nom + ' ×' + c.n : c.nom;
}

// Combos déclenchés pendant une main : au moins deux membres ont agi (événements portant leur uid).
export function combosDeclenches(jokers, evts) {
  const actifs = new Set((evts || []).filter((e) => e.uid != null).map((e) => e.uid));
  return combosActifs(jokers).filter((c) => c.uids.filter((u) => actifs.has(u)).length >= 2);
}

// Nouveaux combos apparus entre deux rangées (après un achat, par exemple).
export function nouveauxCombos(avant, apres) {
  const vus = new Set(combosActifs(avant).map((c) => c.id));
  return combosActifs(apres).filter((c) => !vus.has(c.id));
}

// Familles présentes dans la rangée, pour la musique : { famille: nombre de jokers }.
export function famillesRangee(jokers) {
  const f = {};
  for (const j of jokers) {
    const d = REG.JOKER[j.id];
    if (d) f[d.fam] = (f[d.fam] || 0) + 1;
  }
  return f;
}

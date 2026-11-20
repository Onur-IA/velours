// Consommables (Arcanes, Astres, Ombres), privilèges, tickets et paquets.

import {
  REG, creerConso, placeJoker, ajouterJoker, tirerJoker, detruireCartes, creerCarte, ajouterCarte,
  valeurVenteJoker, monterMain, mainLaPlusJouee, retirerJoker, mod, note, chanceBrute,
} from './outils.js';
import { MAINS, MAIN, ENSEIGNES, NOM_ENSEIGNES, LISTE_AMELIORATIONS } from './donnees.js';
import { choisir, entier } from './rng.js';
import { ajouterPublic } from './public.js';

export const CONSOS = [];
export const CONSO = REG.CONSO;

function C(id, cat, nom, desc, extra) {
  const d = Object.assign({ id, cat, nom, desc, prix: cat === 'ombre' ? 4 : 3, min: 0, max: 0 }, extra || {});
  CONSOS.push(d);
  CONSO[id] = d;
}

const amel = (a) => (etat, sel) => {
  sel.forEach((c) => (c.amel = a));
};
const enseigne = (e) => (etat, sel) => {
  sel.forEach((c) => (c.ens = e));
};

// ---------------------------------------------------------------- Arcanes

C('contrepoids', 'arcane', 'Le Contrepoids', 'Jusqu\'à 2 cartes choisies deviennent {c|Lestées}.', { min: 1, max: 2, utiliser: amel('lestee'), icone: 'poids' });
C('braise', 'arcane', 'La Braise', 'Jusqu\'à 2 cartes choisies deviennent {c|Ardentes}.', { min: 1, max: 2, utiliser: amel('ardente'), icone: 'flamme' });
C('masque', 'arcane', 'Le Masque', '1 carte choisie devient {c|Caméléon}.', { min: 1, max: 1, utiliser: amel('cameleon'), icone: 'masque' });
C('verrier', 'arcane', 'Le Verrier', '1 carte choisie devient {c|Cristal}.', { min: 1, max: 1, utiliser: amel('cristal'), icone: 'cristal' });
C('forge', 'arcane', 'La Forge', '1 carte choisie devient {c|Enclume}.', { min: 1, max: 1, utiliser: amel('enclume'), icone: 'enclume' });
C('feuille_or', 'arcane', "La Feuille d'or", '1 carte choisie devient {c|Dorée}.', { min: 1, max: 1, utiliser: amel('doree'), icone: 'feuille' });
C('fer_cheval', 'arcane', 'Le Fer à cheval', 'Jusqu\'à 2 cartes choisies deviennent {c|Veinardes}.', { min: 1, max: 2, utiliser: amel('veinarde'), icone: 'trefle4' });
C('encre', 'arcane', "L'Encre", 'Jusqu\'à 3 cartes choisies deviennent des {c|Piques}.', { min: 1, max: 3, utiliser: enseigne('P'), icone: 'P' });
C('fard', 'arcane', 'Le Fard', 'Jusqu\'à 3 cartes choisies deviennent des {c|Cœurs}.', { min: 1, max: 3, utiliser: enseigne('C'), icone: 'C' });
C('safran', 'arcane', 'Le Safran', 'Jusqu\'à 3 cartes choisies deviennent des {c|Carreaux}.', { min: 1, max: 3, utiliser: enseigne('K'), icone: 'K' });
C('mousse', 'arcane', 'La Mousse', 'Jusqu\'à 3 cartes choisies deviennent des {c|Trèfles}.', { min: 1, max: 3, utiliser: enseigne('T'), icone: 'T' });
C('marchepied', 'arcane', 'Le Marchepied', 'Jusqu\'à 2 cartes choisies montent d\'un rang. Le Roi devient As, l\'As devient 2.', {
  min: 1, max: 2, icone: 'fleche',
  utiliser: (etat, sel) => sel.forEach((c) => (c.rang = c.rang === 14 ? 2 : c.rang + 1)),
});
C('miroir', 'arcane', 'Le Miroir', 'Choisis 2 cartes : celle de gauche devient une copie de celle de droite.', {
  min: 2, max: 2, icone: 'miroir',
  utiliser: (etat, sel) => {
    const [a, b] = sel;
    Object.assign(a, { rang: b.rang, ens: b.ens, amel: b.amel, edition: b.edition, sceau: b.sceau, bonus: b.bonus });
  },
});
C('couperet', 'arcane', 'Le Couperet', 'Détruit jusqu\'à 2 cartes choisies.', {
  min: 1, max: 2, icone: 'ciseaux',
  utiliser: (etat, sel) => {
    detruireCartes(etat, sel.map((c) => c.id), 'couperet');
  },
});
C('tirelire', 'arcane', 'La Tirelire', 'Double tes louis ({l|20 louis} gagnés au plus).', {
  icone: 'piece',
  utiliser: (etat) => {
    etat.argent += Math.max(0, Math.min(20, etat.argent));
  },
});
C('brocante', 'arcane', 'La Brocante', 'Gagne la valeur de revente de tous tes jokers ({l|30 louis} au plus).', {
  icone: 'sac',
  utiliser: (etat) => {
    etat.argent += Math.min(30, etat.jokers.reduce((s, j) => s + valeurVenteJoker(etat, j), 0));
  },
});
C('oracle', 'arcane', "L'Oracle", 'Crée jusqu\'à 2 Astres au hasard (s\'il y a de la place).', {
  icone: 'etoile',
  utiliser: (etat) => {
    creerConso(etat, 'astre');
    creerConso(etat, 'astre');
  },
});
C('rabatteur', 'arcane', 'Le Rabatteur', 'Crée un joker au hasard (il faut une place libre).', {
  icone: 'grelot',
  peut: (etat) => placeJoker(etat),
  utiliser: (etat) => {
    const d = tirerJoker(etat, 'conso');
    const j = ajouterJoker(etat, d.id);
    note(etat, { t: 'joker', uid: j.uid, txt: 'Bienvenue' });
  },
});
C('redite', 'arcane', 'La Redite', 'Crée une copie du dernier Arcane ou Astre utilisé.', {
  icone: 'boucle',
  peut: (etat) => !!etat.dernierConso && etat.dernierConso !== 'redite',
  utiliser: (etat) => {
    creerConso(etat, null, { id: etat.dernierConso, force: true });
  },
});
C('vernis', 'arcane', 'Le Vernis', '{v|1 chance sur 3} d\'ajouter Brillant, Irisé ou Prisme à un joker sans édition, au hasard.', {
  icone: 'pinceau',
  peut: (etat) => etat.jokers.some((j) => !j.edition),
  utiliser: (etat) => {
    if (!chanceBrute(etat, 1, 3)) return { texte: 'Raté' };
    const j = choisir(etat, 'conso', etat.jokers.filter((k) => !k.edition));
    j.edition = choisir(etat, 'conso', ['brillant', 'brillant', 'irise', 'irise', 'prisme']);
    note(etat, { t: 'joker', uid: j.uid, txt: 'Verni' });
    return { texte: 'Réussi' };
  },
});
// v7 : deux Arcanes de paquet, plus doux que leurs cousines des Ombres.
C('calque', 'arcane', 'Le Calque', 'Ajoute à ton paquet {v|une copie} de la carte choisie (amélioration, édition et sceau compris).', {
  min: 1, max: 1, icone: 'miroir',
  utiliser: (etat, sel) => {
    const c = sel[0];
    ajouterCarte(etat, creerCarte(etat, c.rang, c.ens, { amel: c.amel, edition: c.edition, sceau: c.sceau, bonus: c.bonus, niv: c.niv }), etat.phase === 'manche' ? 'main' : null);
  },
});
C('laque', 'arcane', 'La Laque', 'Jusqu\'à 2 cartes choisies sans édition deviennent {c|Brillantes} ({j|+40 jetons}).', {
  min: 1, max: 2, icone: 'pinceau',
  peut: (etat, sel) => !sel || sel.every((c) => !c.edition),
  utiliser: (etat, sel) => {
    sel.forEach((c) => {
      if (!c.edition) c.edition = 'brillant';
    });
  },
});

// ----------------------------------------------------------------- Astres

const NOMS_ASTRES = {
  lueur: 'Lueur', jumelles: 'Jumelles', balance: 'Balance', trident: 'Trident', echelle: 'Échelle', maree: 'Marée',
  citadelle: 'Citadelle', carrousel: 'Carrousel', comete: 'Comète', couronne: 'Couronne', essaim: 'Essaim', eclipse: 'Éclipse', nova: 'Nova',
};
for (const m of MAINS) {
  C(m.astre, 'astre', NOMS_ASTRES[m.astre], 'Monte d\'un niveau : {c|' + m.nom + '}. {j|+' + m.pasJ + ' jetons} et {m|+' + m.pasM + ' multi}.', {
    main: m.id,
    cachee: !!m.cachee,
    icone: 'etoile',
    utiliser: (etat) => {
      monterMain(etat, m.id, 1);
      etat.stats.astres = (etat.stats.astres || 0) + 1;
      return { niveau: m.id };
    },
  });
}

// ----------------------------------------------------------------- Ombres

C('pacte', 'ombre', 'Le Pacte', 'Un joker sans édition, au hasard, devient {c|Inverté}. Tu perds {c|1 carte} en main pour toute la partie.', {
  icone: 'oeil',
  peut: (etat) => etat.jokers.some((j) => !j.edition),
  utiliser: (etat) => {
    const j = choisir(etat, 'conso', etat.jokers.filter((k) => !k.edition));
    j.edition = 'inverte';
    etat.bonus.tailleMain = (etat.bonus.tailleMain || 0) - 1;
    note(etat, { t: 'joker', uid: j.uid, txt: 'Inverté' });
  },
});
C('appel', 'ombre', "L'Appel", 'Crée un joker {c|Légendaire} (il faut une place libre).', {
  icone: 'couronne', rare: true,
  peut: (etat) => placeJoker(etat),
  utiliser: (etat) => {
    const d = tirerJoker(etat, 'conso', { rarete: 'L' });
    const j = ajouterJoker(etat, d.id);
    note(etat, { t: 'joker', uid: j.uid, txt: 'Légende' });
  },
});
C('reflet', 'ombre', 'Le Reflet', 'Crée 2 copies de la carte choisie dans ta main.', {
  min: 1, max: 1, icone: 'miroir',
  utiliser: (etat, sel) => {
    const c = sel[0];
    for (let i = 0; i < 2; i++) {
      ajouterCarte(etat, creerCarte(etat, c.rang, c.ens, { amel: c.amel, edition: c.edition, sceau: c.sceau, bonus: c.bonus }), 'main');
    }
  },
});
for (const [s, nom, art] of [['carmin', 'Le Cachet carmin', 'carmin'], ['azur', 'Le Cachet azur', 'azur'], ['ambre', 'Le Cachet ambre', 'ambre'], ['lilas', 'Le Cachet lilas', 'lilas']]) {
  C('cachet_' + s, 'ombre', nom, 'Pose un {c|Sceau ' + art + '} sur 1 carte choisie.', {
    min: 1, max: 1, icone: 'sceau', teinte: s,
    utiliser: (etat, sel) => {
      sel[0].sceau = s;
    },
  });
}
C('mue', 'ombre', 'La Mue', 'Détruit 1 carte de ta main au hasard, puis y ajoute 3 têtes améliorées.', {
  icone: 'couronne',
  peut: (etat) => etat.main.length > 0,
  utiliser: (etat) => {
    detruireCartes(etat, [choisir(etat, 'conso', etat.main)], 'mue');
    for (let i = 0; i < 3; i++) {
      const c = creerCarte(etat, 11 + entier(etat, 'conso', 3), choisir(etat, 'conso', ENSEIGNES), { amel: choisir(etat, 'conso', LISTE_AMELIORATIONS) });
      ajouterCarte(etat, c, 'main');
    }
  },
});
C('abime', 'ombre', "L'Abîme", 'Toutes tes mains montent d\'un niveau.', {
  icone: 'etoile', rare: true,
  utiliser: (etat) => {
    for (const m of MAINS) monterMain(etat, m.id, 1);
    return { niveau: 'toutes' };
  },
});
C('sacrifice', 'ombre', 'Le Sacrifice', 'Détruit un de tes jokers au hasard. Gagne {l|25 louis}.', {
  icone: 'crane',
  peut: (etat) => etat.jokers.length > 0,
  utiliser: (etat) => {
    const j = choisir(etat, 'conso', etat.jokers);
    retirerJoker(etat, j.uid);
    etat.argent += 25;
  },
});
C('uniforme', 'ombre', "L'Uniforme", 'Toutes les cartes de ta main prennent la même enseigne, au hasard.', {
  icone: 'masque',
  peut: (etat) => etat.main.length > 0,
  utiliser: (etat) => {
    const e = choisir(etat, 'conso', ENSEIGNES);
    for (const id of etat.main) {
      const c = etat.paquet.find((k) => k.id === id);
      if (c) c.ens = e;
    }
    return { texte: NOM_ENSEIGNES[e] };
  },
});
C('enluminure', 'ombre', "L'Enluminure", 'Ajoute Brillant, Irisé ou Prisme à 1 carte choisie.', {
  min: 1, max: 1, icone: 'pinceau',
  utiliser: (etat, sel) => {
    sel[0].edition = choisir(etat, 'conso', ['brillant', 'irise', 'prisme']);
  },
});
C('jumeau', 'ombre', 'Le Jumeau', 'Copie un de tes jokers au hasard (il faut une place libre). Tes louis tombent à 0.', {
  icone: 'masque',
  peut: (etat) => etat.jokers.length > 0 && placeJoker(etat),
  utiliser: (etat) => {
    const src = choisir(etat, 'conso', etat.jokers);
    const j = ajouterJoker(etat, src.id, src.edition === 'inverte' ? null : src.edition);
    j.etat = JSON.parse(JSON.stringify(src.etat));
    etat.argent = Math.min(etat.argent, 0);
    note(etat, { t: 'joker', uid: j.uid, txt: 'Jumeau' });
  },
});

export const ARCANES = CONSOS.filter((c) => c.cat === 'arcane');
export const ASTRES = CONSOS.filter((c) => c.cat === 'astre');
export const OMBRES = CONSOS.filter((c) => c.cat === 'ombre');
export const NOM_CAT = { arcane: 'Arcane', astre: 'Astre', ombre: 'Ombre' };

// ------------------------------------------------------------- Privilèges

export const PRIVILEGES = [
  { id: 'main_velours', nom: 'Main de velours', desc: '{c|+1 main} par manche.', effets: { mains: 1 } },
  { id: 'corbeille', nom: 'Corbeille', desc: '{c|+1 défausse} par manche.', effets: { defausses: 1 } },
  { id: 'rente', nom: 'Rente', desc: 'Tes intérêts peuvent monter jusqu\'à {l|5 louis de plus} par manche.', effets: { interetMax: 5 } },
  { id: 'vitrine', nom: 'Vitrine', desc: '{c|+1 article} dans chaque boutique.', effets: { emplBoutique: 1 } },
  { id: 'ristourne', nom: 'Ristourne', desc: 'Tout coûte {c|25 % moins cher} en boutique.', effets: { remise: 0.25 } },
  { id: 'marchandage', nom: 'Marchandage', desc: 'Les relances coûtent {l|2 louis} de moins.', effets: { relanceMoins: 2 } },
  { id: 'grande_manche', nom: 'Grande manche', desc: '{c|+1 carte} en main.', effets: { tailleMain: 1 } },
  { id: 'ecrin', nom: 'Écrin', desc: '{c|+1 emplacement} de consommable.', effets: { emplConsos: 1 } },
  { id: 'estrade', nom: 'Estrade', desc: '{c|+1 emplacement} de joker.', effets: { emplJokers: 1 }, prix: 16, palierMin: 3 },
  { id: 'telescope', nom: 'Télescope', desc: 'Les paquets d\'Astres contiennent toujours l\'astre de ta main la plus jouée.', effets: { telescope: 1 } },
  { id: 'vernissage', nom: 'Vernissage', desc: 'Les éditions apparaissent {c|2 fois plus souvent}.', effets: { editionsX: 1 } },
  { id: 'coup_pouce', nom: 'Coup de pouce', desc: 'Toutes les mises demandent {c|10 % de jetons en moins}.', effets: { cible: -0.1 } },
  { id: 'carnet', nom: "Carnet d'adresses", desc: 'Les jokers rares se montrent {c|2 fois plus souvent}.', effets: { raresX: 1 } },
  // Privilèges de la salle (absents quand la règle du public est coupée).
  { id: 'strapontins', nom: 'Strapontins', desc: 'Tu peux garder {c|1 rappel de plus} en réserve.', effets: { reserveRappels: 1 }, besoinPublic: true, palierMin: 2 },
  { id: 'abonnes', nom: 'Abonnés', desc: 'Le public gagne {c|1 cran} à chaque manche gagnée.', effets: { publicManche: 1 }, besoinPublic: true },
];
export const PRIVILEGE = REG.PRIVILEGE;
for (const p of PRIVILEGES) {
  if (!p.prix) p.prix = 10;
  PRIVILEGE[p.id] = p;
}

// ---------------------------------------------------------------- Tickets
// Récompenses offertes quand tu passes une petite ou une grande mise.

export const TICKETS = [
  { id: 't_fortune', nom: 'Ticket Fortune', desc: 'Gagne tout de suite {l|4 louis}, plus {l|2 louis} par palier atteint.', immediat: (etat) => { etat.argent += 4 + 2 * etat.palier; } },
  { id: 't_epargne', nom: 'Ticket Épargne', desc: 'Double tes louis ({l|15 louis} gagnés au plus).', immediat: (etat) => { etat.argent += Math.max(0, Math.min(15, etat.argent)); } },
  { id: 't_etoile', nom: 'Ticket Étoile', desc: 'Ta main la plus jouée monte de 2 niveaux.', immediat: (etat) => { monterMain(etat, mainLaPlusJouee(etat) || 'carte_haute', 2); } },
  { id: 't_rare', nom: 'Ticket Rare', desc: 'La prochaine boutique offre un joker rare gratuit.', boutique: true, palierMin: 2 },
  { id: 't_peu_commun', nom: 'Ticket Choisi', desc: 'La prochaine boutique offre un joker peu commun gratuit.', boutique: true },
  { id: 't_relance', nom: 'Ticket Relance', desc: 'Les relances de la prochaine boutique sont gratuites.', boutique: true },
  { id: 't_eclat', nom: 'Ticket Éclat', desc: 'Dans la prochaine boutique, un joker gagne une édition et devient gratuit.', boutique: true },
  { id: 't_inverte', nom: 'Ticket Inverté', desc: 'La prochaine boutique propose un joker Inverté.', boutique: true, palierMin: 2 },
  { id: 't_arcane', nom: 'Ticket Arcane', desc: 'Ouvre tout de suite un grand paquet d\'Arcanes.', paquet: ['arcanes', 'grand'] },
  { id: 't_astre', nom: 'Ticket Astral', desc: 'Ouvre tout de suite un grand paquet d\'Astres.', paquet: ['astres', 'grand'] },
  { id: 't_bouffon', nom: 'Ticket Troupe', desc: 'Ouvre tout de suite un paquet de Jokers.', paquet: ['jokers', 'petit'] },
  { id: 't_bravo', nom: 'Ticket Bravo', desc: 'Le public gagne tout de suite {c|4 crans}.', besoinPublic: true, immediat: (etat) => { ajouterPublic(etat, 4); } },
  { id: 't_ombre', nom: 'Ticket Ombre', desc: 'Ouvre tout de suite un paquet d\'Ombres.', paquet: ['ombres', 'petit'], palierMin: 2 },
];
export const TICKET = Object.fromEntries(TICKETS.map((t) => [t.id, t]));

// ---------------------------------------------------------------- Paquets

export const TYPES_PAQUET = {
  cartes: { nom: 'Paquet de cartes', poids: 4, desc: 'Des cartes à jouer à ajouter à ton paquet.' },
  arcanes: { nom: "Paquet d'Arcanes", poids: 4, desc: 'Des Arcanes à utiliser tout de suite.' },
  astres: { nom: "Paquet d'Astres", poids: 4, desc: 'Des Astres pour monter tes mains de niveau.' },
  jokers: { nom: 'Paquet de Jokers', poids: 1.2, desc: 'Des jokers à engager.' },
  ombres: { nom: "Paquet d'Ombres", poids: 0.6, desc: 'Des Ombres, puissantes et risquées.' },
};
export const TAILLES_PAQUET = {
  petit: { nom: 'Petit', prix: 4, montre: 3, prend: 1 },
  grand: { nom: 'Grand', prix: 6, montre: 5, prend: 1 },
  immense: { nom: 'Immense', prix: 8, montre: 5, prend: 2 },
};
export function contenuPaquet(type, taille) {
  const t = TAILLES_PAQUET[taille];
  const reduit = type === 'jokers' || type === 'ombres';
  return { montre: reduit ? t.montre - 1 : t.montre, prend: t.prend };
}
export function nomPaquet(type, taille) {
  const t = TAILLES_PAQUET[taille];
  const base = TYPES_PAQUET[type].nom;
  return taille === 'petit' ? base : base.replace('Paquet', t.nom + ' paquet');
}
export { MAIN };

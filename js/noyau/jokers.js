// La troupe : tous les jokers de Velours.
// Crochets de score (copiables) : carte, enMain, rejoue, rejoueEnMain, main, gain.
// Crochets d'état (jamais copiés) : avant, apres, total, debutManche, finManche,
// defausse, vente, paquet, carteDetruite, finBoutique, patronVaincu, sauvetage, passe.

import { REG, emplJokers, jokersComptes, creerConso, note, synergieActive } from './outils.js';
import './synergies.js';
import { MAIN, fmtM, LISTE_SCEAUX, jetonsDeRang } from './donnees.js';
import { entier, choisir } from './rng.js';
import { PUBLIC, publicActif, etatPublic, ajouterPublic } from './public.js';

export const JOKERS = [];
export const JOKER = REG.JOKER;

export const RARETES = {
  C: { nom: 'Commun', poids: 68 },
  U: { nom: 'Peu commun', poids: 26 },
  R: { nom: 'Rare', poids: 6 },
  E: { nom: 'Épique', poids: 1.6 },
  L: { nom: 'Légendaire', poids: 0.35 },
};

export const FAMILLES = {
  echos: 'Échos',
  pousses: 'Pousses',
  maudits: 'Maudits',
  duos: 'Duos secrets',
  base: 'Jetons et multi',
  enseignes: 'Enseignes',
  rangs: 'Rangs et têtes',
  rejoue: 'Cartes rejouées',
  copie: 'Copies',
  croissance: 'Jokers qui grandissent',
  economie: 'Économie',
  regles: 'Règles et tailles',
  matieres: 'Matières, éditions, sceaux',
  hasard: 'Hasard',
  risque: 'Conditions et sacrifices',
  patron: 'Contre les patrons',
  public: 'Avec le public',
  crescendo: 'Le crescendo',
};

function J(id, nom, r, prix, fam, desc, extra) {
  const d = Object.assign({ id, nom, r, prix, fam, desc, tags: [] }, extra || {});
  JOKERS.push(d);
  JOKER[id] = d;
}

const petit = (c) => c.rang >= 2 && c.rang <= 5;
const x = (v) => '×' + fmtM(v);
const actuel = (s) => ' {g|(Actuel : ' + s + ')}';

// ---------------------------------------------------------------- Communs

J('figurant', 'Le Figurant', 'C', 3, 'base', '{m|+5 multi}.', {
  main: () => ({ multi: 5 }),
});
J('videur', 'Le Videur', 'C', 4, 'base', '{j|+45 jetons}.', {
  main: () => ({ jetons: 45 }),
});
J('duo', 'Le Duo', 'C', 4, 'base', '{m|+8 multi} si ta main contient une Paire.', {
  tags: ['paire'],
  main: (c) => (c.contient.paire ? { multi: 8 } : null),
});
J('trio', 'Le Trio', 'C', 4, 'base', '{m|+14 multi} si ta main contient un Brelan.', {
  tags: ['brelan'],
  main: (c) => (c.contient.brelan ? { multi: 14 } : null),
});
J('escaladeuse', "L'Escaladeuse", 'C', 4, 'base', '{m|+14 multi} si ta main contient une Suite.', {
  tags: ['suite'],
  main: (c) => (c.contient.suite ? { multi: 14 } : null),
});
J('teinturier', 'Le Teinturier', 'C', 4, 'base', '{m|+12 multi} si ta main contient une Couleur.', {
  tags: ['couleur'],
  main: (c) => (c.contient.couleur ? { multi: 12 } : null),
});
J('siamois', 'Les Siamois', 'C', 4, 'base', '{j|+80 jetons} si ta main contient une Double paire.', {
  tags: ['paire'],
  main: (c) => (c.contient.double_paire ? { jetons: 80 } : null),
});
J('geometre', 'Le Géomètre', 'C', 4, 'base', '{j|+110 jetons} si ta main contient une Suite.', {
  tags: ['suite'],
  main: (c) => (c.contient.suite ? { jetons: 110 } : null),
});
J('tisserand', 'Le Tisserand', 'C', 4, 'base', '{j|+90 jetons} si ta main contient une Couleur.', {
  tags: ['couleur'],
  main: (c) => (c.contient.couleur ? { jetons: 90 } : null),
});
J('fossoyeur', 'Le Fossoyeur', 'C', 5, 'enseignes', 'Chaque Pique marqué donne {j|+25 jetons}.', {
  tags: ['pique', 'carte'],
  cible: (c, h) => h.ens(c, 'P'),
  carte: (ctx, c) => (ctx.ens(c, 'P') ? { jetons: 25 } : null),
});
J('entremetteuse', "L'Entremetteuse", 'C', 5, 'enseignes', 'Chaque Cœur marqué donne {m|+4 multi}.', {
  tags: ['coeur', 'carte'],
  cible: (c, h) => h.ens(c, 'C'),
  carte: (ctx, c) => (ctx.ens(c, 'C') ? { multi: 4 } : null),
});
J('preteur', 'Le Prêteur sur gages', 'C', 5, 'enseignes', 'Chaque Carreau marqué a {v|1 chance sur 2} de rapporter {l|1 louis}.', {
  tags: ['carreau', 'carte', 'argent', 'chance'],
  cible: (c, h) => h.ens(c, 'K'),
  carte: (ctx, c) => (ctx.ens(c, 'K') && ctx.chance(1, 2) ? { argent: 1 } : null),
});
J('jardinier', 'Le Jardinier', 'C', 5, 'enseignes', 'Chaque Trèfle marqué donne {j|+12 jetons} et {m|+2 multi}.', {
  tags: ['trefle', 'carte'],
  cible: (c, h) => h.ens(c, 'T'),
  carte: (ctx, c) => (ctx.ens(c, 'T') ? { jetons: 12, multi: 2 } : null),
});
J('cour', 'La Petite cour', 'C', 4, 'rangs', 'Chaque tête marquée donne {j|+25 jetons}.', {
  tags: ['tetes', 'carte'],
  cible: (c, h) => h.tete(c),
  carte: (ctx, c) => (ctx.tete(c) ? { jetons: 25 } : null),
});
J('personnel', 'Le Petit personnel', 'C', 4, 'rangs', 'Chaque 2, 3, 4 ou 5 marqué donne {j|+30 jetons}.', {
  tags: ['petites', 'carte'],
  cible: petit,
  carte: (ctx, c) => (petit(c) ? { jetons: 30 } : null),
});
J('mathematicien', 'La Mathématicienne', 'C', 5, 'rangs', 'Chaque rang premier marqué (2, 3, 5, 7) donne {m|+6 multi}.', {
  tags: ['petites', 'carte'],
  cible: (c) => [2, 3, 5, 7].includes(c.rang),
  carte: (ctx, c) => ([2, 3, 5, 7].includes(c.rang) ? { multi: 6 } : null),
});
J('croupier', 'Le Croupier', 'C', 5, 'rangs', 'Cartes marquées toutes paires : {j|+100 jetons}. Toutes impaires (As compris) : {m|+12 multi}. Une tête annule tout.', {
  tags: ['carte'],
  cible: (c) => c.rang <= 10 || c.rang === 14,
  main: (ctx) => {
    const ms = ctx.marquantes;
    if (!ms.length || ms.some((c) => c.rang >= 11 && c.rang <= 13)) return null;
    if (ms.every((c) => c.rang % 2 === 0 && c.rang !== 14)) return { jetons: 100 };
    if (ms.every((c) => c.rang % 2 === 1 || c.rang === 14)) return { multi: 12 };
    return null;
  },
});
J('as_manche', "L'As dans la manche", 'C', 4, 'rangs', 'Chaque As marqué donne {j|+20 jetons} et {m|+4 multi}.', {
  tags: ['as', 'carte'],
  cible: (c) => c.rang === 14,
  carte: (ctx, c) => (c.rang === 14 ? { jetons: 20, multi: 4 } : null),
});
J('souffleur', 'Le Souffleur', 'C', 5, 'rejoue', 'Rejoue chaque 2, 3, 4 ou 5 marqué.', {
  tags: ['petites', 'rejoue', 'carte'],
  cible: petit,
  rejoue: (ctx, c) => (petit(c) ? 1 : 0),
});
J('chiffonnier', 'Le Chiffonnier', 'C', 4, 'croissance', (j) => 'Gagne {j|+3 jetons} par carte défaussée.' + actuel('+' + (j.etat.jetons || 0) + ' jetons'), {
  tags: ['defausse'],
  defausse: (etat, j, cartes) => {
    j.etat.jetons = (j.etat.jetons || 0) + 3 * cartes.length;
    return { texte: '+' + 3 * cartes.length };
  },
  main: (ctx, j) => (j.etat.jetons ? { jetons: j.etat.jetons } : null),
});
J('suite_idees', 'La Suite dans les idées', 'C', 5, 'croissance', (j) => 'Gagne {j|+15 jetons} à chaque Suite jouée.' + actuel('+' + (j.etat.jetons || 0) + ' jetons'), {
  tags: ['suite'],
  avant: (ctx, j) => {
    if (!ctx.contient.suite) return null;
    j.etat.jetons = (j.etat.jetons || 0) + 15;
    return { texte: 'Grandit' };
  },
  main: (ctx, j) => (j.etat.jetons ? { jetons: j.etat.jetons } : null),
});
J('rentier', 'Le Rentier', 'C', 5, 'economie', 'Rapporte {l|4 louis} à la fin de chaque manche.', {
  tags: ['argent'],
  gain: () => 4,
});
J('grippe_sou', 'Le Grippe-sou', 'C', 4, 'economie', 'Rapporte {l|2 louis} par défausse non utilisée à la fin de la manche.', {
  tags: ['argent', 'defausse'],
  gain: (etat) => 2 * (etat.manche ? etat.manche.defausses : 0),
});
J('brocanteur', 'Le Brocanteur', 'C', 4, 'economie', 'Une relance gratuite à chaque boutique.', {
  tags: ['argent'],
  passif: { relancesGratuites: 1 },
});
J('bourse', 'La Bourse pleine', 'C', 5, 'economie', (j, etat) => '{j|+2 jetons} par louis que tu possèdes.' + (etat ? actuel('+' + 2 * Math.max(0, etat.argent) + ' jetons') : ''), {
  tags: ['argent'],
  main: (ctx) => (ctx.etat.argent > 0 ? { jetons: 2 * ctx.etat.argent } : null),
});
J('bas_laine', 'Le Bas de laine', 'C', 3, 'economie', 'Sa valeur de revente grimpe de {l|3 louis} à chaque manche.', {
  tags: ['argent'],
  finManche: (etat, j) => {
    j.bonusVente = (j.bonusVente || 0) + 3;
    return { texte: 'Valeur +3' };
  },
});
J('dime', 'La Dîme', 'C', 5, 'economie', 'À la première main de la manche, chaque carte marquée rapporte {l|1 louis}.', {
  tags: ['argent', 'carte'],
  carte: (ctx) => (ctx.premiereMain ? { argent: 1 } : null),
});
J('ouverture', 'Le Lever de rideau', 'C', 4, 'risque', '{m|+25 multi} à la première main de la manche.', {
  main: (ctx) => (ctx.premiereMain ? { multi: 25 } : null),
});
J('minimaliste', 'Le Minimaliste', 'C', 4, 'risque', '{m|+16 multi} si tu joues 3 cartes ou moins.', {
  tags: ['main_tenue'],
  main: (ctx) => (ctx.jouees.length <= 3 ? { multi: 16 } : null),
});
J('archiviste', "L'Archiviste", 'C', 4, 'base', (j, etat) => '{j|+4 jetons} par carte dans ta défausse.' + (etat && etat.manche ? actuel('+' + 4 * etat.defausse.length + ' jetons') : ''), {
  tags: ['defausse'],
  main: (ctx) => (ctx.etat.defausse.length ? { jetons: 4 * ctx.etat.defausse.length } : null),
});
J('fauche', 'Le Fauché', 'C', 4, 'economie', '{m|+20 multi} si tu as 4 louis ou moins.', {
  tags: ['argent'],
  main: (ctx) => (ctx.etat.argent <= 4 ? { multi: 20 } : null),
});
J('girouette', 'La Girouette', 'C', 4, 'hasard', 'Donne entre {m|+1 et +19 multi}, au hasard à chaque main.', {
  tags: ['chance'],
  main: (ctx) => {
    if (ctx.apercu) {
      ctx.incertain();
      return { multi: 1 };
    }
    return { multi: 1 + entier(ctx.etat, 'chance', 19) };
  },
});
J('bonimenteur', 'Le Bonimenteur', 'C', 5, 'hasard', 'À chaque main jouée, {v|1 chance sur 4} de créer un Arcane (s\'il y a de la place).', {
  tags: ['chance', 'arcane'],
  avant: (ctx) => {
    if (ctx.chance(1, 4) && creerConso(ctx.etat, 'arcane')) return { texte: 'Arcane' };
    return null;
  },
});
J('receleur', 'Le Receleur', 'C', 4, 'risque', 'Si ta première défausse de la manche est une seule carte, détruis-la et gagne {l|4 louis}.', {
  tags: ['destruction', 'defausse', 'argent'],
  defausse: (etat, j, cartes, info) => (info.premiere && cartes.length === 1 ? { detruire: [cartes[0].id], argent: 4, texte: '+4 louis' } : null),
});
J('lesteur', 'Le Lesteur', 'C', 4, 'matieres', 'Chaque carte Lestée marquée donne aussi {m|+6 multi}.', {
  tags: ['lestee', 'carte'],
  cible: (c) => c.amel === 'lestee',
  carte: (ctx, c) => (c.amel === 'lestee' ? { multi: 6 } : null),
});
J('ovation', "L'Ovation", 'C', 5, 'regles', 'Toutes les cartes jouées marquent.', {
  tags: ['carte'],
  regles: { toutMarque: true },
});
J('balayeur', 'Le Balayeur', 'C', 5, 'regles', '{c|+1 défausse} par manche.', {
  tags: ['defausse'],
  passif: { defausses: 1 },
});
J('veilleur', 'Le Veilleur', 'C', 4, 'base', '{m|+2 multi} par carte gardée en main.', {
  tags: ['main_tenue'],
  main: (ctx) => (ctx.enMain.length ? { multi: 2 * ctx.enMain.length } : null),
});
J('chandelle', 'La Chandelle', 'C', 4, 'croissance', (j) => '{m|+' + (j.etat.multi ?? 30) + ' multi}. Perd 3 multi à chaque main jouée, puis s\'éteint.', {
  init: (j) => {
    j.etat.multi = 30;
  },
  main: (ctx, j) => ({ multi: j.etat.multi }),
  apres: (ctx, j) => {
    j.etat.multi -= 3;
    if (j.etat.multi <= 0) return { detruitJoker: true, texte: 'Éteinte' };
    return { texte: '-3' };
  },
});
J('placier', 'Le Placier', 'C', 4, 'base', 'Selon sa place dans la main jouée, une carte marquée donne {j|+8, +16, +24, +32 ou +40 jetons}.', {
  sig: true,
  tags: ['ordre', 'carte'],
  carte: (ctx, c) => ({ jetons: 8 * (ctx.jouees.indexOf(c) + 1) }),
});
J('bluffeur', 'Le Bluffeur', 'C', 5, 'risque', '{x|×3 multi} si tu joues 5 cartes qui ne forment qu\'une Carte haute.', {
  sig: true,
  main: (ctx) => (ctx.type === 'carte_haute' && ctx.jouees.length === 5 ? { xmulti: 3 } : null),
});
J('testament', 'Le Testament', 'C', 4, 'matieres', 'Quand tu le vends, le joker à sa droite reçoit une édition (Brillant, Irisé ou Prisme).', {
  sig: true,
  tags: ['edition'],
  vente: (etat, j, idx) => {
    const v = etat.jokers[idx + 1];
    if (v && !v.edition) {
      v.edition = choisir(etat, 'joker', ['brillant', 'brillant', 'irise', 'irise', 'prisme']);
      note(etat, { t: 'joker', uid: v.uid, txt: 'Hérite' });
    }
  },
});
J('longue_vue', 'La Longue-vue', 'C', 5, 'regles', 'Tu vois les 3 prochaines cartes de ta pioche.', {
  sig: true,
  passif: { vision: 3 },
});

// ------------------------------------------------------------ Peu communs

J('daltonien', 'Le Daltonien', 'U', 6, 'enseignes', 'Piques et Trèfles sont une même enseigne. Cœurs et Carreaux aussi.', {
  tags: ['pique', 'coeur', 'carreau', 'trefle', 'couleur'],
  regles: { daltonien: true },
});
J('arlequin', "L'Arlequin", 'U', 6, 'enseignes', '{x|×3 multi} si les 4 enseignes sont présentes parmi les cartes marquées.', {
  tags: ['pique', 'coeur', 'carreau', 'trefle'],
  main: (ctx) => (['P', 'C', 'K', 'T'].every((e) => ctx.marquantes.some((c) => ctx.ens(c, e))) ? { xmulti: 3 } : null),
});
J('nuit_noire', 'La Nuit noire', 'U', 6, 'enseignes', '{x|×2,5 multi} si toutes les cartes gardées en main sont noires.', {
  tags: ['pique', 'trefle', 'main_tenue'],
  cible: (c, h) => h.noir(c),
  main: (ctx) => (ctx.enMain.length && ctx.enMain.every((c) => ctx.noir(c)) ? { xmulti: 2.5 } : null),
});
J('sang_bleu', 'Le Sang bleu', 'U', 6, 'enseignes', 'Chaque Cœur marqué a {v|1 chance sur 2} de donner {x|×1,5 multi}.', {
  tags: ['coeur', 'carte', 'chance'],
  cible: (c, h) => h.ens(c, 'C'),
  carte: (ctx, c) => (ctx.ens(c, 'C') && ctx.chance(1, 2) ? { xmulti: 1.5 } : null),
});
J('salon_prive', 'Le Salon privé', 'U', 6, 'rangs', 'Chaque Dame gardée en main donne {m|+10 multi}.', {
  tags: ['tetes', 'main_tenue', 'dame'],
  cible: (c) => c.rang === 12,
  enMain: (ctx, c) => (c.rang === 12 ? { multi: 10 } : null),
});
J('portraitiste', 'Le Portraitiste', 'U', 6, 'rangs', 'Toutes les cartes comptent comme des têtes.', {
  tags: ['tetes'],
  regles: { toutesTetes: true },
});
J('bal_masque', 'Le Bal masqué', 'U', 6, 'rangs', 'La première tête marquée donne {x|×2 multi}.', {
  tags: ['tetes', 'carte'],
  cible: (c, h) => h.tete(c),
  carte: (ctx, c) => (ctx.marquantes.find((k) => ctx.tete(k)) === c ? { xmulti: 2 } : null),
});
J('miroir_loge', 'Le Miroir de loge', 'U', 7, 'rejoue', 'Rejoue chaque tête marquée.', {
  tags: ['tetes', 'rejoue', 'carte'],
  cible: (c, h) => h.tete(c),
  rejoue: (ctx, c) => (ctx.tete(c) ? 1 : 0),
});
J('rappel', 'Le Rappel', 'U', 6, 'rejoue', 'Rejoue 2 fois la première carte marquée.', {
  tags: ['rejoue', 'carte', 'ordre'],
  rejoue: (ctx, c) => (ctx.marquantes[0] === c ? 2 : 0),
});
J('echo_balcon', "L'Écho du balcon", 'U', 6, 'rejoue', 'Rejoue les effets des cartes gardées en main.', {
  tags: ['rejoue', 'main_tenue', 'enclume'],
  cible: (c) => c.amel === 'enclume',
  rejoueEnMain: () => 1,
});
J('bis', 'Le Bis', 'U', 6, 'rejoue', 'À la dernière main de la manche, rejoue toutes les cartes marquées.', {
  tags: ['rejoue', 'carte'],
  rejoue: (ctx) => (ctx.derniereMain ? 1 : 0),
});
J('ventriloque', 'Le Ventriloque', 'U', 7, 'copie', 'Copie le joker à sa droite, s\'il est commun.', {
  tags: ['ordre'],
  copie: (jokers, i) => (jokers[i + 1] && JOKER[jokers[i + 1].id].r === 'C' ? [i + 1] : []),
});
J('vigneron', 'Le Vigneron', 'U', 7, 'croissance', (j) => 'Gagne {x|×0,15 multi} à chaque manche gagnée.' + actuel(x(j.etat.x ?? 1) + ' multi'), {
  init: (j) => {
    j.etat.x = 1;
  },
  finManche: (etat, j) => {
    j.etat.x = Math.round((j.etat.x + 0.15) * 100) / 100;
    return { texte: 'Mûrit' };
  },
  main: (ctx, j) => (j.etat.x > 1 ? { xmulti: j.etat.x } : null),
});
J('astrologue', "L'Astrologue", 'U', 6, 'croissance', (j, etat) => '{m|+2 multi} par Astre utilisé dans cette partie.' + (etat ? actuel('+' + 2 * (etat.stats.astres || 0) + ' multi') : ''), {
  tags: ['astre'],
  main: (ctx) => (ctx.etat.stats.astres ? { multi: 2 * ctx.etat.stats.astres } : null),
});
J('ogre', "L'Ogre", 'U', 6, 'croissance', (j) => 'Quand tu quittes la boutique, il dévore ton consommable le plus à gauche et gagne {x|×0,25 multi}.' + actuel(x(j.etat.x ?? 1) + ' multi'), {
  tags: ['arcane', 'astre', 'destruction'],
  init: (j) => {
    j.etat.x = 1;
  },
  finBoutique: (etat, j) => {
    if (!etat.consommables.length) return null;
    etat.consommables.shift();
    j.etat.x = Math.round((j.etat.x + 0.25) * 100) / 100;
    return { texte: 'Miam' };
  },
  main: (ctx, j) => (j.etat.x > 1 ? { xmulti: j.etat.x } : null),
});
J('brise_glace', 'Le Brise-glace', 'U', 6, 'matieres', (j) => 'Gagne {x|×0,5 multi} chaque fois qu\'une carte Cristal se brise.' + actuel(x(j.etat.x ?? 1) + ' multi'), {
  tags: ['cristal', 'destruction'],
  cible: (c) => c.amel === 'cristal',
  init: (j) => {
    j.etat.x = 1;
  },
  carteDetruite: (etat, j, cartes, raison) => {
    if (raison !== 'brise') return null;
    j.etat.x += 0.5 * cartes.length;
    return { texte: 'Grandit' };
  },
  main: (ctx, j) => (j.etat.x > 1 ? { xmulti: j.etat.x } : null),
});
J('fripier', 'Le Fripier', 'U', 6, 'croissance', (j) => 'Gagne {x|×0,2 multi} par carte détruite.' + actuel(x(j.etat.x ?? 1) + ' multi'), {
  tags: ['destruction', 'cristal'],
  init: (j) => {
    j.etat.x = 1;
  },
  carteDetruite: (etat, j, cartes) => {
    j.etat.x = Math.round((j.etat.x + 0.2 * cartes.length) * 100) / 100;
    return { texte: 'Grandit' };
  },
  main: (ctx, j) => (j.etat.x > 1 ? { xmulti: j.etat.x } : null),
});
J('cannibale', 'Le Cannibale', 'U', 7, 'risque', (j) => 'Après la première main de chaque manche, détruit la carte marquée la plus à droite et gagne {m|+2 multi}.' + actuel('+' + (j.etat.multi || 0) + ' multi'), {
  tags: ['destruction', 'ordre'],
  main: (ctx, j) => (j.etat.multi ? { multi: j.etat.multi } : null),
  apres: (ctx, j) => {
    if (!ctx.premiereMain || !ctx.marquantes.length) return null;
    const c = ctx.marquantes[ctx.marquantes.length - 1];
    j.etat.multi = (j.etat.multi || 0) + 2;
    return { detruire: [c.id], texte: 'Dévore' };
  },
});
J('faux_monnayeur', 'Le Faux-monnayeur', 'U', 5, 'economie', 'Tu peux t\'endetter jusqu\'à {l|20 louis}.', {
  tags: ['argent'],
  passif: { dette: 20 },
});
J('coffre_fort', 'Le Coffre-fort', 'U', 6, 'economie', (j, etat) => '{m|+1 multi} par tranche de 3 louis que tu possèdes.' + (etat ? actuel('+' + Math.floor(Math.max(0, etat.argent) / 3) + ' multi') : ''), {
  tags: ['argent'],
  main: (ctx) => (ctx.etat.argent >= 3 ? { multi: Math.floor(ctx.etat.argent / 3) } : null),
});
J('pique_assiette', 'Le Pique-assiette', 'U', 6, 'economie', 'Le premier paquet acheté dans chaque boutique est gratuit.', {
  tags: ['argent'],
  passif: { paquetGratuit: 1 },
});
J('coup_eclat', "Le Coup d'éclat", 'U', 6, 'economie', 'Si tu bats la mise dès ta première main, gagne {l|8 louis}.', {
  tags: ['argent'],
  gain: (etat, j, info) => (info && info.mainsJouees === 1 ? 8 : 0),
});
J('mecene', 'Le Mécène', 'U', 7, 'economie', 'À la fin de la manche, rapporte {l|1 louis} par joker que tu possèdes.', {
  tags: ['argent'],
  gain: (etat) => etat.jokers.length,
});
J('manches_longues', 'Les Manches longues', 'U', 6, 'regles', '{c|+2 cartes} en main. {c|-1 défausse} par manche.', {
  tags: ['main_tenue'],
  passif: { tailleMain: 2, defausses: -1 },
});
J('stoique', 'Le Stoïque', 'U', 6, 'regles', '{c|+3 cartes} en main quand il ne te reste qu\'une main à jouer.', {
  tags: ['main_tenue'],
  passif: (etat) => (etat.manche && etat.manche.mains === 1 ? { tailleMain: 3 } : null),
});
J('poubelle_doree', 'La Corbeille dorée', 'U', 6, 'regles', '{c|+1 défausse}. Défausser 5 cartes d\'un coup rapporte {l|2 louis}.', {
  tags: ['defausse', 'argent'],
  passif: { defausses: 1 },
  defausse: (etat, j, cartes) => (cartes.length === 5 ? { argent: 2, texte: '+2 louis' } : null),
});
J('dernier_verre', 'Le Dernier verre', 'U', 7, 'regles', '{c|+1 main} par manche.', {
  passif: { mains: 1 },
});
J('tricheur', 'Le Tricheur', 'U', 7, 'regles', 'Suites et Couleurs se forment avec 4 cartes.', {
  tags: ['suite', 'couleur'],
  regles: { suiteDe4: true, couleurDe4: true },
});
J('boiteux', 'Le Boiteux', 'U', 6, 'regles', 'Tes Suites peuvent sauter un rang (ex. 3, 5, 6, 8, 9).', {
  tags: ['suite'],
  regles: { saut: true },
});
J('souffleur_verre', 'Le Souffleur de verre', 'U', 6, 'matieres', 'Tes cartes Cristal ne se brisent jamais.', {
  tags: ['cristal'],
  cible: (c) => c.amel === 'cristal',
  regles: { cristalSolide: true },
});
J('de_pipe', 'Le Dé pipé', 'U', 6, 'hasard', 'Toutes tes chances sont doublées (1 sur 4 devient 2 sur 4).', {
  tags: ['chance'],
  cible: (c) => c.amel === 'veinarde' || c.amel === 'cristal',
  regles: { chancesX2: true },
});
J('cirier', 'Le Cirier', 'U', 6, 'matieres', 'Chaque carte marquée portant un sceau donne {j|+20 jetons} et {m|+4 multi}. En fin de manche, scelle une carte de ton paquet au hasard.', {
  tags: ['sceau', 'carte'],
  finManche: (etat) => {
    const libres = etat.paquet.filter((c) => !c.sceau);
    if (!libres.length) return null;
    choisir(etat, 'chance', libres).sceau = choisir(etat, 'chance', LISTE_SCEAUX);
    return { texte: 'Scellé' };
  },
  cible: (c) => !!c.sceau,
  carte: (ctx, c) => (c.sceau ? { jetons: 20, multi: 4 } : null),
});
J('enlumineur', "L'Enlumineur", 'U', 6, 'matieres', '{x|×1,75 multi} si une carte marquée porte une édition.', {
  tags: ['edition'],
  cible: (c) => !!c.edition,
  main: (ctx) => (ctx.marquantes.some((c) => c.edition) ? { xmulti: 1.75 } : null),
});
J('dresseur', 'Le Dresseur', 'U', 6, 'matieres', 'Chaque carte Caméléon marquée donne {x|×1,5 multi}. En fin de manche, une carte ordinaire de ton paquet devient Caméléon.', {
  tags: ['cameleon', 'carte'],
  finManche: (etat) => {
    const libres = etat.paquet.filter((c) => !c.amel);
    if (!libres.length) return null;
    choisir(etat, 'chance', libres).amel = 'cameleon';
    return { texte: 'Dressée' };
  },
  cible: (c) => c.amel === 'cameleon',
  carte: (ctx, c) => (c.amel === 'cameleon' ? { xmulti: 1.5 } : null),
});
J('alchimiste', "L'Alchimiste", 'U', 6, 'matieres', 'Si ta première main de la manche est une seule carte sans amélioration, elle en reçoit une au hasard.', {
  tags: ['lestee', 'cristal', 'enclume', 'doree', 'cameleon'],
  avant: (ctx) => {
    if (!ctx.premiereMain || ctx.jouees.length !== 1 || ctx.jouees[0].amel) return null;
    if (ctx.apercu) {
      ctx.incertain();
      return null;
    }
    ctx.jouees[0].amel = choisir(ctx.etat, 'joker', ['lestee', 'ardente', 'cameleon', 'cristal', 'enclume', 'doree', 'veinarde']);
    return { texte: 'Transmute' };
  },
});
J('puriste', 'Le Puriste', 'U', 7, 'risque', '{x|×3 multi} tant que tu n\'as utilisé aucune défausse dans la manche.', {
  tags: ['defausse'],
  main: (ctx) => (ctx.m.defaussesUtilisees === 0 ? { xmulti: 3 } : null),
});
J('dernier_souffle', 'Le Dernier souffle', 'U', 6, 'risque', '{x|×3 multi} à la dernière main de la manche.', {
  main: (ctx) => (ctx.derniereMain ? { xmulti: 3 } : null),
});
J('salle_vide', 'La Salle vide', 'U', 6, 'risque', (j, etat) => '{m|+12 multi} par emplacement de joker vide.' + (etat ? actuel('+' + 12 * Math.max(0, emplJokers(etat) - jokersComptes(etat)) + ' multi') : ''), {
  main: (ctx) => {
    const n = Math.max(0, emplJokers(ctx.etat) - jokersComptes(ctx.etat));
    return n ? { multi: 12 * n } : null;
  },
});
J('avocat', "L'Avocat", 'U', 6, 'patron', 'Les patrons demandent {c|25 % de jetons en moins}.', {
  tags: ['patron'],
  passif: { ciblePatron: -0.25 },
});
J('derniere_chance', 'La Dernière chance', 'U', 6, 'patron', 'Si tu perds une manche avec au moins 30 % du score demandé, tu es sauvé. Ce joker disparaît.', {
  tags: ['patron'],
  sauvetage: (etat, j) => etat.manche.score >= 0.3 * etat.manche.cible,
});
J('rebouteux', 'Le Rebouteux', 'U', 6, 'patron', 'Les cartes affaiblies par un patron marquent normalement.', {
  tags: ['patron'],
  regles: { rebouteux: true },
});
J('voyante', 'La Voyante', 'U', 4, 'hasard', 'À chaque paquet ouvert, crée un Arcane (s\'il y a de la place).', {
  tags: ['chance', 'arcane'],
  paquet: (etat, j, chance) => (creerConso(etat, 'arcane') ? { texte: 'Arcane' } : null),
});
J('souvenir', 'Le Souvenir', 'U', 6, 'risque', (j, etat) => '{x|×2,5 multi} si tu joues le même type de main que ta dernière main de la manche précédente.' + (etat && etat.memoire.derniereMain ? actuel(MAIN[etat.memoire.derniereMain].nom) : ' {g|(Aucun souvenir encore)}'), {
  sig: true,
  main: (ctx) => (ctx.etat.memoire.derniereMain && ctx.etat.memoire.derniereMain === ctx.type ? { xmulti: 2.5 } : null),
});
J('crescendo', 'Le Crescendo', 'U', 6, 'croissance', (j) => '{m|+8 multi} par main d\'affilée qui marque plus que la précédente, dans la même manche.' + actuel('+' + 8 * (j.etat.serie || 0) + ' multi'), {
  sig: true,
  debutManche: (etat, j) => {
    j.etat.serie = 0;
  },
  main: (ctx, j) => (j.etat.serie ? { multi: 8 * j.etat.serie } : null),
  total: (ctx, j, total) => {
    if (ctx.m.dernierTotal == null) return null;
    if (total > ctx.m.dernierTotal) {
      j.etat.serie = (j.etat.serie || 0) + 1;
      return { texte: 'Crescendo' };
    }
    j.etat.serie = 0;
    return { texte: 'Retombe' };
  },
});
J('compte_bon', 'Le Compte est bon', 'U', 6, 'risque', '{x|×4 multi} si les cartes marquées totalisent exactement 21 (têtes 10, As 1 ou 11).', {
  sig: true,
  tags: ['as', 'tetes'],
  main: (ctx) => {
    let s = 0;
    let as = 0;
    for (const c of ctx.marquantes) {
      if (c.rang === 14) {
        as++;
        s += 11;
      } else s += c.rang >= 11 ? 10 : c.rang;
    }
    while (s > 21 && as > 0) {
      s -= 10;
      as--;
    }
    return s === 21 ? { xmulti: 4 } : null;
  },
});
J('exces_zele', "L'Excès de zèle", 'U', 6, 'croissance', (j) => 'À la fin de la manche, gagne {m|+1 multi} par tranche de 25 % au-dessus du score demandé (8 au plus).' + actuel('+' + (j.etat.multi || 0) + ' multi'), {
  sig: true,
  main: (ctx, j) => (j.etat.multi ? { multi: j.etat.multi } : null),
  finManche: (etat, j, info) => {
    const dep = info.score / Math.max(1, info.cible) - 1;
    const g = Math.max(0, Math.min(8, Math.floor(dep / 0.25)));
    if (!g) return null;
    j.etat.multi = (j.etat.multi || 0) + g;
    return { texte: '+' + g + ' multi' };
  },
});
J('commanditaire', 'Le Commanditaire', 'U', 6, 'risque', (j) => 'Chaque manche, il commande une main. La jouer donne {x|×2 multi}, et {l|4 louis} la première fois.' + (j.etat.type ? actuel(MAIN[j.etat.type].nom) : ''), {
  sig: true,
  tags: ['argent'],
  init: (j, etat) => {
    j.etat.type = 'paire';
    j.etat.fait = false;
  },
  debutManche: (etat, j) => {
    j.etat.type = choisir(etat, 'joker', ['paire', 'double_paire', 'brelan', 'suite', 'couleur', 'full']);
    j.etat.fait = false;
    return { texte: MAIN[j.etat.type].nom };
  },
  main: (ctx, j) => (ctx.type === j.etat.type ? { xmulti: 2, argent: j.etat.fait ? 0 : 4 } : null),
  apres: (ctx, j) => {
    if (ctx.type === j.etat.type) j.etat.fait = true;
    return null;
  },
});
J('marionnettiste', 'La Marionnettiste', 'U', 6, 'rejoue', 'Quand tu joues 3 ou 5 cartes, celle du milieu est rejouée 2 fois.', {
  sig: true,
  tags: ['rejoue', 'carte', 'ordre'],
  rejoue: (ctx, c) => {
    const n = ctx.jouees.length;
    return (n === 3 || n === 5) && ctx.jouees[(n - 1) / 2] === c ? 2 : 0;
  },
});
J('equilibriste', "L'Équilibriste", 'U', 6, 'enseignes', '{x|×2 multi} si tu marques autant de cartes rouges que de noires.', {
  sig: true,
  tags: ['pique', 'coeur', 'carreau', 'trefle'],
  main: (ctx) => {
    let r = 0;
    let n = 0;
    let k = 0;
    for (const c of ctx.marquantes) {
      if (c.amel === 'cameleon') k++;
      else if (c.ens === 'C' || c.ens === 'K') r++;
      else n++;
    }
    const t = r + n + k;
    return t >= 2 && t % 2 === 0 && Math.abs(r - n) <= k ? { xmulti: 2 } : null;
  },
});
J('flambeur', 'Le Flambeur', 'U', 5, 'economie', 'Au début de chaque manche, il mise {l|5 louis} pour toi. Gagne en 2 mains ou moins et il t\'en rend {l|15}.', {
  sig: true,
  tags: ['argent'],
  debutManche: (etat, j) => {
    j.etat.mise = false;
    if (etat.argent >= 5) {
      etat.argent -= 5;
      j.etat.mise = true;
      return { texte: 'Mise 5 louis' };
    }
    return { texte: 'Pas de mise' };
  },
  gain: (etat, j, info) => (j.etat.mise && info && info.mainsJouees <= 2 ? 15 : 0),
});
J('poete', 'Le Poète', 'U', 7, 'risque', 'Si tes cartes jouées alternent rouge et noir (3 au moins) : {x|×2 multi}. Si en plus la première et la dernière ont le même rang : {x|×3 multi}.', {
  sig: true,
  tags: ['ordre'],
  main: (ctx) => {
    const cs = ctx.jouees;
    if (cs.length < 3) return null;
    const coul = (c) => (c.amel === 'cameleon' ? '*' : c.ens === 'C' || c.ens === 'K' ? 'R' : 'N');
    const ok = ['R', 'N'].some((dep) =>
      cs.every((c, i) => {
        const att = i % 2 === 0 ? dep : dep === 'R' ? 'N' : 'R';
        const k = coul(c);
        return k === '*' || k === att;
      })
    );
    if (!ok) return null;
    return { xmulti: cs[0].rang === cs[cs.length - 1].rang ? 3 : 2 };
  },
});
J('palindrome', 'Le Palindrome', 'U', 6, 'risque', '{x|×2,5 multi} si les rangs joués se lisent pareil dans les deux sens (3 cartes au moins).', {
  sig: true,
  tags: ['ordre', 'paire'],
  main: (ctx) => {
    const cs = ctx.jouees;
    if (cs.length < 3) return null;
    for (let i = 0; i < cs.length / 2; i++) if (cs[i].rang !== cs[cs.length - 1 - i].rang) return null;
    return { xmulti: 2.5 };
  },
});

// ------------------------------------------------------------------ Rares

J('famille', 'La Grande famille', 'E', 10, 'base', '{x|×4 multi} si ta main contient un Carré, {x|×1,5} si elle contient un Brelan.', {
  main: (c) => (c.contient.carre ? { xmulti: 4 } : c.contient.brelan ? { xmulti: 1.5 } : null),
});
J('trepied', 'Le Trépied', 'R', 8, 'base', '{x|×2,5 multi} si ta main contient un Brelan.', {
  tags: ['brelan'],
  main: (c) => (c.contient.brelan ? { xmulti: 2.5 } : null),
});
J('funambule', 'La Funambule', 'E', 10, 'base', '{x|×3 multi} si ta main contient une Suite.', {
  tags: ['suite'],
  main: (c) => (c.contient.suite ? { xmulti: 3 } : null),
});
J('monochrome', 'Le Monochrome', 'R', 8, 'base', '{x|×2,5 multi} si ta main contient une Couleur.', {
  tags: ['couleur'],
  main: (c) => (c.contient.couleur ? { xmulti: 2.5 } : null),
});
J('tandem', 'Le Tandem', 'R', 8, 'base', '{x|×2 multi} si ta main contient une Paire.', {
  tags: ['paire'],
  main: (c) => (c.contient.paire ? { xmulti: 2 } : null),
});
J('perroquet', 'Le Perroquet', 'E', 10, 'rejoue', 'Rejoue toutes les cartes marquées.', {
  tags: ['rejoue', 'carte'],
  rejoue: () => 1,
});
J('echo', "L'Écho", 'R', 8, 'rejoue', 'Rejoue la carte marquée la plus à droite, une fois par défausse qu\'il te reste (3 au plus).', {
  sig: true,
  tags: ['rejoue', 'carte', 'defausse', 'ordre'],
  rejoue: (ctx, c) => (ctx.marquantes[ctx.marquantes.length - 1] === c ? Math.min(3, ctx.m.defausses) : 0),
});
J('doublure', 'La Doublure', 'E', 10, 'copie', 'Copie le joker placé à sa gauche.', {
  tags: ['ordre'],
  copie: (jokers, i) => (i > 0 ? [i - 1] : []),
});
J('passe_muraille', 'Le Passe-muraille', 'E', 10, 'patron', 'L\'effet des patrons est annulé.', {
  tags: ['patron'],
  regles: { sansPatron: true },
});
J('provocateur', 'Le Provocateur', 'R', 7, 'patron', '{x|×3 multi} contre les patrons. En échange, ils demandent {c|30 % de jetons en plus}.', {
  sig: true,
  tags: ['patron'],
  passif: { ciblePatron: 0.3 },
  main: (ctx) => (ctx.m.type === 2 ? { xmulti: 3 } : null),
});
J('contorsionniste', 'Le Contorsionniste', 'R', 8, 'regles', '{x|×2,5 multi}. {c|-1 carte} en main.', {
  passif: { tailleMain: -1 },
  main: () => ({ xmulti: 2.5 }),
});
J('diva', 'La Diva', 'R', 8, 'risque', '{x|×3 multi}, mais seulement si elle est placée tout à gauche.', {
  tags: ['ordre'],
  main: (ctx, j) => (ctx.etat.jokers[0] === j ? { xmulti: 3 } : null),
});
J('forgeron', 'Le Forgeron', 'R', 8, 'matieres', (j, etat) => '{x|×0,2 multi} par carte Enclume dans ton paquet.' + (etat ? actuel(x(1 + 0.2 * etat.paquet.filter((c) => c.amel === 'enclume').length) + ' multi') : ''), {
  tags: ['enclume'],
  cible: (c) => c.amel === 'enclume',
  main: (ctx) => {
    const n = ctx.etat.paquet.filter((c) => c.amel === 'enclume').length;
    return n ? { xmulti: 1 + 0.2 * n } : null;
  },
});
J('orpailleur', "L'Orpailleur", 'E', 10, 'matieres', 'Chaque carte Dorée marquée donne {x|×1,5 multi}. En fin de manche, dore une carte ordinaire de ton paquet.', {
  tags: ['doree', 'carte'],
  finManche: (etat) => {
    const libres = etat.paquet.filter((c) => !c.amel);
    if (!libres.length) return null;
    choisir(etat, 'chance', libres).amel = 'doree';
    return { texte: 'Pépite' };
  },
  cible: (c) => c.amel === 'doree',
  carte: (ctx, c) => (c.amel === 'doree' ? { xmulti: 1.5 } : null),
});
J('philateliste', 'La Collectionneuse', 'R', 8, 'croissance', (j) => 'Gagne {x|×0,15 multi} par rang différent marqué dans la manche.' + actuel(x(1 + 0.15 * (j.etat.rangs ? j.etat.rangs.length : 0)) + ' multi'), {
  sig: true,
  tags: ['carte'],
  debutManche: (etat, j) => {
    j.etat.rangs = [];
  },
  avant: (ctx, j) => {
    if (!j.etat.rangs) j.etat.rangs = [];
    let n = 0;
    for (const c of ctx.marquantes) {
      if (!j.etat.rangs.includes(c.rang)) {
        j.etat.rangs.push(c.rang);
        n++;
      }
    }
    return n ? { texte: '+' + n + ' rang' + (n > 1 ? 's' : '') } : null;
  },
  main: (ctx, j) => (j.etat.rangs && j.etat.rangs.length ? { xmulti: 1 + 0.15 * j.etat.rangs.length } : null),
});

// ------------------------------------------------------------ Légendaires

J('madame_velours', 'Madame Velours', 'L', 20, 'croissance', (j) => 'Gagne {x|×0,75 multi} à chaque patron vaincu.' + actuel(x(j.etat.x ?? 1.5) + ' multi'), {
  tags: ['patron'],
  init: (j) => {
    j.etat.x = 1.5;
  },
  patronVaincu: (etat, j) => {
    j.etat.x += 0.75;
    return { texte: 'Grandit' };
  },
  main: (ctx, j) => ({ xmulti: j.etat.x }),
});
J('chef_orchestre', "Le Chef d'orchestre", 'L', 20, 'copie', 'Chaque joker placé à sa gauche donne {x|×1,25 multi}.', {
  tags: ['ordre'],
  main: (ctx, j) => {
    const n = ctx.etat.jokers.indexOf(j);
    return n > 0 ? Array.from({ length: n }, () => ({ xmulti: 1.25 })) : null;
  },
});
J('reine_mere', 'La Reine mère', 'L', 20, 'rangs', 'Chaque Dame marquée donne {x|×1,75 multi}.', {
  tags: ['tetes', 'carte', 'dame'],
  cible: (c) => c.rang === 12,
  carte: (ctx, c) => (c.rang === 12 ? { xmulti: 1.75 } : null),
});
J('faiseur_ombres', "Le Faiseur d'ombres", 'L', 20, 'matieres', 'Après chaque patron vaincu, un de tes jokers sans édition devient Inverté.', {
  tags: ['edition', 'patron'],
  patronVaincu: (etat, j) => {
    const libres = etat.jokers.filter((k) => !k.edition);
    if (!libres.length) return null;
    const k = choisir(etat, 'joker', libres);
    k.edition = 'inverte';
    note(etat, { t: 'joker', uid: k.uid, txt: 'Inverté' });
    return { texte: 'Ombre' };
  },
});
J('eternel_second', "L'Éternel second", 'L', 20, 'copie', 'Copie ses deux voisins.', {
  tags: ['ordre'],
  copie: (jokers, i) => [i - 1, i + 1].filter((k) => k >= 0 && k < jokers.length),
});

// ------------------------------------------------- Ceux qui jouent avec la salle
// Six signatures bâties sur l'applaudimètre et les rappels (voir public.js).
// Absents des boutiques quand la règle du public est coupée dans l'atelier.

const jauge = (etat) => (publicActif(etat) ? etatPublic(etat).jauge : 0);
const reserve = (etat) => (publicActif(etat) ? etatPublic(etat).rappels : 0);

J('claque', 'La Claque', 'C', 5, 'public', (j, etat) => '{m|+2 multi} par ampoule allumée de l\'applaudimètre.' + (etat && etat.regles ? actuel('+' + 2 * jauge(etat) + ' multi') : ''), {
  tags: ['public'],
  sig: true,
  main: (ctx) => (jauge(ctx.etat) > 0 ? { multi: 2 * jauge(ctx.etat) } : null),
});
J('chauffeur', 'Le Chauffeur de salle', 'C', 5, 'public', 'Au début de chaque manche, le public gagne {v|2 crans}.', {
  tags: ['public'],
  sig: true,
  debutManche: (etat) => {
    if (!publicActif(etat)) return null;
    const r = ajouterPublic(etat, 2);
    return r.gain && r.apres === r.avant && !r.ovation ? null : { texte: r.ovation ? 'Ovation !' : '+2 public' };
  },
});
J('ouvreuse', "L'Ouvreuse", 'C', 5, 'public', 'Chaque ovation rapporte {l|10 louis}.', {
  tags: ['public', 'argent'],
  sig: true,
  ovation: () => ({ argent: 10 }),
});
J('cabotine', 'La Cabotine', 'U', 6, 'public', 'Le public adore tes redites : la même main deux fois de suite fait {v|gagner 1 cran} au lieu d\'en perdre un.', {
  tags: ['public'],
  sig: true,
  salle: { rediteApplaudie: true },
});
J('critique', 'Le Critique', 'U', 7, 'public', '{x|×2 multi} quand l\'applaudimètre est à ' + PUBLIC.taille * 0.6 + ' ou plus.', {
  tags: ['public'],
  sig: true,
  main: (ctx) => (jauge(ctx.etat) >= PUBLIC.taille * 0.6 ? { xmulti: 2 } : null),
});
J('bouquet', 'Le Bouquet', 'R', 8, 'public', (j, etat) => '{x|×1,5 multi} par rappel gardé en réserve.' + (etat && etat.regles && reserve(etat) ? actuel(x(Math.pow(1.5, reserve(etat))) + ' multi') : ''), {
  tags: ['public'],
  sig: true,
  main: (ctx) => {
    const n = reserve(ctx.etat);
    return n > 0 ? Array.from({ length: n }, () => ({ xmulti: 1.5 })) : null;
  },
});

// ------------------------------------------------------------ Le crescendo
// Une main qui bat la précédente de la manche gravit une marche (5 au plus) ; une main plus faible rompt tout.
// Cinq signatures pour celles et ceux qui construisent leur manche en montant.

const marches = (etat) => (etat && etat.manche ? etat.manche.crescendo || 0 : 0);

J('maestro', 'Le Maestro', 'C', 5, 'crescendo', (j, etat) => '{m|+4 multi} par marche du crescendo.' + (etat && etat.manche ? actuel('+' + 4 * marches(etat) + ' multi') : ''), {
  tags: ['crescendo'],
  sig: true,
  main: (ctx) => (marches(ctx.etat) > 0 ? { multi: 4 * marches(ctx.etat) } : null),
});
J('metronome', 'Le Métronome', 'C', 4, 'crescendo', '{j|+20 jetons} par main déjà jouée dans la manche.', {
  tags: ['crescendo'],
  sig: true,
  main: (ctx) => (ctx.m.mainsJouees > 0 ? { jetons: 20 * ctx.m.mainsJouees } : null),
});
J('montee_marches', 'La Montée des marches', 'U', 5, 'crescendo', 'Chaque marche gravie du crescendo rapporte {l|3 louis}.', {
  tags: ['crescendo', 'argent'],
  sig: true,
  crescendoMonte: () => 3,
});
J('souffleuse', 'La Souffleuse', 'U', 6, 'crescendo', 'Une fois par manche, une main plus faible {v|ne rompt pas} le crescendo.', {
  tags: ['crescendo'],
  sig: true,
  souffle: true,
});
J('point_orgue', "Le Point d'orgue", 'R', 8, 'crescendo', (j, etat) => '{x|×1 multi}, plus {x|×0,5} par marche du crescendo.' + (etat && etat.manche && marches(etat) ? actuel(x(1 + 0.5 * marches(etat)) + ' multi') : ''), {
  tags: ['crescendo'],
  sig: true,
  main: (ctx) => (marches(ctx.etat) > 0 ? { xmulti: 1 + 0.5 * marches(ctx.etat) } : null),
});

// ------------------------------------------------- Quatre familles nouvelles (v5)
// Échos : ils rejouent l'effet d'un voisin (joker de la rangée ou carte jouée).
// Pousses : elles prennent de la valeur à chaque manche, mais ne valent rien à la revente.
// Maudits : très forts, avec une contrepartie (une main de moins, des cartes face cachée).
// Duos : un bonus caché, révélé la première fois que les deux partenaires sont sur scène ensemble.

// Rejoue l'effet de fin de main du joker décalé de `decal`, multiplié par `part` (0,5 : moitié).
function echoDe(ctx, inst, decal, part) {
  const js = ctx.etat.jokers;
  const i = js.findIndex((k) => k.uid === inst.uid);
  if (i < 0) return null;
  const k = i + decal;
  if (k < 0 || k >= js.length) return null;
  const voisin = js[k];
  if (!JOKER[voisin.id] || JOKER[voisin.id].fam === 'echos' || voisin.uid === ctx.m.jokerMuet) return null;
  const out = [];
  const ajoute = (r) => {
    if (!r) return;
    if (Array.isArray(r)) return r.forEach(ajoute);
    const e = {};
    if (r.jetons) e.jetons = Math.round(r.jetons * part);
    if (r.multi) e.multi = Math.round(r.multi * part * 10) / 10;
    if (r.xmulti && r.xmulti !== 1) e.xmulti = Math.round((1 + (r.xmulti - 1) * part) * 100) / 100;
    if (e.jetons || e.multi || e.xmulti) out.push(e);
  };
  for (const { def, inst: vi } of effectifs(js, k)) {
    if (!def.main || def.fam === 'echos') continue;
    ajoute(def.main(ctx, vi));
  }
  return out.length ? out : null;
}

J('ec_resonance', 'La Résonance', 'C', 5, 'echos', 'Rejoue {v|à moitié} l\'effet du joker placé à sa gauche.', {
  tags: ['ordre', 'echo'],
  main: (ctx, j) => echoDe(ctx, j, -1, 0.5),
});
J('ec_reverb', 'La Réverbération', 'U', 6, 'echos', 'Rejoue une fois chaque carte marquée posée juste à côté d\'une figure.', {
  tags: ['rejoue', 'tetes', 'echo'],
  rejoue: (ctx, c) => {
    const i = ctx.jouees.indexOf(c);
    if (i < 0 || ctx.tete(c)) return 0;
    const v = [ctx.jouees[i - 1], ctx.jouees[i + 1]];
    return v.some((k) => k && ctx.tete(k)) ? 1 : 0;
  },
});
J('ec_cascade', 'La Cascade', 'U', 6, 'echos', 'Chaque carte marquée rejoue aussi les {j|jetons} de sa voisine de droite.', {
  tags: ['ordre', 'echo'],
  carte: (ctx, c) => {
    const i = ctx.jouees.indexOf(c);
    const v = i >= 0 ? ctx.jouees[i + 1] : null;
    return v ? { jetons: jetonsDeRang(v.rang) } : null;
  },
});
J('ec_canon', 'Le Canon', 'E', 10, 'echos', 'Rejoue {v|en entier} l\'effet du joker à sa droite, et {v|à moitié} celui de gauche.', {
  tags: ['ordre', 'echo'],
  main: (ctx, j) => [].concat(echoDe(ctx, j, 1, 1) || [], echoDe(ctx, j, -1, 0.5) || []),
});

// Pousses : un compteur de manches, perdu à la vente.
const pousse = (extra) => Object.assign({
  tags: ['pousse'],
  pousse: true,
  init: (j) => {
    j.etat.n = 0;
  },
  finManche: (etat, j) => {
    // v6 : synergie du Bouquet, les Pousses grandissent de deux manches à la fois.
    const pas = synergieActive(etat, 'bouquet') ? 2 : 1;
    j.etat.n = (j.etat.n || 0) + pas;
    return { texte: pas > 1 ? 'Pousse ×2' : 'Pousse' };
  },
}, extra);
const manches = (j) => (j && j.etat && j.etat.n) || 0;
const perdue = ' {g|Ne vaut rien à la revente.}';

J('po_bourgeon', 'Le Bourgeon', 'U', 6, 'pousses', (j) => '{m|+2 multi} par manche passée sur scène.' + actuel('+' + 2 * manches(j) + ' multi') + perdue, pousse({
  main: (ctx, j) => (manches(j) ? { multi: 2 * manches(j) } : null),
}));
J('po_lierre', 'Le Lierre', 'C', 4, 'pousses', (j) => '{j|+10 jetons} par manche passée sur scène.' + actuel('+' + 10 * manches(j) + ' jetons') + perdue, pousse({
  main: (ctx, j) => (manches(j) ? { jetons: 10 * manches(j) } : null),
}));
J('po_chene', 'Le Chêne centenaire', 'U', 7, 'pousses', (j) => '{x|×1 multi}, plus {x|×0,12} par manche passée sur scène.' + actuel(x(1 + 0.12 * manches(j)) + ' multi') + perdue, pousse({
  main: (ctx, j) => (manches(j) ? { xmulti: Math.round((1 + 0.12 * manches(j)) * 100) / 100 } : null),
}));
J('po_orchidee', "L'Orchidée", 'R', 8, 'pousses', (j) => '{m|+1 multi} par manche. Après 6 manches, elle fleurit : {x|×1,5 multi} en plus.' + actuel('+' + manches(j) + ' multi' + (manches(j) >= 6 ? ', ×1,5' : '')) + perdue, pousse({
  main: (ctx, j) => {
    const n = manches(j);
    if (!n) return null;
    return n >= 6 ? [{ multi: n }, { xmulti: 1.5 }] : { multi: n };
  },
}));

// Maudits.
J('mo_pacte', 'Le Pacte', 'U', 6, 'maudits', '{x|×2,5 multi}. {c|Une main de moins} par manche.', {
  tags: ['maudit'],
  maudit: true,
  passif: { mains: -1 },
  main: () => ({ xmulti: 2.5 }),
});
J('mo_voile', 'Le Voile noir', 'U', 6, 'maudits', '{x|×2 multi}. {c|Une carte piochée sur trois arrive face cachée.}', {
  tags: ['maudit'],
  maudit: true,
  regles: { voile: 3 },
  main: () => ({ xmulti: 2 }),
});
J('mo_clepsydre', 'La Clepsydre', 'R', 8, 'maudits', '{x|×2,5 multi}. {c|Deux défausses de moins} par manche.', {
  tags: ['maudit'],
  maudit: true,
  passif: { defausses: -2 },
  main: () => ({ xmulti: 2.5 }),
});
J('mo_masque', 'Le Masque de plomb', 'E', 10, 'maudits', '{x|×3,5 multi}. {c|Une main de moins, et les figures arrivent face cachée.}', {
  tags: ['maudit', 'tetes'],
  maudit: true,
  passif: { mains: -1 },
  regles: { figuresVoilees: true },
  main: () => ({ xmulti: 3.5 }),
});

// Duos : le bonus reste secret tant que le duo n'a pas été formé une fois (meta.decouvert.duos).
export const DUOS_CONNUS = new Set();
const duoForme = (etat, partenaire) => etat.jokers.some((k) => k.id === partenaire && (!etat.manche || k.uid !== etat.manche.jokerMuet));
const secret = (id, texte) => (j, etat) => {
  const d = JOKER[id];
  const connu = DUOS_CONNUS.has(id) || (etat && etat.vus && etat.vus.duos && etat.vus.duos[id]);
  return d.base + (connu ? ' {v|Duo avec ' + JOKER[d.partenaire].nom + '} : ' + texte : ' {g|Un bonus caché l\'attend aux côtés d\'un partenaire.}');
};
function duo(ctx, j, base, bonus) {
  const d = JOKER[j.id];
  if (!duoForme(ctx.etat, d.partenaire)) return base;
  if (!ctx.apercu && ctx.etat.vus) {
    if (!ctx.etat.vus.duos) ctx.etat.vus.duos = {};
    if (!ctx.etat.vus.duos[j.id]) ctx.etat.vus.duos[j.id] = 1;
  }
  return [].concat(base || [], bonus, { texte: 'Duo !' });
}

J('du_cour', 'Côté cour', 'C', 4, 'duos', secret('du_cour', '{x|×1,5 multi} en plus.'), {
  tags: ['duo'], partenaire: 'du_jardin', base: '{m|+6 multi}.',
  main: (ctx, j) => duo(ctx, j, { multi: 6 }, { xmulti: 1.5 }),
});
J('du_jardin', 'Côté jardin', 'C', 4, 'duos', secret('du_jardin', '{j|+60 jetons} en plus.'), {
  tags: ['duo'], partenaire: 'du_cour', base: '{j|+40 jetons}.',
  main: (ctx, j) => duo(ctx, j, { jetons: 40 }, { jetons: 60 }),
});
J('du_violon', 'Le Premier violon', 'U', 6, 'duos', secret('du_violon', '{x|×1,75 multi}.'), {
  tags: ['duo', 'crescendo'], partenaire: 'maestro', base: '{m|+6 multi}.',
  main: (ctx, j) => duo(ctx, j, { multi: 6 }, { xmulti: 1.75 }),
});
J('du_muse', 'La Muse', 'U', 7, 'duos', secret('du_muse', '{x|×2 multi}.'), {
  tags: ['duo'], partenaire: 'poete', base: '{m|+10 multi} si ta main contient une Paire.',
  main: (ctx, j) => duo(ctx, j, ctx.contient.paire ? { multi: 10 } : null, { xmulti: 2 }),
});


// ------------------------------------------------------- Jokers de synergie (v6)
// Dix jokers pensés pour se réunir : chacun vaut quelque chose seul, mais leur synergie
// (voir synergies.js) débloque un effet bien plus fort quand la bande est au complet.

J('sy_roi', 'Le Roi', 'C', 5, 'rangs', 'Chaque Roi marqué donne {m|+8 multi}.', {
  tags: ['tetes', 'carte', 'couronne'],
  cible: (c) => c.rang === 13,
  carte: (ctx, c) => (c.rang === 13 ? { multi: 8 } : null),
});
J('sy_reine', 'La Reine', 'C', 5, 'rangs', 'Chaque Dame marquée donne {j|+40 jetons} et {m|+3 multi}.', {
  tags: ['tetes', 'carte', 'couronne', 'dame'],
  cible: (c) => c.rang === 12,
  carte: (ctx, c) => (c.rang === 12 ? { jetons: 40, multi: 3 } : null),
});
J('sy_valet', 'Le Valet', 'C', 4, 'rangs', 'Chaque Valet marqué donne {j|+30 jetons} et {m|+4 multi}.', {
  tags: ['tetes', 'carte', 'couronne'],
  cible: (c) => c.rang === 11,
  carte: (ctx, c) => (c.rang === 11 ? { jetons: 30, multi: 4 } : null),
});
J('sy_contrebasse', 'La Contrebasse', 'U', 6, 'crescendo', (j, etat) => '{j|+45 jetons} par marche du crescendo.' + (etat && etat.manche ? actuel('+' + 45 * marches(etat) + ' jetons') : ''), {
  tags: ['crescendo'],
  sig: true,
  main: (ctx) => (marches(ctx.etat) > 0 ? { jetons: 45 * marches(ctx.etat) } : null),
});
J('sy_ermite', "L'Ermite", 'U', 6, 'base', '{x|×1,5 multi} si tu joues {v|3 cartes ou moins}.', {
  tags: ['petite_main'],
  main: (ctx) => (ctx.jouees.length <= 3 ? { xmulti: 1.5 } : null),
});
J('sy_moine', 'Le Moine', 'C', 4, 'base', '{j|+60 jetons} si tu joues {v|3 cartes ou moins}.', {
  tags: ['petite_main'],
  main: (ctx) => (ctx.jouees.length <= 3 ? { jetons: 60 } : null),
});
J('sy_pickpocket', 'Le Pickpocket', 'C', 4, 'economie', 'La première main de chaque manche rapporte {l|2 louis}.', {
  tags: ['argent'],
  main: (ctx) => (ctx.premiereMain ? { argent: 2 } : null),
});
J('sy_faussaire', 'Le Faussaire', 'U', 5, 'economie', 'Tes autres jokers se revendent {l|4 louis} de plus.', {
  tags: ['argent'],
});
J('sy_reflet', 'Le Reflet', 'U', 6, 'rejoue', 'Rejoue la {v|première} carte marquée.', {
  tags: ['rejoue', 'ordre'],
  rejoue: (ctx, c) => (ctx.marquantes[0] === c ? 1 : 0),
});
J('sy_fleuriste', 'La Fleuriste', 'C', 5, 'croissance', (j, etat) => {
  const n = etat && etat.jokers ? etat.jokers.filter((k) => JOKER[k.id] && JOKER[k.id].pousse).length : 0;
  return '{m|+4 multi} par Pousse dans ta rangée.' + (etat && etat.jokers ? actuel('+' + 4 * n + ' multi') : '');
}, {
  tags: ['pousse'],
  main: (ctx) => {
    const n = ctx.etat.jokers.filter((k) => JOKER[k.id] && JOKER[k.id].pousse).length;
    return n ? { multi: 4 * n } : null;
  },
});

// ---------------------------------------------------------------- Outils

// Renvoie les couples { def, inst } dont le joker i applique les effets de score.
export function effectifs(jokers, i, prof = 0, vus = null) {
  const j = jokers[i];
  if (!j) return [];
  const d = JOKER[j.id];
  if (!d) return [];
  if (!d.copie) return [{ def: d, inst: j }];
  if (prof > 6) return [];
  vus = vus || new Set();
  if (vus.has(i)) return [];
  const suite = new Set(vus);
  suite.add(i);
  let out = [];
  for (const k of d.copie(jokers, i)) out = out.concat(effectifs(jokers, k, prof + 1, suite));
  return out;
}

export function descJoker(j, etat) {
  const d = JOKER[j.id];
  if (!d) return '';
  return typeof d.desc === 'function' ? d.desc(j, etat) : d.desc;
}

export function descDef(d) {
  if (typeof d.desc !== 'function') return d.desc;
  const faux = { etat: {}, bonusVente: 0 };
  if (d.init) d.init(faux, null);
  return d.desc(faux, null).replace(/\s*\{g\|[^}]*\}/g, '');
}

// Deux jokers vont bien ensemble s'ils partagent un thème.
export function compatibles(a, b) {
  const da = JOKER[a.id];
  const db = JOKER[b.id];
  if (!da || !db || a === b) return false;
  return da.tags.some((t) => t !== 'argent' && t !== 'chance' && db.tags.includes(t));
}

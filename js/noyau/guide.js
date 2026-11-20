// Le guide de la première manche : le Régisseur t'accompagne de la première mise à la première boutique.
// Module pur : il lit l'état et dit quelle indication afficher. L'affichage est dans ui/guide.js.

import { evaluer } from './mains.js';
import { MAIN, ORDRE_MAIN, jetonsDeRang } from './donnees.js';
import { carteParId, reglesActives } from './outils.js';

// place : 'haut' (au-dessus de la table) ou 'centre' (entre l'aperçu et la main).
// cible : identifiant de la zone montrée du doigt, ou 'conseil' pour les cartes conseillées.
export const ETAPES = {
  mise: {
    place: 'haut', cible: 'jouer-mise',
    titre: 'Bienvenue sur scène',
    corps: 'Je suis le Régisseur, je te montre les planches. Chaque manche a un {m|score à battre}. Pour commencer, clique sur {c|Jouer}.',
  },
  choisir: {
    place: 'centre', cible: 'conseil',
    titre: 'Ta main',
    corps: 'Clique sur les cartes qui vont ensemble : paire, brelan, suite, couleur. Les flèches montrent ta meilleure combinaison du moment.',
  },
  jouer: {
    place: 'centre', cible: 'jouer',
    titre: 'L\'aperçu',
    corps: 'En haut, ton total avant de jouer : {j|jetons} × {m|multi}. Seules les cartes de la combinaison marquent. Clique sur {c|Jouer la main}.',
  },
  defausse: {
    place: 'centre', cible: 'defausser',
    titre: 'La défausse',
    corps: 'Ton score s\'ajoute à gauche. Tes mains sont comptées : ne les gâche pas. Des cartes inutiles ? Choisis-les et clique sur {c|Défausser} pour en piocher d\'autres.',
  },
  continuer: {
    place: 'centre', cible: null,
    titre: 'À toi de jouer',
    corps: 'Continue jusqu\'au {m|score à battre}. Une grosse main vaut mieux que deux petites.',
  },
  encaisser: {
    place: 'haut', cible: 'encaisser',
    titre: 'Mise battue',
    corps: 'Tu touches des {l|louis} : le gain de la mise, 1 par main non jouée, et des intérêts sur ta bourse. Clique sur {c|Encaisser}.',
  },
  boutique: {
    place: 'haut', cible: 'article:',
    titre: 'La boutique',
    corps: 'Engage un {c|joker} : il rejoint ta rangée et joue avec toi à chaque main. Clique sur un article, puis sur {c|Acheter}. Survole-le pour lire ce qu\'il fait.',
  },
  suivante: {
    place: 'haut', cible: 'suivant',
    titre: 'Ta troupe',
    corps: 'Les jokers se déclenchent de gauche à droite : glisse-les pour changer l\'ordre. Garde quelques {l|louis}, ils rapportent des intérêts. Ensuite : {c|Manche suivante}.',
  },
  fin: {
    place: 'haut', cible: null, bouton: 'Compris',
    titre: 'Tu sais l\'essentiel',
    corps: 'Tu peux passer une mise contre un ticket, mais jamais le {m|patron}, qui tord les règles. Le reste est dans Comment jouer. Bonne partie.',
  },
};

// Le guide couvre la première manche gagnée et la boutique qui suit, pas plus.
// Il se repère aux manches gagnées : passer la petite mise ne le fait donc pas sauter.
export function guideTermine(etat) {
  if (!etat) return true;
  if (etat.palier > 1 || etat.phase === 'defaite' || etat.phase === 'victoire') return true;
  const gagnees = (etat.stats && etat.stats.manchesGagnees) || 0;
  if (gagnees >= 2) return true;
  // Après la première boutique, le guide s'arrête dès que la manche suivante commence.
  if (gagnees === 1 && etat.phase === 'manche') return true;
  // Tout passé jusqu'au patron sans jouer : ce joueur-là sait ce qu'il fait.
  if (gagnees === 0 && etat.mancheIdx >= 2) return true;
  return false;
}

// L'étape à montrer maintenant, ou null. sel : nombre de cartes choisies.
export function etapeGuide(etat, sel = 0) {
  if (guideTermine(etat)) return null;
  const m = etat.manche;
  const gagnees = (etat.stats && etat.stats.manchesGagnees) || 0;
  switch (etat.phase) {
    case 'choix':
      return gagnees ? 'fin' : 'mise';
    case 'manche':
      if (!m) return null;
      if (m.mainsJouees === 0 && m.defaussesUtilisees === 0) return sel > 0 ? 'jouer' : 'choisir';
      if (m.mainsJouees === 1 && m.defaussesUtilisees === 0 && m.defausses > 0) return 'defausse';
      return 'continuer';
    case 'encaissement':
      return 'encaisser';
    case 'boutique':
      return etat.jokers.length ? 'suivante' : 'boutique';
    default:
      return null;
  }
}

// La meilleure combinaison de la main, sans tenir compte des jokers : assez pour apprendre.
// Renvoie { type, nom, ids } où ids sont les cartes qui marquent, ou null si la main est vide.
export function conseilMain(etat) {
  const m = etat.manche;
  if (!m) return null;
  const cachees = new Set(m.cachees || []);
  const cartes = etat.main.filter((id) => !cachees.has(id)).map((id) => carteParId(etat, id)).filter(Boolean);
  const n = Math.min(cartes.length, 12);
  if (!n) return null;
  const regles = reglesActives(etat);
  let meilleur = null;
  for (let masque = 1; masque < 1 << n; masque++) {
    const choix = [];
    for (let i = 0; i < n; i++) if (masque & (1 << i)) choix.push(cartes[i]);
    if (choix.length > 5) continue;
    const r = evaluer(choix, regles);
    if (!r.type) continue;
    const marquantes = r.marquantes.map((i) => choix[i]);
    // On ne propose que les cartes utiles : pas de passagers.
    if (marquantes.length !== choix.length) continue;
    // La main d'abord, puis les jetons, puis les rangs pour départager.
    const valeur = ORDRE_MAIN[r.type] * 1e6 + marquantes.reduce((s, c) => s + jetonsDeRang(c.rang) * 100 + c.rang, 0);
    if (!meilleur || valeur > meilleur.valeur) meilleur = { valeur, type: r.type, ids: marquantes.map((c) => c.id) };
  }
  if (!meilleur) return null;
  return { type: meilleur.type, nom: MAIN[meilleur.type].nom, ids: meilleur.ids };
}

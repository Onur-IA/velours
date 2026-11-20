// Les patrons : la troisième manche de chaque palier.
// Chaque patron porte des drapeaux lus par le moteur (partie.js, score.js).

import { REG } from './outils.js';
import { aEnseigne } from './mains.js';

const ens = (e) => (etat, c, r) => aEnseigne(c, e, r);

// Phase d'un patron à deux phases : 1 avant la moitié du score demandé, 2 ensuite.
export function phasePatron(etat) {
  const m = etat && etat.manche;
  return m && m.cible > 0 && m.score * 2 >= m.cible ? 2 : 1;
}

export const PATRONS = [
  { id: 'corbeau', nom: 'Le Corbeau', desc: 'Les Piques sont affaiblis : ils ne marquent rien.', court: 'Piques affaiblis', palierMin: 1, teinte: 'encre', affaiblit: ens('P') },
  { id: 'veuve', nom: 'La Veuve', desc: 'Les Cœurs sont affaiblis : ils ne marquent rien.', court: 'Cœurs affaiblis', palierMin: 1, teinte: 'rouge', affaiblit: ens('C') },
  { id: 'usurier', nom: "L'Usurier", desc: 'Les Carreaux sont affaiblis : ils ne marquent rien.', court: 'Carreaux affaiblis', palierMin: 1, teinte: 'orange', affaiblit: ens('K') },
  { id: 'braconnier', nom: 'Le Braconnier', desc: 'Les Trèfles sont affaiblis : ils ne marquent rien.', court: 'Trèfles affaiblis', palierMin: 1, teinte: 'vert', affaiblit: ens('T') },
  { id: 'regicide', nom: 'Le Régicide', desc: 'Les têtes sont affaiblies : Valets, Dames et Rois ne marquent rien.', court: 'Têtes affaiblies', palierMin: 2, teinte: 'violet', affaiblit: (etat, c) => c.rang >= 11 && c.rang <= 13 },
  { id: 'geolier', nom: 'Le Geôlier', desc: 'Aucune défausse pendant cette manche.', court: 'Aucune défausse', palierMin: 2, teinte: 'gris', sansDefausse: true },
  { id: 'carcan', nom: 'Le Carcan', desc: 'Tu dois jouer exactement 5 cartes à chaque main (ou toute ta main s\'il t\'en reste moins).', court: '5 cartes obligatoires', palierMin: 1, teinte: 'bois', cinqCartes: true },
  { id: 'huissier', nom: "L'Huissier", desc: 'Ta main la plus jouée de la partie voit sa base divisée par deux.', court: 'Main favorite saisie', palierMin: 2, teinte: 'gris', moitieFavorite: true },
  { id: 'rempart', nom: 'Le Rempart', desc: 'Un mur de jetons : le score demandé est bien plus haut.', court: 'Score demandé énorme', palierMin: 2, teinte: 'bois', facteur: 3.5 },
  { id: 'voile', nom: 'Le Voile', desc: 'Les têtes sont piochées face cachée.', court: 'Têtes face cachée', palierMin: 1, teinte: 'violet', tetesCachees: true },
  { id: 'brouillard', nom: 'Le Brouillard', desc: 'Après ta première main ou défausse, les cartes piochées arrivent face cachée.', court: 'Pioche face cachée', palierMin: 3, teinte: 'gris', piocheCachee: true },
  { id: 'monotone', nom: 'Le Monotone', desc: 'Chaque type de main ne marque qu\'une fois dans la manche. Rejoué, il ne vaut rien.', court: 'Chaque main ne marque qu\'une fois', palierMin: 2, teinte: 'encre', monotone: true },
  { id: 'sablier', nom: 'Le Sablier', desc: 'Après chaque main jouée, ta main rétrécit d\'une carte.', court: 'La main rétrécit', palierMin: 3, teinte: 'or', sablier: true },
  { id: 'percepteur', nom: 'Le Percepteur', desc: 'Chaque carte jouée te coûte 1 louis.', court: '1 louis par carte jouée', palierMin: 1, teinte: 'or', percepteur: true },
  { id: 'goulot', nom: 'Le Goulot', desc: 'Seules les 3 premières cartes marquantes comptent.', court: '3 cartes marquent, pas plus', palierMin: 2, teinte: 'vert', goulot: 3 },
  { id: 'tempete', nom: 'La Tempête', desc: 'Après chaque main, tes jokers sont mélangés.', court: 'Jokers mélangés', palierMin: 3, teinte: 'bleu', tempete: true },
  { id: 'inflation', nom: "L'Inflation", desc: 'Chaque défausse fait grimper le score demandé de 8 %.', court: 'Défausser coûte cher', palierMin: 2, teinte: 'orange', inflation: 0.08 },
  { id: 'baillon', nom: 'Le Bâillon', desc: 'À chaque main, un de tes jokers est muselé, au hasard.', court: 'Un joker muselé', palierMin: 3, teinte: 'rouge', baillon: true },
  { id: 'rabot', nom: 'Le Rabot', desc: 'Les niveaux de tes mains sont ignorés : tout repart du niveau 1.', court: 'Niveaux ignorés', palierMin: 4, teinte: 'bois', rabot: true, facteur: 1.6 },
  { id: 'glouton', nom: 'Le Glouton', desc: 'Après chaque main, il avale 2 cartes de ta main au hasard (défaussées).', court: 'Avale 2 cartes par main', palierMin: 1, teinte: 'vert', glouton: 2 },
  { id: 'juge', nom: 'Le Juge', desc: 'Seule ta meilleure main compte. Les scores ne s\'additionnent pas.', court: 'Une seule main compte', palierMin: 3, teinte: 'bleu', juge: true, facteur: 0.8 },
  // Patrons qui s'en prennent au public (absents quand la règle du public est coupée).
  { id: 'premiere', nom: 'La Première', desc: 'Salle exigeante : la même main deux fois de suite vide tout l\'applaudimètre.', court: 'Une redite vide l\'applaudimètre', palierMin: 2, teinte: 'cyan', besoinPublic: true, exigeant: true },
  { id: 'cabale', nom: 'La Cabale', desc: 'La salle est achetée : l\'applaudimètre est figé et aucun rappel ne te sauvera.', court: 'Public figé, aucun rappel', palierMin: 3, teinte: 'encre', besoinPublic: true, cabale: true },
  // Patrons de fin de partie.
  { id: 'rideau', nom: 'Le Rideau cramoisi', desc: 'Cœurs et Carreaux sont affaiblis.', court: 'Rouges affaiblies', final: true, teinte: 'rouge', affaiblit: (etat, c, r) => aEnseigne(c, 'C', r) || aEnseigne(c, 'K', r) },
  { id: 'minuit', nom: 'Le Minuit', desc: 'Piques et Trèfles sont affaiblis.', court: 'Noires affaiblies', final: true, teinte: 'encre', affaiblit: (etat, c, r) => aEnseigne(c, 'P', r) || aEnseigne(c, 'T', r) },
  // En deux phases : la règle se retourne quand tu atteins la moitié du score demandé.
  {
    id: 'masques', nom: 'Les Deux Masques', final: true, teinte: 'violet', phases: 2,
    desc: 'Avant la moitié du score : Cœurs et Carreaux affaiblis. Après : Piques et Trèfles affaiblis.',
    court: 'Rouges affaiblies, puis noires',
    affaiblit: (etat, c, r) => (phasePatron(etat) === 1 ? aEnseigne(c, 'C', r) || aEnseigne(c, 'K', r) : aEnseigne(c, 'P', r) || aEnseigne(c, 'T', r)),
  },
  { id: 'maitre', nom: 'Le Maître de salle', desc: 'Score demandé plus haut, et une main de moins.', court: 'Plus haut, une main de moins', final: true, teinte: 'or', facteur: 3, mainsMoins: 1 },
];
export const PATRON = REG.PATRON;
for (const p of PATRONS) PATRON[p.id] = p;

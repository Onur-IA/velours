// Le public : la mécanique maison de Velours.
// La salle réagit à chaque main. Un numéro inédit l'enthousiasme, une redite l'ennuie,
// un coup d'éclat la soulève. Quand l'applaudimètre est plein, c'est l'ovation : tu gagnes
// un rappel, une main de plus offerte le jour où tu tombes à court.
// Module pur : aucun hasard, tout se lit dans l'état de la partie.

import { REG, jokersActifs, patronActif, mod, appeler, note } from './outils.js';

export const PUBLIC = {
  taille: 10, // crans de l'applaudimètre
  inedit: 1, // type de main pas encore joué dans la manche
  eclat: 2, // la main marque à elle seule la moitié du score à battre
  redite: 1, // même type que la main précédente de la manche (retiré)
  reserveMax: 2, // rappels gardés en réserve
  cachet: 5, // louis versés par une ovation quand la réserve est pleine
};

// Rappels gardés en réserve au plus (le privilège Strapontins en ajoute un).
export function reserveMax(etat) {
  return PUBLIC.reserveMax + (etat && etat.privileges ? mod(etat, 'reserveRappels') : 0);
}

// La Cabale : pendant sa manche, la salle est achetée et rien ne bouge.
function salleFigee(etat) {
  if (etat.phase !== 'manche') return false;
  const patron = patronActif(etat);
  return !!(patron && patron.cabale);
}

export function publicActif(etat) {
  return !!etat && !!etat.regles && etat.regles.public !== false;
}

// L'état du public, créé au besoin (les sauvegardes d'avant n'en ont pas).
export function etatPublic(etat) {
  const p = etat.public;
  if (!p || typeof p !== 'object') return (etat.public = { jauge: 0, rappels: 0, ovations: 0, rappelsJoues: 0 });
  p.jauge = Math.max(0, Math.min(PUBLIC.taille, Math.round(Number(p.jauge) || 0)));
  p.rappels = Math.max(0, Math.min(reserveMax(etat), Math.round(Number(p.rappels) || 0)));
  p.ovations = p.ovations || 0;
  p.rappelsJoues = p.rappelsJoues || 0;
  return p;
}

// Comment la salle prendrait cette main. À appeler avant d'inscrire la main dans la manche.
// Renvoie { gain, raisons: [{ cle, nom, v }] } sans rien modifier.
export function reactionPublic(etat, type, total) {
  const raisons = [];
  const m = etat.manche;
  if (!publicActif(etat) || !m || !type) return { gain: 0, raisons };
  const patron = patronActif(etat);
  // La Cabale : la salle est achetée, rien ne bouge.
  if (salleFigee(etat)) return { gain: 0, raisons, fige: true };
  const joues = m.typesJoues || [];
  // Certains jokers travaillent la salle (propriété « salle » de leur définition).
  let rediteApplaudie = false;
  for (const j of jokersActifs(etat)) {
    const d = REG.JOKER[j.id];
    if (d && d.salle && d.salle.rediteApplaudie) rediteApplaudie = true;
  }
  if (!joues.includes(type)) raisons.push({ cle: 'inedit', nom: 'Numéro inédit', v: PUBLIC.inedit });
  else if (joues[joues.length - 1] === type) {
    if (rediteApplaudie) raisons.push({ cle: 'redite', nom: 'Redite applaudie', v: PUBLIC.redite });
    // La Première : une redite vide toute la salle.
    else if (patron && patron.exigeant) raisons.push({ cle: 'redite', nom: 'Redite sifflée', v: -Math.max(PUBLIC.redite, etatPublic(etat).jauge) });
    else raisons.push({ cle: 'redite', nom: 'Redite', v: -PUBLIC.redite });
  }
  if (m.cible > 0 && total * 2 >= m.cible) raisons.push({ cle: 'eclat', nom: 'Coup d\'éclat', v: PUBLIC.eclat });
  return { gain: raisons.reduce((s, r) => s + r.v, 0), raisons };
}

// Applique une réaction. Renvoie ce qui s'est passé, pour l'affichage :
// { gain, raisons, avant, apres, ovation, rappelGagne }.
export function appliquerPublic(etat, reaction) {
  const p = etatPublic(etat);
  const out = { gain: reaction.gain, raisons: reaction.raisons, avant: p.jauge, apres: p.jauge, ovation: false, rappelGagne: false, louis: 0, cachets: [] };
  if (!publicActif(etat) || salleFigee(etat)) return out;
  p.jauge = Math.max(0, p.jauge + reaction.gain);
  if (p.jauge >= PUBLIC.taille) {
    // L'ovation vide la salle de son souffle : la jauge repart, le trop-plein est gardé.
    out.ovation = true;
    p.ovations++;
    p.jauge = Math.min(PUBLIC.taille - 1, p.jauge - PUBLIC.taille);
    if (p.rappels < reserveMax(etat)) {
      p.rappels++;
      out.rappelGagne = true;
    } else {
      // Réserve pleine : la salle jette des louis sur la scène.
      etat.argent += PUBLIC.cachet;
      out.louis = PUBLIC.cachet;
    }
    // Une ovation réveille les jokers qui en vivent, d'où qu'elle vienne.
    for (const { j, r } of appeler(etat, 'ovation')) {
      if (r.argent) {
        etat.argent += r.argent;
        out.cachets.push({ uid: j.uid, id: j.id, argent: r.argent });
      }
    }
  }
  out.apres = p.jauge;
  return out;
}

// Phrase d'annonce d'une ovation.
export function texteOvation(r) {
  return r.rappelGagne ? 'Ovation ! Un rappel en réserve' : 'Ovation ! La salle te couvre de louis : +' + r.louis;
}

// Fait monter la salle hors d'une main (joker, privilège, ticket) et annonce l'ovation s'il y en a une.
export function ajouterPublic(etat, gain) {
  const r = appliquerPublic(etat, { gain, raisons: [] });
  if (r.ovation) {
    note(etat, { t: 'info', txt: texteOvation(r) });
    for (const k of r.cachets) note(etat, { t: 'joker', uid: k.uid, txt: '+' + k.argent + ' louis' });
  }
  return r;
}

// À court de mains : le public en redemande, s'il reste un rappel. Renvoie true si une main est offerte.
export function prendreRappel(etat) {
  if (!publicActif(etat)) return false;
  if (salleFigee(etat)) return false;
  const p = etatPublic(etat);
  const m = etat.manche;
  // Un seul rappel par manche : le public ne redemande pas deux fois le même soir.
  if (p.rappels <= 0 || !m || m.rappelPris) return false;
  m.rappelPris = true;
  p.rappels--;
  p.rappelsJoues++;
  return true;
}

// Le rappel des règles, avec la réserve du moment (Strapontins l'agrandit).
export function aidePublic(etat) {
  const max = etat ? reserveMax(etat) : PUBLIC.reserveMax;
  return 'La salle réagit à chaque main. {v|Numéro inédit} (un type de main pas encore joué dans la manche) : +' + PUBLIC.inedit +
    '. {v|Coup d\'éclat} (la moitié du score à battre en une main) : +' + PUBLIC.eclat +
    '. {m|Redite} (le même type deux fois de suite) : -' + PUBLIC.redite +
    '. À ' + PUBLIC.taille + ', c\'est l\'ovation : tu gagnes un {l|rappel}, une main de plus offerte quand tu tombes à court (un seul par manche). Avec ' +
    max + ' rappels en réserve, l\'ovation rapporte {l|' + PUBLIC.cachet + ' louis} à la place.';
}

export const AIDE_PUBLIC = aidePublic(null);

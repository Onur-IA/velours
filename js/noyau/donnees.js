// Données de base : enseignes, rangs, mains, matières de cartes.

export const ENSEIGNES = ['P', 'C', 'K', 'T'];
export const NOM_ENSEIGNE = { P: 'Pique', C: 'Cœur', K: 'Carreau', T: 'Trèfle' };
export const NOM_ENSEIGNES = { P: 'Piques', C: 'Cœurs', K: 'Carreaux', T: 'Trèfles' };
export const ROUGES = { C: true, K: true };

export const RANGS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
export function lettreRang(r) {
  return r <= 10 ? String(r) : { 11: 'V', 12: 'D', 13: 'R', 14: 'A' }[r];
}
export function nomRang(r) {
  return r <= 10 ? String(r) : { 11: 'Valet', 12: 'Dame', 13: 'Roi', 14: 'As' }[r];
}
export function jetonsDeRang(r) {
  if (r <= 10) return r;
  if (r === 14) return 11;
  return 10;
}

// Les treize mains, de la plus modeste à la plus rare.
// base : jetons et multi au niveau 1. pas : gain par niveau.
export const MAINS = [
  { id: 'carte_haute', nom: 'Carte haute', jetons: 8, multi: 1, pasJ: 8, pasM: 1, astre: 'lueur' },
  { id: 'paire', nom: 'Paire', jetons: 12, multi: 2, pasJ: 12, pasM: 1, astre: 'jumelles' },
  { id: 'double_paire', nom: 'Double paire', jetons: 24, multi: 2, pasJ: 18, pasM: 1, astre: 'balance' },
  { id: 'brelan', nom: 'Brelan', jetons: 32, multi: 3, pasJ: 18, pasM: 2, astre: 'trident' },
  { id: 'suite', nom: 'Suite', jetons: 36, multi: 4, pasJ: 28, pasM: 2, astre: 'echelle' },
  { id: 'couleur', nom: 'Couleur', jetons: 40, multi: 4, pasJ: 16, pasM: 2, astre: 'maree' },
  { id: 'full', nom: 'Full', jetons: 45, multi: 5, pasJ: 24, pasM: 2, astre: 'citadelle' },
  { id: 'carre', nom: 'Carré', jetons: 64, multi: 7, pasJ: 28, pasM: 3, astre: 'carrousel' },
  { id: 'quinte_flush', nom: 'Quinte flush', jetons: 96, multi: 9, pasJ: 36, pasM: 3, astre: 'comete' },
  { id: 'quinte_royale', nom: 'Quinte royale', jetons: 128, multi: 10, pasJ: 40, pasM: 4, astre: 'couronne' },
  { id: 'cinq', nom: 'Quintuplé', jetons: 128, multi: 12, pasJ: 32, pasM: 3, astre: 'essaim', cachee: true },
  { id: 'full_couleur', nom: 'Full couleur', jetons: 144, multi: 14, pasJ: 36, pasM: 4, astre: 'eclipse', cachee: true },
  { id: 'cinq_couleur', nom: 'Quintuplé couleur', jetons: 160, multi: 16, pasJ: 44, pasM: 3, astre: 'nova', cachee: true },
];
export const MAIN = Object.fromEntries(MAINS.map((m) => [m.id, m]));
export const ORDRE_MAIN = Object.fromEntries(MAINS.map((m, i) => [m.id, i]));

export function baseDeMain(id, niveau) {
  const m = MAIN[id];
  const n = Math.max(1, niveau || 1) - 1;
  return { jetons: m.jetons + m.pasJ * n, multi: m.multi + m.pasM * n };
}

// Améliorations de cartes.
export const AMELIORATIONS = {
  lestee: { nom: 'Lestée', desc: '{j|+25 jetons} quand elle marque.', jetons: 25 },
  ardente: { nom: 'Ardente', desc: '{m|+5 multi} quand elle marque.', multi: 5 },
  cameleon: { nom: 'Caméléon', desc: 'Compte pour toutes les enseignes.' },
  cristal: { nom: 'Cristal', desc: '{x|×2 multi} quand elle marque. {v|1 chance sur 5} de se briser après.', xmulti: 2, casse: [1, 5] },
  enclume: { nom: 'Enclume', desc: '{x|×1,5 multi} si elle reste dans ta main.', xmulti: 1.5 },
  doree: { nom: 'Dorée', desc: '{l|3 louis} si elle est dans ta main à la fin de la manche.', argent: 3 },
  veinarde: { nom: 'Veinarde', desc: '{v|1 chance sur 4} de {m|+15 multi}. {v|1 chance sur 12} de {l|15 louis}.', multi: 15, chanceMulti: [1, 4], argent: 15, chanceArgent: [1, 12] },
};
export const LISTE_AMELIORATIONS = Object.keys(AMELIORATIONS);

// Éditions (cartes et jokers).
export const EDITIONS = {
  brillant: { nom: 'Brillant', desc: '{j|+40 jetons}.', jetons: 40, prix: 2 },
  irise: { nom: 'Irisé', desc: '{m|+8 multi}.', multi: 8, prix: 3 },
  prisme: { nom: 'Prisme', desc: '{x|×1,5 multi}.', xmulti: 1.5, prix: 5 },
  inverte: { nom: 'Inverté', desc: 'Ne prend pas de place.', prix: 5 },
};

// Sceaux de cire.
export const SCEAUX = {
  carmin: { nom: 'Sceau carmin', desc: 'La carte est rejouée une fois.' },
  azur: { nom: 'Sceau azur', desc: 'Si elle est dans ta main à la fin de la manche, crée l\'Astre de ta dernière main.' },
  ambre: { nom: 'Sceau ambre', desc: '{l|3 louis} quand elle marque.', argent: 3 },
  lilas: { nom: 'Sceau lilas', desc: 'Crée un Arcane quand tu la défausses.' },
};
export const LISTE_SCEAUX = Object.keys(SCEAUX);

export function nomCarte(c) {
  return nomRang(c.rang) + ' de ' + NOM_ENSEIGNE[c.ens];
}

// Format des grands nombres, à la française.
export function fmt(n) {
  if (!isFinite(n)) return 'infini';
  if (Math.abs(n) >= 1e12) {
    const e = Math.floor(Math.log10(Math.abs(n)));
    const m = n / Math.pow(10, e);
    return m.toFixed(2).replace('.', ',') + 'e' + e;
  }
  const neg = n < 0;
  let s = String(Math.round(Math.abs(n)));
  let out = '';
  while (s.length > 3) {
    out = ' ' + s.slice(-3) + out;
    s = s.slice(0, -3);
  }
  return (neg ? '-' : '') + s + out;
}
// Multi : une décimale au besoin.
export function fmtM(n) {
  if (Math.abs(n) >= 1000) return fmt(n);
  const r = Math.round(n * 100) / 100;
  if (Number.isInteger(r)) return String(r);
  return String(r).replace('.', ',');
}

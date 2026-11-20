// Hasard déterministe : chaque flux (pioche, boutique, chance...) avance seul,
// pour qu'une même graine donne les mêmes cartes et les mêmes boutiques.

export function hacher(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

export function alea(etat, flux) {
  const r = etat.rng;
  if (r[flux] === undefined) r[flux] = hacher(etat.graine + '/' + flux);
  let t = (r[flux] = (r[flux] + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function entier(etat, flux, n) {
  return Math.floor(alea(etat, flux) * n);
}

export function choisir(etat, flux, tab) {
  if (!tab.length) return undefined;
  return tab[entier(etat, flux, tab.length)];
}

export function melanger(etat, flux, tab) {
  const t = tab.slice();
  for (let i = t.length - 1; i > 0; i--) {
    const j = entier(etat, flux, i + 1);
    [t[i], t[j]] = [t[j], t[i]];
  }
  return t;
}

// items : tableau, poids : fonction(item) -> nombre
export function pondere(etat, flux, items, poids) {
  let total = 0;
  const ps = items.map((it) => {
    const p = Math.max(0, poids(it));
    total += p;
    return p;
  });
  if (total <= 0) return items[0];
  let x = alea(etat, flux) * total;
  for (let i = 0; i < items.length; i++) {
    x -= ps[i];
    if (x < 0) return items[i];
  }
  return items[items.length - 1];
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function graineAleatoire() {
  let s = '';
  for (let i = 0; i < 8; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

export function normaliserGraine(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);
}

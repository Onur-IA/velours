// Palette et primitives pixel. Tout est dessiné au pixel entier, sans lissage.

// Format logique de l'écran. Paysage : 640 x 360. Portrait (téléphone tenu d'une main) : 360 de large,
// de 640 à 720 de haut selon l'écran. Les valeurs sont des liaisons vivantes : tous les modules voient le format courant.
export let L = 640;
export let H = 360;
export let PORTRAIT = false;
export let FORMAT = 0; // change à chaque bascule, pour invalider les caches d'images
export function reglerFormat(portrait, haut = 640) {
  const h = portrait ? Math.max(640, Math.min(720, Math.round(haut))) : 360;
  const l = portrait ? 360 : 640;
  if (l === L && h === H && portrait === PORTRAIT) return false;
  L = l;
  H = h;
  PORTRAIT = portrait;
  FORMAT++;
  return true;
}

export const C = {
  noir: '#07060d', nuit: '#0d0c1d', nuit2: '#17162f', nuit3: '#25244d', nuit4: '#3a3970',
  velours0: '#2a0810', velours1: '#470c19', velours2: '#6b1123', velours3: '#8f1d2f', velours4: '#b3323f', velours5: '#eaa2a8',
  or0: '#6e4410', or1: '#b77d1a', or2: '#e0aa2a', or3: '#f8d86a',
  creme: '#f3e9d2', creme2: '#d9cdb0', creme3: '#b3a587', blanc: '#ffffff',
  gris0: '#2e2c40', gris1: '#55526b', gris2: '#8a879c', gris3: '#bdb9c9',
  bleu0: '#173a7a', bleu1: '#2a6fd6', bleu2: '#6cb4ff',
  rouge0: '#8a1622', rouge1: '#e0343c', rouge2: '#ff8a78',
  vert0: '#17573a', vert1: '#2e9e5b', vert2: '#8be08a',
  violet0: '#3d1d6b', violet1: '#7a3fc0', violet2: '#c79aff',
  orange1: '#e8792b', cyan1: '#4fd6d0', rose1: '#f08bb4',
  encre: '#1c2340', bois: '#5a3420',
};

export const COUL_ENS = { P: '#1c2340', C: '#d42a3a', K: '#e2701f', T: '#1f6b4a' };
export const COUL_ENS_CLAIR = { P: '#6f7fc0', C: '#ff7a80', K: '#ffb066', T: '#5fc98f' };
// v7 : commune grise, peu commune verte, rare bleue, épique violette, légendaire or (animée en jeu).
export const COUL_RARETE = { C: ['#5d6270', '#aab0bd', '#2c2f37'], U: ['#2e7d4f', '#7fd08a', '#17462b'], R: ['#2f62b8', '#82b6ff', '#162f5e'], E: ['#7b3fc4', '#cda2ff', '#38165f'], L: ['#b77d1a', '#f8d86a', '#3d1d6b'] };
export const TEINTES = {
  rouge: ['#6b1123', '#e0343c', '#ff8a78'], encre: ['#141a33', '#3d4a8a', '#8f9bd6'], orange: ['#7a3a10', '#e8792b', '#ffc27a'],
  vert: ['#17573a', '#2e9e5b', '#8be08a'], violet: ['#3d1d6b', '#7a3fc0', '#c79aff'], gris: ['#2e2c40', '#6d6a80', '#bdb9c9'],
  bois: ['#3a2114', '#8a5a38', '#d9a87a'], or: ['#6e4410', '#e0aa2a', '#f8d86a'], bleu: ['#173a7a', '#2a6fd6', '#6cb4ff'], cyan: ['#0f4f55', '#2aa7a8', '#8ff0e6'],
};

export function toile(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}

export function rect(g, x, y, w, h, c) {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function ell(g, cx, cy, rx, ry, c) {
  g.fillStyle = c;
  cx = Math.round(cx);
  cy = Math.round(cy);
  rx = Math.max(0.5, rx);
  ry = Math.max(0.5, ry);
  const n = Math.floor(ry);
  for (let y = -n; y <= n; y++) {
    const d = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))) + 0.5);
    g.fillRect(cx - d, cy + y, 2 * d + 1, 1);
  }
}

export function tri(g, x1, y1, x2, y2, x3, y3, c) {
  g.fillStyle = c;
  const pts = [[x1, y1], [x2, y2], [x3, y3]].map(([x, y]) => [Math.round(x), Math.round(y)]).sort((a, b) => a[1] - b[1]);
  const [a, b, d] = pts;
  const interp = (p, q, y) => (q[1] === p[1] ? p[0] : p[0] + ((q[0] - p[0]) * (y - p[1])) / (q[1] - p[1]));
  for (let y = a[1]; y <= d[1]; y++) {
    const xa = interp(a, d, y);
    const xb = y < b[1] ? interp(a, b, y) : interp(b, d, y);
    const g0 = Math.round(Math.min(xa, xb));
    const g1 = Math.round(Math.max(xa, xb));
    g.fillRect(g0, y, g1 - g0 + 1, 1);
  }
}

export function ligne(g, x1, y1, x2, y2, c, ep = 1) {
  g.fillStyle = c;
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  x2 = Math.round(x2);
  y2 = Math.round(y2);
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;
  for (let i = 0; i < 2000; i++) {
    g.fillRect(x1, y1, ep, ep);
    if (x1 === x2 && y1 === y2) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x1 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y1 += sy;
    }
  }
}

// Rectangle aux coins rabotés (rayon 1 à 3).
export function rrect(g, x, y, w, h, c, r = 2) {
  g.fillStyle = c;
  x = Math.round(x);
  y = Math.round(y);
  if (r <= 0 || w < 2 * r || h < 2 * r) {
    g.fillRect(x, y, w, h);
    return;
  }
  const coupes = r === 1 ? [1] : r === 2 ? [2, 1] : [3, 2, 1];
  g.fillRect(x, y + r, w, h - 2 * r);
  coupes.forEach((d, i) => {
    g.fillRect(x + d, y + i, w - 2 * d, 1);
    g.fillRect(x + d, y + h - 1 - i, w - 2 * d, 1);
  });
}

// Panneau en relief : bord, fond, liseré clair en haut.
export function panneau(g, x, y, w, h, o = {}) {
  const bord = o.bord || C.noir;
  const fond = o.fond || C.nuit2;
  rrect(g, x, y, w, h, bord, o.r ?? 2);
  rrect(g, x + 1, y + 1, w - 2, h - 2, fond, Math.max(0, (o.r ?? 2) - 1));
  if (o.clair) rect(g, x + 3, y + 1, w - 6, 1, o.clair);
  if (o.sombre) rect(g, x + 3, y + h - 2, w - 6, 1, o.sombre);
}

// Dessine un motif ASCII ('#' plein) à l'échelle e.
export function motif(g, lignes, x, y, c, e = 1, carte = null) {
  for (let j = 0; j < lignes.length; j++) {
    const l = lignes[j];
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (ch === '.' || ch === ' ') continue;
      g.fillStyle = carte && carte[ch] ? carte[ch] : c;
      g.fillRect(x + i * e, y + j * e, e, e);
    }
  }
}

export function hachage(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function melange(c1, c2, t) {
  const p = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const a = p(c1);
  const b = p(c2);
  const m = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return '#' + m.map((v) => v.toString(16).padStart(2, '0')).join('');
}

// ------------------------------------------------------------ Enseignes

export const PIPS7 = {
  C: ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'],
  P: ['...#...', '..###..', '.#####.', '#######', '##.#.##', '...#...', '..###..'],
  K: ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'],
  T: ['..###..', '..###..', '##.#.##', '#######', '##.#.##', '...#...', '..###..'],
};
export const PIPS5 = {
  C: ['.#.#.', '#####', '#####', '.###.', '..#..'],
  P: ['..#..', '.###.', '#####', '#.#.#', '.###.'],
  K: ['..#..', '.###.', '#####', '.###.', '..#..'],
  T: ['.###.', '.###.', '#####', '#.#.#', '.###.'],
};

// Grande enseigne dessinée par formes, pour les As, les fonds et les écrans.
export function grandeEnseigne(g, ens, cx, cy, t, c) {
  const u = t / 20;
  if (ens === 'K') {
    const r = Math.round(10 * u);
    g.fillStyle = c;
    for (let y = -r; y <= r; y++) {
      const d = Math.round((r - Math.abs(y)) * 0.72);
      g.fillRect(Math.round(cx) - d, Math.round(cy) + y, 2 * d + 1, 1);
    }
  } else if (ens === 'C') {
    ell(g, cx - 4.6 * u, cy - 3.6 * u, 5.2 * u, 5.2 * u, c);
    ell(g, cx + 4.6 * u, cy - 3.6 * u, 5.2 * u, 5.2 * u, c);
    tri(g, cx - 9.6 * u, cy - 1.5 * u, cx + 9.6 * u, cy - 1.5 * u, cx, cy + 10 * u, c);
  } else if (ens === 'P') {
    ell(g, cx - 4.6 * u, cy + 1.6 * u, 5.2 * u, 5.2 * u, c);
    ell(g, cx + 4.6 * u, cy + 1.6 * u, 5.2 * u, 5.2 * u, c);
    tri(g, cx - 9.6 * u, cy, cx + 9.6 * u, cy, cx, cy - 10.5 * u, c);
    tri(g, cx, cy + 2 * u, cx - 4 * u, cy + 10 * u, cx + 4 * u, cy + 10 * u, c);
  } else {
    ell(g, cx, cy - 5 * u, 4.6 * u, 4.6 * u, c);
    ell(g, cx - 5.4 * u, cy + 1.4 * u, 4.6 * u, 4.6 * u, c);
    ell(g, cx + 5.4 * u, cy + 1.4 * u, 4.6 * u, 4.6 * u, c);
    rect(g, cx - 1.5 * u, cy - 2 * u, 3 * u + 1, 5 * u, c);
    tri(g, cx, cy + 2 * u, cx - 4 * u, cy + 10 * u, cx + 4 * u, cy + 10 * u, c);
  }
}

// --------------------------------------------------------------- Icônes

export const ICONES = {
  poids: ['....###....', '...#...#...', '...#...#...', '..#######..', '..#######..', '.#########.', '.#########.', '.#########.', '###########', '###########', '###########'],
  flamme: ['.....#.....', '....##.....', '....###....', '...####.#..', '..#####.##.', '..########.', '.#########.', '.####.####.', '.###...###.', '..##...##..', '...#####...'],
  masque: ['.#########.', '###########', '##..###..##', '##..###..##', '###########', '###########', '##.#####.##', '###.....###', '.#########.', '..#######..', '....###....'],
  cristal: ['...#####...', '..#######..', '.#########.', '###########', '.#########.', '..#######..', '..#######..', '...#####...', '....###....', '....###....', '.....#.....'],
  enclume: ['...........', '###########', '###########', '.##########', '...#######.', '....#####..', '....#####..', '....#####..', '...#######.', '..#########', '..#########'],
  piece: ['...#####...', '..#######..', '.####.####.', '.####.####.', '#####.#####', '#####.#####', '#####.#####', '.####...##.', '.#########.', '..#######..', '...#####...'],
  trefle4: ['..##...##..', '.####.####.', '.####.####.', '..#######..', '....###....', '..#######..', '.####.####.', '.####.####.', '..##..###..', '........##.', '.........#.'],
  fleche: ['.....#.....', '....###....', '...#####...', '..#######..', '.#########.', '....###....', '....###....', '....###....', '....###....', '....###....', '....###....'],
  miroir: ['...#####...', '..#.....#..', '.#..#....#.', '.#.#.....#.', '.#.......#.', '.#.......#.', '..#.....#..', '...#####...', '....###....', '....###....', '....###....'],
  ciseaux: ['.........##', '.#######.##', '.#########.', '.########..', '.########..', '.########..', '.#######...', '......##...', '.....##....', '....##.....', '...##......'],
  etoile: ['.....#.....', '.....#.....', '....###....', '....###....', '###########', '.#########.', '..#######..', '..#######..', '.####.####.', '.##.....##.', '##.......##'],
  grelot: ['.#.......#.', '###.....###', '.#.#...#.#.', '...##.##...', '..#######..', '.#########.', '.#########.', '###########', '###########', '.#.#.#.#.#.', '...........'],
  boucle: ['...........', '..######...', '.#......#..', '#........#.', '#.......###', '#........#.', '#..........', '#........#.', '.#......#..', '..######...', '...........'],
  pinceau: ['.........##', '........###', '.......###.', '......###..', '.....###...', '....###....', '..####.....', '.####......', '.###.......', '##.........', '#..........'],
  oeil: ['...........', '...........', '..#######..', '.##.....##.', '##..###..##', '#..#####..#', '##..###..##', '.##.....##.', '..#######..', '...........', '...........'],
  couronne: ['...........', '#....#....#', '#...###...#', '##..###..##', '##.#####.##', '###########', '###########', '###########', '...........', '###########', '###########'],
  sceau: ['...#####...', '.#########.', '.#########.', '###.###.###', '####.#.####', '#####.#####', '####.#.####', '###.###.###', '.#########.', '.#########.', '...#####...'],
  crane: ['..#######..', '.#########.', '###########', '##..###..##', '##..###..##', '###########', '.####.####.', '..#######..', '..#.#.#.#..', '..#.#.#.#..', '...........'],
  feuille: ['........##.', '......####.', '....######.', '...#######.', '..#######..', '.#######...', '.######....', '.#####.....', '.###.......', '#..........', '#..........'],
  sac: ['...##.##...', '....###....', '...#####...', '..#######..', '.#########.', '###########', '###########', '###########', '###########', '.#########.', '..#######..'],
  cadenas: ['...#####...', '..##...##..', '..#.....#..', '..#.....#..', '.#########.', '.#########.', '.####.####.', '.####.####.', '.####.####.', '.#########.', '.#########.'],
};

// Pièce d'un louis, 7x7.
export function louis(g, x, y) {
  motif(g, ['.#####.', '#######', '#######', '#######', '#######', '#######', '.#####.'], x, y, C.or0);
  motif(g, ['.....', '.###.', '#####', '#####', '#####', '.###.'], x + 1, y, C.or2);
  motif(g, ['.#.', '.#.', '.##'], x + 2, y + 2, C.or0);
  rect(g, x + 2, y + 1, 2, 1, C.or3);
}

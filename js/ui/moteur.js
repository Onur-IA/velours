// Moteur d'affichage : boucle, mise à l'échelle entière, souris, zones, bulles,
// entités animées, particules, popups, secousses.

import { L, H, C, rect, reglerFormat, PORTRAIT } from './dessin.js';
import { texte, largeurTexte } from './police.js';
import { son, reveiller } from './son.js';

export const M = {
  canvas: null, g: null, cadre: null,
  t: 0, dt: 0, image: 0,
  echelle: 2,
  souris: { x: -99, y: -99, bas: false, dedans: false },
  zones: [], survol: null, appui: null, glisse: null,
  secousse: 0, flash: 0, flashCoul: '#ffffff', zoom: 0,
  particules: [], popups: [],
  vitesse: 1, fige: false, hate: false,
  attentes: [],
  bulleEl: null, bulleCle: null,
  clavier: null,
  tactile: false, long: false, rotation: 0, appuiPos: null,
  bloque: false, // un panneau DOM est ouvert
  // v5 : inclinaison du téléphone (-1 à 1) pour les cartes rares en relief. Sans capteur : souris, ou lent balancement.
  incl: { x: 0, y: 0, capteur: false, tCapteur: 0 },
};

// Inclinaison : capteur d'orientation si présent (iOS demande la permission au premier toucher), sinon repli.
export function initInclinaison() {
  const surOrientation = (e) => {
    if (e.gamma == null && e.beta == null) return;
    const gx = Math.max(-1, Math.min(1, (e.gamma || 0) / 25));
    const gy = Math.max(-1, Math.min(1, ((e.beta || 0) - 40) / 25));
    // Paysage : les axes tournent avec l'écran.
    const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    const [x, y] = ang === 90 ? [gy, -gx] : ang === -90 || ang === 270 ? [-gy, gx] : [gx, gy];
    M.incl.x += (x - M.incl.x) * 0.3;
    M.incl.y += (y - M.incl.y) * 0.3;
    M.incl.capteur = true;
    M.incl.tCapteur = M.t;
  };
  window.addEventListener('deviceorientation', surOrientation);
  const demander = () => {
    window.removeEventListener('pointerdown', demander);
    const D = window.DeviceOrientationEvent;
    if (D && typeof D.requestPermission === 'function') D.requestPermission().catch(() => {});
  };
  window.addEventListener('pointerdown', demander);
}
// À chaque image : sans capteur récent, la souris guide le relief, et au repos il se balance doucement.
export function majInclinaison() {
  const I = M.incl;
  if (I.capteur && M.t - I.tCapteur < 1.5) return I;
  I.capteur = false;
  let x, y;
  if (M.souris.dedans && !M.tactile) {
    x = (M.souris.x / L) * 2 - 1;
    y = (M.souris.y / H) * 2 - 1;
  } else {
    x = Math.sin(M.t * 0.7) * 0.6;
    y = Math.cos(M.t * 0.5) * 0.3;
  }
  I.x += (x - I.x) * 0.08;
  I.y += (y - I.y) * 0.08;
  return I;
}

export function initMoteur() {
  M.canvas = document.getElementById('ecran');
  M.cadre = document.getElementById('cadre');
  M.bulleEl = document.getElementById('bulle');
  M.canvas.width = L;
  M.canvas.height = H;
  M.g = M.canvas.getContext('2d');
  M.g.imageSmoothingEnabled = false;
  redimensionner();
  window.addEventListener('resize', redimensionner);
  window.addEventListener('orientationchange', () => setTimeout(redimensionner, 120));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', redimensionner);
  // Pointeurs (souris, doigt, stylet) : un seul jeu d'événements pour tout.
  // Au doigt : toucher sélectionne, glisser déplace, un appui long montre la bulle d'aide.
  const pos = (e) => {
    const r = M.canvas.getBoundingClientRect();
    if (M.rotation) {
      // Jeu pivoté d'un quart de tour (téléphone tenu en portrait) : on remet le doigt dans le repère du jeu.
      M.souris.x = ((e.clientY - r.top) / r.height) * L;
      M.souris.y = ((r.right - e.clientX) / r.width) * H;
    } else {
      M.souris.x = ((e.clientX - r.left) / r.width) * L;
      M.souris.y = ((e.clientY - r.top) / r.height) * H;
    }
    M.souris.dedans = M.souris.x >= 0 && M.souris.y >= 0 && M.souris.x < L && M.souris.y < H;
  };
  let minuterieLong = null;
  const seuil = () => (M.tactile ? 7 : 4);
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' && !M.souris.bas) return;
    pos(e);
    if (M.glisse && !M.glisse.actif && Math.hypot(M.souris.x - M.glisse.x0, M.souris.y - M.glisse.y0) > seuil()) {
      M.glisse.actif = true;
      M.long = false;
      clearTimeout(minuterieLong);
    }
    if (M.appuiPos && Math.hypot(M.souris.x - M.appuiPos.x, M.souris.y - M.appuiPos.y) > 10) clearTimeout(minuterieLong);
  });
  M.canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    M.tactile = e.pointerType === 'touch' || e.pointerType === 'pen';
    document.body.classList.toggle('tactile', M.tactile);
    pos(e);
    reveiller();
    M.souris.bas = true;
    M.long = false;
    if (M.bloque) return;
    try {
      M.canvas.setPointerCapture(e.pointerId);
    } catch {}
    const z = zoneSous();
    M.appui = z;
    M.appuiPos = { x: M.souris.x, y: M.souris.y };
    if (z && z.glisser) M.glisse = { ref: z.glisser, x0: M.souris.x, y0: M.souris.y, dx: M.souris.x - z.x, dy: M.souris.y - z.y, actif: false };
    M.hate = true;
    clearTimeout(minuterieLong);
    if (M.tactile) {
      minuterieLong = setTimeout(() => {
        if (M.souris.bas && !(M.glisse && M.glisse.actif)) M.long = true;
      }, 380);
    }
  });
  const relache = (e, annule) => {
    if (e.button !== undefined && e.button !== 0 && e.type !== 'pointercancel') return;
    pos(e);
    clearTimeout(minuterieLong);
    M.souris.bas = false;
    M.hate = false;
    const a = M.appui;
    const gl = M.glisse;
    const long = M.long;
    M.appui = null;
    M.glisse = null;
    M.long = false;
    if (M.tactile) M.souris.dedans = false; // pas de survol fantôme après le doigt levé
    if (M.bloque || annule) return;
    if (gl && gl.actif) {
      if (gl.ref.lacher) gl.ref.lacher(M.souris.x, M.souris.y, gl);
      return;
    }
    // Un appui long a montré la bulle : on ne déclenche pas le clic en relâchant.
    if (long) return;
    if (a && a.clic && (dans(a, M.souris.x, M.souris.y) || (M.tactile && a === zoneSous(true)))) a.clic();
  };
  window.addEventListener('pointerup', (e) => relache(e, false));
  window.addEventListener('pointercancel', (e) => relache(e, true));
  M.canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (M.tactile) return;
    if (M.clavier) M.clavier('ClicDroit');
  });
  M.canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') M.souris.dedans = false;
  });
  // iOS : pas de zoom au double toucher ni de loupe sur le jeu.
  for (const ev of ['gesturestart', 'dblclick']) document.addEventListener(ev, (e) => e.preventDefault());
  // Le premier geste réveille le son ; sur iOS, touchend et click comptent comme geste, pointerdown pas toujours.
  window.addEventListener('touchend', reveiller, true);
  window.addEventListener('click', reveiller, true);
  // Un clic dans un panneau (hors canvas) compte aussi comme premier geste pour le son.
  window.addEventListener('pointerdown', reveiller, true);
  window.addEventListener('keydown', (e) => {
    reveiller();
    if (M.bloque && e.key !== 'Escape') return;
    if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (M.clavier && M.clavier(e.key)) e.preventDefault();
  });
}

// Marges de l'encoche et de la barre d'accueil (env(safe-area-inset-*)), lues par une sonde CSS.
let sonde = null;
function marges() {
  if (!sonde) {
    sonde = document.createElement('div');
    sonde.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(sonde);
  }
  const cs = getComputedStyle(sonde);
  return { h: parseFloat(cs.paddingTop) || 0, d: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, g: parseFloat(cs.paddingLeft) || 0 };
}

export function estTactile() {
  return M.tactile || (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
}

function redimensionner() {
  const dpr = window.devicePixelRatio || 1;
  const m = marges();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tactile = estTactile();
  // Téléphone tenu en portrait : mise en page dédiée, jouable d'une main (v4).
  // ?pivote=1 rend l'ancien comportement (le jeu paysage pivoté d'un quart de tour), ?portrait=1 force le portrait.
  const q = typeof location !== 'undefined' ? location.search : '';
  const enPortrait = /portrait=1/.test(q) || (tactile && vh > vw * 1.15 && !/pivote=1/.test(q));
  M.rotation = !enPortrait && tactile && vh > vw * 1.15 ? 90 : 0;
  let aw = vw - m.g - m.d;
  let ah = vh - m.h - m.b;
  if (M.rotation) [aw, ah] = [ah, aw];
  if (reglerFormat(enPortrait, (360 * ah) / Math.max(1, aw))) {
    M.canvas.width = L;
    M.canvas.height = H;
    M.g.imageSmoothingEnabled = false;
  }
  document.body.classList.toggle('portrait', PORTRAIT);
  if (tactile || PORTRAIT) {
    // Au doigt : on remplit l'écran, quitte à une mise à l'échelle non entière (écran à haute densité).
    M.echelle = Math.max(0.3, Math.min(aw / L, ah / H));
  } else {
    const f = Math.max(1, Math.floor(Math.min((aw * dpr) / L, (ah * dpr) / H)));
    M.echelle = f / dpr;
  }
  const w = L * M.echelle;
  const h = H * M.echelle;
  M.cadre.style.width = w + 'px';
  M.cadre.style.height = h + 'px';
  // Centré dans la zone sûre (hors encoche).
  const cx = m.g + (vw - m.g - m.d) / 2;
  const cy = m.h + (vh - m.h - m.b) / 2;
  M.cadre.style.position = 'fixed';
  M.cadre.style.left = cx - w / 2 + 'px';
  M.cadre.style.top = cy - h / 2 + 'px';
  M.cadre.style.transform = M.rotation ? 'rotate(90deg)' : '';
  document.body.classList.toggle('pivote', !!M.rotation);
  if (tactile) document.body.classList.add('tactile');
  document.documentElement.style.setProperty('--px', M.echelle + 'px');
}

function dans(z, x, y) {
  return x >= z.x && y >= z.y && x < z.x + z.w && y < z.y + z.h;
}
function zoneSous(large = M.tactile) {
  for (let i = M.zones.length - 1; i >= 0; i--) if (dans(M.zones[i], M.souris.x, M.souris.y)) return M.zones[i];
  if (!large) return null;
  // Au doigt, on pardonne : la zone cliquable la plus proche à 6 pixels près.
  let mieux = null;
  let dmin = 6;
  for (let i = M.zones.length - 1; i >= 0; i--) {
    const z = M.zones[i];
    if (!z.clic && !z.glisser) continue;
    const dx = Math.max(z.x - M.souris.x, 0, M.souris.x - (z.x + z.w));
    const dy = Math.max(z.y - M.souris.y, 0, M.souris.y - (z.y + z.h));
    const d = Math.hypot(dx, dy);
    if (d < dmin) {
      dmin = d;
      mieux = z;
    }
  }
  return mieux;
}

// Déclare une zone interactive pour l'image en cours.
export function zone(z) {
  M.zones.push(z);
  return z;
}
export function viderZones() {
  M.zones.length = 0;
}
export function survole(id) {
  return !!(M.survol && M.survol.id === id) && !M.bloque;
}
export function appuie(id) {
  return !!(M.appui && M.appui.id === id && M.souris.bas);
}

// ------------------------------------------------------------- Attentes
// Le temps de jeu s'arrête quand M.fige est vrai (utile pour les captures).

export function attendre(ms) {
  return new Promise((ok) => M.attentes.push({ reste: ms, ok }));
}

// ------------------------------------------------------------- Entités

const vis = new Map();
// Position lissée d'une entité (carte, joker...). Renvoie { x, y, neuf }.
export function poser(cle, tx, ty, o = {}) {
  let v = vis.get(cle);
  if (!v) {
    const d = o.depuis || { x: tx, y: ty };
    v = { x: d.x, y: d.y, saut: 0, vu: 0, ne: M.t, retard: o.retard || 0 };
    vis.set(cle, v);
  }
  v.vu = M.image;
  if (v.retard > 0) {
    // Entrée décalée : la carte attend son tour avant de partir.
    v.retard -= M.dt;
    return v;
  }
  const k = o.immediat ? 1 : 1 - Math.exp(-M.dt * (o.raideur || 16));
  v.x += (tx - v.x) * k;
  v.y += (ty - v.y) * k;
  if (Math.abs(tx - v.x) < 0.3) v.x = tx;
  if (Math.abs(ty - v.y) < 0.3) v.y = ty;
  v.saut *= Math.exp(-M.dt * 10);
  if (v.saut < 0.3) v.saut = 0;
  return v;
}
export function sauter(cle, force = 7) {
  const v = vis.get(cle);
  if (v) v.saut = force;
}
export function positionDe(cle) {
  return vis.get(cle) || null;
}
export function oublier(cle) {
  vis.delete(cle);
}
export function placer(cle, x, y) {
  vis.set(cle, { x, y, saut: 0, vu: M.image, ne: M.t });
}

function nettoyerEntites() {
  for (const [k, v] of vis) if (v.vu < M.image - 2) vis.delete(k);
}

// ------------------------------------------------------------- Effets

export function popup(x, y, txt, coul, o = {}) {
  // Les popups voisins s'empilent (vers le haut ou vers le bas) pour rester lisibles.
  const pas = o.pile === 'bas' ? 9 : -9;
  for (const p of M.popups) if (Math.abs(p.x - x) < 34 && Math.abs(p.y - y) < 40 && (p.pile || 'haut') === (o.pile || 'haut') && p.groupe === o.groupe) p.y += pas;
  M.popups.push({ x, y, txt, coul: coul || C.blanc, e: o.e || 1, age: 0, duree: o.duree || 0.9, vy: o.vy ?? -22, fond: o.fond, pile: o.pile, groupe: o.groupe });
}
export function eclats(x, y, n, couleurs, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = (o.vitesse || 60) * (0.3 + Math.random());
    M.particules.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.haut || 20),
      g: o.gravite ?? 160, age: 0, duree: (o.duree || 0.7) * (0.5 + Math.random() * 0.7),
      c: couleurs[Math.floor(Math.random() * couleurs.length)], t: Math.random() < 0.3 ? 2 : 1,
    });
  }
}
// v5 : sensations réglables dans les options (tremblement, arrêt sur image, vibration).
export const SENSATION = { tremblement: true, pause: true, vibration: true };

export function secouer(force) {
  if (!SENSATION.tremblement) return;
  M.secousse = Math.max(M.secousse, force);
}

// Arrêt sur image de `ms` millisecondes (au plus 200), si l'option est active.
export function figer(ms) {
  if (!SENSATION.pause) return false;
  M.arret = Math.max(M.arret || 0, Math.min(200, ms) / 1000);
  return true;
}

// Vibration : navigator.vibrate (Android et la plupart des navigateurs), sinon le repli iOS
// (un interrupteur caché, dont la bascule donne un petit retour haptique sur iOS 18 et plus), sinon rien.
let interrupteur = null;
export function vibrer(motifVib = 30) {
  if (!SENSATION.vibration) return 'coupe';
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' && navigator.vibrate(motifVib)) return 'vibrate';
  } catch {}
  if (typeof document === 'undefined' || !/iP(hone|ad|od)/.test(navigator.userAgent || '')) return 'aucun';
  try {
    if (!interrupteur) {
      const lab = document.createElement('label');
      lab.setAttribute('aria-hidden', 'true');
      lab.style.cssText = 'position:fixed;left:-99px;top:-99px;width:1px;height:1px;opacity:0;pointer-events:none';
      const inp = document.createElement('input');
      inp.type = 'checkbox';
      inp.setAttribute('switch', '');
      lab.append(inp);
      document.body.append(lab);
      interrupteur = lab;
    }
    const n = Array.isArray(motifVib) ? Math.ceil(motifVib.length / 2) : 1;
    for (let i = 0; i < Math.min(3, n); i++) setTimeout(() => interrupteur.click(), i * 90);
    return 'ios';
  } catch {
    return 'aucun';
  }
}
export function flasher(coul, force = 0.5) {
  M.flash = force;
  M.flashCoul = coul;
}
export function zoomer(force) {
  M.zoom = force;
}

// --------------------------------------------------------------- Bulles

function echapper(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
export function versHtml(s) {
  return echapper(s).replace(/\{(\w)\|([^}]*)\}/g, '<span class="t-$1">$2</span>');
}

function majBulle() {
  const el = M.bulleEl;
  const z = M.survol;
  if (!z || !z.bulle || M.bloque || (M.glisse && M.glisse.actif) || (M.tactile && !M.long)) {
    if (M.bulleCle !== null) {
      el.style.display = 'none';
      M.bulleCle = null;
    }
    return;
  }
  const cle = z.id + '|' + Math.floor(M.t * 3);
  if (cle !== M.bulleCle) {
    const b = typeof z.bulle === 'function' ? z.bulle() : z.bulle;
    if (!b) {
      el.style.display = 'none';
      M.bulleCle = null;
      return;
    }
    let html = '';
    if (b.titre) html += '<div class="b-titre">' + echapper(b.titre) + '</div>';
    if (b.sous) html += '<div class="b-sous" style="' + (b.sousCoul ? 'color:' + b.sousCoul : '') + '">' + echapper(b.sous) + '</div>';
    if (b.corps) html += '<div class="b-corps">' + versHtml(b.corps) + '</div>';
    for (const x of b.extras || []) html += '<div class="b-extra"><b>' + echapper(x.titre) + '</b> ' + versHtml(x.corps) + '</div>';
    if (b.pied) html += '<div class="b-pied">' + versHtml(b.pied) + '</div>';
    el.innerHTML = html;
    el.style.display = 'block';
    M.bulleCle = cle;
  }
  const e = M.echelle;
  const bw = el.offsetWidth;
  const bh = el.offsetHeight;
  let x = (z.x + z.w / 2) * e - bw / 2;
  let y = z.bulleY != null ? z.bulleY * e : z.bulleBas ? (z.y + z.h + 4) * e : (z.y - 4) * e - bh;
  if (y < 4) y = (z.y + z.h + 4) * e;
  if (y + bh > H * e - 4) y = Math.max(4, (z.y - 4) * e - bh);
  x = Math.max(4, Math.min(L * e - bw - 4, x));
  el.style.left = x + 'px';
  el.style.top = y + 'px';
}

// --------------------------------------------------------------- Boucle

let dernier = 0;
export function lancerBoucle(dessiner) {
  const boucle = (ts) => {
    const brut = Math.min(0.05, (ts - dernier) / 1000 || 0.016);
    dernier = ts;
    M.image++;
    // v5 : arrêt sur image (hit-stop) : le temps du jeu se fige une fraction de seconde au moment de l'impact.
    const arret = M.arret > 0;
    if (arret) M.arret -= brut;
    M.dt = arret ? 0 : brut;
    M.t += M.dt;
    // Attentes : accélérées par la vitesse choisie et par un clic maintenu.
    if (!M.fige && !arret) {
      const pasMs = brut * 1000 * M.vitesse * (M.hate ? 3 : 1);
      for (const a of M.attentes) a.reste -= pasMs;
      const finies = M.attentes.filter((a) => a.reste <= 0);
      M.attentes = M.attentes.filter((a) => a.reste > 0);
      for (const a of finies) a.ok();
    }
    const g = M.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    rect(g, 0, 0, L, H, C.noir);
    let sx = 0;
    let sy = 0;
    if (M.secousse > 0.2) {
      sx = Math.round((Math.random() * 2 - 1) * M.secousse);
      sy = Math.round((Math.random() * 2 - 1) * M.secousse);
      if (!M.fige) M.secousse *= Math.exp(-brut * 9);
    } else M.secousse = 0;
    g.translate(sx, sy);
    viderZones();
    try {
      dessiner(g);
    } catch (err) {
      console.error(err);
    }
    // Particules et popups, par-dessus tout.
    nettoyerEntites();
    for (const p of M.particules) {
      if (!M.fige) {
        p.age += brut;
        p.vy += p.g * brut;
        p.x += p.vx * brut;
        p.y += p.vy * brut;
      }
      if (p.age < p.duree) rect(g, p.x, p.y, p.t, p.t, p.c);
    }
    M.particules = M.particules.filter((p) => p.age < p.duree);
    for (const p of M.popups) {
      if (!M.fige) {
        p.age += brut;
        p.y += p.vy * brut * Math.max(0, 1 - p.age / p.duree);
      }
      const w = largeurTexte(p.txt, p.e);
      const px = Math.round(Math.max(2, Math.min(L - w - 2, p.x - w / 2)));
      const py = Math.round(p.y - (p.age < 0.08 ? 3 : 0));
      if (p.fond) rect(g, px - 2, py - 2, w + 4, 7 * p.e + 4, p.fond);
      texte(g, p.txt, px, py, { c: p.coul, e: p.e, contour: p.fond ? null : C.noir });
    }
    M.popups = M.popups.filter((p) => p.age < p.duree);
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (M.flash > 0.02) {
      g.globalAlpha = Math.min(0.8, M.flash);
      rect(g, 0, 0, L, H, M.flashCoul);
      g.globalAlpha = 1;
      if (!M.fige) M.flash *= Math.exp(-brut * 8);
    }
    // Zoom bref (CSS) pour les grosses mains.
    if (M.zoom > 0.002) {
      M.canvas.style.transform = 'scale(' + (1 + M.zoom).toFixed(4) + ')';
      if (!M.fige) M.zoom *= Math.exp(-brut * 5);
    } else if (M.zoom !== 0) {
      M.zoom = 0;
      M.canvas.style.transform = '';
    }
    const avant = M.survol;
    M.survol = M.souris.dedans && !M.bloque ? zoneSous() : null;
    if (M.survol && (!avant || avant.id !== M.survol.id) && M.survol.clic && !M.survol.muet && !M.tactile) son.survol();
    M.canvas.style.cursor = M.survol && (M.survol.clic || M.survol.glisser) ? 'pointer' : 'default';
    majBulle();
    requestAnimationFrame(boucle);
  };
  requestAnimationFrame(boucle);
}

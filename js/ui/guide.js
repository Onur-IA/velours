// Affichage du guide de la première manche : une bulle du Régisseur, une flèche sur la cible.

import { M, versHtml } from './moteur.js';
import { C, rect, PORTRAIT, FORMAT, H } from './dessin.js';
import { son } from './son.js';
import { ETAPES, etapeGuide, guideTermine, conseilMain } from '../noyau/guide.js';

const PLACES = {
  haut: { x: 322, y: 12, w: 190 },
  centre: { x: 271, y: 137, w: 250 },
};
// Portrait : la bulle se pose sur le tapis, entre le compteur et la main.
const PLACES_PORTRAIT = {
  haut: { x: 12, y: 330, w: 336 },
  centre: { x: 12, y: 330, w: 336 },
};

let el = null;
let cle = null;

function boite() {
  if (!el) el = document.getElementById('guide');
  return el;
}

export function cacherGuide() {
  const b = boite();
  if (b && cle !== null) {
    b.hidden = true;
    cle = null;
  }
}

function terminer(app) {
  app.meta.guide.fini = true;
  app.ui.guideVu = false;
  app.sauverMeta();
  cacherGuide();
}

// Flèche pixel qui sautille au-dessus d'un point.
function fleche(g, x, y) {
  const dy = Math.round(Math.abs(Math.sin(M.t * 5)) * 3);
  const yy = Math.round(y) - dy;
  const xx = Math.round(x);
  for (let i = 0; i < 5; i++) {
    rect(g, xx - 5 + i, yy - 6 + i, 11 - 2 * i, 1, C.noir);
    if (i < 4) rect(g, xx - 4 + i, yy - 6 + i, 9 - 2 * i, 1, C.or3);
  }
  rect(g, xx - 2, yy - 11, 5, 5, C.noir);
  rect(g, xx - 1, yy - 10, 3, 5, C.or3);
}

function cadre(g, z) {
  if (Math.floor(M.t * 3) % 2) return;
  const x = Math.round(z.x) - 2, y = Math.round(z.y) - 2, w = Math.round(z.w) + 4, h = Math.round(z.h) + 4;
  rect(g, x, y, w, 1, C.or3);
  rect(g, x, y + h - 1, w, 1, C.or3);
  rect(g, x, y, 1, h, C.or3);
  rect(g, x + w - 1, y, 1, h, C.or3);
}

// À appeler à la fin du dessin de la table.
export function majGuide(g, app) {
  const e = app.etat;
  const ui = app.ui;
  const meta = app.meta;
  const actif = meta.guide && !meta.guide.fini && !app.demo && e;
  if (!actif) return cacherGuide();
  if (guideTermine(e)) {
    // On ne clôt le guide que s'il a vraiment été suivi dans cette partie.
    // Perdre pendant le guide ne le clôt pas : il reviendra à la partie suivante.
    if (ui.guideVu && e.phase !== 'defaite') terminer(app);
    return cacherGuide();
  }
  if (ui.scene || ui.occupe || ui.annonce || ui.calque || ui.fin || app.panneau) return cacherGuide();
  const id = etapeGuide(e, ui.sel.length);
  const d = id && ETAPES[id];
  if (!d) return cacherGuide();
  ui.guideVu = true;

  let conseil = null;
  if (d.cible === 'conseil') {
    const cleMain = e.main.join(',');
    if (!ui.guideConseil || ui.guideConseil.cle !== cleMain) ui.guideConseil = { cle: cleMain, v: conseilMain(e) };
    conseil = ui.guideConseil.v;
  }

  const b = boite();
  const nouvelleCle = id + '|' + (conseil ? conseil.type : '') + '|' + FORMAT;
  if (nouvelleCle !== cle) {
    cle = nouvelleCle;
    const p = (PORTRAIT ? PLACES_PORTRAIT : PLACES)[d.place];
    b.style.left = 'calc(var(--px) * ' + p.x + ')';
    b.style.top = 'calc(var(--px) * ' + p.y + ')';
    b.style.width = 'calc(var(--px) * ' + p.w + ')';
    b.className = 'g-' + d.place;
    let corps = versHtml(d.corps);
    if (conseil) corps += ' <span class="t-l">Ici : ' + conseil.nom + '.</span>';
    b.innerHTML = '<div class="g-tete"><span class="g-qui">Le Régisseur</span><span class="g-titre"></span></div><div class="g-corps">' + corps + '</div><div class="g-pied"></div>';
    b.querySelector('.g-titre').textContent = d.titre;
    const pied = b.querySelector('.g-pied');
    const bouton = (label, classe, action) => {
      const k = document.createElement('button');
      k.className = 'btn petit ' + classe;
      k.textContent = label;
      k.addEventListener('click', () => {
        son.clic();
        action();
      });
      pied.append(k);
    };
    if (d.bouton) bouton(d.bouton, 'or', () => terminer(app));
    else bouton('Passer le guide', 'nuit', () => terminer(app));
    b.hidden = false;
  }

  // Flèches et cadre sur la cible, d'après les zones de l'image en cours.
  if (conseil) {
    for (const cid of conseil.ids) {
      const z = M.zones.find((k) => k.id === 'carte:' + cid);
      if (z && !ui.sel.includes(cid)) fleche(g, z.x + 21, z.y + 12);
    }
  } else if (d.cible) {
    // En boutique, la flèche montre un joker, pas le premier article venu.
    const joker = d.cible === 'article:' && e.boutique ? e.boutique.articles.find((a) => a.sorte === 'joker') : null;
    const cible = joker ? 'article:' + joker.uid : d.cible;
    const z = M.zones.find((k) => k.id && (cible.endsWith(':') ? k.id.startsWith(cible) : k.id === cible));
    if (z) {
      cadre(g, z);
      fleche(g, z.x + z.w / 2, z.y - 3);
    }
  }
}

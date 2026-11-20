// Mode Mentor (v4) : un bouton, et un joueur fort te montre le meilleur coup, t'explique pourquoi,
// rejoue tes mains après coup et glisse des astuces de stratégie. Facultatif (Options).
// Le calcul part dans un Web Worker, borné dans le temps ; repli sur le fil principal si besoin.

import * as P from '../noyau/partie.js';
import { M, positionDe } from './moteur.js';
import { C, rect, PORTRAIT, FORMAT } from './dessin.js';
import { son } from './son.js';
import { LC, HC } from './sprites.js';

const PLACES = { x: 322, y: 12, w: 300 };
const PLACES_PORTRAIT = { x: 12, y: 300, w: 336 };
const DELAI_MAX = 2500; // au-delà, on abandonne la réponse

let worker = null;
let enAttente = new Map();
let prochain = 1;
let el = null;

function boite() {
  if (!el) el = document.getElementById('mentor');
  return el;
}

function lancerWorker() {
  if (worker !== null) return worker;
  try {
    worker = new Worker(new URL('./mentor-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (ev) => {
      const p = enAttente.get(ev.data.id);
      if (!p) return;
      enAttente.delete(ev.data.id);
      clearTimeout(p.minuteur);
      if (ev.data.erreur) p.ko(new Error(ev.data.erreur));
      else p.ok(ev.data.res);
    };
    worker.onerror = () => {
      worker = false;
    };
  } catch (e) {
    worker = false;
  }
  return worker;
}

// Calcul hors du fil principal ; repli : le module du Mentor importé directement.
export function calculer(quoi, etat, args = {}) {
  const copie = JSON.parse(JSON.stringify(etat, (k, v) => (k === 'evts' ? [] : v)));
  const w = lancerWorker();
  if (w) {
    return new Promise((ok, ko) => {
      const id = prochain++;
      const minuteur = setTimeout(() => {
        enAttente.delete(id);
        ko(new Error('Le Mentor a pris trop de temps.'));
      }, DELAI_MAX);
      enAttente.set(id, { ok, ko, minuteur });
      w.postMessage({ id, quoi, etat: copie, args });
    });
  }
  return import('../noyau/mentor.js').then((Mt) => {
    if (quoi === 'manche') return Mt.conseilManche(copie, args);
    if (quoi === 'boutique') return Mt.conseilBoutique(copie);
    if (quoi === 'partout') return Mt.conseilPartout(copie, args);
    if (quoi === 'revue') return Mt.revueMain(copie, args.ids, args.total, args);
    return Mt.astuce(copie, args.vues || []);
  });
}

export function mentorActif(app) {
  return !!(app.meta.options.mentor && app.etat && !app.demo);
}

export function cacherMentor(app) {
  const b = boite();
  if (b) b.hidden = true;
  if (app && app.ui) app.ui.mentor = null;
}

// Marque la partie : le Mentor a servi (affiché en fin de partie et dans l'historique).
function marquer(app) {
  const e = app.etat;
  e.mentor = (e.mentor || 0) + 1;
}

function afficher(app, m) {
  const b = boite();
  if (!b) return;
  app.ui.mentor = m;
  const p = PORTRAIT ? PLACES_PORTRAIT : PLACES;
  b.style.left = 'calc(var(--px) * ' + p.x + ')';
  b.style.top = 'calc(var(--px) * ' + p.y + ')';
  b.style.width = 'calc(var(--px) * ' + p.w + ')';
  b.className = 'mentor-' + (m.genre || 'conseil');
  b.innerHTML = '<div class="g-tete"><span class="g-qui"></span><span class="g-titre"></span></div><div class="g-corps"></div><div class="g-pied"></div>';
  b.querySelector('.g-qui').textContent = m.qui || 'Le Mentor';
  b.querySelector('.g-titre').textContent = m.titre || '';
  const corps = b.querySelector('.g-corps');
  corps.textContent = '';
  if (m.bref) {
    const l = document.createElement('div');
    l.className = 'g-bref';
    l.textContent = m.bref;
    corps.append(l);
  }
  const det = document.createElement('div');
  det.textContent = m.bref && m.texte && m.texte.startsWith(m.bref) ? m.texte.slice(m.bref.length).trim() : m.texte || '';
  corps.append(det);
  if (m.suite && m.suite.length) {
    const s2 = document.createElement('div');
    s2.className = 'g-suite';
    s2.textContent = 'Et aussi :\n' + m.suite.join('\n');
    s2.style.whiteSpace = 'pre-line';
    corps.append(s2);
  }
  const pied = b.querySelector('.g-pied');
  const bouton = (label, classe, action, id) => {
    const k = document.createElement('button');
    k.className = 'btn petit ' + classe;
    k.textContent = label;
    if (id) k.id = id;
    k.addEventListener('click', () => {
      son.clic();
      action();
    });
    pied.append(k);
  };
  if (m.appliquer) bouton(m.appliquer.label, 'or', () => {
    m.appliquer.faire();
    cacherMentor(app);
  }, 'mentor-appliquer');
  if (m.trier) bouton(m.trier.label, 'nuit', () => {
    m.trier.faire();
    const k = pied.querySelector('#mentor-trier');
    if (k) k.remove();
  }, 'mentor-trier');
  bouton('Fermer', 'nuit', () => cacherMentor(app), 'mentor-fermer');
  b.hidden = false;
  b.dataset.format = FORMAT;
}

// Le bouton MENTOR : meilleur coup pour la main ou la boutique en cours.
export async function conseiller(app) {
  const e = app.etat;
  const ui = app.ui;
  if (!e || ui.occupe) return;
  const phases = ['manche', 'boutique', 'paquet', 'choix'];
  if (!phases.includes(e.phase)) {
    afficher(app, { titre: 'Rien à conseiller ici', texte: 'Je donne mon avis pendant une manche, en boutique, dans un paquet ou au choix de la mise.' });
    return;
  }
  const quoi = 'partout';
  afficher(app, { titre: 'Je réfléchis...', texte: 'J\'essaie chaque option sur une copie de ta partie, jokers compris.' });
  const signature = (x) => x.phase + '|' + x.main.join(',') + '|' + (x.boutique ? x.boutique.articles.map((a) => a.uid).join(',') : '') + '|' + (x.paquetOuvert ? x.paquetOuvert.choix.map((a) => a.uid).join(',') : '') + '|' + x.argent + '|' + x.consommables.length + '|' + x.mancheIdx;
  const cle = signature(e);
  try {
    const t0 = performance.now();
    const c = await calculer(quoi, e, { budgetMs: 500 });
    if (!c) return cacherMentor(app);
    // L'état a changé pendant le calcul : on ne montre pas un conseil périmé.
    if (signature(app.etat) !== cle) return cacherMentor(app);
    marquer(app);
    son.choisir();
    const ms = Math.round(performance.now() - t0);
    // v7 : une ligne pour le pourquoi, le détail ensuite, et la suite du plan (vision d'ensemble).
    const bref = c.ligne || (c.pourquoi || '').split(/(?<=[.!?])\s/)[0];
    const suite = (c.autres || []).filter((x) => x && x.titre).slice(0, 2).map((x) => '• ' + x.titre + (x.ligne ? ' : ' + x.ligne : ''));
    if (c.tri) suite.push('• ' + c.tri.titre + ' : ' + c.tri.ligne);
    if (c.vision) suite.push(c.vision);
    const m = { titre: c.titre, bref, texte: c.pourquoi, suite, conseil: c, quoi: e.phase, ms };
    if (c.tri) m.trier = { label: c.tri.mode === 'enseigne' ? 'Trier par enseigne' : 'Trier par rang', faire: () => {
      P.trier(app.etat, c.tri.mode);
      ui.rev = (ui.rev || 0) + 1;
      if (app.sauver) app.sauver();
    } };
    const choisirCartes = () => {
      ui.sel = (c.ids || []).filter((id) => app.etat.main.includes(id));
      ui.rev = (ui.rev || 0) + 1;
    };
    if (e.phase === 'manche' && c.action !== 'utiliser' && c.ids && c.ids.length) {
      m.appliquer = { label: c.action === 'defausser' ? 'Choisir ces cartes' : 'Choisir cette main', faire: choisirCartes };
    } else if (c.action === 'utiliser') {
      m.appliquer = { label: 'Préparer', faire: () => {
        choisirCartes();
        ui.selConso = c.conso;
      } };
    } else if (c.action === 'prendre' || c.action === 'garder') {
      m.appliquer = { label: 'Préparer', faire: () => {
        choisirCartes();
        ui.selChoix = c.choix;
      } };
    } else if (c.action === 'ordonner') {
      m.appliquer = { label: 'Ranger ainsi', faire: () => {
        c.ordre.forEach((uid, i) => P.deplacerJoker(app.etat, uid, i));
        if (app.sauver) app.sauver();
      } };
    }
    if (c.explorees) m.texte += ' (' + c.explorees + ' combinaisons calculées en ' + ms + ' ms.)';
    afficher(app, m);
  } catch (err) {
    afficher(app, { titre: 'Pas de réponse', texte: String(err.message || err) });
  }
}

// Après une main : « voici comment j'aurais joué ». avant = copie de l'état prise juste avant.
export async function revue(app, avant, ids, total) {
  if (!mentorActif(app) || app.meta.options.mentorRevue === false) return;
  try {
    const r = await calculer('revue', avant, { ids, total, budgetMs: 400 });
    if (!r || r.bon) {
      if (r && r.bon) app.ui.mentorBravo = M.t;
      return;
    }
    if (app.ui.occupe || app.ui.mentor) return;
    afficher(app, { genre: 'revue', titre: 'Plus ' + r.ecart.toLocaleString('fr-FR') + ' possible', texte: r.texte, conseil: { ids: [] } });
  } catch (err) {
    /* une revue manquée n'est pas grave */
  }
}

// Astuce de stratégie, une fois par sujet, au début d'une manche ou en boutique.
export async function astuceAuto(app) {
  const e = app.etat;
  if (!mentorActif(app) || app.meta.options.mentorAstuces === false) return;
  if (app.ui.occupe || app.ui.mentor || app.panneau) return;
  const cle = e.phase + '|' + e.palier + '|' + e.mancheIdx;
  if (app.ui.astuceCle === cle) return;
  app.ui.astuceCle = cle;
  const vues = app.meta.mentorVues || (app.meta.mentorVues = []);
  try {
    const a = await calculer('astuce', e, { vues });
    if (!a || app.ui.mentor || app.ui.occupe) return;
    vues.push(a.id);
    app.sauverMeta();
    afficher(app, { genre: 'astuce', qui: 'Astuce du Mentor', titre: '', texte: a.texte });
  } catch (err) {
    /* rien */
  }
}

function cadre(g, z, coul) {
  const x = Math.round(z.x) - 2, y = Math.round(z.y) - 2, w = Math.round(z.w) + 4, h = Math.round(z.h) + 4;
  rect(g, x, y, w, 1, coul);
  rect(g, x, y + h - 1, w, 1, coul);
  rect(g, x, y, 1, h, coul);
  rect(g, x + w - 1, y, 1, h, coul);
}

// Dessin : les cartes ou l'article conseillés clignotent en or (ou en rouge pour une défausse).
export function dessinerMentor(g, app) {
  const m = app.ui.mentor;
  const b = boite();
  if (b && !b.hidden && b.dataset.format !== String(FORMAT) && m) afficher(app, m);
  if (!m || !m.conseil) return;
  const c = m.conseil;
  if (Math.floor(M.t * 3) % 3 === 0) return;
  const coul = c.action === 'defausser' ? C.rouge2 : C.or3;
  for (const id of c.ids || []) {
    const pc = positionDe('c' + id);
    if (pc) cadre(g, { x: pc.x, y: pc.y, w: LC, h: HC }, coul);
  }
  for (const uid of [c.uid, c.puis, c.choix, c.conso].filter(Boolean)) {
    const z = M.zones.find((k) => k.id === 'article:' + uid || k.id === 'joker:' + uid || k.id === 'choix:' + uid || k.id === 'conso:' + uid);
    if (z) cadre(g, z, c.action === 'vendre' && uid === c.uid ? C.rouge2 : C.or3);
  }
  for (const uid of c.ordre || []) {
    const z = M.zones.find((k) => k.id === 'joker:' + uid);
    if (z) cadre(g, z, C.or3);
  }
  if (app.etat.phase === 'choix') {
    const z = M.zones.find((k) => k.id === (c.action === 'passer' ? 'passer-mise' : 'jouer-mise'));
    if (z) cadre(g, z, C.or3);
  } else if (c.action === 'relancer' || c.action === 'passer') {
    const z = M.zones.find((k) => k.id === (c.action === 'relancer' ? 'relancer' : app.etat.phase === 'paquet' ? 'paquet-passer' : 'suivant'));
    if (z) cadre(g, z, C.or3);
  }
}

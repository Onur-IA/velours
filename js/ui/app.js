// Velours : démarrage, écran titre, sauvegarde, mode démonstration.

import { EPREUVES } from '../noyau/epreuves.js';
import { L, H, PORTRAIT, FORMAT, C, rect, rrect, motif, grandeEnseigne, melange, toile, PIPS7 } from './dessin.js';
import { texte, largeurTexte } from './police.js';
import { M, initMoteur, lancerBoucle, zone, attendre, eclats, initInclinaison, SENSATION } from './moteur.js';
import { reglerDeco } from './sprites.js';
import { son, reglerMuet, reglerMusique, reglerVolumes, reglerScene, reglerElan, reglerTroupe, reglerPatron, etatSon, niveauSon } from './son.js';
import { choisirScene, couchesTroupe } from './partition.js';
import { famillesRangee, combosActifs } from '../noyau/combos.js';
import { reglerTapis, dessinerJeu, clavierJeu, nouvelleUi, bouton, viderEvts, dessinerCarte, dessinerJoker, actionJouer, lancerManche, toast, VISUEL } from './table.js';
import { ouvrir, fermer } from './ecrans.js';
import { cacherGuide } from './guide.js';
import * as P from '../noyau/partie.js';
import { migrerMeta, niveauRenommee, prochainObjectif, normaliserMeta, metaVide, enregistrerPartie, fusionnerVus, jokersVerrouilles, defiDuJour, dateParis, VERSION_NOUVEAUTES, defiTente, marquerEssaiDefi } from '../noyau/meta.js';
import { REGLES_DEFAUT, JEU, ENJEUX } from '../noyau/regles.js';
import { ajouterJoker, creerConso, creerCarte } from '../noyau/outils.js';
import { JOKERS } from '../noyau/jokers.js';
import { LC, HC } from './sprites.js';

const params = new URLSearchParams(location.search);

const app = {
  etat: null,
  sauvegarde: null,
  meta: metaVide(),
  ui: nouvelleUi(),
  ecran: 'titre',
  demo: params.get('demo') === '1',
  panneau: null,
  horsLigne: false,

  apres() {
    viderEvts(app);
    app.ui.rev++;
    app.sauver();
  },

  sauver() {
    if (app.demo || !app.etat) return;
    fusionnerVus(app.meta, app.etat);
    clearTimeout(app._t1);
    app._t1 = setTimeout(() => {
      if (!app.etat || app.demo) return;
      if (app.etat.phase === 'defaite') return;
      ecrire('partie', P.serialiser(app.etat));
      ecrire('meta', JSON.stringify(app.meta));
    }, 250);
  },

  sauverMeta() {
    if (app.demo) return;
    clearTimeout(app._t2);
    app._t2 = setTimeout(() => ecrire('meta', JSON.stringify(app.meta)), 200);
  },

  nouvellePartie(opts = {}) {
    app.demo = false;
    const regles = opts.regles || REGLES_DEFAUT;
    app.etat = P.nouvellePartie({
      graine: opts.graine,
      regles,
      defi: opts.defi || null,
      zen: !!opts.zen,
      epreuve: opts.epreuve || null,
      atelier: !!opts.atelier,
      verrouilles: opts.toutDebloque ? [] : jokersVerrouilles(app.meta),
      date: new Date().toISOString(),
    });
    if (opts.defi) marquerEssaiDefi(app.meta, opts.defi); // un essai par jour
    app.ui = nouvelleUi();
    app.ecran = 'jeu';
    app.sauvegarde = null;
    son.paquet();
    app.apres();
    // Toute première partie : le Régisseur guide la première manche (voir ui/guide.js).
    app.meta.aideVue = true;
    // Leçon de poker (v4) : une fois, pour qui n'a jamais joué.
    if (!app.meta.leconVue) {
      app.meta.leconVue = true;
      ouvrir(app, 'lecon');
    }
    app.sauverMeta();
  },

  continuer() {
    if (!app.sauvegarde) return;
    app.etat = app.sauvegarde;
    app.sauvegarde = null;
    app.ui = nouvelleUi();
    app.ecran = 'jeu';
    son.carte();
    if (app.etat.phase === 'victoire') app.ui.fin = { type: 'victoire', nouveautes: [], t0: M.t };
  },

  finDePartie(evenement) {
    const e = app.etat;
    let nouveautes = [];
    const renAvant = niveauRenommee(app.meta);
    if (!app.demo) {
      nouveautes = enregistrerPartie(app.meta, e, evenement);
      if (evenement === 'fin') effacer('partie');
      else ecrire('partie', P.serialiser(e));
      ecrire('meta', JSON.stringify(app.meta));
    }
    const m = e.manche;
    app.ui.fin = {
      type: evenement === 'victoire' ? 'victoire' : 'defaite', nouveautes, t0: M.t,
      renAvant, renApres: niveauRenommee(app.meta), gain: (e.compte && e.compte.renommeeGagnee) || 0,
      objectif: prochainObjectif(app.meta),
      manque: evenement !== 'victoire' && m ? Math.max(0, m.cible - m.score) : 0, cible: m ? m.cible : 0,
    };
    if (app.ui.fin.renApres.niveau > renAvant.niveau) setTimeout(() => son.niveau(), 1400);
    if (evenement === 'victoire') {
      son.victoire();
      son.stinger('victoire');
      for (let i = 0; i < 6; i++) eclats(80 + i * 96, 60, 30, [C.or3, C.rouge2, C.blanc, C.bleu2], { vitesse: 120, duree: 1.4 });
    } else {
      son.defaite();
      son.stinger('defaite');
    }
  },

  continuerSansFin() {
    P.continuerApresVictoire(app.etat);
    app.ui.fin = null;
    app.ui.encT0 = M.t;
    app.apres();
  },

  rejouer() {
    const e = app.etat;
    if (e.phase !== 'defaite' && !app.demo) enregistrerPartie(app.meta, e, 'fin');
    if (e.epreuve) return app.nouvellePartie({ epreuve: e.epreuve.id });
    // Le défi du jour ne se tente qu'une fois (v5) : « Encore une partie » relance une partie classique.
    const defi = e.defi && e.defi.date === dateParis() && !defiTente(app.meta) ? defiDuJour() : null;
    const regles = defi ? defi.regles : e.defi ? REGLES_DEFAUT : e.regles;
    app.nouvellePartie({ regles, defi, graine: defi ? defi.graine : '', atelier: e.atelier, zen: e.zen, toutDebloque: e.atelier || !!defi });
  },

  abandonner() {
    const e = app.etat;
    if (e && !app.demo) {
      enregistrerPartie(app.meta, e, 'fin');
      effacer('partie');
      ecrire('meta', JSON.stringify(app.meta));
    }
    app.etat = null;
    app.sauvegarde = null;
    app.ecran = 'titre';
  },

  retourTitre() {
    const e = app.etat;
    if (app.demo) {
      location.search = '';
      return;
    }
    if (e && e.phase === 'defaite') app.sauvegarde = null;
    else if (e) {
      // Une victoire quittée est une partie finie, qu'on peut encore reprendre en sans fin.
      if (e.phase === 'victoire') enregistrerPartie(app.meta, e, 'fin');
      ecrire('partie', P.serialiser(e));
      app.sauvegarde = e;
    }
    ecrire('meta', JSON.stringify(app.meta));
    app.etat = null;
    app.ecran = 'titre';
    app.ui = nouvelleUi();
  },

  pause() {
    if (app.ui.occupe && !app.ui.annonce) return;
    son.clic();
    ouvrir(app, 'pause');
  },

  basculerSon() {
    app.meta.options.muet = !app.meta.options.muet;
    reglerMuet(app.meta.options.muet);
    if (!app.meta.options.muet) son.clic();
    app.sauverMeta();
  },

  // Volumes de 0 à 1, mémorisés dans les options. cle : volume, volMusique ou volEffets.
  reglerVolume(cle, v) {
    const o = app.meta.options;
    o[cle] = Math.min(1, Math.max(0, Number(v) || 0));
    reglerVolumes({ general: o.volume, musique: o.volMusique, effets: o.volEffets });
    app.sauverMeta();
  },

  // La musique suit le moment de la partie : titre, table, boutique, patron.
  accorderMusique() {
    const e = app.ecran === 'jeu' ? app.etat : null;
    const m = e && e.manche;
    const annonce = !!app.ui.annonce;
    const r = choisirScene(e ? {
      ecran: 'jeu',
      phase: annonce ? 'manche' : e.phase,
      fin: !!app.ui.fin,
      victoire: !!(app.ui.fin && app.ui.fin.type === 'victoire'),
      patron: annonce || !!(m && m.patron && !m.patronAnnule),
      final: e.palier >= e.regles.paliers,
      palier: e.palier,
      score: annonce || !m ? 0 : m.score,
      cible: m ? m.cible : 0,
      mains: annonce || !m ? 9 : m.mains,
      mainsMax: annonce || !m ? 9 : m.mains + m.mainsJouees,
      crescendo: m && e.phase === 'manche' ? (app.ui.scene ? app.ui.scene.crescendo : m.crescendo) || 0 : 0,
    } : { ecran: 'titre' });
    reglerElan(r.fievre !== undefined ? (m && (app.ui.scene ? app.ui.scene.crescendo : m.crescendo)) || 0 : 0);
    reglerPatron(r.scene === 'patron' && e ? (m && m.patron) || (P.infoPalier(e) || {}).patron || null : null);
    reglerScene(r.scene, annonce ? 0 : r.int, { final: r.final, tension: r.tension || 0, fievre: !!r.fievre, score: r.score || 0 });
    // La troupe à l'orchestre : les familles de la rangée ajoutent leurs instruments.
    const js = e ? (app.ui.scene ? app.ui.scene.jokers : e.jokers) : [];
    reglerTroupe(app.meta.options.troupe === false ? null : couchesTroupe(famillesRangee(js), combosActifs(js).length));
  },

  changerVitesse() {
    const v = app.meta.options.vitesse;
    app.meta.options.vitesse = v === 1 ? 2 : v === 2 ? 4 : 1;
    M.vitesse = app.meta.options.vitesse;
    app.sauverMeta();
  },
};

// ------------------------------------------------------------ Stockage

// Version statique (publiée en ligne, ou ouverte sans serveur) : tout est gardé dans le navigateur.
const STATIQUE = !!(document.querySelector('meta[name="velours-statique"]') || /github\.io$/.test(location.hostname) || location.protocol === 'file:');
app.statique = STATIQUE;

async function lire(nom) {
  if (STATIQUE) {
    app.horsLigne = true;
    try {
      return JSON.parse(localStorage.getItem('velours-' + nom) || 'null');
    } catch {
      return null;
    }
  }
  try {
    const r = await fetch('/api/' + nom, { cache: 'no-store' });
    if (!r.ok) throw new Error('http');
    return await r.json();
  } catch {
    app.horsLigne = true;
    try {
      return JSON.parse(localStorage.getItem('velours-' + nom) || 'null');
    } catch {
      return null;
    }
  }
}
function ecrire(nom, json) {
  if (app.demo) return;
  if (nom === 'meta') garderCopieMeta(json);
  if (app.horsLigne) {
    try {
      localStorage.setItem('velours-' + nom, json);
    } catch {}
    return;
  }
  fetch('/api/' + nom, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: json }).catch(() => {});
}
// v6 : copie tournante de la méta, qui ne recule jamais (une méta vide ou moins avancée ne l'écrase pas).
// Si la clé principale disparaît ou se retrouve vide, on repart de cette copie au lancement.
const CLE_COPIE = 'velours-copie-meta';
function avancement(m) {
  if (!m || typeof m !== 'object' || !m.stats) return -1;
  const s = m.stats;
  return (Number(s.parties) || 0) * 1000 + (Number(s.mainsJouees) || 0) + Object.keys((m.decouvert && m.decouvert.jokers) || {}).length;
}
function garderCopieMeta(json) {
  try {
    const neuf = JSON.parse(json);
    const vieux = JSON.parse(localStorage.getItem(CLE_COPIE) || 'null');
    if (avancement(neuf) >= avancement(vieux)) localStorage.setItem(CLE_COPIE, json);
  } catch {}
}
function lireCopieMeta() {
  try {
    return JSON.parse(localStorage.getItem(CLE_COPIE) || 'null');
  } catch {
    return null;
  }
}
// Demande au navigateur de ne pas effacer le stockage du jeu (Safari et Chrome l'accordent souvent à une appli installée).
async function demanderPersistance() {
  try {
    if (navigator.storage && navigator.storage.persist) app.persistant = await navigator.storage.persist();
  } catch {}
}

// v6 : export et import de la sauvegarde (fichier ou texte à coller).
export function exporterSauvegarde() {
  const contenu = { jeu: 'velours', format: 1, date: new Date().toISOString(), meta: app.meta, partie: app.etat && !app.demo ? JSON.parse(P.serialiser(app.etat)) : app.sauvegarde ? JSON.parse(P.serialiser(app.sauvegarde)) : null };
  const json = JSON.stringify(contenu);
  app.meta.dernierExport = contenu.date;
  app.sauverMeta();
  return json;
}
export function importerSauvegarde(texte) {
  let c;
  try {
    c = JSON.parse(String(texte || '').trim());
  } catch {
    return { ok: false, raison: 'Ce texte n\'est pas une sauvegarde de Velours.' };
  }
  if (!c || c.jeu !== 'velours' || !c.meta || !c.meta.stats) return { ok: false, raison: 'Ce texte n\'est pas une sauvegarde de Velours.' };
  // L'ancienne méta est mise de côté avant d'être remplacée.
  try {
    localStorage.setItem('velours-avant-import', JSON.stringify({ meta: app.meta, date: new Date().toISOString() }));
  } catch {}
  const mig = migrerMeta(c.meta);
  app.meta = mig.meta;
  const json = JSON.stringify(app.meta);
  try {
    localStorage.setItem(CLE_COPIE, json); // l'import fait foi, même s'il est moins avancé
  } catch {}
  ecrire('meta', json);
  app.sauvegarde = null;
  if (c.partie) {
    const s = P.charger(c.partie);
    if (s && s.phase !== 'defaite') {
      app.sauvegarde = s;
      ecrire('partie', P.serialiser(s));
    }
  }
  if (app.ecran === 'jeu') {
    app.etat = null;
    app.ecran = 'titre';
  }
  return { ok: true, parties: app.meta.stats.parties, enCours: !!app.sauvegarde };
}

// Copie de secours d'une sauvegarde d'avant la v5 : écrite une fois, jamais écrasée (navigateur, et serveur s'il y en a un).
function garderSecours(nom, brut) {
  if (app.demo || !brut) return;
  const json = JSON.stringify(brut);
  try {
    const cle = 'velours-secours-v1-' + nom;
    if (localStorage.getItem(cle) === null) localStorage.setItem(cle, json);
  } catch {}
  if (!app.horsLigne) fetch('/api/secours-' + nom, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: json }).catch(() => {});
}
function effacer(nom) {
  if (app.demo) return;
  if (app.horsLigne) {
    try {
      localStorage.removeItem('velours-' + nom);
    } catch {}
    return;
  }
  fetch('/api/' + nom, { method: 'DELETE' }).catch(() => {});
}

// ---------------------------------------------------------------- Titre

let fondTitre = null;
let formatTitre = -1;
function dessinerFondTitre() {
  if (fondTitre && formatTitre === FORMAT) return fondTitre;
  formatTitre = FORMAT;
  const [cv, g] = toile(L, H);
  rect(g, 0, 0, L, H, C.nuit);
  // Grand rideau de velours, plis verticaux.
  for (let x = 0; x < L; x++) {
    const pli = Math.sin(x * 0.11) * 0.5 + Math.sin(x * 0.037 + 1) * 0.5;
    const c = pli > 0.45 ? C.velours3 : pli > 0 ? C.velours2 : pli > -0.5 ? C.velours1 : C.velours0;
    rect(g, x, 0, 1, H, c);
    if (pli > 0.42 && pli < 0.5 && x % 2) rect(g, x, 0, 1, H, C.velours2);
  }
  // Assombrit le bas et les côtés en trame.
  for (let y = 0; y < H; y++) for (let x = 0; x < L; x++) {
    const d = Math.max(Math.abs(x - L / 2) / (L / 2), y / H);
    const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5][(x & 3) + ((y & 3) << 2)] / 16;
    if (d > 0.55 && bayer < (d - 0.55) * 1.9) rect(g, x, y, 1, 1, C.velours0);
  }
  // Embrasse dorée en haut.
  rect(g, 0, 0, L, 10, C.noir);
  for (let x = 0; x < L; x += 16) {
    rrect(g, x, 8, 16, 9, C.or0, 2);
    rrect(g, x + 1, 8, 14, 7, C.or1, 2);
    rect(g, x + 3, 9, 8, 1, C.or3);
    rect(g, x + 7, 17, 2, 4, C.or1);
    rect(g, x + 6, 21, 4, 3, C.or2);
  }
  // Scène en bas.
  rect(g, 0, H - 26, L, 26, C.noir);
  rect(g, 0, H - 26, L, 2, C.or0);
  rect(g, 0, H - 24, L, 1, C.or1);
  fondTitre = cv;
  return cv;
}

function logo(g, x, y) {
  const s = 'VELOURS';
  const e = PORTRAIT ? 7 : 9;
  const w = largeurTexte(s, e);
  const x0 = Math.round(x - w / 2);
  texte(g, s, x0 + 3, y + 5, { c: C.noir, e, contour: C.noir, ce: 3 });
  texte(g, s, x0, y, { c: C.or2, e, contour: C.noir, ce: 3 });
  // Reflet : haut plus clair, bas plus sombre.
  const bande = (dy, h, c) => {
    g.save();
    g.beginPath();
    g.rect(x0, y + dy, w, h);
    g.clip();
    texte(g, s, x0, y, { c, e });
    g.restore();
  };
  bande(0, e * 2, C.or3);
  bande(e * 2, e, '#f0c44a');
  bande(e * 5, e, C.or1);
  bande(e * 6, e, C.or0);
  // Éclat qui balaie en biais.
  const bx = x0 + ((M.t * 110) % (w + 420)) - 40;
  g.save();
  g.beginPath();
  g.moveTo(bx + 14, y);
  g.lineTo(bx + 22, y);
  g.lineTo(bx + 8, y + e * 7);
  g.lineTo(bx, y + e * 7);
  g.closePath();
  g.clip();
  texte(g, s, x0, y, { c: C.blanc, e });
  g.restore();
}

const CARTES_TITRE = [
  { rang: 10, ens: 'C' }, { rang: 11, ens: 'C' }, { rang: 12, ens: 'C', edition: 'prisme', id: 3 }, { rang: 13, ens: 'C' }, { rang: 14, ens: 'C', amel: 'doree' },
];
const JOKERS_TITRE = ['madame_velours', 'poete', 'flambeur', 'chef_orchestre'];

function dessinerTitre(g) {
  g.drawImage(dessinerFondTitre(), 0, 0);
  // Pluie lente d'enseignes.
  for (let i = 0; i < 26; i++) {
    const ens = 'PCKT'[i % 4];
    const x = (i * 97 + 30) % L;
    const y = ((M.t * (6 + (i % 5) * 2) + i * 53) % (H + 30)) - 20;
    g.globalAlpha = 0.22;
    motif(g, PIPS7[ens], x, Math.round(y), i % 2 ? C.velours4 : C.or1);
    g.globalAlpha = 1;
  }
  // Portrait : tout descend, le menu tombe sous le pouce.
  const dyP = PORTRAIT ? Math.round((H - 640) / 2) : 0;
  logo(g, L / 2, PORTRAIT ? 70 + dyP : 40);
  texte(g, 'UN ROGUELIKE DE CARTES', L / 2, PORTRAIT ? 136 + dyP : 112, { c: C.creme, a: 'c', e: 2, ombre: C.noir });

  // Éventail de cartes à gauche, troupe à droite.
  const yDeco = PORTRAIT ? 176 + dyP : 186;
  CARTES_TITRE.forEach((c, i) => {
    const x = (PORTRAIT ? 8 : 14) + i * (PORTRAIT ? 24 : 27);
    const y = yDeco + Math.round(Math.sin(M.t * 1.6 + i * 0.7) * 3) + Math.abs(i - 2) * 6;
    dessinerCarte(g, Object.assign({ id: i + 1 }, c), x, y);
  });
  JOKERS_TITRE.forEach((id, i) => {
    const x = L - (PORTRAIT ? 156 : 170) + i * (PORTRAIT ? 34 : 36);
    const y = yDeco + Math.round(Math.sin(M.t * 1.4 + i * 0.9 + 2) * 3) + Math.abs(i - 1.5) * 6;
    dessinerJoker(g, { id, uid: i + 1, edition: i === 0 ? 'irise' : null }, x, y);
  });

  // Menu.
  const bw = PORTRAIT ? 260 : 190;
  const bx = L / 2 - bw / 2;
  const hb = PORTRAIT ? 34 : 24; // au doigt, des boutons plus hauts
  let y = PORTRAIT ? H - 300 : 138;
  const s = app.sauvegarde;
  if (s) {
    const etiquette = s.phase === 'victoire' ? 'CONTINUER (VICTOIRE)' : 'CONTINUER : PALIER ' + s.palier;
    bouton(g, 't-continuer', bx, y, bw, hb, etiquette, { coul: 'or', ctexte: C.noir, clic: () => app.continuer(), bulle: { titre: 'Partie en cours', corps: JEU[s.regles.jeu].nom + ', enjeu ' + ENJEUX[s.regles.enjeu].nom + '. Graine ' + s.graine + '.' } });
    y += hb + 4;
  }
  bouton(g, 't-nouvelle', bx, y, bw, hb, 'NOUVELLE PARTIE', { coul: s ? 'bleu' : 'or', ctexte: s ? C.blanc : C.noir, clic: () => ouvrir(app, 'nouvelle') });
  y += hb + 4;
  const d = app.meta.defis[dateParis()];
  bouton(g, 't-defi', bx, y, bw, hb, 'DÉFI DU JOUR' + (d ? ' : ' + (d.score >= (d.maison || Infinity) ? 'BATTU' : 'TENTÉ') : ''), { coul: 'rouge', clic: () => ouvrir(app, 'defi') });
  y += hb + 4;
  const nEp = Object.values(app.meta.epreuves || {}).filter((r) => r.gagne).length;
  bouton(g, 't-epreuves', bx, y, bw, hb - 2, 'ÉPREUVES ' + nEp + '/' + EPREUVES.length, { coul: 'bleu', clic: () => ouvrir(app, 'epreuves'), bulle: { titre: 'Épreuves', corps: EPREUVES.length + ' parties scénarisées, dont trois défis à contrainte qui débloquent chacun une carte.' } });
  y += hb + 2;
  bouton(g, 't-atelier', bx, y, bw / 2 - 2, hb - 2, 'ATELIER', { coul: 'violet', clic: () => ouvrir(app, 'atelier'), bulle: { titre: 'Atelier de règles', corps: 'Règle tout : paliers, mains, défausses, scores demandés, emplacements, familles de jokers. Sauve tes profils.' } });
  bouton(g, 't-collection', bx + bw / 2 + 2, y, bw / 2 - 2, hb - 2, 'COLLECTION', { coul: 'vert', clic: () => ouvrir(app, 'collection') });
  y += hb + 2;
  bouton(g, 't-aide', bx, y, bw / 2 - 2, hb - 4, 'COMMENT JOUER', { coul: 'nuit', clic: () => ouvrir(app, 'aide') });
  bouton(g, 't-options', bx + bw / 2 + 2, y, bw / 2 - 2, hb - 4, 'OPTIONS', { coul: 'nuit', clic: () => ouvrir(app, 'pause') });

  // Nouveautés : en or tant qu'elles n'ont pas été lues.
  const neuf = app.meta.nouveautesVues !== VERSION_NOUVEAUTES;
  bouton(g, 't-nouveautes', L - 84, PORTRAIT ? 22 : 28, 76, 16, neuf ? 'NOUVEAUTÉS !' : 'NOUVEAUTÉS', { coul: neuf ? 'or' : 'nuit', ctexte: neuf ? C.noir : C.blanc, clic: () => ouvrir(app, 'nouveautes') });

  const st = app.meta.stats;
  texte(g, st.parties ? st.victoires + ' VICTOIRE' + (st.victoires > 1 ? 'S' : '') + ' · MEILLEUR PALIER ' + st.palierMax + ' · ' + Object.keys(app.meta.decouvert.jokers).length + '/' + JOKERS.length + ' JOKERS' : 'CLIQUE SUR NOUVELLE PARTIE POUR COMMENCER', L / 2, H - 17, { c: C.or2, a: 'c' });
  if (app.horsLigne && !STATIQUE) texte(g, 'SERVEUR ABSENT : SAUVEGARDE DANS LE NAVIGATEUR', L / 2, H - 8, { c: C.rouge2, a: 'c' });
}

// ----------------------------------------------------------------- Démo

function creerDemo(vue) {
  const e = P.nouvellePartie({ graine: 'DEMO2026', regles: REGLES_DEFAUT, date: new Date().toISOString() });
  e.palier = 6;
  e.paliers[6] = { patron: 'tempete', tickets: ['t_rare', 't_astre'], etats: ['battue', 'battue', 'a_venir'], privilege: 'estrade' };
  e.patronsVus = ['corbeau', 'carcan', 'regicide', 'goulot', 'voile', 'tempete'];
  e.mancheIdx = 2;
  e.argent = 37;
  e.privileges = ['main_velours', 'rente', 'grande_manche'];
  e.niveaux.couleur = { niveau: 4, jouees: 23 };
  e.niveaux.quinte_flush = { niveau: 2, jouees: 3 };
  e.niveaux.full = { niveau: 3, jouees: 6 };
  e.niveaux.paire = { niveau: 2, jouees: 9 };
  e.niveaux.brelan = { niveau: 2, jouees: 4 };
  e.stats = Object.assign(e.stats, { mainsJouees: 61, meilleureMain: 48210, meilleureMainType: 'couleur', totalMarque: 291330, defausses: 38, manchesGagnees: 17, astres: 7 });
  ajouterJoker(e, 'entremetteuse', 'irise');
  ajouterJoker(e, 'tisserand');
  ajouterJoker(e, 'sang_bleu');
  const mono = ajouterJoker(e, 'monochrome', 'prisme');
  const mv = ajouterJoker(e, 'madame_velours');
  mv.etat.x = 2.25;
  creerConso(e, null, { id: 'maree', force: true });
  creerConso(e, null, { id: 'fard', force: true });
  // Un paquet travaillé : des Cœurs soignés.
  for (const c of e.paquet) {
    if (c.ens === 'K' && c.rang <= 6) c.ens = 'C';
    if (c.ens === 'C' && c.rang === 14) c.amel = 'cristal';
    if (c.ens === 'C' && c.rang === 13) c.edition = 'brillant';
    if (c.ens === 'C' && c.rang === 12 && !c.sceau) {
      c.amel = 'ardente';
      c.sceau = 'carmin';
    }
    if (c.ens === 'C' && c.rang === 7) c.amel = 'lestee';
    if (c.ens === 'P' && c.rang === 13) c.amel = 'enclume';
    if (c.ens === 'T' && c.rang === 11) c.amel = 'doree';
  }
  e.memoire.derniereMain = 'couleur';
  e.vus.patrons.tempete = 1;
  if (vue === 'boutique' || vue === 'paquet') {
    e.mancheIdx = 2;
    e.paliers[6].etats = ['battue', 'battue', 'a_venir'];
    P.genererBoutique(e);
    e.phase = 'boutique';
    if (vue === 'paquet') P.ouvrirPaquet(e, 'arcanes', 'grand', 'boutique');
    return e;
  }
  if (vue === 'choix') {
    e.mancheIdx = 0;
    e.paliers[6].etats = ['a_venir', 'a_venir', 'a_venir'];
    return e;
  }
  if (vue === 'patron') return e;
  // Vue par défaut : une main prête à marquer contre le patron.
  e.paliers[6].patron = 'rempart';
  P.commencerManche(e);
  const veux = [[14, 'C'], [13, 'C'], [12, 'C'], [9, 'C'], [7, 'C'], [13, 'P'], [11, 'T'], [4, 'T'], [2, 'P']];
  const main = [];
  for (const [r, s] of veux) {
    const c = e.paquet.find((k) => k.rang === r && k.ens === s && !main.includes(k.id));
    if (c) main.push(c.id);
  }
  const tous = e.paquet.map((c) => c.id).filter((id) => !main.includes(id));
  e.main = main;
  e.pioche = tous;
  e.tri = null;
  e.manche.score = 0;
  return e;
}

// ------------------------------------------------------------- Démarrage

async function demarrer() {
  initMoteur();
  let [meta, partie] = await Promise.all([lire('meta'), lire('partie')]);
  // v6 : la clé principale a disparu ou recule nettement ? On repart de la copie tournante.
  const copie = lireCopieMeta();
  if (copie && avancement(copie) > Math.max(0, avancement(meta))) {
    meta = copie;
    app.restauree = true;
  }
  demanderPersistance();
  // v5 : migration de la sauvegarde. Les mêmes clés sont gardées ; une copie de l'original est mise de côté avant tout.
  const mig = migrerMeta(meta);
  if (mig.migree) garderSecours('meta', meta);
  if (partie && partie.version === 1) garderSecours('partie', partie);
  app.meta = mig.meta;
  const s = partie ? P.charger(partie) : null;
  if (!app.demo && (mig.migree || app.restauree)) ecrire('meta', JSON.stringify(app.meta));
  if (!app.demo && s && partie.version !== s.version) ecrire('partie', P.serialiser(s));
  if (s && s.phase !== 'defaite') app.sauvegarde = s;
  const o = app.meta.options;
  reglerMuet(o.muet);
  reglerVolumes({ general: o.volume, musique: o.volMusique, effets: o.volEffets });
  reglerMusique(o.musique);
  M.vitesse = o.vitesse || 1;
  document.body.classList.toggle('sans-crt', !o.crt);
  reglerTapis(o.tapis);
  reglerDeco(o.cartesDeco !== false);
  VISUEL.relief = o.relief !== false;
  SENSATION.tremblement = o.tremblement !== false;
  SENSATION.pause = o.arretImage !== false;
  SENSATION.vibration = o.vibration !== false;
  initInclinaison();

  M.clavier = (touche) => {
    if (app.panneau) {
      if (touche === 'Escape') {
        fermer(app);
        return true;
      }
      return false;
    }
    if (app.ecran === 'jeu') return clavierJeu(app, touche);
    return false;
  };

  if (app.demo) {
    const vue = params.get('vue') || 'score';
    app.etat = creerDemo(vue);
    app.ui = nouvelleUi();
    app.ecran = 'jeu';
    if (vue === 'score') app.ui.sel = app.etat.main.slice(0, 5);
  }
  lancerBoucle((g) => {
    app.accorderMusique();
    if (app.ecran === 'jeu' && app.etat) dessinerJeu(g, app);
    else {
      cacherGuide();
      dessinerTitre(g);
    }
  });

  // Crochets pour les captures automatiques.
  const panneau = params.get('panneau');
  if (panneau) ouvrir(app, panneau, { onglet: params.get('onglet') });
  const auto = params.get('auto');
  if (auto && app.etat) {
    await attendre(500);
    if (auto === 'jouer') actionJouer(app);
    if (auto === 'affronter') lancerManche(app);
  }
  const fige = Number(params.get('fige'));
  if (fige) setTimeout(() => (M.fige = true), fige);
  // Onglet fermé juste après un réglage : on n'attend pas la minuterie, les options partent tout de suite.
  window.addEventListener('pagehide', () => {
    if (app.demo || app.horsLigne) return;
    try {
      fetch('/api/meta', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(app.meta), keepalive: true }).catch(() => {});
    } catch {}
  });
  window.velours = app;
  app.etatSon = etatSon;
  app.niveauSon = niveauSon;
  app.M = M;
}

demarrer();
app.exporterSauvegarde = exporterSauvegarde;
app.importerSauvegarde = importerSauvegarde;

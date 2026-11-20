// La partie : paliers, manches, boutique, paquets. Tout l'état est du JSON pur.

import { etatEpreuve, reglesEpreuve } from './epreuves.js';
import { publicActif, reactionPublic, appliquerPublic, ajouterPublic, prendreRappel } from './public.js';
import { alea, entier, choisir, melanger, pondere, graineAleatoire, normaliserGraine } from './rng.js';
import { MAINS, MAIN, ENSEIGNES, LISTE_AMELIORATIONS, LISTE_SCEAUX, EDITIONS } from './donnees.js';
import {
  REG, mod, tailleMain, mainsParManche, defaussesParManche, placeJoker, placeConso, detteMax, reglesActives,
  nouvelUid, creerCarte, carteParId, note, ajouterJoker, valeurVenteJoker, appeler, retirerJoker, detruireCartes,
  ajouterCarte, tirerJoker, tirerEdition, creerConso, tirerConso, mainLaPlusJouee, chanceBrute, patronActif,
  synergieActive, niveler, nivJoker, peutMonter, NIV_MAX, jokerPermis,
} from './outils.js';
import { JOKER, effectifs } from './jokers.js';
import { CONSO, PRIVILEGES, PRIVILEGE, TICKETS, TICKET, TYPES_PAQUET, TAILLES_PAQUET, contenuPaquet } from './consommables.js';
import { PATRONS, PATRON } from './patrons.js';
import { normaliserRegles, basePalier, construirePaquet, JEU, ENJEUX } from './regles.js';
import { calculerMain, evaluerMain, apportsJokers } from './score.js';

// Format de la partie sauvée. v1 : jusqu'à la v4.1. v2 (Velours 5) : mode zen, duos vus. Une v1 se migre au chargement.
export const VERSION = 2;
export const GAINS_MANCHE = [3, 5, 7];
export const FACTEURS_MANCHE = [1, 1.5, 2];
export const NOMS_MANCHE = ['Petite mise', 'Grande mise', 'Patron'];

function arrondi(v) {
  if (v < 100) return Math.round(v);
  const p = Math.pow(10, Math.floor(Math.log10(v)) - 2);
  return Math.round(v / p) * p;
}

// ------------------------------------------------------------ Création

export function nouvellePartie(opts = {}) {
  const epreuve = opts.epreuve ? etatEpreuve(opts.epreuve) : null;
  const regles = normaliserRegles(epreuve ? reglesEpreuve(opts.epreuve) : opts.regles);
  const etat = {
    version: VERSION,
    graine: normaliserGraine(opts.graine) || graineAleatoire(),
    regles,
    rng: {},
    prochainId: 100,
    palier: 1,
    mancheIdx: 0,
    phase: 'choix',
    argent: regles.argentDepart,
    paquet: [], pioche: [], main: [], defausse: [],
    jokers: [], consommables: [], privileges: [], ticketsBoutique: [],
    niveaux: {},
    manche: null,
    paliers: {},
    patronsVus: [],
    boutique: null,
    paquetOuvert: null,
    encaissement: null,
    stats: { mainsJouees: 0, meilleureMain: 0, totalMarque: 0, cartesJouees: 0, defausses: 0, astres: 0, achats: 0, relances: 0, passes: 0, cartesDetruites: 0, manchesGagnees: 0 },
    memoire: { derniereMain: null },
    public: { jauge: 0, rappels: 0, ovations: 0, rappelsJoues: 0 },
    bonus: {},
    vus: { jokers: {}, consos: {}, patrons: {}, mains: {} },
    verrouilles: opts.verrouilles || [],
    defi: opts.defi || null,
    zen: !!opts.zen, // v5 : mode zen, aucune manche ne se perd
    epreuve,
    atelier: !!opts.atelier,
    tri: 'rang',
    evts: [],
    gagne: false,
    sansFin: false,
    dernierConso: null,
    debut: opts.date || null,
  };
  for (const m of MAINS) etat.niveaux[m.id] = { niveau: 1, jouees: 0 };
  etat.paquet = construirePaquet(etat, regles.jeu);
  // Défis à contrainte (v5) : une enseigne retirée du paquet.
  if (epreuve && epreuve.retirer) etat.paquet = etat.paquet.filter((c) => c.ens !== epreuve.retirer);
  const jeu = JEU[regles.jeu];
  if (jeu.argent) etat.argent += jeu.argent;
  if (jeu.privileges) etat.privileges.push(...jeu.privileges);
  for (let i = 0; i < (jeu.astres || 0); i++) creerConso(etat, 'astre', { force: true });
  for (let i = 0; i < (jeu.ombre || 0); i++) creerConso(etat, 'ombre', { force: true });
  if (etat.defi && etat.defi.depart) {
    const d = etat.defi.depart;
    if (d.argent) etat.argent += d.argent;
    for (const id of d.jokers || []) if (JOKER[id]) ajouterJoker(etat, id);
    for (const id of d.privileges || []) if (PRIVILEGE[id]) etat.privileges.push(id);
    for (const id of d.consos || []) if (CONSO[id]) creerConso(etat, null, { id, force: true });
  }
  if (epreuve && epreuve.depart) {
    const d = epreuve.depart;
    if (d.argent) etat.argent += d.argent;
    for (const id of d.jokers || []) if (JOKER[id]) ajouterJoker(etat, id);
    for (let i = 0; i < (d.astres || 0); i++) creerConso(etat, 'astre', { force: true });
  }
  preparerPalier(etat);
  return etat;
}

function preparerPalier(etat) {
  const p = etat.palier;
  const final = p === etat.regles.paliers || (p > etat.regles.paliers && (p - etat.regles.paliers) % 4 === 0);
  let pool = PATRONS.filter((b) => (final ? b.final : !b.final && b.palierMin <= p) && (!b.besoinPublic || publicActif(etat)));
  const neufs = pool.filter((b) => !etat.patronsVus.includes(b.id));
  if (neufs.length) pool = neufs;
  const patron = choisir(etat, 'patron', pool);
  etat.patronsVus.push(patron.id);
  const tks = TICKETS.filter((t) => (t.palierMin || 1) <= p && (!t.besoinPublic || publicActif(etat)));
  const libres = PRIVILEGES.filter((v) => !etat.privileges.includes(v.id) && (v.palierMin || 1) <= p && (!v.besoinPublic || publicActif(etat)));
  etat.paliers[p] = {
    patron: patron.id,
    tickets: [choisir(etat, 'ticket', tks).id, choisir(etat, 'ticket', tks).id],
    etats: ['a_venir', 'a_venir', 'a_venir'],
    privilege: libres.length ? choisir(etat, 'privilege', libres).id : null,
  };
}

export function infoPalier(etat) {
  return etat.paliers[etat.palier];
}

export function cibleManche(etat, idx) {
  const P = infoPalier(etat);
  const patron = idx === 2 && !reglesActives(etat).sansPatron ? PATRON[P.patron] : null;
  let f = FACTEURS_MANCHE[idx];
  if (patron && patron.facteur) f = patron.facteur;
  let v = basePalier(etat.regles, etat.palier) * f * Math.max(0.1, 1 + mod(etat, 'cible'));
  if (idx === 2) v *= Math.max(0.1, 1 + mod(etat, 'ciblePatron'));
  return Math.max(1, arrondi(v));
}

export function gainManche(etat, idx) {
  if (idx === 0 && mod(etat, 'petiteSansGain')) return 0;
  return GAINS_MANCHE[idx];
}

// ------------------------------------------------------------- Manche

export function commencerManche(etat) {
  if (etat.phase !== 'choix') return { ok: false, raison: 'Pas maintenant.' };
  const idx = etat.mancheIdx;
  const P = infoPalier(etat);
  const patron = idx === 2 ? PATRON[P.patron] : null;
  const m = {
    type: idx,
    patron: patron ? patron.id : null,
    patronAnnule: false,
    cible: 0, cibleInitiale: 0,
    score: 0,
    mains: 0, defausses: 0,
    mainsJouees: 0, defaussesUtilisees: 0,
    typesJoues: [],
    tailleMainMod: 0,
    jokerMuet: null,
    cachees: [],
    dernierTotal: null,
    derniereMain: null,
    // v7 : le crescendo se garde d'une manche à l'autre, comparé à la dernière main jouée.
    crescendo: Math.max(0, etat.crescendo || 0),
    refCrescendo: etat.crescendoRef ?? null,
    souffle: false,
  };
  etat.manche = m;
  if (patron) {
    etat.vus.patrons[patron.id] = 1;
    if (reglesActives(etat).sansPatron) m.patronAnnule = true;
  }
  const actif = patronActif(etat);
  m.cible = cibleManche(etat, idx);
  m.cibleInitiale = m.cible;
  m.mains = Math.max(1, mainsParManche(etat) - (actif && actif.mainsMoins ? actif.mainsMoins : 0));
  m.defausses = actif && actif.sansDefausse ? 0 : defaussesParManche(etat);
  etat.pioche = melanger(etat, 'pioche', etat.paquet.map((c) => c.id));
  etat.main = [];
  etat.defausse = [];
  for (const { j, r } of appeler(etat, 'debutManche')) if (r.texte) note(etat, { t: 'joker', uid: j.uid, txt: r.texte });
  if (actif && actif.baillon) museler(etat);
  etat.phase = 'manche';
  piocher(etat);
  return { ok: true };
}

function museler(etat) {
  const m = etat.manche;
  m.jokerMuet = null;
  if (etat.jokers.length) m.jokerMuet = choisir(etat, 'patron', etat.jokers).uid;
}

export function piocher(etat) {
  const m = etat.manche;
  const actif = m ? patronActif(etat) : null;
  const n = tailleMain(etat);
  const nouvelles = [];
  while (etat.main.length < n && etat.pioche.length) {
    const id = etat.pioche.shift();
    etat.main.push(id);
    nouvelles.push(id);
    const voile = reglesActives(etat);
    const carte = carteParId(etat, id);
    if (m && !m.cachees.includes(id) && ((voile.voile && etat.main.length % voile.voile === 0) || (voile.figuresVoilees && carte.rang >= 11 && carte.rang <= 13))) m.cachees.push(id);
    if (actif && m) {
      const c = carteParId(etat, id);
      if (actif.tetesCachees && c.rang >= 11 && c.rang <= 13) m.cachees.push(id);
      else if (actif.piocheCachee && (m.mainsJouees > 0 || m.defaussesUtilisees > 0)) m.cachees.push(id);
    }
  }
  if (etat.tri) trier(etat, etat.tri);
  return nouvelles;
}

const ORDRE_ENS = { P: 0, C: 1, T: 2, K: 3 };
export function trier(etat, mode) {
  etat.tri = mode;
  const cachees = new Set(etat.manche ? etat.manche.cachees : []);
  const vis = etat.main.filter((id) => !cachees.has(id)).map((id) => carteParId(etat, id));
  const cac = etat.main.filter((id) => cachees.has(id));
  if (mode === 'enseigne') vis.sort((a, b) => ORDRE_ENS[a.ens] - ORDRE_ENS[b.ens] || b.rang - a.rang || a.id - b.id);
  else vis.sort((a, b) => b.rang - a.rang || ORDRE_ENS[a.ens] - ORDRE_ENS[b.ens] || a.id - b.id);
  etat.main = vis.map((c) => c.id).concat(cac);
}

export function deplacerCarte(etat, id, vers) {
  const i = etat.main.indexOf(id);
  if (i < 0) return;
  etat.main.splice(i, 1);
  etat.main.splice(Math.max(0, Math.min(etat.main.length, vers)), 0, id);
}

export function deplacerJoker(etat, uid, vers) {
  const i = etat.jokers.findIndex((j) => j.uid === uid);
  if (i < 0) return;
  const [j] = etat.jokers.splice(i, 1);
  etat.jokers.splice(Math.max(0, Math.min(etat.jokers.length, vers)), 0, j);
}

function cartesDeMain(etat, ids) {
  const set = new Set(ids);
  return etat.main.filter((id) => set.has(id)).map((id) => carteParId(etat, id));
}

// Vérifie qu'une main peut être jouée. Renvoie { ok, raison, type }.
export function verifierMain(etat, ids) {
  const m = etat.manche;
  if (etat.phase !== 'manche' || !m) return { ok: false, raison: 'Pas de manche en cours.' };
  const cartes = cartesDeMain(etat, ids);
  if (cartes.length < 1) return { ok: false, raison: 'Choisis au moins une carte.' };
  if (cartes.length > 5) return { ok: false, raison: '5 cartes au plus.' };
  if (m.mains <= 0) return { ok: false, raison: 'Plus de main.' };
  const actif = patronActif(etat);
  const ev = evaluerMain(etat, cartes);
  const exige = Math.min(5, etat.main.length);
  if (actif && actif.cinqCartes && cartes.length !== exige) return { ok: false, raison: 'Le Carcan exige ' + exige + ' cartes.', type: ev.type };
  return { ok: true, type: ev.type, cartes };
}

// Aperçu fidèle : simule la main sur une copie de l'état.
export function apercu(etat, ids) {
  const v = verifierMain(etat, ids);
  if (!v.type) return null;
  const cachees = new Set(etat.manche.cachees);
  if (ids.some((id) => cachees.has(id))) return { type: null, cache: true, ok: v.ok, raison: v.raison };
  const copie = JSON.parse(JSON.stringify(etat, (k, val) => (k === 'evts' ? [] : val)));
  const set = new Set(ids);
  const jouees = copie.main.filter((id) => set.has(id)).map((id) => carteParId(copie, id));
  const enMain = copie.main.filter((id) => !set.has(id)).map((id) => carteParId(copie, id));
  copie.manche.mains--;
  const r = calculerMain(copie, jouees, enMain, { apercu: true });
  return { type: r.type, niveau: r.niveau, jetons: r.jetons, multi: r.multi, total: r.total, incertain: r.incertain, ok: v.ok, raison: v.raison, marquantes: r.marquantes, annulee: !!r.annulee, apports: apportsJokers(r.evts) };
}

// Met à jour le crescendo de la manche après une main de total donné.
// Renvoie { avant, apres, monte, rompu, souffle, louis } pour l'interface.
export const CRESCENDO_MAX = 5;
export function majCrescendo(etat, total) {
  const m = etat.manche;
  const avant = m.crescendo || 0;
  const r = { avant, apres: avant, monte: false, rompu: false, souffle: false, louis: 0 };
  const ref = m.refCrescendo;
  m.refCrescendo = total;
  etat.crescendoRef = total;
  if (ref == null) return r;
  if (total > ref) {
    r.apres = Math.min(CRESCENDO_MAX, avant + 1);
    r.monte = r.apres > avant;
  } else if (avant > 0) {
    // La Souffleuse rattrape une main plus faible, une fois par manche.
    if (!m.souffle && etat.jokers.some((j) => j.uid !== m.jokerMuet && JOKER[j.id] && JOKER[j.id].souffle)) {
      m.souffle = true;
      r.souffle = true;
    } else {
      // v7 : une main plus faible fait redescendre de deux marches ; une seule avec l'Orchestre (v6).
      const recul = synergieActive(etat, 'orchestre') ? 1 : 2;
      r.apres = Math.max(0, avant - recul);
      r.recule = r.apres > 0;
      r.rompu = r.apres === 0;
    }
  }
  m.crescendo = r.apres;
  etat.crescendo = r.apres;
  if (etat.stats) etat.stats.crescendoMax = Math.max(etat.stats.crescendoMax || 0, r.apres);
  if (r.monte) {
    for (const j of etat.jokers) {
      const d = JOKER[j.id];
      if (d && d.crescendoMonte && j.uid !== m.jokerMuet) r.louis += d.crescendoMonte(etat, j, r.apres) || 0;
    }
    if (synergieActive(etat, 'orchestre')) r.louis += 1;
    // v7 : l'apothéose (marche 5) paie 5 louis la première fois de la manche.
    if (r.apres === CRESCENDO_MAX && !m.apotheose) {
      m.apotheose = true;
      r.apotheose = true;
      r.louis += 5;
    }
    etat.argent += r.louis;
  }
  return r;
}

export function jouerMain(etat, ids) {
  const v = verifierMain(etat, ids);
  if (!v.ok) return v;
  const m = etat.manche;
  const actif = patronActif(etat);
  const cartes = v.cartes;
  const set = new Set(cartes.map((c) => c.id));
  const enMain = etat.main.filter((id) => !set.has(id)).map((id) => carteParId(etat, id));
  m.mains--;
  let taxe = 0;
  if (actif && actif.percepteur) {
    taxe = Math.min(cartes.length, Math.max(0, etat.argent + detteMax(etat)));
    etat.argent -= taxe;
  }
  m.cachees = m.cachees.filter((id) => !set.has(id));
  etat.niveaux[v.type].jouees++;
  etat.vus.mains[v.type] = 1;

  const R = calculerMain(etat, cartes, enMain);

  // Carnet de la troupe : chaque joker présent retient ses mains et sa meilleure.
  const troupe = etat.stats.troupe || (etat.stats.troupe = {});
  for (const j of etat.jokers) {
    const t = troupe[j.id] || (troupe[j.id] = { mains: 0, meilleure: 0 });
    t.mains++;
    if (R.total > t.meilleure) t.meilleure = R.total;
  }

  // Le public réagit, d'après les mains déjà jouées dans la manche.
  const salle = publicActif(etat) ? appliquerPublic(etat, reactionPublic(etat, R.type, R.total)) : null;

  // Le crescendo : chaque main qui bat la précédente de la manche gravit une marche.
  const crescendo = majCrescendo(etat, R.total);

  m.mainsJouees++;
  m.typesJoues.push(R.type);
  m.derniereMain = R.type;
  m.dernierTotal = R.total;
  const scoreAvant = m.score;
  if (actif && actif.juge) m.score = Math.max(m.score, R.total);
  else m.score += R.total;
  etat.stats.mainsJouees++;
  etat.stats.cartesJouees += cartes.length;
  etat.stats.totalMarque += R.total;
  if (R.total > etat.stats.meilleureMain) {
    etat.stats.meilleureMain = R.total;
    etat.stats.meilleureMainType = R.type;
  }
  noterJournal(etat, R, cartes);

  // Les cartes jouées partent à la défausse, les détruites disparaissent.
  etat.main = etat.main.filter((id) => !set.has(id));
  etat.defausse.push(...cartes.map((c) => c.id));
  const parRaison = {};
  for (const d of R.detruites) (parRaison[d.raison] = parRaison[d.raison] || []).push(d.id);
  for (const raison of Object.keys(parRaison)) detruireCartes(etat, parRaison[raison], raison);
  for (const uid of R.jokersDetruits) retirerJoker(etat, uid);

  const out = { ok: true, resultat: R, jouees: cartes.map((c) => c.id), scoreAvant, taxe, issue: 'continue', effetsPatron: [], public: salle, rappel: false, crescendo };

  if (m.score >= m.cible) {
    out.issue = 'gagne';
    gagnerManche(etat);
    return out;
  }
  // À court de mains : un rappel en réserve offre une main de plus, avant tout sauvetage.
  if (m.mains <= 0 && prendreRappel(etat)) {
    m.mains = 1;
    out.rappel = true;
  }
  // Mode zen (v5) : à court de mains, la manche passe quand même, sans bonus.
  if (m.mains <= 0 && etat.zen) {
    out.issue = 'sauve';
    out.zen = true;
    gagnerManche(etat, { sauve: true });
    return out;
  }
  if (m.mains <= 0) {
    const sauveur = appeler(etat, 'sauvetage').find((x) => x.r === true);
    if (sauveur) {
      retirerJoker(etat, sauveur.j.uid);
      out.issue = 'sauve';
      out.sauveur = sauveur.j.id;
      gagnerManche(etat, { sauve: true });
      return out;
    }
    out.issue = 'perdu';
    etat.phase = 'defaite';
    return out;
  }
  // Effets du patron entre deux mains.
  if (actif) {
    if (actif.phases === 2 && scoreAvant * 2 < m.cible && m.score * 2 >= m.cible) out.effetsPatron.push('Les masques tournent : noires affaiblies');
    if (actif.sablier) {
      m.tailleMainMod--;
      out.effetsPatron.push('La main rétrécit');
    }
    if (actif.glouton && etat.main.length) {
      const avale = melanger(etat, 'patron', etat.main).slice(0, actif.glouton);
      etat.main = etat.main.filter((id) => !avale.includes(id));
      etat.defausse.push(...avale);
      out.avalees = avale;
      out.effetsPatron.push('Le Glouton avale ' + avale.length + ' carte' + (avale.length > 1 ? 's' : ''));
    }
    if (actif.tempete && etat.jokers.length > 1) {
      etat.jokers = melanger(etat, 'patron', etat.jokers);
      out.effetsPatron.push('Jokers mélangés');
    }
    if (actif.baillon) museler(etat);
  }
  piocher(etat);
  if (!etat.main.length && etat.zen) {
    out.issue = 'sauve';
    out.zen = true;
    gagnerManche(etat, { sauve: true });
    return out;
  }
  if (!etat.main.length) {
    out.issue = 'perdu';
    etat.phase = 'defaite';
  }
  return out;
}

export function defausser(etat, ids) {
  const m = etat.manche;
  if (etat.phase !== 'manche' || !m) return { ok: false, raison: 'Pas de manche en cours.' };
  const cartes = cartesDeMain(etat, ids);
  if (cartes.length < 1) return { ok: false, raison: 'Choisis au moins une carte.' };
  if (cartes.length > 5) return { ok: false, raison: '5 cartes au plus.' };
  if (m.defausses <= 0) return { ok: false, raison: 'Plus de défausse.' };
  const actif = patronActif(etat);
  const premiere = m.defaussesUtilisees === 0;
  m.defausses--;
  m.defaussesUtilisees++;
  etat.stats.defausses++;
  const set = new Set(cartes.map((c) => c.id));
  m.cachees = m.cachees.filter((id) => !set.has(id));
  const detruire = [];
  for (const { j, r } of appeler(etat, 'defausse', cartes, { premiere })) {
    if (r.argent) etat.argent += r.argent;
    if (r.detruire) detruire.push(...r.detruire);
    if (r.texte) note(etat, { t: 'joker', uid: j.uid, txt: r.texte });
  }
  for (const c of cartes) {
    if (c.sceau === 'lilas' && creerConso(etat, 'arcane')) note(etat, { t: 'carte', id: c.id, txt: 'Arcane' });
  }
  etat.main = etat.main.filter((id) => !set.has(id));
  etat.defausse.push(...cartes.map((c) => c.id));
  if (detruire.length) detruireCartes(etat, detruire, 'joker');
  if (actif && actif.inflation) {
    m.cible += Math.ceil(m.cibleInitiale * actif.inflation);
  }
  piocher(etat);
  // Plus aucune carte à jouer : la manche est perdue.
  if (!etat.main.length) etat.phase = 'defaite';
  return { ok: true, defaussees: cartes.map((c) => c.id), detruites: detruire, perdu: etat.phase === 'defaite' };
}

function gagnerManche(etat, opts = {}) {
  const m = etat.manche;
  const P = infoPalier(etat);
  const info = { mainsJouees: m.mainsJouees, score: m.score, cible: m.cible, type: m.type, patron: !!m.patron };
  const lignes = [];
  // Privilège Abonnés : la salle se remplit à chaque manche gagnée.
  if (publicActif(etat) && mod(etat, 'publicManche')) ajouterPublic(etat, mod(etat, 'publicManche'));
  const g = gainManche(etat, m.type);
  lignes.push({ label: m.type === 2 ? 'Patron battu' : NOMS_MANCHE[m.type] + ' battue', montant: g });
  if (m.mains > 0 && !mod(etat, 'sansBonusMains')) lignes.push({ label: 'Mains restantes (' + m.mains + ')', montant: m.mains });
  // Jeu du Parrain (v4) : chaque main jouée rapporte.
  const parMain = mod(etat, 'argentMain');
  if (parMain > 0 && info.mainsJouees > 0) lignes.push({ label: 'Le Parrain (' + info.mainsJouees + ' main' + (info.mainsJouees > 1 ? 's' : '') + ')', montant: parMain * info.mainsJouees });
  const dorees = etat.main.map((id) => carteParId(etat, id)).filter((c) => c && c.amel === 'doree').length;
  if (dorees) lignes.push({ label: 'Cartes Dorées (' + dorees + ')', montant: 3 * dorees });
  for (let i = 0; i < etat.jokers.length; i++) {
    const j = etat.jokers[i];
    if (j.uid === m.jokerMuet) continue;
    let total = 0;
    for (const { def, inst } of effectifs(etat.jokers, i)) if (def.gain) total += (niveler({ argent: def.gain(etat, inst, info) || 0 }, inst).argent) || 0;
    if (total > 0) lignes.push({ label: JOKER[j.id].nom, montant: total, uid: j.uid });
  }
  // v6 : synergie du Casse du siècle.
  if (synergieActive(etat, 'casse')) lignes.push({ label: 'Le Casse du siècle', montant: 4 });
  const plafond = Math.max(0, etat.regles.interetMax + mod(etat, 'interetMax'));
  const interets = Math.min(plafond, Math.floor(Math.max(0, etat.argent) / etat.regles.interetPar));
  if (interets > 0) lignes.push({ label: 'Intérêts (1 par ' + etat.regles.interetPar + ' louis)', montant: interets });

  // Sceaux azur : un Astre de la dernière main.
  for (const id of etat.main) {
    const c = carteParId(etat, id);
    if (c && c.sceau === 'azur' && m.derniereMain && creerConso(etat, null, { id: MAIN[m.derniereMain].astre })) {
      note(etat, { t: 'info', txt: 'Sceau azur : un Astre' });
    }
  }
  for (const { j, r } of appeler(etat, 'finManche', info)) if (r.texte) note(etat, { t: 'joker', uid: j.uid, txt: r.texte });
  if (m.type === 2) for (const { j, r } of appeler(etat, 'patronVaincu')) if (r.texte) note(etat, { t: 'joker', uid: j.uid, txt: r.texte });

  etat.memoire.derniereMain = m.derniereMain;
  etat.stats.manchesGagnees++;
  etat.encaissement = { lignes, total: lignes.reduce((s, l) => s + l.montant, 0), sauve: !!opts.sauve };
  P.etats[m.type] = 'battue';
  etat.main = [];
  etat.pioche = [];
  etat.defausse = [];
  m.jokerMuet = null;
  m.cachees = [];
  if (m.type === 2 && etat.palier >= etat.regles.paliers && !etat.gagne) {
    etat.gagne = true;
    etat.phase = 'victoire';
  } else etat.phase = 'encaissement';
}

export function continuerApresVictoire(etat) {
  if (etat.phase !== 'victoire') return;
  etat.sansFin = true;
  etat.phase = 'encaissement';
}

export function encaisser(etat) {
  if (etat.phase !== 'encaissement' || !etat.encaissement) return { ok: false };
  const m = etat.manche;
  etat.argent += etat.encaissement.total;
  etat.encaissement = null;
  if (m.type === 2) {
    etat.palier++;
    etat.mancheIdx = 0;
    preparerPalier(etat);
  } else etat.mancheIdx = m.type + 1;
  etat.manche = null;
  genererBoutique(etat);
  etat.phase = 'boutique';
  return { ok: true };
}

export function passerManche(etat) {
  if (etat.phase !== 'choix' || etat.mancheIdx > 1) return { ok: false, raison: 'Le patron ne se passe pas.' };
  const P = infoPalier(etat);
  const idx = etat.mancheIdx;
  const t = TICKET[P.tickets[idx]];
  P.etats[idx] = 'passee';
  etat.mancheIdx++;
  etat.stats.passes++;
  for (const { j, r } of appeler(etat, 'passe')) if (r.texte) note(etat, { t: 'joker', uid: j.uid, txt: r.texte });
  if (t.immediat) t.immediat(etat);
  else if (t.boutique) etat.ticketsBoutique.push(t.id);
  else if (t.paquet) ouvrirPaquet(etat, t.paquet[0], t.paquet[1], 'choix');
  return { ok: true, ticket: t.id };
}

// ------------------------------------------------------------ Boutique

export function prixBoutique(etat, base) {
  const p = (base + mod(etat, 'surcout')) * (1 - Math.min(0.9, mod(etat, 'remise')));
  return Math.max(1, Math.round(p));
}

function articleJoker(etat, opts = {}) {
  const exclus = etat.boutique ? etat.boutique.articles.filter((a) => a.sorte === 'joker').map((a) => a.id) : [];
  const d = tirerJoker(etat, 'boutique', { rarete: opts.rarete, exclus });
  const edition = opts.edition !== undefined ? opts.edition : tirerEdition(etat, 'boutique');
  return { uid: nouvelUid(etat), sorte: 'joker', id: d.id, edition, base: d.prix + (edition ? EDITIONS[edition].prix : 0), gratuit: !!opts.gratuit };
}

// v6 : un joker de ta rangée peut revenir en boutique. L'acheter le fait monter de niveau (sans prendre de place).
export const PART_DOUBLON = 0.16;
export function jokersMontables(etat) {
  return etat.jokers.filter((j) => nivJoker(j) < NIV_MAX && peutMonter(JOKER[j.id]) && !(JOKER[j.id] && JOKER[j.id].pousse));
}
function articleDoublon(etat) {
  const deja = etat.boutique ? etat.boutique.articles.map((a) => a.id) : [];
  const pool = jokersMontables(etat).filter((j) => !deja.includes(j.id) && jokerPermis(etat, JOKER[j.id]));
  if (!pool.length || alea(etat, 'doublon') >= PART_DOUBLON) return null;
  const j = choisir(etat, 'doublon', pool);
  return { uid: nouvelUid(etat), sorte: 'joker', id: j.id, edition: null, base: JOKER[j.id].prix, gratuit: false, doublon: true };
}
// Le joker de la rangée qu'un article ferait monter (doublon), ou null.
export function cibleDoublon(etat, a) {
  if (!a || a.sorte !== 'joker') return null;
  return etat.jokers.find((j) => j.id === a.id && nivJoker(j) < NIV_MAX && peutMonter(JOKER[j.id]) && !JOKER[j.id].pousse) || null;
}

// v6 : la répétition, une par boutique. Le joker choisi monte d'un niveau.
export function prixNiveau(etat, j) {
  const d = JOKER[j.id];
  return prixBoutique(etat, (d ? d.prix : 4) + 4 * nivJoker(j));
}
export function peutRepeter(etat, j) {
  const b = etat.boutique;
  if (etat.phase !== 'boutique' || !b || !j) return { ok: false, raison: 'Seulement en boutique.' };
  if (b.repetee) return { ok: false, raison: 'Une seule répétition par boutique.' };
  const d = JOKER[j.id];
  if (!peutMonter(d) || (d && d.pousse)) return { ok: false, raison: 'Ce joker ne monte pas de niveau.' };
  if (nivJoker(j) >= NIV_MAX) return { ok: false, raison: 'Déjà au niveau maximum.' };
  return { ok: true };
}
export function monterJoker(etat, uid) {
  const j = etat.jokers.find((k) => k.uid === uid);
  const v = peutRepeter(etat, j);
  if (!v.ok) return v;
  const prix = prixNiveau(etat, j);
  if (!peutPayer(etat, prix)) return { ok: false, raison: 'Pas assez de louis.' };
  etat.argent -= prix;
  etat.boutique.repetee = true;
  j.niv = nivJoker(j) + 1;
  j.bonusVente = (j.bonusVente || 0) + 1;
  etat.stats.niveaux = (etat.stats.niveaux || 0) + 1;
  return { ok: true, niv: j.niv };
}

// v6 : la retouche, une par boutique : choisis une carte de ton paquet parmi quatre, elle gagne un niveau
// (+15 jetons et +2 multi par niveau quand elle marque, 3 niveaux au plus).
export const RETOUCHE_MAX = 3;
export function prixRetouche(etat) {
  return prixBoutique(etat, 5);
}
export function peutRetoucher(etat) {
  const b = etat.boutique;
  if (etat.phase !== 'boutique' || !b) return { ok: false, raison: 'Seulement en boutique.' };
  if (b.retouchee) return { ok: false, raison: 'Une seule retouche par boutique.' };
  if (!etat.paquet.some((c) => (c.niv || 0) < RETOUCHE_MAX)) return { ok: false, raison: 'Toutes tes cartes sont au maximum.' };
  return { ok: true };
}
export function acheterRetouche(etat) {
  const v = peutRetoucher(etat);
  if (!v.ok) return v;
  const prix = prixRetouche(etat);
  if (!peutPayer(etat, prix)) return { ok: false, raison: 'Pas assez de louis.' };
  etat.argent -= prix;
  etat.boutique.retouchee = true;
  const pool = melanger(etat, 'retouche', etat.paquet.filter((c) => (c.niv || 0) < RETOUCHE_MAX).map((c) => c.id));
  const choix = pool.slice(0, 4).map((id) => ({ uid: nouvelUid(etat), sorte: 'retouche', carteId: id }));
  etat.paquetOuvert = { type: 'retouche', taille: 'petit', choix, restant: 1, retour: 'boutique' };
  etat.phase = 'paquet';
  return { ok: true };
}

function tirerArticle(etat) {
  const ombres = 2 * (1 + mod(etat, 'ombresX'));
  const sorte = pondere(etat, 'boutique', ['joker', 'arcane', 'astre', 'ombre'], (s) => ({ joker: 70, arcane: 15, astre: 13, ombre: ombres })[s]);
  if (sorte === 'joker') return articleDoublon(etat) || articleJoker(etat);
  const exclus = etat.boutique ? etat.boutique.articles.filter((a) => a.sorte === 'conso').map((a) => a.id) : [];
  const d = tirerConso(etat, sorte, 'boutique', exclus);
  return { uid: nouvelUid(etat), sorte: 'conso', id: d.id, base: d.prix };
}

function tirerPaquet(etat) {
  const types = Object.keys(TYPES_PAQUET);
  const type = pondere(etat, 'boutique', types, (t) => TYPES_PAQUET[t].poids * (t === 'ombres' ? 1 + mod(etat, 'ombresX') : 1));
  const taille = pondere(etat, 'boutique', ['petit', 'grand', 'immense'], (t) => ({ petit: 5, grand: 3, immense: 1 })[t]);
  return { uid: nouvelUid(etat), type, taille, base: TAILLES_PAQUET[taille].prix };
}

export function nbArticles(etat) {
  return Math.max(1, 2 + mod(etat, 'emplBoutique'));
}

export function genererBoutique(etat) {
  const P = infoPalier(etat);
  const b = {
    articles: [], paquets: [],
    privilege: P.privilege && !etat.privileges.includes(P.privilege) ? P.privilege : null,
    relances: 0,
    relancesGratuites: mod(etat, 'relancesGratuites'),
    relancesInfinies: false,
    paquetGratuit: mod(etat, 'paquetGratuit') > 0,
  };
  etat.boutique = b;
  const tickets = etat.ticketsBoutique;
  etat.ticketsBoutique = [];
  if (tickets.includes('t_rare')) b.articles.push(articleJoker(etat, { rarete: 'R', gratuit: true }));
  if (tickets.includes('t_peu_commun')) b.articles.push(articleJoker(etat, { rarete: 'U', gratuit: true }));
  if (tickets.includes('t_inverte')) b.articles.push(articleJoker(etat, { edition: 'inverte' }));
  if (tickets.includes('t_relance')) b.relancesInfinies = true;
  const n = nbArticles(etat);
  while (b.articles.length < n) b.articles.push(tirerArticle(etat));
  // La toute première boutique montre toujours au moins un joker.
  if (etat.stats.manchesGagnees <= 1 && !b.articles.some((a) => a.sorte === 'joker')) b.articles[0] = articleJoker(etat);
  if (tickets.includes('t_eclat')) {
    let a = b.articles.find((x) => x.sorte === 'joker' && !x.edition);
    if (!a) {
      a = articleJoker(etat, { edition: null });
      b.articles[b.articles.length - 1] = a;
    }
    a.edition = choisir(etat, 'boutique', ['brillant', 'irise', 'prisme']);
    a.gratuit = true;
  }
  b.paquets = [tirerPaquet(etat), tirerPaquet(etat)];
  return b;
}

export function prixArticle(etat, a) {
  return a.gratuit ? 0 : prixBoutique(etat, a.base);
}
export function prixPaquet(etat, p) {
  const b = etat.boutique;
  if (b && b.paquetGratuit) return 0;
  return prixBoutique(etat, p.base);
}
export function prixPrivilege(etat, id) {
  return prixBoutique(etat, PRIVILEGE[id].prix);
}
export function prixRelance(etat) {
  const b = etat.boutique;
  if (!b) return 0;
  if (b.relancesInfinies || b.relancesGratuites > 0) return 0;
  return Math.max(0, etat.regles.coutRelance - mod(etat, 'relanceMoins') + b.relances);
}
export function peutPayer(etat, prix) {
  return etat.argent - prix >= -detteMax(etat) || prix === 0;
}

export function acheterArticle(etat, uid) {
  const b = etat.boutique;
  if (etat.phase !== 'boutique' || !b) return { ok: false, raison: 'Pas de boutique.' };
  const i = b.articles.findIndex((a) => a.uid === uid);
  if (i < 0) return { ok: false, raison: 'Article introuvable.' };
  const a = b.articles[i];
  const prix = prixArticle(etat, a);
  if (!peutPayer(etat, prix)) return { ok: false, raison: 'Pas assez de louis.' };
  const cible = cibleDoublon(etat, a);
  if (cible) {
    // v6 : doublon, le joker de ta rangée monte de niveau.
    etat.argent -= prix;
    cible.niv = nivJoker(cible) + 1;
    cible.bonusVente = (cible.bonusVente || 0) + 1;
    if (a.edition && !cible.edition) cible.edition = a.edition;
    etat.stats.niveaux = (etat.stats.niveaux || 0) + 1;
    b.articles.splice(i, 1);
    etat.stats.achats++;
    return { ok: true, monte: cible.uid, niv: cible.niv };
  }
  if (a.sorte === 'joker') {
    if (a.edition !== 'inverte' && !placeJoker(etat)) return { ok: false, raison: 'Plus de place pour un joker.' };
    etat.argent -= prix;
    ajouterJoker(etat, a.id, a.edition);
  } else {
    if (!placeConso(etat)) return { ok: false, raison: 'Plus de place pour un consommable.' };
    etat.argent -= prix;
    creerConso(etat, null, { id: a.id });
  }
  b.articles.splice(i, 1);
  etat.stats.achats++;
  return { ok: true };
}

export function vendreJoker(etat, uid) {
  const i = etat.jokers.findIndex((j) => j.uid === uid);
  if (i < 0) return { ok: false };
  const j = etat.jokers[i];
  const v = valeurVenteJoker(etat, j);
  const d = JOKER[j.id];
  if (d && d.vente) d.vente(etat, j, i);
  etat.jokers.splice(i, 1);
  etat.argent += v;
  if (etat.manche && etat.manche.jokerMuet === uid) etat.manche.jokerMuet = null;
  return { ok: true, valeur: v };
}

export function valeurVenteConso(etat, c) {
  return Math.max(1, Math.floor(CONSO[c.id].prix / 2));
}
export function vendreConso(etat, uid) {
  const i = etat.consommables.findIndex((c) => c.uid === uid);
  if (i < 0) return { ok: false };
  const v = valeurVenteConso(etat, etat.consommables[i]);
  etat.consommables.splice(i, 1);
  etat.argent += v;
  return { ok: true, valeur: v };
}

export function relancer(etat) {
  const b = etat.boutique;
  if (etat.phase !== 'boutique' || !b) return { ok: false };
  const prix = prixRelance(etat);
  if (!peutPayer(etat, prix)) return { ok: false, raison: 'Pas assez de louis.' };
  etat.argent -= prix;
  if (!b.relancesInfinies) {
    if (b.relancesGratuites > 0) b.relancesGratuites--;
    else b.relances++;
  }
  etat.stats.relances++;
  b.articles = [];
  const n = nbArticles(etat);
  while (b.articles.length < n) b.articles.push(tirerArticle(etat));
  return { ok: true };
}

export function acheterPrivilege(etat) {
  const b = etat.boutique;
  if (etat.phase !== 'boutique' || !b || !b.privilege) return { ok: false };
  const prix = prixPrivilege(etat, b.privilege);
  if (!peutPayer(etat, prix)) return { ok: false, raison: 'Pas assez de louis.' };
  etat.argent -= prix;
  etat.privileges.push(b.privilege);
  const P = infoPalier(etat);
  if (P.privilege === b.privilege) P.privilege = null;
  b.privilege = null;
  etat.stats.achats++;
  return { ok: true };
}

export function acheterPaquet(etat, uid) {
  const b = etat.boutique;
  if (etat.phase !== 'boutique' || !b) return { ok: false };
  const i = b.paquets.findIndex((p) => p.uid === uid);
  if (i < 0) return { ok: false };
  const p = b.paquets[i];
  const prix = prixPaquet(etat, p);
  if (!peutPayer(etat, prix)) return { ok: false, raison: 'Pas assez de louis.' };
  etat.argent -= prix;
  if (b.paquetGratuit) b.paquetGratuit = false;
  b.paquets.splice(i, 1);
  etat.stats.achats++;
  ouvrirPaquet(etat, p.type, p.taille, 'boutique');
  return { ok: true };
}

export function quitterBoutique(etat) {
  if (etat.phase !== 'boutique') return { ok: false };
  for (const { j, r } of appeler(etat, 'finBoutique')) if (r.texte) note(etat, { t: 'joker', uid: j.uid, txt: r.texte });
  etat.boutique = null;
  etat.phase = 'choix';
  return { ok: true };
}

// ------------------------------------------------------------- Paquets

export function carteAleatoire(etat, flux) {
  const c = creerCarte(etat, 2 + entier(etat, flux, 13), choisir(etat, flux, ENSEIGNES));
  if (alea(etat, flux) < 0.4) c.amel = choisir(etat, flux, LISTE_AMELIORATIONS);
  const ed = tirerEdition(etat, flux, 2);
  if (ed && ed !== 'inverte') c.edition = ed;
  if (alea(etat, flux) < 0.15) c.sceau = choisir(etat, flux, LISTE_SCEAUX);
  return c;
}

export function ouvrirPaquet(etat, type, taille, retour) {
  const { montre, prend } = contenuPaquet(type, taille);
  const choix = [];
  const ids = [];
  for (let i = 0; i < montre; i++) {
    if (type === 'cartes') choix.push({ uid: nouvelUid(etat), sorte: 'carte', carte: carteAleatoire(etat, 'paquet') });
    else if (type === 'jokers') {
      const d = tirerJoker(etat, 'paquet', { exclus: ids });
      ids.push(d.id);
      choix.push({ uid: nouvelUid(etat), sorte: 'joker', id: d.id, edition: tirerEdition(etat, 'paquet') });
    } else {
      const cat = { arcanes: 'arcane', astres: 'astre', ombres: 'ombre' }[type];
      let d = null;
      if (cat === 'astre' && i === 0 && mod(etat, 'telescope')) {
        const fav = mainLaPlusJouee(etat);
        if (fav) d = CONSO[MAIN[fav].astre];
      }
      if (!d) d = tirerConso(etat, cat, 'paquet', ids);
      ids.push(d.id);
      choix.push({ uid: nouvelUid(etat), sorte: 'conso', id: d.id });
    }
  }
  etat.paquetOuvert = { type, taille, choix, restant: prend, retour };
  // Arcanes et Ombres s'appliquent à des cartes : on pioche une main d'essai.
  if (type === 'arcanes' || type === 'ombres') {
    etat.pioche = melanger(etat, 'paquet', etat.paquet.map((c) => c.id));
    etat.main = [];
    piocher(etat);
  }
  etat.phase = 'paquet';
  const chance = (n, d) => chanceBrute(etat, n, d);
  for (const { j, r } of appeler(etat, 'paquet', chance)) if (r.texte) note(etat, { t: 'joker', uid: j.uid, txt: r.texte });
}

function fermerPaquet(etat) {
  const p = etat.paquetOuvert;
  etat.main = [];
  etat.pioche = [];
  etat.paquetOuvert = null;
  etat.phase = p ? p.retour : 'boutique';
}

export function passerPaquet(etat) {
  if (etat.phase !== 'paquet') return { ok: false };
  fermerPaquet(etat);
  return { ok: true };
}

// Prend un choix du paquet. selIds : cartes visées. garder : range le consommable au lieu de l'utiliser.
export function choisirDansPaquet(etat, uid, selIds = [], garder = false) {
  const p = etat.paquetOuvert;
  if (etat.phase !== 'paquet' || !p) return { ok: false };
  const i = p.choix.findIndex((c) => c.uid === uid);
  if (i < 0) return { ok: false };
  const c = p.choix[i];
  let res = null;
  if (c.sorte === 'carte') {
    ajouterCarte(etat, c.carte);
  } else if (c.sorte === 'retouche') {
    const k = carteParId(etat, c.carteId);
    if (k) k.niv = Math.min(RETOUCHE_MAX, (k.niv || 0) + 1);
    res = { carte: c.carteId, niv: k ? k.niv : 0 };
  } else if (c.sorte === 'joker') {
    if (c.edition !== 'inverte' && !placeJoker(etat)) return { ok: false, raison: 'Plus de place pour un joker.' };
    ajouterJoker(etat, c.id, c.edition);
  } else if (garder) {
    if (!placeConso(etat)) return { ok: false, raison: 'Plus de place pour un consommable.' };
    creerConso(etat, null, { id: c.id });
  } else {
    const v = peutUtiliser(etat, CONSO[c.id], selIds);
    if (!v.ok) return v;
    res = appliquerConso(etat, CONSO[c.id], selIds);
  }
  p.choix.splice(i, 1);
  p.restant--;
  if (p.restant <= 0 || !p.choix.length) fermerPaquet(etat);
  return { ok: true, res };
}

// -------------------------------------------------------- Consommables

export function peutUtiliser(etat, def, selIds = []) {
  if (!def) return { ok: false, raison: 'Inconnu.' };
  if (def.max > 0) {
    const sel = cartesDeMain(etat, selIds);
    if (!etat.main.length) return { ok: false, raison: 'Il faut des cartes en main.' };
    if (sel.length < def.min || sel.length > def.max) {
      return { ok: false, raison: def.min === def.max ? 'Choisis ' + def.min + ' carte' + (def.min > 1 ? 's' : '') + '.' : 'Choisis de ' + def.min + ' à ' + def.max + ' cartes.' };
    }
  }
  if (def.peut && !def.peut(etat)) return { ok: false, raison: 'Impossible pour le moment.' };
  return { ok: true };
}

function appliquerConso(etat, def, selIds) {
  const sel = cartesDeMain(etat, selIds);
  const res = def.utiliser(etat, sel) || {};
  if ((def.cat === 'arcane' || def.cat === 'astre') && def.id !== 'redite') etat.dernierConso = def.id;
  etat.stats.consos = (etat.stats.consos || 0) + 1;
  etat.vus.consos[def.id] = 1;
  if (etat.tri && etat.main.length) trier(etat, etat.tri);
  return res;
}

export function utiliserConso(etat, uid, selIds = []) {
  const i = etat.consommables.findIndex((c) => c.uid === uid);
  if (i < 0) return { ok: false };
  const def = CONSO[etat.consommables[i].id];
  const v = peutUtiliser(etat, def, selIds);
  if (!v.ok) return v;
  etat.consommables.splice(i, 1);
  const res = appliquerConso(etat, def, selIds);
  return { ok: true, res, def };
}

// ---------------------------------------------------------- Sauvegarde

export function serialiser(etat) {
  return JSON.stringify(etat, (k, v) => (k === 'evts' ? [] : v));
}
export function charger(json) {
  const e = typeof json === 'string' ? JSON.parse(json) : json;
  if (!e || typeof e !== 'object') return null;
  if (e.version === 1) migrerPartie(e);
  if (e.version !== VERSION) return null;
  e.evts = [];
  return e;
}

// v1 vers v2 : on ajoute seulement ce qui manque, rien n'est retiré ni remis à zéro.
export function migrerPartie(e) {
  if (!e || e.version !== 1) return e;
  if (e.zen === undefined) e.zen = false;
  if (!e.vus || typeof e.vus !== 'object') e.vus = { jokers: {}, consos: {}, patrons: {}, mains: {} };
  if (!e.vus.duos) e.vus.duos = {};
  if (e.manche && !Array.isArray(e.manche.cachees)) e.manche.cachees = [];
  e.version = 2;
  return e;
}

// v7 : le journal de partie. La plus grosse main (avec ses cartes) et le plus beau combo (le plus de jokers déclenchés ensemble).
const SYMB_ENS = { P: '♠', C: '♥', K: '♦', T: '♣' };
const LETTRE = { 11: 'V', 12: 'D', 13: 'R', 14: 'A' };
function noterJournal(etat, R, cartes) {
  const J = etat.stats.journal || (etat.stats.journal = {});
  const ids = [];
  for (const ev of R.evts || []) {
    if (ev.t !== 'joker' || ev.uid == null) continue;
    const j = etat.jokers.find((x) => x.uid === ev.uid);
    if (j && !ids.includes(j.id)) ids.push(j.id);
  }
  if (!J.main || R.total > J.main.total) {
    J.main = { total: R.total, type: R.type, palier: etat.palier, cartes: cartes.map((c) => (LETTRE[c.rang] || String(c.rang)) + (SYMB_ENS[c.ens] || '')) };
  }
  if (ids.length >= 2 && (!J.combo || ids.length > J.combo.n || (ids.length === J.combo.n && R.total > J.combo.total))) {
    J.combo = { n: ids.length, jokers: ids.slice(0, 8), total: R.total, type: R.type, palier: etat.palier };
  }
}

export function resume(etat) {
  return {
    date: etat.debut,
    graine: etat.graine,
    jeu: etat.regles.jeu,
    enjeu: etat.regles.enjeu,
    palier: etat.palier,
    paliers: etat.regles.paliers,
    gagne: etat.gagne,
    meilleureMain: etat.stats.meilleureMain,
    meilleureMainType: etat.stats.meilleureMainType || null,
    total: etat.stats.totalMarque,
    defi: etat.defi ? etat.defi.date : null,
    epreuve: etat.epreuve ? etat.epreuve.id : null,
    mentor: etat.mentor || 0,
    atelier: etat.atelier,
    jokers: etat.jokers.map((j) => j.id),
    journal: etat.stats.journal || null,
    crescendoMax: etat.stats.crescendoMax || 0,
  };
}

export { ENJEUX, JEU, PATRON, TICKET, PRIVILEGE, CONSO, JOKER };

// Progression entre les parties : collection, déblocages, historique, défi du jour.

import { hacher } from './rng.js';
import { JOKERS, JOKER, DUOS_CONNUS } from './jokers.js';
import { JEUX, JEU, ENJEUX, REGLES_DEFAUT, basePalier, estClassique } from './regles.js';
import { CONSOS, PRIVILEGE } from './consommables.js';
import { resume } from './partie.js';

// Numéro des nouveautés annoncées sur l'écran titre. À augmenter quand la liste change (ui/ecrans.js).
export const VERSION_NOUVEAUTES = 9;

// Format de la méta. v1 : jusqu'à la v4.1. v2 (Velours 5) : duos découverts, carnet zen, record des défis, options de sensation.
export const VERSION_META = 2;

export function metaVide() {
  return {
    version: VERSION_META,
    decouvert: { duos: {}, jokers: {}, consos: {}, patrons: {}, mains: {}, jeux: {}, synergies: {} },
    stats: { parties: 0, victoires: 0, palierMax: 0, meilleureMain: 0, astres: 0, mainsJouees: 0, patronsBattus: 0, enjeuGagneMax: -1, couleurs: 0, victoiresJeu: {} },
    epreuves: {}, // v4 : { id: { gagne, palierMax } }
    leconVue: false, // v4 : la leçon de poker pour débutants
    historique: [],
    defis: {},
    troupe: {},
    profils: [],
    guide: { fini: false },
    nouveautesVues: VERSION_NOUVEAUTES, // un nouveau joueur n'a rien à rattraper
    options: { muet: false, musique: true, volume: 0.8, volMusique: 0.5, volEffets: 0.8, vitesse: 1, crt: true, tapis: 'velours', mentor: false, mentorRevue: true, mentorAstuces: true, cartesDeco: true, relief: true, tremblement: true, arretImage: true, vibration: true, toutDebloque: false },
    renommee: { points: 0 },
  };
}

// Migration au premier lancement : tout ce qui existait est gardé tel quel, les nouveautés s'ajoutent.
// Renvoie { meta, migree, depuis } ; la copie de secours de l'original est faite par l'appelant (ui/app.js).
export function migrerMeta(brut) {
  const depuis = brut && typeof brut === 'object' ? Number(brut.version) || 1 : null;
  const meta = normaliserMeta(brut);
  meta.version = VERSION_META;
  return { meta, migree: depuis !== null && depuis < VERSION_META, depuis };
}

export function normaliserMeta(m) {
  const v = metaVide();
  if (!m || typeof m !== 'object') return v;
  const out = Object.assign(v, m);
  out.decouvert = Object.assign(metaVide().decouvert, m.decouvert || {});
  out.stats = Object.assign(metaVide().stats, m.stats || {});
  out.options = Object.assign(metaVide().options, m.options || {});
  out.renommee = { points: Math.max(0, Number(m.renommee && m.renommee.points) || 0) };
  out.options.toutDebloque = !!out.options.toutDebloque;
  if (!tapisDebloques(out).some((t) => t.id === out.options.tapis)) out.options.tapis = 'velours';
  // Volumes : toujours un nombre entre 0 et 1, quoi que contienne le fichier.
  for (const k of ['volume', 'volMusique', 'volEffets']) {
    const n = Number(out.options[k]);
    out.options[k] = Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : metaVide().options[k];
  }
  // Une sauvegarde d'avant les nouveautés ne les a pas vues.
  out.nouveautesVues = m.aideVue || (m.stats && m.stats.parties) ? Number(m.nouveautesVues) || 1 : VERSION_NOUVEAUTES;
  // Guide de la première manche : déjà fait pour qui a déjà vu l'aide d'une version précédente.
  out.guide = { fini: m.guide && typeof m.guide === 'object' ? !!m.guide.fini : !!m.aideVue };
  if (!Array.isArray(out.historique)) out.historique = [];
  if (!Array.isArray(out.profils)) out.profils = [];
  if (!out.defis || typeof out.defis !== 'object') out.defis = {};
  if (!out.troupe || typeof out.troupe !== 'object' || Array.isArray(out.troupe)) out.troupe = {};
  if (!out.epreuves || typeof out.epreuves !== 'object' || Array.isArray(out.epreuves)) out.epreuves = {};
  if (!out.stats.victoiresJeu || typeof out.stats.victoiresJeu !== 'object') out.stats.victoiresJeu = {};
  out.stats.couleurs = Math.max(0, Number(out.stats.couleurs) || 0);
  // Qui a déjà joué connaît le poker : la leçon ne s'impose qu'aux nouveaux.
  out.leconVue = m.leconVue !== undefined ? !!m.leconVue : !!(m.stats && m.stats.parties);
  for (const id of Object.keys(out.decouvert.duos || {})) DUOS_CONNUS.add(id);
  return out;
}

const nb = (o) => Object.keys(o || {}).length;

// Jokers à débloquer : condition lisible + test sur la méta.
export const VERROUS_JOKERS = [
  { id: 'tandem', cond: 'Joue 100 mains.', test: (m) => m.stats.mainsJouees >= 100 },
  { id: 'contorsionniste', cond: 'Marque 10 000 jetons en une seule main.', test: (m) => m.stats.meilleureMain >= 10000 },
  { id: 'diva', cond: 'Marque 50 000 jetons en une seule main.', test: (m) => m.stats.meilleureMain >= 50000 },
  { id: 'echo', cond: 'Atteins le palier 4.', test: (m) => m.stats.palierMax >= 4 },
  { id: 'perroquet', cond: 'Atteins le palier 5.', test: (m) => m.stats.palierMax >= 5 },
  { id: 'philateliste', cond: 'Atteins le palier 6.', test: (m) => m.stats.palierMax >= 6 },
  { id: 'provocateur', cond: 'Bats 5 patrons.', test: (m) => m.stats.patronsBattus >= 5 },
  { id: 'passe_muraille', cond: 'Bats 10 patrons.', test: (m) => m.stats.patronsBattus >= 10 },
  { id: 'forgeron', cond: 'Découvre 30 jokers.', test: (m) => nb(m.decouvert.jokers) >= 30 },
  { id: 'doublure', cond: 'Gagne une partie.', test: (m) => m.stats.victoires >= 1 },
  { id: 'eternel_second', cond: 'Gagne 2 parties.', test: (m) => m.stats.victoires >= 2 },
  // v5 : les trois défis à contrainte débloquent chacun une carte.
  { id: 'du_muse', cond: 'Réussis le défi Cœurs brisés.', test: (m) => !!(m.epreuves && m.epreuves.sans_coeurs && m.epreuves.sans_coeurs.gagne) },
  { id: 'ec_canon', cond: 'Réussis le défi Petite troupe.', test: (m) => !!(m.epreuves && m.epreuves.trois_jokers && m.epreuves.trois_jokers.gagne) },
  { id: 'mo_masque', cond: 'Réussis le défi Sans repentir.', test: (m) => !!(m.epreuves && m.epreuves.sans_defausse && m.epreuves.sans_defausse.gagne) },
  { id: 'chef_orchestre', cond: 'Gagne une partie avec l\'enjeu Cuivre ou plus.', test: (m) => m.stats.enjeuGagneMax >= 2 },
];

const VERROUS_JEUX = {
  roturier: (m) => m.stats.palierMax >= 3,
  bicolore: (m) => m.stats.palierMax >= 4,
  ecarlate: (m) => m.stats.palierMax >= 5,
  fourmi: (m) => m.stats.victoires >= 1,
  bascule: (m) => m.stats.enjeuGagneMax >= 1,
  astronome: (m) => m.stats.astres >= 20,
  miniature: (m) => m.stats.victoires >= 3,
  ombres: (m) => nb(m.decouvert.jokers) >= 60,
  soliste: (m) => m.stats.palierMax >= 6,
  parrain: (m) => !!(m.stats.victoiresJeu && m.stats.victoiresJeu.rentier),
  crepuscule: (m) => (m.stats.couleurs || 0) >= 10,
  geant: (m) => m.stats.patronsBattus >= 25,
};

// v6 : mode « tout débloqué » (options) : jokers, jeux, enjeux et tapis ouverts, sans toucher à la progression réelle.
export function toutDebloque(meta) {
  return !!(meta && meta.options && meta.options.toutDebloque);
}
export function jokersVerrouilles(meta) {
  if (toutDebloque(meta)) return [];
  return VERROUS_JOKERS.filter((v) => !v.test(meta)).map((v) => v.id);
}
export function jeuDebloque(meta, id) {
  if (toutDebloque(meta)) return true;
  return !VERROUS_JEUX[id] || VERROUS_JEUX[id](meta);
}
export function enjeuMax(meta) {
  if (toutDebloque(meta)) return ENJEUX.length - 1;
  return Math.min(ENJEUX.length - 1, meta.stats.enjeuGagneMax + 1);
}

function etatDeblocages(meta) {
  return {
    jokers: jokersVerrouilles(meta),
    jeux: JEUX.filter((j) => !jeuDebloque(meta, j.id)).map((j) => j.id),
    enjeu: enjeuMax(meta),
  };
}

// Reporte ce que la partie a montré dans la collection.
export function fusionnerVus(meta, etat) {
  for (const k of ['jokers', 'consos', 'patrons', 'mains']) Object.assign(meta.decouvert[k], etat.vus[k] || {});
  Object.assign(meta.decouvert.duos, etat.vus.duos || {});
  Object.assign(meta.decouvert.synergies, etat.vus.synergies || {});
  for (const id of Object.keys(meta.decouvert.duos)) DUOS_CONNUS.add(id);
  meta.decouvert.jeux[etat.regles.jeu] = 1;
}

// Enregistre une victoire ou une fin de partie. Renvoie la liste des nouveautés débloquées.
export function enregistrerPartie(meta, etat, evenement) {
  const avant = etatDeblocages(meta);
  fusionnerVus(meta, etat);
  // Mode zen (v5) : on garde les découvertes et un carnet à part, sans toucher aux statistiques ni aux déblocages.
  if (etat.zen) {
    const z = meta.zen || (meta.zen = { parties: 0, palierMax: 0, meilleureMain: 0 });
    z.palierMax = Math.max(z.palierMax || 0, etat.palier);
    z.meilleureMain = Math.max(z.meilleureMain || 0, etat.stats.meilleureMain || 0);
    if (!etat.compte) etat.compte = {};
    if (evenement === 'fin' && !etat.compte.fin) {
      etat.compte.fin = true;
      z.parties = (z.parties || 0) + 1;
    }
    return [];
  }
  const s = meta.stats;
  if (!etat.compte) etat.compte = {};
  const patronsBattus = Object.values(etat.paliers).filter((p) => p.etats[2] === 'battue').length;
  s.patronsBattus += patronsBattus - (etat.compte.patrons || 0);
  etat.compte.patrons = patronsBattus;
  s.mainsJouees += etat.stats.mainsJouees - (etat.compte.mains || 0);
  etat.compte.mains = etat.stats.mainsJouees;
  s.astres += (etat.stats.astres || 0) - (etat.compte.astres || 0);
  etat.compte.astres = etat.stats.astres || 0;
  const couleurs = etat.niveaux && etat.niveaux.couleur ? etat.niveaux.couleur.jouees : 0;
  s.couleurs = (s.couleurs || 0) + couleurs - (etat.compte.couleurs || 0);
  etat.compte.couleurs = couleurs;
  // Épreuves (v4) : on retient le meilleur palier et la réussite, sans toucher aux statistiques classiques.
  if (etat.epreuve) {
    const ep = meta.epreuves[etat.epreuve.id] || (meta.epreuves[etat.epreuve.id] = { gagne: false, palierMax: 0 });
    ep.palierMax = Math.max(ep.palierMax, etat.palier);
    if (evenement === 'victoire') ep.gagne = true;
  }
  s.palierMax = Math.max(s.palierMax, etat.palier);
  s.meilleureMain = Math.max(s.meilleureMain, etat.stats.meilleureMain);
  if (evenement === 'victoire' && !etat.compte.victoire) {
    etat.compte.victoire = true;
    s.victoires++;
    // Les enjeux ne se débloquent qu'avec les règles classiques.
    if (!etat.defi && !etat.epreuve && !etat.mentor && estClassique(Object.assign({}, etat.regles, { jeu: REGLES_DEFAUT.jeu, enjeu: 0 }))) {
      s.enjeuGagneMax = Math.max(s.enjeuGagneMax, etat.regles.enjeu);
      if (!s.victoiresJeu) s.victoiresJeu = {};
      s.victoiresJeu[etat.regles.jeu] = (s.victoiresJeu[etat.regles.jeu] || 0) + 1;
    }
  }
  // Carnet de la troupe, tenu au fil de l'eau : une partie reprise en sans fin continue de compter.
  if (!meta.troupe) meta.troupe = {};
  if (!etat.compte.troupe) etat.compte.troupe = {};
  for (const [id, t] of Object.entries(etat.stats.troupe || {})) {
    if (!JOKER[id]) continue;
    const c = meta.troupe[id] || (meta.troupe[id] = { parties: 0, victoires: 0, mains: 0, meilleure: 0 });
    const vu = etat.compte.troupe[id] || (etat.compte.troupe[id] = { mains: 0, victoire: false });
    if (!vu.compte) {
      vu.compte = true;
      c.parties++;
    }
    if (etat.gagne && !vu.victoire) {
      vu.victoire = true;
      c.victoires++;
    }
    c.mains += Math.max(0, (t.mains || 0) - vu.mains);
    vu.mains = t.mains || 0;
    c.meilleure = Math.max(c.meilleure, t.meilleure || 0);
  }
  // Renommée : des points à chaque partie, comptés au fil de l'eau comme le reste.
  const pts = pointsRenommee(etat);
  const dejaCompte = etat.compte.renommee || 0;
  if (!meta.renommee) meta.renommee = { points: 0 };
  const niveauAvant = niveauRenommee(meta).niveau;
  meta.renommee.points += Math.max(0, pts - dejaCompte);
  etat.compte.renommee = Math.max(pts, dejaCompte);
  etat.compte.renommeeGagnee = (etat.compte.renommeeGagnee || 0) + Math.max(0, pts - dejaCompte);
  const niveauApres = niveauRenommee(meta).niveau;
  if (evenement === 'fin' && !etat.compte.fin) {
    etat.compte.fin = true;
    s.parties++;
    meta.historique.unshift(resume(etat));
    meta.historique = meta.historique.slice(0, 20);
  }
  if (etat.defi && !etat.defi.horsClassement) {
    const d = meta.defis[etat.defi.date] || { score: 0, palier: 0, gagne: false };
    d.essai = true;
    d.score = Math.max(d.score, etat.stats.totalMarque);
    d.palier = Math.max(d.palier, etat.palier);
    d.gagne = d.gagne || etat.gagne;
    d.maison = etat.defi.scoreMaison;
    meta.defis[etat.defi.date] = d;
    s.meilleurDefi = Math.max(s.meilleurDefi || 0, d.score);
    const dates = Object.keys(meta.defis).sort();
    while (dates.length > 60) delete meta.defis[dates.shift()];
  }
  const apres = etatDeblocages(meta);
  const nouveautes = [];
  for (const id of avant.jokers) if (!apres.jokers.includes(id)) nouveautes.push({ sorte: 'joker', id, nom: JOKER[id].nom });
  for (const id of avant.jeux) if (!apres.jeux.includes(id)) nouveautes.push({ sorte: 'jeu', id, nom: JEU[id].nom });
  if (apres.enjeu > avant.enjeu) nouveautes.push({ sorte: 'enjeu', id: ENJEUX[apres.enjeu].id, nom: 'Enjeu ' + ENJEUX[apres.enjeu].nom });
  for (let n = niveauAvant + 1; n <= niveauApres; n++) {
    nouveautes.push({ sorte: 'niveau', id: 'n' + n, nom: 'Renommée ' + n + ' : ' + rangTroupe(n) });
    for (const t of TAPIS) if (t.niveau === n) nouveautes.push({ sorte: 'tapis', id: t.id, nom: 'Tapis ' + t.nom });
  }
  return nouveautes;
}

// Palmarès de la troupe : les jokers les plus engagés, avec leur taux de victoire.
export function palmaresTroupe(meta, n = 8) {
  return Object.entries(meta.troupe || {})
    .filter(([id]) => JOKER[id])
    .map(([id, t]) => ({ id, nom: JOKER[id].nom, parties: t.parties, victoires: t.victoires, mains: t.mains, meilleure: t.meilleure, taux: t.parties ? t.victoires / t.parties : 0 }))
    .sort((a, b) => b.parties - a.parties || b.victoires - a.victoires || b.meilleure - a.meilleure || a.nom.localeCompare(b.nom, 'fr'))
    .slice(0, n);
}

// ------------------------------------------------------- Défi du jour

// Lundi de la semaine d'une date 'AAAA-MM-JJ' (calcul en UTC pour ne dépendre d'aucun fuseau).
export function lundiDe(date) {
  const d = new Date(date + 'T00:00:00Z');
  const recul = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - recul);
  return d.toISOString().slice(0, 10);
}

// Classement local des défis, semaine par semaine, la plus récente d'abord.
// Chaque semaine : { lundi, jours: [7 cases, null si pas joué], joues, battus, total, meilleur }.
export function semainesDefis(meta) {
  const semaines = new Map();
  for (const [date, r] of Object.entries(meta.defis || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !r || Number.isNaN(new Date(date + 'T00:00:00Z').getTime())) continue;
    const lundi = lundiDe(date);
    if (!semaines.has(lundi)) semaines.set(lundi, { lundi, jours: [null, null, null, null, null, null, null], joues: 0, battus: 0, total: 0, meilleur: 0 });
    const s = semaines.get(lundi);
    const i = Math.round((new Date(date + 'T00:00:00Z') - new Date(lundi + 'T00:00:00Z')) / 86400000);
    const battu = (r.score || 0) >= (r.maison || Infinity);
    s.jours[i] = { date, score: r.score || 0, maison: r.maison || 0, battu };
    s.joues++;
    if (battu) s.battus++;
    s.total += r.score || 0;
    s.meilleur = Math.max(s.meilleur, r.score || 0);
  }
  const liste = [...semaines.values()].sort((a, b) => (a.lundi < b.lundi ? 1 : -1));
  // La meilleure semaine : le plus de maisons battues, puis le plus gros total.
  let record = null;
  for (const s of liste) if (!record || s.battus > record.battus || (s.battus === record.battus && s.total > record.total)) record = s;
  for (const s of liste) s.record = s === record && liste.length > 1;
  return liste;
}

// Un essai par jour (v5) : le défi du jour est compté dès qu'il est lancé.
export function defiTente(meta, date = dateParis()) {
  return !!(meta.defis && meta.defis[date]);
}
export function marquerEssaiDefi(meta, defi) {
  if (!defi || meta.defis[defi.date]) return;
  meta.defis[defi.date] = { score: 0, palier: 0, gagne: false, maison: defi.scoreMaison, essai: true };
}

export function dateParis(d = new Date()) {
  const p = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const g = (t) => p.find((x) => x.type === t).value;
  return g('year') + '-' + g('month') + '-' + g('day');
}

const MODIFS = [
  { nom: 'Grandes mains', desc: '+2 cartes en main, mais 1 main de moins.', effets: { tailleMain: 2, mains: -1 } },
  { nom: 'Bourse garnie', desc: '12 louis de plus au départ.', depart: { argent: 12 } },
  { nom: 'Sans filet', desc: '2 défausses de moins, 1 main de plus.', effets: { defausses: -2, mains: 1 } },
  { nom: 'Vitrine du jour', desc: 'Un article de plus dans chaque boutique.', effets: { emplBoutique: 1 } },
  { nom: 'Rangée courte', desc: '1 emplacement de joker en moins, mises 20 % plus basses.', effets: { emplJokers: -1, cible: -0.2 } },
  { nom: 'Soldes', desc: 'Tout coûte 25 % moins cher, intérêts plafonnés 2 louis plus bas.', effets: { remise: 0.25, interetMax: -2 } },
  { nom: 'Éditions en fête', desc: 'Les éditions sont 3 fois plus fréquentes.', effets: { editionsX: 2 } },
  { nom: 'Ciel dégagé', desc: 'Tu commences avec le Télescope et 2 Astres.', depart: { privileges: ['telescope'], astres: 2 } },
  { nom: 'Invité surprise', desc: 'Un joker peu commun t\'accompagne dès le départ.', invite: true },
];

export function defiDuJour(date = dateParis()) {
  const h = hacher('velours-defi-' + date);
  const jeu = JEUX[h % JEUX.length];
  const a = MODIFS[(h >>> 4) % MODIFS.length];
  let b = MODIFS[(h >>> 9) % MODIFS.length];
  if (b === a) b = MODIFS[((h >>> 9) + 1) % MODIFS.length];
  const effets = {};
  const depart = { argent: 0, jokers: [], privileges: [], consos: [] };
  for (const m of [a, b]) {
    for (const k of Object.keys(m.effets || {})) effets[k] = (effets[k] || 0) + m.effets[k];
    if (m.depart) {
      depart.argent += m.depart.argent || 0;
      depart.privileges.push(...(m.depart.privileges || []));
      if (m.depart.astres) {
        const astres = CONSOS.filter((c) => c.cat === 'astre' && !c.cachee);
        depart.consos.push(astres[(h >>> 13) % astres.length].id, astres[(h >>> 17) % astres.length].id);
      }
    }
    if (m.invite) {
      const us = JOKERS.filter((j) => j.r === 'U' && !j.copie);
      depart.jokers.push(us[(h >>> 6) % us.length].id);
    }
  }
  // v7 : le joker du jour, un rare ou un épique tiré de la date, offert au départ à tout le monde.
  const vedettes = JOKERS.filter((j) => (j.r === 'R' || j.r === 'E') && !j.copie && !depart.jokers.includes(j.id));
  const jokerDuJour = vedettes[(h >>> 21) % vedettes.length].id;
  depart.jokers.unshift(jokerDuJour);
  const regles = Object.assign({}, REGLES_DEFAUT, { paliers: 5, jeu: jeu.id, enjeu: 0, familles: {} });
  let maison = 0;
  const f = Math.max(0.1, 1 + (effets.cible || 0) + ((jeu.effets && jeu.effets.cible) || 0));
  for (let p = 1; p <= regles.paliers; p++) maison += basePalier(regles, p) * 4.5 * f;
  maison = Math.round((maison * 1.45) / 100) * 100; // v7 : 1,3 avant le joker du jour
  return {
    date,
    graine: 'JOUR' + date.replace(/-/g, ''),
    nom: a.nom + ' et ' + b.nom,
    modifs: [a, b].map((m) => ({ nom: m.nom, desc: m.desc })),
    jeu: jeu.id,
    jokerDuJour,
    regles,
    effets,
    depart,
    scoreMaison: maison,
  };
}

export { PRIVILEGE };

// ------------------------------------------------------------- Renommée (v3)
// La méta-progression : chaque partie rapporte des points, même perdue. Les niveaux donnent un rang
// et des tapis de table (pur décor : l'équilibre du jeu ne bouge pas).

export const TAPIS = [
  { id: 'velours', nom: 'Velours', niveau: 1 },
  { id: 'emeraude', nom: 'Émeraude', niveau: 2 },
  { id: 'saphir', nom: 'Saphir', niveau: 3 },
  { id: 'ardoise', nom: 'Ardoise', niveau: 5 },
  { id: 'prune', nom: 'Prune', niveau: 7 },
  { id: 'or', nom: 'Or de scène', niveau: 9 },
  { id: 'neon', nom: 'Néon rose', niveau: 12 },
];

const RANGS = ['Figurant', 'Choriste', 'Doublure', 'Second rôle', 'Premier rôle', 'Tête d\'affiche', 'Vedette', 'Étoile', 'Monstre sacré', 'Légende'];
export function rangTroupe(n) {
  return RANGS[Math.min(RANGS.length - 1, Math.max(0, n - 1))];
}

// Points cumulés pour atteindre le niveau n (niveau 1 : 0 point).
export function seuilRenommee(n) {
  const k = Math.max(0, n - 1);
  return 40 * k + 10 * k * k;
}

export function niveauRenommee(meta) {
  const p = (meta && meta.renommee && meta.renommee.points) || 0;
  let n = 1;
  while (p >= seuilRenommee(n + 1)) n++;
  const bas = seuilRenommee(n);
  const haut = seuilRenommee(n + 1);
  return { niveau: n, points: p, dans: p - bas, besoin: haut - bas, rang: rangTroupe(n), prochainTapis: TAPIS.find((t) => t.niveau > n) || null };
}

export function pointsRenommee(etat) {
  if (!etat || !etat.stats) return 0;
  const patrons = Object.values(etat.paliers || {}).filter((p) => p.etats && p.etats[2] === 'battue').length;
  let pts = 4 * (etat.palier || 1) + 3 * (etat.stats.manchesGagnees || 0) + 6 * patrons;
  pts += 2 * Math.floor(Math.log10((etat.stats.meilleureMain || 0) + 1));
  if (etat.gagne) pts += 40;
  if (etat.defi) pts += 10;
  if (etat.epreuve) pts += 10;
  return pts;
}

export function tapisDebloques(meta) {
  if (toutDebloque(meta)) return TAPIS.slice();
  const n = niveauRenommee(meta).niveau;
  return TAPIS.filter((t) => t.niveau <= n);
}

// Le prochain objectif le plus proche : un joker à débloquer, avec une progression lisible (0 à 1).
export function prochainObjectif(meta) {
  const s = meta.stats;
  const mesures = {
    tandem: [s.mainsJouees, 100], contorsionniste: [s.meilleureMain, 10000], diva: [s.meilleureMain, 50000],
    echo: [s.palierMax, 4], perroquet: [s.palierMax, 5], philateliste: [s.palierMax, 6], provocateur: [s.patronsBattus, 5],
    passe_muraille: [s.patronsBattus, 10], forgeron: [nb(meta.decouvert.jokers), 30], doublure: [s.victoires, 1], eternel_second: [s.victoires, 2],
  };
  let mieux = null;
  for (const v of VERROUS_JOKERS) {
    if (v.test(meta) || !mesures[v.id]) continue;
    const [a, b] = mesures[v.id];
    const avance = Math.max(0, Math.min(0.99, (a || 0) / b));
    if (!mieux || avance > mieux.avance) mieux = { id: v.id, nom: JOKER[v.id] ? JOKER[v.id].nom : v.id, cond: v.cond, avance };
  }
  return mieux;
}

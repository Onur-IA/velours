// Le Mentor (v4) : un joueur fort qui conseille, explique et rejoue tes mains.
// Il réutilise la recherche du joueur automatique d'équilibrage (tests/bot.js) :
// on trie toutes les combinaisons à bas coût, puis on calcule le vrai score (jokers compris)
// des meilleures, dans un budget de temps. Logique pure : tourne dans un Web Worker ou dans les tests.

import * as P from './partie.js';
import { evaluer } from './mains.js';
import { MAIN, MAINS, ORDRE_MAIN, baseDeMain, jetonsDeRang, lettreRang, fmt } from './donnees.js';
import { calculerMain } from './score.js';
import { carteParId, placeJoker, placeConso, reglesActives, mainLaPlusJouee, valeurVenteJoker, emplJokers } from './outils.js';
import { JOKER, descDef } from './jokers.js';
import { CONSO, TICKET, TYPES_PAQUET, nomPaquet } from './consommables.js';
import { combosActifs } from './combos.js';
import { apportSynergie } from './synergies.js';
import { VALEURS_JOKERS } from './valeurs-jokers.js';

const SYMBOLE = { P: '♠', C: '♥', K: '♦', T: '♣' };
const maintenant = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function nomCarte(c) {
  return c ? lettreRang(c.rang) + SYMBOLE[c.ens] : '?';
}
export function nomCartes(etat, ids) {
  return ids.map((id) => nomCarte(carteParId(etat, id))).join(' ');
}
const nomMain = (type) => (MAIN[type] ? MAIN[type].nom : type);

// ------------------------------------------------------------ Valeur des jokers

// Valeur d'un joker : l'effet mesuré par le simulateur (paliers gagnés), sinon un a priori par rareté.
export function valeurJoker(id, edition) {
  const d = JOKER[id];
  let v = VALEURS_JOKERS[id];
  if (v === undefined) v = d ? ({ C: 0, U: 0.15, R: 0.35, E: 0.5, L: 0.6 })[d.r] || 0 : 0;
  return v + (edition ? 0.15 : 0);
}

// Combos qu'un joker ajouterait à la rangée actuelle.
export function combosAjoutes(etat, id) {
  const avant = new Map(combosActifs(etat.jokers).map((c) => [c.id, c.n]));
  const apres = combosActifs(etat.jokers.concat([{ id, uid: -1 }]));
  return apres.filter((c) => c.uids.includes(-1) && (avant.get(c.id) || 0) < c.n);
}

// ------------------------------------------------------------ Mains

// Les meilleures mains jouables, score réel (jokers compris). opts : { budgetMs, garder }.
export function meilleuresMains(etat, opts = {}) {
  const m = etat.manche;
  if (!m || etat.phase !== 'manche') return { mains: [], explorees: 0, total: 0 };
  const t0 = maintenant();
  const budget = opts.budgetMs ?? 350;
  const cachees = new Set(m.cachees || []);
  const ids = etat.main.filter((id) => !cachees.has(id));
  const regles = reglesActives(etat);
  const cands = [];
  const n = Math.min(ids.length, 13);
  for (let masque = 1; masque < 1 << n; masque++) {
    const s = [];
    for (let i = 0; i < n; i++) if (masque & (1 << i)) s.push(ids[i]);
    if (s.length > 5) continue;
    const cartes = s.map((id) => carteParId(etat, id));
    const r = evaluer(cartes, regles);
    if (!r.type) continue;
    const niv = (etat.niveaux[r.type] || {}).niveau || 1;
    const b = baseDeMain(r.type, niv);
    const jet = r.marquantes.reduce((a, i) => a + jetonsDeRang(cartes[i].rang), 0);
    // Les passagers ne marquent pas, mais certains jokers les aiment : on les garde, un peu pénalisés.
    const passagers = s.length - r.marquantes.length;
    cands.push({ s, type: r.type, h: (b.jetons + jet) * b.multi - passagers * 0.5 });
  }
  cands.sort((a, b) => b.h - a.h);
  const out = [];
  let explorees = 0;
  // Au moins les 12 premières, puis tant que le budget le permet.
  for (const c of cands) {
    if (explorees >= 12 && maintenant() - t0 > budget) break;
    const a = P.apercu(etat, c.s);
    explorees++;
    if (!a || !a.type || !a.ok) continue;
    out.push({ ids: c.s, type: a.type, total: a.total, jetons: a.jetons, multi: a.multi, incertain: !!a.incertain, marquantes: (a.marquantes || []).map((x) => x.id) });
  }
  out.sort((a, b) => b.total - a.total || a.ids.length - b.ids.length);
  return { mains: out.slice(0, opts.garder || 3), explorees, total: cands.length, ms: Math.round(maintenant() - t0) };
}

// Meilleur type atteignable dans une main de cartes (sans jokers), et sa valeur de base.
function meilleurType(cartes, regles, niveaux) {
  let best = 0;
  let type = null;
  const n = cartes.length;
  for (let masque = 1; masque < 1 << n; masque++) {
    const s = [];
    for (let i = 0; i < n; i++) if (masque & (1 << i)) s.push(cartes[i]);
    if (s.length > 5) continue;
    const r = evaluer(s, regles);
    if (!r.type) continue;
    const b = baseDeMain(r.type, (niveaux[r.type] || {}).niveau || 1);
    const v = (b.jetons + r.marquantes.reduce((a, i) => a + jetonsDeRang(s[i].rang), 0)) * b.multi;
    if (v > best) {
      best = v;
      type = r.type;
    }
  }
  return { type, v: best };
}

// ------------------------------------------------------------ Lookahead boutique (v5)

// Force d'une rangée de jokers : score moyen de la meilleure main sur des mains tirées au hasard
// dans le paquet (mêmes tirages pour chaque rangée comparée, donc comparaison juste).
function mainsEchantillon(etat, n, taille) {
  const rnd = alea(etat.palier * 977 + etat.stats.achats * 31 + etat.argent);
  const tas = etat.paquet.map((c) => c.id);
  const out = [];
  for (let k = 0; k < n; k++) {
    const t = tas.slice();
    const main = [];
    for (let i = 0; i < taille && t.length; i++) main.push(t.splice(Math.floor(rnd() * t.length), 1)[0]);
    out.push(main);
  }
  return out;
}

function forceRangee(base, jokers, echantillon) {
  let somme = 0;
  const regles = reglesActives(base);
  for (const main of echantillon) {
    const cartes = main.map((id) => carteParId(base, id)).filter(Boolean);
    // Les 4 meilleures combinaisons à bas coût, puis le vrai score avec la rangée.
    const cands = [];
    const n = cartes.length;
    for (let masque = 1; masque < 1 << n; masque++) {
      const s = [];
      for (let i = 0; i < n; i++) if (masque & (1 << i)) s.push(cartes[i]);
      if (s.length > 5) continue;
      const r = evaluer(s, regles);
      if (!r.type) continue;
      const b = baseDeMain(r.type, (base.niveaux[r.type] || {}).niveau || 1);
      cands.push({ s, h: (b.jetons + r.marquantes.reduce((a, i) => a + jetonsDeRang(s[i].rang), 0)) * b.multi + s.length * 0.1 });
    }
    cands.sort((a, b) => b.h - a.h);
    let best = 0;
    for (const c of cands.slice(0, 4)) {
      const copie = JSON.parse(JSON.stringify(Object.assign({}, base, { jokers }), (k, v) => (k === 'evts' ? [] : v)));
      const set = new Set(c.s.map((x) => x.id));
      const jouees = c.s.map((x) => carteParId(copie, x.id));
      const enMain = cartes.filter((x) => !set.has(x.id)).map((x) => carteParId(copie, x.id));
      try {
        const r = calculerMain(copie, jouees, enMain, { apercu: true });
        if (r && r.total > best) best = r.total;
      } catch (e) {
        /* joker exotique hors manche : on ignore cette combinaison */
      }
    }
    somme += Math.log(1 + best);
  }
  return somme / Math.max(1, echantillon.length);
}

// Prépare un état de manche fictif pour mesurer les rangées depuis la boutique.
function baseLookahead(etat) {
  const base = JSON.parse(JSON.stringify(etat, (k, v) => (k === 'evts' ? [] : v)));
  base.phase = 'manche';
  base.manche = { type: 0, patron: null, patronAnnule: false, cible: 1, cibleInitiale: 1, score: 0, mains: Math.max(1, (etat.regles.mains || 4) - 1), defausses: etat.regles.defausses || 3,
    mainsJouees: 1, defaussesUtilisees: 0, typesJoues: [], tailleMainMod: 0, jokerMuet: null, cachees: [], dernierTotal: null, derniereMain: null, crescendo: 0, souffle: false };
  return base;
}

// Gain de force (en log de score) qu'apporte un joker, en plus ou à la place d'un autre.
export function lookaheadJokers(etat, candidats, opts = {}) {
  const t0 = maintenant();
  const base = baseLookahead(etat);
  const ech = mainsEchantillon(etat, opts.mains ?? 10, Math.max(5, (etat.regles.tailleMain || 8)));
  const actuelle = forceRangee(base, etat.jokers, ech);
  const res = [];
  for (const c of candidats) {
    if (maintenant() - t0 > (opts.budgetMs ?? 400)) break;
    const j = { uid: -1 - res.length, id: c.id, edition: c.edition || null, etat: {}, bonusVente: 0 };
    const d = JOKER[c.id];
    try {
      if (d && d.init) d.init(j, base);
    } catch (e) {
      /* rien */
    }
    const rangee = c.remplace != null ? etat.jokers.map((x) => (x.uid === c.remplace ? j : x)) : etat.jokers.concat([j]);
    res.push(Object.assign({}, c, { gain: forceRangee(base, rangee, ech) - actuelle }));
  }
  return { actuelle, res, ms: Math.round(maintenant() - t0) };
}

// Graine pseudo-aléatoire locale (le Mentor ne touche jamais aux tirages de la partie).
function alea(seed) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

// Ce qu'on peut garder pour défausser : la meilleure main, une couleur ou une suite à quatre, les paires.
function optionsGarde(etat, ids, meilleure) {
  const cartes = ids.map((id) => carteParId(etat, id));
  const opts = [];
  if (meilleure && ORDRE_MAIN[meilleure.type] >= 1) opts.push({ garde: meilleure.marquantes.length ? meilleure.marquantes : meilleure.ids, but: meilleure.type, idee: 'garder ta ' + nomMain(meilleure.type) });
  const parEns = {};
  for (const c of cartes) (parEns[c.ens] = parEns[c.ens] || []).push(c);
  for (const [ens, cs] of Object.entries(parEns)) if (cs.length >= 3) opts.push({ garde: cs.slice(0, 4).map((c) => c.id), but: 'couleur', idee: 'chasser la Couleur à ' + SYMBOLE[ens] });
  const rangs = [...new Set(cartes.map((c) => c.rang))].sort((a, b) => a - b);
  for (let i = 0; i < rangs.length; i++) {
    const fen = rangs.filter((r) => r >= rangs[i] && r <= rangs[i] + 4);
    if (fen.length >= 3) {
      const garde = fen.map((r) => cartes.find((c) => c.rang === r).id);
      opts.push({ garde, but: 'suite', idee: 'chasser la Suite (' + fen.map(lettreRang).join('-') + ')' });
    }
  }
  const parRang = {};
  for (const c of cartes) (parRang[c.rang] = parRang[c.rang] || []).push(c.id);
  const groupes = Object.values(parRang).filter((g) => g.length >= 2).flat();
  if (groupes.length) opts.push({ garde: groupes, but: 'brelan', idee: 'garder tes paires pour un Brelan ou un Full' });
  // Dédoublonne.
  const vus = new Set();
  return opts.filter((o) => {
    const k = [...o.garde].sort().join(',');
    if (vus.has(k)) return false;
    vus.add(k);
    return true;
  });
}

// Estime chaque défausse possible par tirages simulés dans la pioche (dont l'ordre reste secret).
function estimerDefausses(etat, ids, meilleure, budgetMs) {
  const t0 = maintenant();
  const regles = reglesActives(etat);
  const pioche = etat.pioche.map((id) => carteParId(etat, id)).filter(Boolean);
  const baseActuelle = meilleurType(ids.map((id) => carteParId(etat, id)), regles, etat.niveaux).v || 1;
  const rnd = alea(etat.stats.mainsJouees * 7919 + etat.palier * 131 + ids.length);
  const res = [];
  for (const o of optionsGarde(etat, ids, meilleure)) {
    const jette = ids.filter((id) => !o.garde.includes(id)).sort((a, b) => carteParId(etat, a).rang - carteParId(etat, b).rang).slice(0, 5);
    if (!jette.length) continue;
    const gardees = ids.filter((id) => !jette.includes(id)).map((id) => carteParId(etat, id));
    let somme = 0;
    let atteint = 0;
    let n = 0;
    for (; n < 40; n++) {
      if (n >= 8 && maintenant() - t0 > budgetMs) break;
      const tas = pioche.slice();
      const main = gardees.slice();
      for (let k = 0; k < jette.length && tas.length; k++) main.push(tas.splice(Math.floor(rnd() * tas.length), 1)[0]);
      const r = meilleurType(main, regles, etat.niveaux);
      somme += r.v;
      if (r.type && ORDRE_MAIN[r.type] >= ORDRE_MAIN[o.but]) atteint++;
    }
    res.push(Object.assign({}, o, { jette, gain: somme / n / baseActuelle, chance: atteint / n, tirages: n }));
  }
  return res.sort((a, b) => b.gain - a.gain);
}

// Le conseil pour la main en cours : jouer quoi, ou défausser quoi, et pourquoi.
export function conseilManche(etat, opts = {}) {
  const m = etat.manche;
  if (!m || etat.phase !== 'manche') return null;
  const t0 = maintenant();
  const budget = opts.budgetMs ?? 600;
  const r = meilleuresMains(etat, { budgetMs: budget * 0.6, garder: 3 });
  const best = r.mains[0];
  if (!best) {
    if (m.defausses > 0) return { action: 'defausser', ids: etat.main.slice(0, Math.min(5, etat.main.length)), titre: 'Défausse', pourquoi: 'Aucune main n\'est jouable ici. Défausse pour repiocher.', ms: Math.round(maintenant() - t0) };
    return { action: 'rien', ids: [], titre: 'Plus rien à faire', pourquoi: 'Aucune main jouable et plus de défausse.', ms: 0 };
  }
  const reste = Math.max(0, m.cible - m.score);
  const rythme = reste / Math.max(1, m.mains);
  const detail = nomMain(best.type) + ' : ' + fmt(best.jetons) + ' × ' + fmt(best.multi) + ' = ' + fmt(best.total);
  const alt = r.mains[1] && r.mains[1].total < best.total ? ' La suivante, ' + nomMain(r.mains[1].type) + ', ne ferait que ' + fmt(r.mains[1].total) + '.' : '';
  const base = { meilleures: r.mains, explorees: r.explorees, combinaisons: r.total };
  if (best.total >= reste && !opts.forceDefausse) {
    return Object.assign(base, { action: 'jouer', ids: best.ids, total: best.total, titre: 'Joue ' + nomCartes(etat, best.ids),
      pourquoi: detail + '. Il ne manque que ' + fmt(reste) + ' : cette main gagne la manche.', ms: Math.round(maintenant() - t0) });
  }
  if (m.defausses > 0 && (m.mains === 1 || best.total < rythme * 0.9)) {
    const d = estimerDefausses(etat, etat.main.filter((id) => !(m.cachees || []).includes(id)), best, Math.max(60, budget - (maintenant() - t0)));
    // Prudence : garder sa meilleure main reste le choix par défaut ; une chasse (Couleur, Suite) doit promettre nettement plus.
    const sure = d.find((o) => o.idee.startsWith('garder ta'));
    let top = d[0];
    if (sure && top !== sure && top.gain < sure.gain * (opts.prudence ?? 1.25)) top = sure;
    if (top && top.gain > (opts.seuil ?? 1.0)) {
      return Object.assign(base, { action: 'defausser', ids: top.jette, garde: top.garde, titre: 'Défausse ' + nomCartes(etat, top.jette),
        pourquoi: 'Ta meilleure main (' + detail + ') ne tient pas le rythme : il faut environ ' + fmt(Math.ceil(rythme)) + ' par main. Je propose de ' + top.idee + ' : ' + Math.round(top.chance * 100) + ' % de chances d\'y arriver, et une main en moyenne ' + Math.round((top.gain - 1) * 100) + ' % plus forte.',
        ms: Math.round(maintenant() - t0) });
    }
  }
  const pourquoi = best.total >= rythme
    ? detail + '. Il faut environ ' + fmt(Math.ceil(rythme)) + ' par main : tu es dans le rythme.'
    : detail + '. C\'est le maximum de ta main' + (m.defausses > 0 ? ', et aucune défausse ne promet mieux.' : ' et il ne reste plus de défausse.');
  return Object.assign(base, { action: 'jouer', ids: best.ids, total: best.total, titre: 'Joue ' + nomCartes(etat, best.ids), pourquoi: pourquoi + alt, ms: Math.round(maintenant() - t0) });
}

// Après coup : « voici comment j'aurais joué ». etat = copie prise juste avant la main.
export function revueMain(etat, idsJoues, totalJoue, opts = {}) {
  const r = meilleuresMains(etat, { budgetMs: opts.budgetMs ?? 400, garder: 1 });
  const best = r.mains[0];
  if (!best) return null;
  const ecart = best.total - totalJoue;
  const memes = best.ids.length === idsJoues.length && best.ids.every((id) => idsJoues.includes(id));
  if (memes || ecart <= Math.max(2, totalJoue * 0.03)) return { bon: true, ecart: 0, texte: 'Rien à redire : c\'était le meilleur coup (' + fmt(totalJoue) + ').' };
  const reste = etat.manche ? Math.max(0, etat.manche.cible - etat.manche.score) : 0;
  const suffisait = totalJoue >= reste;
  return {
    bon: false, ecart, ids: best.ids, type: best.type, total: best.total,
    texte: 'Voici comment j\'aurais joué : ' + nomCartes(etat, best.ids) + ' (' + nomMain(best.type) + ') pour ' + fmt(best.total) + ', soit ' + fmt(ecart) + ' de plus.' + (suffisait ? ' Ta main suffisait quand même : garder des cartes pour plus tard peut se défendre.' : ''),
  };
}

// ------------------------------------------------------------ Boutique


// ------------------------------------------------------------ v7 : le Mentor regarde tout le rayon
// Valeur d'un consommable de boutique, sur la même échelle que valeurJoker (≈ paliers gagnés), avec une ligne d'explication.
const AMEL_ARCANE = { contrepoids: 'lestee', braise: 'ardente', masque: 'cameleon', verrier: 'cristal', forge: 'enclume', feuille_or: 'doree', fer_cheval: 'veinarde' };
const ENS_ARCANE = { encre: 'P', fard: 'C', safran: 'K', mousse: 'T' };
const NOM_ENS = { P: 'Piques', C: 'Cœurs', K: 'Carreaux', T: 'Trèfles' };
function partMain(etat, id) {
  let tot = 0;
  for (const v of Object.values(etat.niveaux || {})) tot += v.jouees || 0;
  const n = (etat.niveaux && etat.niveaux[id] && etat.niveaux[id].jouees) || 0;
  return tot ? n / tot : 0;
}
function texteRangee(etat) {
  return etat.jokers.map((j) => (JOKER[j.id] ? JOKER[j.id].nom + ' ' + descDef(JOKER[j.id]) : '')).join(' ');
}
export function valeurConsoBoutique(etat, id) {
  const d = CONSO[id];
  if (!d) return { v: -1, ligne: '' };
  const txt = texteRangee(etat);
  if (d.cat === 'astre') {
    const part = partMain(etat, d.main);
    const niv = (etat.niveaux[d.main] && etat.niveaux[d.main].niveau) || 1;
    const v = 0.05 + 0.6 * part + (niv >= 2 && part > 0.2 ? 0.08 : 0);
    return { v, ligne: part > 0 ? 'Ta ' + nomMain(d.main) + ' fait ' + Math.round(part * 100) + ' % de tes mains : un niveau de plus, à chaque fois.' : 'Une main que tu ne joues pas encore.' };
  }
  if (d.cat === 'arcane') {
    if (AMEL_ARCANE[id]) {
      const a = AMEL_ARCANE[id];
      const lie = new RegExp(NOM_AMEL[a] || '§', 'i').test(txt);
      return { v: 0.16 + (lie ? 0.3 : 0), ligne: lie ? 'Tes jokers aiment les cartes ' + NOM_AMEL[a] + ' : ' + d.nom + ' les nourrit.' : 'Rend une ou deux cartes plus fortes pour toute la partie.' };
    }
    if (ENS_ARCANE[id]) {
      const e = ENS_ARCANE[id];
      const lie = new RegExp(NOM_ENS[e], 'i').test(txt) || /Couleur/.test(txt);
      return { v: 0.1 + (lie ? 0.32 : 0), ligne: lie ? 'Ta rangée compte sur les ' + NOM_ENS[e] + ' ou les couleurs : convertis des cartes.' : 'Change l\'enseigne de cartes, utile pour viser une Couleur.' };
    }
    if (id === 'tirelire') return { v: 0.04 + Math.min(20, etat.argent) / 45, ligne: 'Double tes louis : ' + Math.min(20, etat.argent) + ' louis de plus.' };
    if (id === 'brocante') {
      const g = Math.min(30, etat.jokers.reduce((t, j) => t + valeurVenteJoker(etat, j), 0));
      return { v: g / 60, ligne: 'Rapporte ' + g + ' louis, la revente de ta rangée.' };
    }
    if (id === 'rabatteur') return { v: placeJoker(etat) ? 0.28 : -0.5, ligne: 'Un joker gratuit pour une place vide.' };
    if (id === 'oracle') return { v: placeConso(etat) ? 0.16 : 0.05, ligne: 'Deux Astres au hasard pour monter tes mains.' };
    if (id === 'vernis') return { v: etat.jokers.some((j) => !j.edition) ? 0.13 : -0.3, ligne: 'Une chance sur trois de vernir un joker (jetons, multi ou ×1,5).' };
    if (id === 'couperet') return { v: 0.17, ligne: 'Retire tes cartes faibles : le paquet se resserre, tes bonnes mains reviennent plus souvent.' };
    if (id === 'calque' || id === 'miroir') return { v: 0.15, ligne: 'Copie ta meilleure carte (une Cristal, une Dorée...) pour la voir plus souvent.' };
    if (id === 'laque') return { v: 0.14, ligne: 'Deux cartes Brillantes : +40 jetons chacune quand elles marquent.' };
    return { v: 0.1, ligne: d.desc.replace(/\{[a-z]\|([^}]*)\}/g, '$1') };
  }
  if (d.cat === 'ombre') {
    if (id === 'appel') return { v: placeJoker(etat) ? 0.95 : -0.5, ligne: 'Un joker légendaire : rien ne frappe plus fort.' };
    if (id === 'abime') return { v: 0.45, ligne: 'Toutes tes mains montent d\'un niveau.' };
    return { v: 0.18, ligne: d.desc.replace(/\{[a-z]\|([^}]*)\}/g, '$1') };
  }
  return { v: 0, ligne: '' };
}
function valeurPaquet(etat, p) {
  const sans = { jokers: placeJoker(etat) ? 0.32 : 0.02, astres: 0.18, arcanes: 0.2, cartes: 0.08, ombres: 0.22 }[p.type] ?? 0.1;
  const prend = p.taille === 'immense' ? 1.4 : p.taille === 'grand' ? 1.15 : 1;
  return sans * prend;
}
const premiere = (t) => {
  const s = String(t || '').split(/(?<=[.!?])\s/)[0];
  return s.length > 110 ? s.slice(0, 107) + '...' : s;
};

export function conseilBoutique(etat, opts = {}) {
  const b = etat.boutique;
  if (!b || etat.phase !== 'boutique') return null;
  const argent = etat.argent;
  const pas = etat.regles.interetPar;
  const conseils = [];
  const jokers = b.articles.filter((a) => a.sorte === 'joker').map((a) => {
    const prix = P.prixArticle(etat, a);
    // v6 : un doublon fait monter le joker de la rangée (pas de place prise) ; une synergie complétée vaut cher.
    const doublon = P.cibleDoublon(etat, a);
    if (doublon) return { a, prix, v: 0.15 + 0.6 * Math.max(0, valeurJoker(a.id, null)), combos: [], doublon, syn: null };
    const combos = combosAjoutes(etat, a.id);
    const ap = apportSynergie(etat.jokers, a.id);
    const v = valeurJoker(a.id, a.edition) + 0.25 * combos.length + 0.45 * ap.complete.length + 0.12 * ap.avance.length;
    return { a, prix, v, combos, syn: ap.complete[0] || null };
  }).sort((x, y) => y.v - x.v);
  const pire = etat.jokers.filter((j) => !j.eternel).map((j) => ({ j, v: valeurJoker(j.id, j.edition) })).sort((x, y) => x.v - y.v)[0];
  // v5 : lookahead. On rejoue des mains tirées du paquet avec chaque joker du rayon dans la rangée :
  // le gain immédiat de score s'ajoute à la valeur mesurée par le simulateur (qui, elle, voit le long terme).
  if (opts.lookahead !== false && jokers.length) {
    const plein = !placeJoker(etat);
    const cands = jokers.filter((x) => !x.doublon).slice(0, 3).map((x) => ({ id: x.a.id, edition: x.a.edition, remplace: plein && pire ? pire.j.uid : null, x }));
    const la = lookaheadJokers(etat, cands, { budgetMs: opts.budgetMs ?? 400 });
    for (const r of la.res) {
      r.x.gainImmediat = r.gain;
      r.x.v += Math.max(-0.5, Math.min(1, r.gain * (opts.poidsLookahead ?? 1.5)));
    }
    jokers.sort((x, y) => y.v - x.v);
  }
  const best = jokers[0];
  if (best && P.peutPayer(etat, best.prix) && best.v > -0.2) {
    const nom = JOKER[best.a.id].nom;
    const pourquoiCombo = (best.syn ? ' Il complète la synergie ' + best.syn.nom + ' : ' + best.syn.effet.replace(/\{[a-z]\|([^}]*)\}/g, '$1') : '') + (best.combos.length ? ' Il forme ' + best.combos.map((c) => c.nom).join(' et ') + ' avec ta rangée.' : '');
    const immediat = best.gainImmediat != null && Math.abs(best.gainImmediat) > 0.02 ? ' Sur 10 mains tirées de ton paquet, il ' + (best.gainImmediat > 0 ? 'ferait monter' : 'ferait baisser') + ' ton score d\'environ ' + Math.round(Math.abs(Math.expm1(best.gainImmediat)) * 100) + ' %.' : '';
    const mesure = immediat + (VALEURS_JOKERS[best.a.id] !== undefined ? ' Dans les parties simulées, le prendre tôt vaut ' + (VALEURS_JOKERS[best.a.id] >= 0 ? '+' : '') + VALEURS_JOKERS[best.a.id].toFixed(2).replace('.', ',') + ' palier.' : '');
    if (best.doublon) {
      conseils.push({ action: 'acheter', uid: best.a.uid, titre: 'Achète le doublon de ' + nom, ligne: nom + ' monte d\'un niveau, sans prendre de place.', pourquoi: 'Ton ' + nom + ' passe au niveau ' + (best.doublon.niv ? best.doublon.niv + 1 : 2) + ' (effets ×1,4 puis ×1,8), sans prendre de place dans ta rangée.' + mesure });
    } else if (placeJoker(etat) || best.a.edition === 'inverte') {
      if (etat.jokers.length < 3 || best.v > 0.25 || argent - best.prix >= pas) {
        conseils.push({ action: 'acheter', uid: best.a.uid, titre: 'Achète ' + nom, ligne: best.syn ? 'Il complète ' + best.syn.nom + '.' : best.combos.length ? 'Il s\'accorde avec ta rangée (' + best.combos[0].nom + ').' : best.gainImmediat > 0.69 ? 'Il fait plus que doubler ton score actuel.' : best.gainImmediat > 0.02 ? 'Environ +' + Math.round(Math.expm1(best.gainImmediat) * 100) + ' % de score sur tes prochaines mains.' : 'Le meilleur joker du rayon pour ta rangée.', pourquoi: 'Le meilleur joker du rayon pour toi.' + mesure + pourquoiCombo + (etat.jokers.length < 3 ? ' Ta rangée est encore courte : chaque joker compte.' : '') });
      }
    } else if (pire && best.v > pire.v + 0.2) {
      conseils.push({ action: 'vendre', uid: pire.j.uid, puis: best.a.uid, titre: 'Vends ' + JOKER[pire.j.id].nom + ', prends ' + nom, ligne: 'Rangée pleine : ' + nom + ' fera bien plus que ' + JOKER[pire.j.id].nom + '.', pourquoi: 'Ta rangée est pleine. ' + JOKER[pire.j.id].nom + ' rapporte peu (' + fmt(valeurVenteJoker(etat, pire.j)) + ' louis à la revente) et ' + nom + ' vaut nettement mieux.' + pourquoiCombo });
    }
  }
  // v7 : chaque joker conseillé porte sa valeur ; les consommables et les paquets entrent dans la même course.
  for (const c of conseils) if (c.v === undefined) c.v = best ? best.v : 0;
  const pasFauche = (prix, v) => P.peutPayer(etat, prix) && (v > 0.3 || argent - prix >= Math.min(pas, 5) || argent < pas);
  for (const a of b.articles.filter((x) => x.sorte === 'conso')) {
    const prix = P.prixArticle(etat, a);
    if (!placeConso(etat) || !pasFauche(prix, 0)) continue;
    const r = valeurConsoBoutique(etat, a.id);
    if (r.v < 0.12) continue;
    const d = CONSO[a.id];
    const genre = d.cat === 'astre' ? 'Astre' : d.cat === 'ombre' ? 'Ombre' : 'Arcane';
    conseils.push({ action: 'acheter', uid: a.uid, v: r.v, titre: 'Achète ' + d.nom + ' (' + genre + ')', pourquoi: r.ligne + ' ' + d.desc.replace(/\{[a-z]\|([^}]*)\}/g, '$1'), ligne: r.ligne });
  }
  const typesVus = new Set();
  for (const p of (b.paquets || []).slice().sort((x, y) => valeurPaquet(etat, y) - valeurPaquet(etat, x))) {
    if (typesVus.has(p.type)) continue;
    typesVus.add(p.type);
    const prix = P.prixPaquet(etat, p);
    const v = valeurPaquet(etat, p);
    if (!pasFauche(prix, v) || v < 0.15) continue;
    const nom = nomPaquet(p.type, p.taille);
    const ligne = p.type === 'jokers' ? 'Tu as une place libre : un paquet de jokers te laisse choisir.' : p.type === 'astres' ? 'Des Astres au choix pour monter ta main favorite.' : p.type === 'arcanes' ? 'Des Arcanes au choix : de quoi travailler ton paquet.' : p.type === 'ombres' ? 'Des Ombres : puissantes, à choisir avec soin.' : 'Des cartes à ajouter à ton paquet.';
    conseils.push({ action: 'paquet', uid: p.uid, v: v * 0.75, titre: 'Ouvre le ' + nom, pourquoi: ligne + ' ' + (TYPES_PAQUET[p.type] ? TYPES_PAQUET[p.type].desc : ''), ligne });
  }
  conseils.sort((x, y) => (y.v || 0) - (x.v || 0));
  // Économie : les intérêts.
  const prochain = (Math.floor(argent / pas) + 1) * pas;
  const plafond = Math.max(0, etat.regles.interetMax);
  const interets = Math.min(plafond, Math.floor(Math.max(0, argent) / pas));
  if (!conseils.length) {
    if (interets < plafond && prochain - argent <= 2) conseils.push({ action: 'garder', titre: 'Garde tes louis', pourquoi: 'Encore ' + (prochain - argent) + ' louis et tu touches un intérêt de plus à chaque manche (1 par ' + pas + ' louis, ' + plafond + ' au plus).' });
    else if (argent >= P.prixRelance(etat) + 12) conseils.push({ action: 'relancer', titre: 'Relance la boutique', pourquoi: 'Rien ici ne vaut le coup et tu as de la marge : une relance coûte ' + P.prixRelance(etat) + ' louis.' });
    else conseils.push({ action: 'passer', titre: 'Passe à la manche suivante', pourquoi: 'Rien ne renforce vraiment ta rangée. Garder ' + argent + ' louis te rapporte ' + interets + ' d\'intérêts.' });
  }
  for (const c of conseils) if (!c.ligne) c.ligne = premiere(c.pourquoi);
  return Object.assign(conseils[0], { autres: conseils.slice(1, 4) });
}

// ------------------------------------------------------------ Astuces

// Une astuce de stratégie adaptée à la situation (ou null). `vues` : ids déjà montrées.
export function astuce(etat, vues = []) {
  const liste = [];
  const js = etat.jokers;
  // Ordre : les ×multi agissent mieux à droite, après les +multi.
  const texte = (j) => (JOKER[j.id] ? descDef(JOKER[j.id]) : '');
  const ix = js.findIndex((j) => /\{x\|/.test(texte(j)));
  const im = js.findIndex((j, i) => i > ix && /\{m\|\+/.test(texte(j)));
  if (ix >= 0 && im > ix) liste.push({ id: 'ordre', texte: 'Les jokers agissent de gauche à droite. Glisse ' + JOKER[js[ix].id].nom + ' (×multi) à droite de ' + JOKER[js[im].id].nom + ' (+multi) : multiplier un multi déjà gonflé rapporte plus.' });
  if (etat.phase === 'boutique' && etat.boutique) {
    for (const a of etat.boutique.articles.filter((x) => x.sorte === 'joker')) {
      const c = combosAjoutes(etat, a.id);
      if (c.length) {
        liste.push({ id: 'combo-' + a.id, texte: JOKER[a.id].nom + ' formerait ' + c[0].nom + ' avec ta rangée. Les combos ne changent pas le score, mais signalent des jokers qui se nourrissent du même style de jeu.' });
        break;
      }
    }
    const pas = etat.regles.interetPar;
    if (etat.argent % pas >= pas - 2 && etat.argent < pas * etat.regles.interetMax) liste.push({ id: 'interets', texte: 'Les intérêts : 1 louis par tranche de ' + pas + ' louis gardés, à chaque manche. Finir la boutique juste au-dessus d\'une tranche, c\'est de l\'argent gratuit.' });
  }
  const faibles = js.filter((j) => valeurJoker(j.id, j.edition) < -0.3);
  if (faibles.length && emplJokers(etat) - js.length <= 0) liste.push({ id: 'vendre-' + faibles[0].id, texte: JOKER[faibles[0].id].nom + ' est l\'un des jokers les moins utiles dans les parties simulées. Rangée pleine : vends-le dès qu\'un meilleur passe.' });
  if (etat.phase === 'manche' && etat.manche && etat.manche.defausses > 0 && etat.manche.mainsJouees === 0) liste.push({ id: 'defausse', texte: 'Les défausses sont gratuites : elles ne coûtent pas de main. Sers-t\'en pour viser une Couleur ou une Suite tôt dans la manche.' });
  const fav = mainLaPlusJouee(etat);
  if (fav && (etat.niveaux[fav] || {}).jouees >= 4) liste.push({ id: 'astre-' + fav, texte: 'Tu joues souvent la ' + nomMain(fav) + '. Les Astres montent son niveau : jetons et multi de base grimpent pour toute la partie.' });
  if (js.length >= 2 && !combosActifs(js).length) liste.push({ id: 'synergie', texte: 'Une rangée gagne quand ses jokers aiment la même chose (des têtes, des Couleurs, des défausses...). Choisis un style et achète dans ce sens.' });
  return liste.find((a) => !vues.includes(a.id)) || null;
}

// ============================================================ Le Mentor partout (v5)
// Paquets, consommables, ordre des jokers, mises à passer. Même principe que la boutique :
// on essaie chaque option sur une copie de la partie et on mesure le résultat sur des mains tirées du paquet.

const NOM_AMEL = { lestee: 'Lestée', ardente: 'Ardente', cameleon: 'Caméléon', cristal: 'Cristal', enclume: 'Enclume', doree: 'Dorée', veinarde: 'Veinarde' };
const cloner = (e) => JSON.parse(JSON.stringify(e, (k, v) => (k === 'evts' ? [] : v)));

// Mains d'essai : la main visible (si elle existe) puis des mains mêlant cartes visibles et paquet.
// Les cartes visibles reviennent souvent, car ce sont elles que les Arcanes touchent.
function mainsMelees(etat, n) {
  const rnd = alea(etat.palier * 1201 + (etat.stats.consos || 0) * 17 + etat.argent * 7 + etat.main.length);
  const vis = etat.main.slice();
  const tas = etat.paquet.map((c) => c.id).filter((id) => !vis.includes(id));
  const taille = Math.max(5, etat.regles.tailleMain || 8);
  const out = [];
  if (vis.length) out.push(vis.slice(0, taille));
  while (out.length < n) {
    const v = vis.slice();
    const t = tas.slice();
    const main = [];
    const nv = vis.length ? Math.min(v.length, Math.floor(taille / 2)) : 0;
    for (let i = 0; i < nv; i++) main.push(v.splice(Math.floor(rnd() * v.length), 1)[0]);
    while (main.length < taille && t.length) main.push(t.splice(Math.floor(rnd() * t.length), 1)[0]);
    out.push(main);
  }
  return out;
}

// Valeur d'une situation : force de la rangée et du paquet (log du score), jokers, louis, consommables gardés.
// ref (facultatif) : la situation de départ. Un joker perdu au hasard compte comme le meilleur perdu (prudence).
let dernierDetail = null;
function valeurSituation(e, ech, refEtat) {
  const base = baseLookahead(e);
  const f = forceRangee(base, base.jokers, ech);
  let vj = e.jokers.reduce((a, j) => a + valeurJoker(j.id, j.edition), 0);
  if (refEtat && e.jokers.length < refEtat.jokers.length) {
    const vals = refEtat.jokers.map((j) => valeurJoker(j.id, j.edition)).sort((a, b) => b - a);
    const perdus = refEtat.jokers.length - e.jokers.length;
    vj = vals.reduce((a, v) => a + v, 0) - vals.slice(0, perdus).reduce((a, v) => a + Math.max(0.3, v), 0);
  }
  const louis = Math.min(Math.max(0, e.argent), 30);
  dernierDetail = { f, vj, louis, argent: e.argent };
  return f + 0.5 * vj + 0.015 * louis + 0.04 * e.consommables.length;
}

// Texte du gain : en score si la force bouge, sinon en louis.
function texteGain(avant, apres) {
  if (!avant || !apres) return '';
  const df = apres.f - avant.f;
  const dl = apres.argent - avant.argent;
  const bouts = [];
  if (Math.abs(df) > 0.02) {
    const pc = Math.expm1(df) * 100;
    bouts.push(pc >= 100 ? 'ton score sur des mains d\'essai fait plus que doubler' : 'environ ' + (pc > 0 ? '+' : '') + Math.round(pc) + ' % de score sur des mains d\'essai');
  }
  if (dl) bouts.push((dl > 0 ? '+' : '') + dl + ' louis');
  return bouts.length ? ' Effet estimé : ' + bouts.join(', ') + '.' : '';
}

// Sélections de cartes à essayer pour un consommable qui vise 1 à max cartes.
function selections(etat, def, evalSel) {
  if (!def.max) return [{ sel: [], v: evalSel([]) }];
  const ids = etat.main.slice();
  const seules = ids.map((id) => ({ sel: [id], v: evalSel([id]) })).sort((a, b) => b.v - a.v);
  const out = seules.slice();
  if (def.max >= 2) {
    const top = seules.slice(0, 4).map((x) => x.sel[0]);
    for (let a = 0; a < top.length; a++) for (let b = a + 1; b < top.length; b++) {
      out.push({ sel: [top[a], top[b]], v: evalSel([top[a], top[b]]) });
      if (def.max >= 3) for (let c = b + 1; c < top.length; c++) out.push({ sel: [top[a], top[b], top[c]], v: evalSel([top[a], top[b], top[c]]) });
    }
  }
  return out.filter((x) => x.sel.length >= (def.min || 1)).sort((a, b) => b.v - a.v);
}

// Meilleure façon d'utiliser un consommable (tenu ou dans un paquet). appliquer(copie, sel) -> ok.
function meilleurUsage(etat, def, appliquer, ech, ref) {
  const essai = (sel) => {
    const c = cloner(etat);
    let ok = false;
    try {
      ok = appliquer(c, sel);
    } catch (e) {
      ok = false;
    }
    return ok ? valeurSituation(c, ech, etat) - ref : -9;
  };
  const sels = selections(etat, def, essai);
  if (!sels[0] || sels[0].v <= -9) return null;
  // Recalcule le détail du meilleur essai pour l'explication.
  essai(sels[0].sel);
  return { sel: sels[0].sel, gain: sels[0].v, detail: dernierDetail };
}

function expliquerConso(etat, def, sel) {
  const cartes = sel.length ? ' sur ' + nomCartes(etat, sel) : '';
  if (def.cat === 'astre') {
    const m = MAINS.find((x) => x.astre === def.id);
    const jouees = m && etat.niveaux[m.id] ? etat.niveaux[m.id].jouees || 0 : 0;
    return def.nom + ' monte d\'un niveau la main « ' + (m ? nomMain(m.id) : '?') + ' », pour toute la partie' + (jouees ? ' (tu l\'as jouée ' + jouees + ' fois).' : '.');
  }
  return 'Utilise ' + def.nom + cartes + '. ' + String(def.desc || '').replace(/\{[a-z]\|([^}]*)\}/g, '$1');
}

// Conseil dans un paquet ouvert : quoi prendre, sur quelles cartes, ou passer.
export function conseilPaquet(etat, opts = {}) {
  const p = etat.paquetOuvert;
  if (!p || etat.phase !== 'paquet') return null;
  const t0 = maintenant();
  const ech = mainsMelees(etat, opts.mains ?? 6);
  const ref = valeurSituation(etat, ech);
  const refDetail = dernierDetail;
  const options = [];
  // Les cartes à jouer ajoutées au paquet : un a priori simple (matières, éditions, sceaux, enseigne dominante).
  const compte = {};
  for (const c of etat.paquet) compte[c.ens] = (compte[c.ens] || 0) + 1;
  const dominante = Object.entries(compte).sort((a, b) => b[1] - a[1])[0];
  for (const c of p.choix) {
    if (maintenant() - t0 > (opts.budgetMs ?? 900)) break;
    if (c.sorte === 'retouche') {
      // v6 : la retouche. On mesure la carte retouchée sur les mains d'essai.
      const copie = cloner(etat);
      const k = copie.paquet.find((x) => x.id === c.carteId);
      if (!k) continue;
      k.niv = (k.niv || 0) + 1;
      const v = valeurSituation(copie, ech) - ref + 0.02;
      const orig = etat.paquet.find((x) => x.id === c.carteId);
      options.push({ c, sel: [], gain: Math.max(0.01, v), detail: dernierDetail, nom: nomCarte(orig), pourquoi: 'Retouche ' + nomCarte(orig) + (orig.rang >= 11 ? ' : une figure, elle marque souvent.' : ' : c\'est celle qui sert le plus dans tes mains.') });
      continue;
    }
    if (c.sorte === 'joker') {
      if (c.edition !== 'inverte' && !placeJoker(etat)) continue;
      const v = valeurSituation(Object.assign(cloner(etat), { jokers: etat.jokers.concat([{ uid: -9, id: c.id, edition: c.edition || null, etat: {}, bonusVente: 0 }]) }), ech) - ref;
      options.push({ c, sel: [], gain: v, detail: dernierDetail, pourquoi: JOKER[c.id].nom + ' est le meilleur choix : ' + (v > 0.3 ? 'il renforce nettement ta rangée.' : 'il complète ta rangée.') + (VALEURS_JOKERS[c.id] !== undefined ? ' Dans les parties simulées, le prendre tôt vaut ' + (VALEURS_JOKERS[c.id] >= 0 ? '+' : '') + VALEURS_JOKERS[c.id].toFixed(2).replace('.', ',') + ' palier.' : '') });
    } else if (c.sorte === 'carte') {
      const k = c.carte;
      const v = (k.amel ? 0.12 : 0) + (k.edition ? 0.15 : 0) + (k.sceau ? 0.1 : 0) + (k.rang >= 11 ? 0.05 : 0) + (dominante && k.ens === dominante[0] ? 0.05 : 0) - 0.06;
      options.push({ c, sel: [], gain: v, pourquoi: 'Ajoute ' + nomCarte(k) + (k.amel ? ' (' + (NOM_AMEL[k.amel] || k.amel) + ')' : '') + ' à ton paquet' + (dominante && k.ens === dominante[0] ? ' : elle suit ton enseigne principale.' : '.') });
    } else {
      const def = CONSO[c.id];
      const u = meilleurUsage(etat, def, (copie, sel) => P.choisirDansPaquet(copie, c.uid, sel).ok, ech, ref);
      if (u) options.push({ c, sel: u.sel, gain: u.gain, detail: u.detail, pourquoi: expliquerConso(etat, def, u.sel) });
      if (placeConso(etat)) options.push({ c, sel: [], garder: true, gain: 0.03 + (def.cat === 'astre' ? 0 : 0.02), pourquoi: 'Garde ' + def.nom + ' pour plus tard : aucune carte de cette main n\'en profite vraiment.' });
    }
  }
  options.sort((a, b) => b.gain - a.gain);
  const best = options[0];
  const ms = Math.round(maintenant() - t0);
  if (!best || best.gain <= 0) return { action: 'passer', ids: [], titre: 'Passe ce paquet', pourquoi: 'Rien ici n\'améliore ta partie : prendre une carte de plus diluerait ton paquet.', ms };
  const nom = best.nom || (best.c.sorte === 'joker' ? JOKER[best.c.id].nom : best.c.sorte === 'carte' ? nomCarte(best.c.carte) : CONSO[best.c.id].nom);
  const gainTxt = best.detail ? texteGain(refDetail, best.detail) : '';
  return { action: best.garder ? 'garder' : 'prendre', choix: best.c.uid, ids: best.sel, titre: (best.garder ? 'Garde ' : best.c.sorte === 'retouche' ? '' : 'Prends ') + (best.c.sorte === 'retouche' ? 'Retouche ' : '') + nom + (best.sel.length ? ' sur ' + nomCartes(etat, best.sel) : ''), pourquoi: best.pourquoi + gainTxt, ms };
}

// Faut-il utiliser un consommable tenu maintenant, et sur quelles cartes ?
export function conseilConso(etat, opts = {}) {
  if (!etat.consommables.length) return null;
  const t0 = maintenant();
  const ech = mainsMelees(etat, opts.mains ?? 6);
  const ref = valeurSituation(etat, ech) - 0.04; // le consommable gardé compte dans ref
  const refDetail = dernierDetail;
  let best = null;
  for (const k of etat.consommables) {
    if (maintenant() - t0 > (opts.budgetMs ?? 600)) break;
    const def = CONSO[k.id];
    if (!def || (def.max > 0 && !etat.main.length)) continue;
    const u = meilleurUsage(etat, def, (copie, sel) => P.utiliserConso(copie, k.uid, sel).ok, ech, ref);
    if (u && (!best || u.gain > best.gain)) best = { k, def, sel: u.sel, gain: u.gain, detail: u.detail };
  }
  if (!best || best.gain <= (opts.seuil ?? 0.03)) return null;
  return { action: 'utiliser', conso: best.k.uid, ids: best.sel, gain: best.gain, titre: 'Utilise ' + best.def.nom + (best.sel.length ? ' sur ' + nomCartes(etat, best.sel) : ''),
    pourquoi: expliquerConso(etat, best.def, best.sel) + texteGain(refDetail, best.detail), ms: Math.round(maintenant() - t0) };
}

// Ordre des jokers : on essaie les permutations (toutes jusqu'à 4 jokers, sinon les plus prometteuses).
function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const out = [];
  arr.forEach((x, i) => {
    for (const r of permutations(arr.slice(0, i).concat(arr.slice(i + 1)))) out.push([x].concat(r));
  });
  return out;
}
const rangOrdre = (j) => {
  const t = JOKER[j.id] ? descDef(JOKER[j.id]) : '';
  return /\{x\|/.test(t) ? 3 : /\{m\|\+/.test(t) ? 2 : /jetons/.test(t) ? 1 : 0;
};
export function conseilOrdre(etat, opts = {}) {
  const js = etat.jokers;
  if (js.length < 2) return null;
  const t0 = maintenant();
  const ech = mainsEchantillon(etat, opts.mains ?? 8, Math.max(5, etat.regles.tailleMain || 8));
  const base = baseLookahead(etat);
  const actuel = forceRangee(base, js, ech);
  let cands;
  if (js.length <= 4) cands = permutations(js);
  else {
    const tri = js.slice().sort((a, b) => rangOrdre(a) - rangOrdre(b));
    cands = [tri];
    for (let i = 0; i < js.length - 1; i++) {
      const s = tri.slice();
      [s[i], s[i + 1]] = [s[i + 1], s[i]];
      cands.push(s);
    }
  }
  let best = { r: js, f: actuel };
  for (const r of cands) {
    if (maintenant() - t0 > (opts.budgetMs ?? 500)) break;
    if (r.every((j, i) => j === js[i])) continue;
    const f = forceRangee(base, r, ech);
    if (f > best.f + 1e-9) best = { r, f };
  }
  const gain = best.f - actuel;
  if (gain < (opts.seuil ?? 0.01)) return null;
  return { action: 'ordonner', ordre: best.r.map((j) => j.uid), gain, titre: 'Range tes jokers : ' + best.r.map((j) => JOKER[j.id].nom).join(', '),
    pourquoi: 'Les jokers agissent de gauche à droite : les jetons et les +multi d\'abord, les ×multi ensuite. Dans cet ordre, ta rangée marque environ ' + Math.max(1, Math.round(Math.expm1(gain) * 100)) + ' % de plus.', ms: Math.round(maintenant() - t0) };
}

// Passer une mise (petite ou grande) contre son ticket ?
const VALEUR_TICKET = { t_rare: 0.55, t_inverte: 0.45, t_peu_commun: 0.35, t_eclat: 0.35, t_etoile: 0.35, t_bouffon: 0.3, t_astre: 0.3, t_epargne: 0.3, t_fortune: 0.2, t_arcane: 0.2, t_ombre: 0.2, t_relance: 0.1, t_bravo: 0.1 };
export function conseilChoix(etat, opts = {}) {
  if (etat.phase !== 'choix') return null;
  const idx = etat.mancheIdx;
  const ech = mainsEchantillon(etat, opts.mains ?? 8, Math.max(5, etat.regles.tailleMain || 8));
  const base = baseLookahead(etat);
  const force = Math.exp(forceRangee(base, etat.jokers, ech));
  const mains = Math.max(1, etat.regles.mains || 4);
  const capacite = force * mains * 0.75;
  const cible = P.cibleManche(etat, idx);
  const patron = P.cibleManche(etat, 2);
  const marge = capacite / patron;
  if (idx < 2) {
    const tid = P.infoPalier(etat).tickets[idx];
    const t = TICKET[tid];
    const v = VALEUR_TICKET[tid] ?? 0.2;
    if (marge >= (opts.margePasse ?? 2.2) && v >= 0.3) {
      return { action: 'passer', titre: 'Passe cette mise', ids: [], pourquoi: 'Ta rangée tient la route : environ ' + fmt(Math.round(capacite)) + ' points par manche, pour un patron à ' + fmt(patron) + '. ' + t.nom + ' vaut plus que les louis et la boutique de cette mise.' };
    }
    return { action: 'jouer', titre: 'Joue cette mise', ids: [], pourquoi: (marge < (opts.margePasse ?? 2.2) ? 'Ta rangée a besoin de la boutique : environ ' + fmt(Math.round(capacite)) + ' points par manche, pour un patron à ' + fmt(patron) + '.' : t.nom + ' ne vaut pas les louis et la boutique de cette mise.') + ' Cible : ' + fmt(cible) + '.' };
  }
  return { action: 'jouer', titre: 'Affronte le patron', ids: [], pourquoi: 'Le patron ne se passe pas. Environ ' + fmt(Math.round(capacite)) + ' points par manche avec ta rangée, pour une cible de ' + fmt(patron) + (marge < 1 ? ' : joue serré et garde tes défausses.' : '.') };
}

// v7 : faut-il ranger la main ? Par enseigne quand une Couleur se dessine, par rang quand des paires traînent.
export function conseilTri(etat) {
  if (etat.phase !== 'manche' || etat.main.length < 5) return null;
  const cartes = etat.main.map((id) => carteParId(etat, id)).filter((k) => k && !k.cachee);
  const ens = {};
  const rangs = {};
  for (const k of cartes) {
    ens[k.ens] = (ens[k.ens] || 0) + 1;
    rangs[k.rang] = (rangs[k.rang] || 0) + 1;
  }
  const [eTop, nTop] = Object.entries(ens).sort((x, y) => y[1] - x[1])[0] || [null, 0];
  const NOM = { P: 'Piques', C: 'Cœurs', K: 'Carreaux', T: 'Trèfles' };
  if (nTop >= 4 && etat.tri !== 'enseigne') return { mode: 'enseigne', titre: 'Trie par enseigne', ligne: nTop + ' ' + (NOM[eTop] || eTop) + ' en main : rangées ensemble, ta Couleur saute aux yeux.' };
  const paires = Object.values(rangs).filter((n) => n >= 2).length;
  if (paires >= 1 && nTop < 4 && etat.tri !== 'rang') return { mode: 'rang', titre: 'Trie par rang', ligne: 'Tes paires et suites se lisent mieux rangées par valeur.' };
  return null;
}

// v7 : la vision d'ensemble. Où en est la partie (louis, intérêts, rangée, patron) en une ligne.
export function visionPartie(etat) {
  const bouts = [];
  const pas = 5;
  const interets = Math.min(5, Math.floor(Math.max(0, etat.argent) / pas));
  const manque = pas - (etat.argent % pas);
  if (etat.phase === 'boutique') {
    if (interets < 5 && manque <= 2) bouts.push('à ' + manque + ' louis d\'un intérêt de plus');
    else if (interets >= 5) bouts.push('intérêts au plafond, dépense le surplus');
  }
  const places = emplJokers(etat) - etat.jokers.length;
  if (places > 0) bouts.push(places + ' place' + (places > 1 ? 's' : '') + ' libre' + (places > 1 ? 's' : '') + ' en rangée');
  const fav = mainLaPlusJouee(etat);
  if (fav) bouts.push('ta main phare : ' + nomMain(fav) + ' niv. ' + ((etat.niveaux[fav] && etat.niveaux[fav].niveau) || 1));
  return bouts.length ? 'Vue d\'ensemble : ' + bouts.join(', ') + '.' : '';
}

const avecLigne = (c) => {
  if (c && !c.ligne) c.ligne = premiere(c.pourquoi);
  return c;
};

// Le conseil complet, selon la phase : ce que le bouton MENTOR montre.
export function conseilPartout(etat, opts = {}) {
  if (etat.phase === 'paquet') return avecLigne(conseilPaquet(etat, opts));
  if (etat.phase === 'choix') return avecLigne(conseilChoix(etat, opts));
  if (etat.phase === 'manche') {
    const c = avecLigne(conseilConso(etat, { budgetMs: 300 }));
    const tri = conseilTri(etat);
    if (c && c.gain > 0.06) return Object.assign(c, { tri, autres: [] });
    const m = conseilManche(etat, opts);
    if (!m) return m;
    // v7 : la ligne dit pourquoi, pas seulement le calcul (« Double paire : 40 × 2 = 80. Il faut environ 73... »).
    const calc = /^([^:.]+) : [\d  ]+ × [\d  ,]+ = ([\d  ]+)\.\s*(.*)$/.exec(m.pourquoi || '');
    if (calc && !m.ligne) m.ligne = calc[1] + ' pour ' + calc[2].trim() + (calc[3] ? ' : ' + premiere(calc[3]).replace(/^./, (x) => x.toLowerCase()).replace(' : ', ', ') : '.');
    avecLigne(m);
    m.tri = tri;
    m.autres = c ? [c] : [];
    return m;
  }
  if (etat.phase === 'boutique') {
    const b = conseilBoutique(etat, opts);
    const c = avecLigne(conseilConso(etat, { budgetMs: 250 }));
    const o = avecLigne(conseilOrdre(etat, { budgetMs: 300 }));
    const vision = visionPartie(etat);
    let r;
    if (b && ['acheter', 'vendre', 'paquet'].includes(b.action)) r = b;
    else r = c || o || b;
    if (!r) return r;
    avecLigne(r);
    const autres = [];
    for (const x of [c, o, b].concat(b && b.autres ? b.autres : [])) if (x && x !== r && x.titre !== r.titre && !autres.some((y) => y.titre === x.titre)) autres.push(x);
    r.autres = autres.slice(0, 3);
    r.vision = vision;
    return r;
  }
  return null;
}

// Panneaux hors table : nouvelle partie, atelier de règles, collection, défi du jour, pause, aide.

import { M, versHtml, SENSATION, vibrer } from './moteur.js';
import { texte, largeurTexte } from './police.js';
import { toile, C, COUL_RARETE } from './dessin.js';
import { spriteJoker, spriteConso, spritePatron, spritePrivilege, LC, HC } from './sprites.js';
import { son, reglerMuet, reglerMusique } from './son.js';
import { JOKERS, RARETES, FAMILLES, descDef } from '../noyau/jokers.js';
import { CONSOS, NOM_CAT, PRIVILEGES } from '../noyau/consommables.js';
import { PATRONS } from '../noyau/patrons.js';
import { MAINS } from '../noyau/donnees.js';
import { JEUX, JEU, ENJEUX, REGLES_DEFAUT, BORNES, COURBES, normaliserRegles, basePalier, estClassique } from '../noyau/regles.js';
import { jokersVerrouilles, jeuDebloque, enjeuMax, VERROUS_JOKERS, defiDuJour, dateParis, defiTente, palmaresTroupe, semainesDefis, VERSION_NOUVEAUTES, tapisDebloques, niveauRenommee, TAPIS } from '../noyau/meta.js';
import { reglerTapis, VISUEL } from './table.js';
import { graineAleatoire, normaliserGraine } from '../noyau/rng.js';
import { AIDE_PUBLIC } from '../noyau/public.js';
import { fmt } from '../noyau/donnees.js';
import { EPREUVES, epreuveOuverte } from '../noyau/epreuves.js';
import { SYNERGIES, compositionSynergie } from '../noyau/synergies.js';
import { repliqueDe } from '../noyau/repliques.js';
import { toutDebloque } from '../noyau/meta.js';
import { spriteCarte, reglerDeco } from './sprites.js';

const racine = () => document.getElementById('panneau');

function el(tag, attrs = {}, enfants = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'texte') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(enfants)) if (c) e.append(c);
  return e;
}

// Titre en police bitmap, rendu dans un petit canvas.
function pix(str, echelle = 2, coul = C.or3) {
  const w = largeurTexte(str, 1) + 1;
  const [cv, g] = toile(w, 11);
  texte(g, str, 0, 4, { c: C.noir });
  texte(g, str, 0, 3, { c: coul });
  cv.className = 'pix';
  cv.style.width = 'calc(var(--px) * ' + w * echelle + ')';
  cv.style.height = 'calc(var(--px) * ' + 11 * echelle + ')';
  return cv;
}

function copie(sprite, echelle = 1) {
  const [cv, g] = toile(sprite.width, sprite.height);
  g.drawImage(sprite, 0, 0);
  cv.style.width = 'calc(var(--px) * ' + sprite.width * echelle + ')';
  cv.style.height = 'calc(var(--px) * ' + sprite.height * echelle + ')';
  return cv;
}

function mystere(r, w = LC, h = HC) {
  const [cv, g] = toile(w, h);
  const k = COUL_RARETE[r] || [C.nuit4, C.gris2, C.nuit];
  g.fillStyle = C.noir;
  g.fillRect(1, 0, w - 2, h);
  g.fillRect(0, 1, w, h - 2);
  g.fillStyle = k[2];
  g.fillRect(1, 1, w - 2, h - 2);
  g.fillStyle = C.nuit;
  g.fillRect(4, 4, w - 8, h - 8);
  for (let j = 0; j < h / 8; j++) for (let i = 0; i < w / 8; i++) if ((i + j) % 2) {
    g.fillStyle = C.nuit2;
    g.fillRect(4 + i * 8, 4 + j * 8, Math.min(8, w - 8 - i * 8), Math.min(8, h - 8 - j * 8));
  }
  texte(g, '?', w / 2, h / 2 - 10, { c: k[0], e: 3, a: 'c' });
  cv.style.width = 'calc(var(--px) * ' + w * 0.75 + ')';
  cv.style.height = 'calc(var(--px) * ' + h * 0.75 + ')';
  return cv;
}

function bouton(label, classe, action, attrs = {}) {
  return el('button', Object.assign({ class: 'btn ' + (classe || ''), onclick: (e) => {
    son.clic();
    action(e);
  } }, attrs), label);
}

function fenetre(titre, corps, pied, classe = '') {
  const f = el('div', { class: 'fenetre ' + classe }, [
    el('div', { class: 'f-tete' }, [pix(titre, 2, C.or3)]),
    el('div', { class: 'f-corps' }, corps),
    pied ? el('div', { class: 'f-pied' }, pied) : null,
  ]);
  return f;
}

export function fermer(app) {
  const r = racine();
  r.hidden = true;
  r.innerHTML = '';
  M.bloque = false;
  app.panneau = null;
}

function montrer(app, nom, noeud) {
  const r = racine();
  r.innerHTML = '';
  r.append(noeud);
  r.hidden = false;
  M.bloque = true;
  app.panneau = nom;
}

export function ouvrir(app, nom, args) {
  const f = { sauvegarde: panneauSauvegarde, nouvelle: panneauNouvelle, atelier: panneauAtelier, collection: panneauCollection, defi: panneauDefi, pause: panneauPause, aide: panneauAide, nouveautes: panneauNouveautes, epreuves: panneauEpreuves, lecon: panneauLecon }[nom];
  if (f) montrer(app, nom, f(app, args || {}));
}

// --------------------------------------------------------- Nouvelle partie

function choixJeu(app, courant, surChoix) {
  const g = el('div', { class: 'grille g3' });
  const dessiner = () => {
    g.innerHTML = '';
    for (const j of JEUX) {
      const ok = jeuDebloque(app.meta, j.id);
      g.append(el('div', {
        class: 'tuile' + (courant.v === j.id ? ' choisie' : '') + (ok ? '' : ' verrou'),
        onclick: () => {
          if (!ok) return;
          courant.v = j.id;
          son.choisir();
          dessiner();
          if (surChoix) surChoix();
        },
      }, [el('b', { texte: j.nom }), el('small', { html: ok ? versHtml(j.desc) : '<span class="cond">Verrouillé. ' + j.deblocage + '</span>' })]));
    }
  };
  dessiner();
  return g;
}

function choixEnjeu(app, courant, libre) {
  const boite = el('div');
  const desc = el('p', { class: 'discret' });
  const p = el('div', { class: 'pastilles' });
  const max = libre ? ENJEUX.length - 1 : enjeuMax(app.meta);
  const dessiner = () => {
    p.innerHTML = '';
    ENJEUX.forEach((e, i) => {
      const ok = i <= max;
      p.append(el('div', {
        class: 'pastille' + (courant.v === i ? ' choisie' : '') + (ok ? '' : ' verrou'),
        title: ok ? e.desc : 'Gagne une partie classique avec l\'enjeu ' + ENJEUX[i - 1].nom + '.',
        texte: e.nom,
        onclick: () => {
          if (!ok) return;
          courant.v = i;
          son.choisir();
          dessiner();
        },
      }));
    });
    const cumul = ENJEUX.slice(1, courant.v + 1).map((e) => e.desc).join(' ');
    desc.textContent = courant.v === 0 ? 'Bois : aucun malus. Gagne pour ouvrir l\'enjeu suivant.' : ENJEUX[courant.v].nom + ', malus cumulés : ' + cumul;
  };
  dessiner();
  boite.append(p, desc);
  return boite;
}

function champGraine(valeur) {
  const input = el('input', { type: 'text', class: 'graine', maxlength: 16, placeholder: 'AU HASARD', value: valeur || '', spellcheck: 'false' });
  input.addEventListener('input', () => {
    input.value = normaliserGraine(input.value);
  });
  return input;
}

function panneauNouvelle(app) {
  const jeu = { v: jeuDebloque(app.meta, app.meta.dernierJeu || 'carmin') ? app.meta.dernierJeu || 'carmin' : 'carmin' };
  const enjeu = { v: Math.min(enjeuMax(app.meta), app.meta.dernierEnjeu || 0) };
  const graine = champGraine('');
  const zen = el('input', { type: 'checkbox', 'data-zen': '1' });
  const corps = [
    el('h3', { texte: 'Jeu de départ' }),
    choixJeu(app, jeu),
    el('h3', { texte: 'Enjeu' }),
    choixEnjeu(app, enjeu, false),
    el('h3', { texte: 'Graine' }),
    el('div', { class: 'ligne' }, [
      graine,
      bouton('Tirer', 'nuit petit', () => {
        graine.value = graineAleatoire();
      }),
      el('span', { class: 'discret', texte: 'Laisse vide pour une graine au hasard. Même graine, mêmes cartes et mêmes boutiques.' }),
    ]),
    el('h3', { texte: 'Mode zen' }),
    el('label', { class: 'ligne' }, [zen, el('span', { html: ' <b>Sans échec</b> : à court de mains, la manche passe quand même. Pour construire des combos tranquille. Ne compte ni pour les statistiques ni pour les déblocages.' })]),
  ];
  const pied = [
    el('div', { class: 'gauche' }, [bouton('Atelier de règles', 'nuit', () => ouvrir(app, 'atelier'))]),
    bouton('Retour', 'nuit', () => fermer(app)),
    bouton('Lancer la partie', 'or', () => {
      app.meta.dernierJeu = jeu.v;
      app.meta.dernierEnjeu = enjeu.v;
      fermer(app);
      app.nouvellePartie({ graine: graine.value, zen: zen.checked, regles: Object.assign({}, REGLES_DEFAUT, { jeu: jeu.v, enjeu: enjeu.v }) });
    }),
  ];
  return fenetre('Nouvelle partie', corps, pied);
}

// ---------------------------------------------------------------- Atelier

const CHAMPS = [
  ['paliers', 'Paliers pour gagner', 'Nombre de patrons à battre.'],
  ['mains', 'Mains par manche', ''],
  ['defausses', 'Défausses par manche', ''],
  ['tailleMain', 'Cartes en main', ''],
  ['emplJokers', 'Emplacements de jokers', ''],
  ['emplConsos', 'Emplacements de consommables', ''],
  ['argentDepart', 'Louis de départ', ''],
  ['interetPar', 'Intérêts : 1 louis par tranche de', ''],
  ['interetMax', 'Intérêts : plafond par manche', ''],
  ['coutRelance', 'Prix de la première relance', ''],
];

function panneauAtelier(app) {
  const r = normaliserRegles(app.meta.atelier || REGLES_DEFAUT);
  const jeu = { v: r.jeu };
  const enjeu = { v: r.enjeu };
  const graine = champGraine('');
  const apercu = el('p', { class: 'discret' });
  const majApercu = () => {
    const vals = [];
    for (let p = 1; p <= Math.min(r.paliers, 8); p++) vals.push(fmt(Math.round(basePalier(r, p))));
    apercu.textContent = 'Petite mise par palier : ' + vals.join(', ') + (r.paliers > 8 ? ', ...' : '') + '. Grande mise ×1,5. Patron ×2.';
  };
  const lignes = el('div', { class: 'colonnes' });
  const inputs = {};
  for (const [cle, label] of CHAMPS) {
    const input = el('input', { type: 'number', min: BORNES[cle][0], max: BORNES[cle][1], step: 1, value: r[cle] });
    input.addEventListener('change', () => {
      const v = Math.min(BORNES[cle][1], Math.max(BORNES[cle][0], Math.round(Number(input.value) || 0)));
      input.value = v;
      r[cle] = v;
      majApercu();
    });
    inputs[cle] = input;
    lignes.append(el('div', { class: 'ligne' }, [el('label', { texte: label }), input]));
  }
  // Courbe et facteur de score.
  const courbe = el('select');
  for (const [k, c] of Object.entries(COURBES)) courbe.append(el('option', { value: k, texte: c.nom + ' : ' + c.desc, selected: r.courbe === k }));
  courbe.addEventListener('change', () => {
    r.courbe = courbe.value;
    majApercu();
  });
  const valF = el('span', { class: 'val', texte: '×' + String(r.facteurCible).replace('.', ',') });
  const facteur = el('input', { type: 'range', min: 0.25, max: 4, step: 0.25, value: r.facteurCible });
  facteur.addEventListener('input', () => {
    r.facteurCible = Number(facteur.value);
    valF.textContent = '×' + String(r.facteurCible).replace('.', ',');
    majApercu();
  });
  // Le public : applaudimètre et rappels.
  const cochePublic = el('input', { type: 'checkbox', checked: r.public !== false });
  cochePublic.addEventListener('change', () => (r.public = cochePublic.checked));
  const lignePublic = el('label', { class: 'coche' }, [cochePublic, el('span', { texte: 'Le public : applaudimètre, ovations et rappels' })]);
  // Familles de jokers.
  const familles = el('div', { class: 'colonnes' });
  const coche = (cle, label, n) => {
    const c = el('input', { type: 'checkbox', checked: r.familles[cle] !== false });
    c.addEventListener('change', () => {
      if (c.checked) delete r.familles[cle];
      else r.familles[cle] = false;
    });
    familles.append(el('label', { class: 'coche' }, [c, el('span', { texte: label + ' (' + n + ')' })]));
  };
  for (const [k, nom] of Object.entries(FAMILLES)) coche(k, nom, JOKERS.filter((j) => j.fam === k).length);
  coche('signature', 'Signatures Velours', JOKERS.filter((j) => j.sig).length);

  // Profils.
  const profils = el('select');
  const majProfils = () => {
    profils.innerHTML = '';
    profils.append(el('option', { value: '', texte: 'Profils sauvés...' }));
    app.meta.profils.forEach((p, i) => profils.append(el('option', { value: i, texte: p.nom })));
  };
  majProfils();
  const recharger = (regles) => {
    app.meta.atelier = normaliserRegles(regles);
    ouvrir(app, 'atelier');
  };
  profils.addEventListener('change', () => {
    const p = app.meta.profils[Number(profils.value)];
    if (p && profils.value !== '') recharger(p.regles);
  });
  const nomProfil = el('input', { type: 'text', placeholder: 'Nom du profil', maxlength: 24, style: 'width: calc(var(--px) * 80)' });

  const corps = [
    el('p', { class: 'discret', texte: 'Règle tout avant de jouer. Les valeurs de départ donnent le rythme classique. Une partie d\'atelier remplit la collection, mais ne débloque pas les enjeux.' }),
    el('h3', { texte: 'Rythme de la partie' }),
    lignes,
    lignePublic,
    el('h3', { texte: 'Score demandé' }),
    el('div', { class: 'ligne' }, [el('label', { texte: 'Courbe' }), courbe]),
    el('div', { class: 'ligne' }, [el('label', { texte: 'Facteur sur tous les scores demandés' }), facteur, valF]),
    apercu,
    el('h3', { texte: 'Jeu de départ' }),
    choixJeu({ meta: { stats: { palierMax: 99, victoires: 99, enjeuGagneMax: 99, astres: 999 }, decouvert: { jokers: Object.fromEntries(JOKERS.map((j) => [j.id, 1])) } } }, jeu, () => (r.jeu = jeu.v)),
    el('h3', { texte: 'Enjeu' }),
    choixEnjeu(app, enjeu, true),
    el('h3', { texte: 'Familles de jokers en jeu' }),
    familles,
    el('h3', { texte: 'Profils' }),
    el('div', { class: 'ligne' }, [
      profils,
      nomProfil,
      bouton('Sauver', 'vert petit', () => {
        const nom = nomProfil.value.trim() || 'Profil ' + (app.meta.profils.length + 1);
        r.jeu = jeu.v;
        r.enjeu = enjeu.v;
        const i = app.meta.profils.findIndex((p) => p.nom === nom);
        const p = { nom, regles: normaliserRegles(r) };
        if (i >= 0) app.meta.profils[i] = p;
        else app.meta.profils.push(p);
        app.meta.profils = app.meta.profils.slice(-12);
        app.sauverMeta();
        majProfils();
        nomProfil.value = '';
      }),
      bouton('Supprimer', 'rouge petit', () => {
        if (profils.value === '') return;
        app.meta.profils.splice(Number(profils.value), 1);
        app.sauverMeta();
        majProfils();
      }),
    ]),
  ];
  majApercu();
  const pied = [
    el('div', { class: 'gauche' }, [
      bouton('Valeurs classiques', 'nuit', () => recharger(REGLES_DEFAUT)),
      el('span', { class: 'discret', texte: 'Graine' }),
      graine,
    ]),
    bouton('Retour', 'nuit', () => {
      r.jeu = jeu.v;
      r.enjeu = enjeu.v;
      app.meta.atelier = normaliserRegles(r);
      app.sauverMeta();
      fermer(app);
    }),
    bouton('Jouer avec ces règles', 'or', () => {
      r.jeu = jeu.v;
      r.enjeu = enjeu.v;
      const regles = normaliserRegles(r);
      app.meta.atelier = regles;
      app.sauverMeta();
      fermer(app);
      app.nouvellePartie({ graine: graine.value, regles, atelier: !estClassique(Object.assign({}, regles, { jeu: REGLES_DEFAUT.jeu, enjeu: 0 })), toutDebloque: true });
    }),
  ];
  return fenetre('Atelier de règles', corps, pied);
}

// ------------------------------------------------------------- Collection

const pluriel = (n, mot) => n + ' ' + mot + (n > 1 ? 's' : '');

// Ce que tu as vécu avec un joker : parties, victoires, meilleure main.
function carnetJoker(meta, id) {
  const t = (meta.troupe || {})[id];
  if (!t || !t.parties) return '<p class="carnet discret">Jamais engagé dans une partie terminée.</p>';
  return '<p class="carnet">Engagé dans <b>' + pluriel(t.parties, 'partie') + '</b>, <b>' + pluriel(t.victoires, 'victoire') + '</b> (' + Math.round((100 * t.victoires) / t.parties) + ' %).<br>' +
    'Meilleure main ensemble : <b>' + fmt(t.meilleure) + '</b>.<br>' + pluriel(t.mains, 'main') + ' jouée' + (t.mains > 1 ? 's' : '') + ' côte à côte.</p>';
}

function panneauCollection(app, args) {
  const meta = app.meta;
  const onglet = { v: args.onglet || 'jokers' };
  const corps = el('div');
  const verrous = jokersVerrouilles(meta);
  const dessiner = () => {
    corps.innerHTML = '';
    const onglets = el('div', { class: 'onglets' });
    const noms = { jokers: 'Jokers', synergies: 'Synergies', consos: 'Consommables', patrons: 'Patrons', mains: 'Mains', jeux: 'Jeux et enjeux', parties: 'Parties' };
    for (const [k, nom] of Object.entries(noms)) {
      onglets.append(el('div', { class: 'onglet' + (onglet.v === k ? ' actif' : ''), texte: nom, onclick: () => {
        onglet.v = k;
        son.clic();
        dessiner();
      } }));
    }
    corps.append(onglets);
    const fiche = el('div', { class: 'fiche' });
    const montrerFiche = (titre, sous, coul, html) => {
      fiche.innerHTML = '';
      fiche.append(el('h4', { texte: titre }), el('div', { class: 'rar', style: 'color:' + coul, texte: sous }), el('div', { html }));
    };
    const vignettes = el('div', { class: 'vignettes' });
    if (onglet.v === 'jokers') {
      const vus = meta.decouvert.jokers;
      const n = JOKERS.filter((j) => vus[j.id]).length;
      corps.append(el('p', { class: 'discret', texte: n + ' jokers découverts sur ' + JOKERS.length + '. Survole une carte pour lire sa fiche.' }));
      const ordre = { C: 0, U: 1, R: 2, E: 3, L: 4 };
      for (const j of JOKERS.slice().sort((a, b) => ordre[a.r] - ordre[b.r])) {
        const verrou = verrous.includes(j.id);
        const connu = !!vus[j.id] || toutDebloque(meta);
        const v = el('div', { class: 'vignette' + (verrou ? ' verrou' : '') }, connu || verrou ? copie(spriteJoker(j.id), 0.75) : mystere(j.r));
        v.addEventListener('mouseenter', () => {
          if (verrou) montrerFiche('Joker verrouillé', RARETES[j.r].nom, COUL_RARETE[j.r][1], '<span class="t-m">' + VERROUS_JOKERS.find((x) => x.id === j.id).cond + '</span>');
          else if (!connu) montrerFiche('Pas encore croisé', RARETES[j.r].nom, COUL_RARETE[j.r][1], '<span class="t-g">Tu le découvriras en boutique ou dans un paquet.</span>');
          else montrerFiche(j.nom, RARETES[j.r].nom + (j.sig ? ' · Signature Velours' : ''), COUL_RARETE[j.r][1], '<p class="replique">« ' + repliqueDe(j.id) + ' »</p>' + versHtml(descDef(j)) + '<p class="discret">Famille : ' + FAMILLES[j.fam] + '</p>' + carnetJoker(meta, j.id));
        });
        vignettes.append(v);
      }
      montrerFiche('La troupe', 'Collection', C.or3, 'Quatre raretés : commun, peu commun, rare, légendaire. Le petit V doré marque les signatures Velours.');
      corps.append(el('div', { class: 'collection' }, [vignettes, fiche]));
    } else if (onglet.v === 'synergies') {
      // v6 : le codex des synergies, avec leur composition (toujours visible) et si tu les as déjà réunies.
      const vues = meta.decouvert.synergies || {};
      corps.append(el('p', { class: 'discret', texte: SYNERGIES.filter((s) => vues[s.id]).length + ' synergies réunies sur ' + SYNERGIES.length + '. Réunis les jokers indiqués dans ta rangée : l\'effet s\'active tant qu\'ils sont tous sur scène (un joker muselé ne compte pas).' }));
      const liste = el('div', { class: 'synergies' });
      for (const sy of SYNERGIES) {
        const faite = !!vues[sy.id];
        const portraits = el('div', { class: 'syn-portraits' }, sy.membres.map((id) => copie(spriteJoker(id), 0.5)));
        liste.append(el('div', { class: 'syn' + (faite ? ' faite' : '') }, [
          portraits,
          el('div', {}, [
            el('b', { texte: (faite ? '★ ' : '') + sy.nom }),
            el('small', { html: '<span class="discret">' + compositionSynergie(sy) + '</span><br>' + versHtml(sy.effet) + (faite ? '' : '<br><span class="t-g">Jamais réunie.</span>') }),
          ]),
        ]));
      }
      corps.append(liste);
    } else if (onglet.v === 'consos') {
      const vus = meta.decouvert.consos;
      corps.append(el('p', { class: 'discret', texte: CONSOS.filter((c) => vus[c.id]).length + ' consommables découverts sur ' + CONSOS.length + ', et ' + PRIVILEGES.length + ' privilèges.' }));
      for (const c of CONSOS) {
        const connu = !!vus[c.id];
        const v = el('div', { class: 'vignette' }, connu ? copie(spriteConso(c.id), 0.75) : mystere(null));
        v.addEventListener('mouseenter', () => montrerFiche(connu ? c.nom : 'Pas encore croisé', NOM_CAT[c.cat], c.cat === 'astre' ? C.bleu2 : c.cat === 'ombre' ? C.gris3 : C.violet2, connu ? versHtml(c.desc) : ''));
        vignettes.append(v);
      }
      for (const p of PRIVILEGES) {
        const v = el('div', { class: 'vignette' }, copie(spritePrivilege(p.id), 0.75));
        v.addEventListener('mouseenter', () => montrerFiche(p.nom, 'Privilège', C.or3, versHtml(p.desc)));
        vignettes.append(v);
      }
      montrerFiche('Consommables', 'Collection', C.or3, 'Les Arcanes transforment tes cartes. Les Astres montent tes mains de niveau. Les Ombres sont puissantes, avec un prix.');
      corps.append(el('div', { class: 'collection' }, [vignettes, fiche]));
    } else if (onglet.v === 'patrons') {
      const vus = meta.decouvert.patrons;
      corps.append(el('p', { class: 'discret', texte: PATRONS.filter((p) => vus[p.id]).length + ' patrons affrontés sur ' + PATRONS.length + '.' }));
      for (const p of PATRONS) {
        const connu = !!vus[p.id];
        const v = el('div', { class: 'vignette' }, connu ? copie(spritePatron(p, 64), 0.75) : mystere('R', 64, 64));
        v.addEventListener('mouseenter', () => montrerFiche(connu ? p.nom : 'Pas encore affronté', p.final ? 'Patron final' : 'Patron, dès le palier ' + p.palierMin, C.rouge2, connu ? versHtml(p.desc) : ''));
        vignettes.append(v);
      }
      montrerFiche('Les patrons', 'Collection', C.or3, 'Un patron ferme chaque palier, avec sa règle à lui. Ceux du dernier palier sont à part.');
      corps.append(el('div', { class: 'collection' }, [vignettes, fiche]));
    } else if (onglet.v === 'mains') {
      const t = el('table', { class: 'mains' });
      t.append(el('tr', {}, [el('th', { texte: 'Main' }), el('th', { texte: 'Base' }), el('th', { texte: 'Par niveau' }), el('th', { texte: 'Astre' }), el('th', { texte: 'Jouée' })]));
      for (const m of MAINS.slice().reverse()) {
        const vue = !!meta.decouvert.mains[m.id];
        if (m.cachee && !vue) {
          t.append(el('tr', {}, [el('td', { class: 'discret', texte: 'Main secrète' }), el('td', { texte: '?' }), el('td', { texte: '?' }), el('td', { texte: '?' }), el('td', { texte: 'Jamais' })]));
          continue;
        }
        const astre = CONSOS.find((c) => c.id === m.astre);
        t.append(el('tr', {}, [
          el('td', { texte: m.nom }),
          el('td', { html: '<span class="jeton-j">' + m.jetons + '</span> × <span class="jeton-m">' + m.multi + '</span>' }),
          el('td', { html: '<span class="jeton-j">+' + m.pasJ + '</span> et <span class="jeton-m">+' + m.pasM + '</span>' }),
          el('td', { texte: astre.nom }),
          el('td', { class: vue ? 'gagne' : 'discret', texte: vue ? 'Oui' : 'Pas encore' }),
        ]));
      }
      corps.append(t);
    } else if (onglet.v === 'jeux') {
      const g = el('div', { class: 'grille g3' });
      for (const j of JEUX) {
        const ok = jeuDebloque(meta, j.id);
        g.append(el('div', { class: 'tuile' + (ok ? '' : ' verrou'), style: 'cursor:default' }, [el('b', { texte: j.nom }), el('small', { html: versHtml(j.desc) + (ok ? '' : '<br><span class="cond">' + j.deblocage + '</span>') })]));
      }
      corps.append(el('h3', { texte: 'Jeux de départ' }), g, el('h3', { texte: 'Enjeux' }));
      const max = enjeuMax(meta);
      ENJEUX.forEach((e, i) => corps.append(el('div', { class: 'stat' }, [el('span', { html: '<b>' + e.nom + '</b> ' + e.desc }), el('span', { class: i <= max ? 'gagne' : 'discret', texte: i <= meta.stats.enjeuGagneMax ? 'Gagné' : i <= max ? 'Ouvert' : 'Verrouillé' })])));
    } else {
      const s = meta.stats;
      corps.append(el('h3', { texte: 'En chiffres' }));
      for (const [a, b] of [['Parties terminées', s.parties], ['Victoires', s.victoires], ['Meilleur palier atteint', s.palierMax], ['Meilleure main', fmt(s.meilleureMain)], ['Mains jouées', fmt(s.mainsJouees)], ['Patrons battus', s.patronsBattus], ['Astres utilisés', s.astres]]) {
        corps.append(el('div', { class: 'stat' }, [el('span', { texte: a }), el('b', { texte: String(b) })]));
      }
      corps.append(el('h3', { texte: 'Ta troupe fétiche' }));
      const palmares = palmaresTroupe(meta, 6);
      if (!palmares.length) corps.append(el('p', { class: 'discret', texte: 'Termine une partie avec des jokers pour remplir le carnet de la troupe.' }));
      for (const t of palmares) {
        corps.append(el('div', { class: 'stat' }, [
          el('span', { html: '<b>' + t.nom + '</b> · ' + pluriel(t.parties, 'partie') + ' · ' + pluriel(t.victoires, 'victoire') + ' (' + Math.round(t.taux * 100) + ' %)' }),
          el('span', { html: 'Meilleure main <b>' + fmt(t.meilleure) + '</b>' }),
        ]));
      }
      corps.append(el('h3', { texte: 'Dernières parties' }));
      if (!meta.historique.length) corps.append(el('p', { class: 'discret', texte: 'Aucune partie terminée pour le moment.' }));
      for (const h of meta.historique) {
        const quand = h.date ? new Date(h.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';
        corps.append(el('div', { class: 'stat' }, [
          el('span', { html: '<span class="' + (h.gagne ? 'gagne' : 'perdu') + '">' + (h.gagne ? 'Victoire' : 'Palier ' + h.palier) + '</span> · ' + (JEU[h.jeu] ? JEU[h.jeu].nom : h.jeu) + ' · ' + ENJEUX[h.enjeu].nom + (h.defi ? ' · Défi' : '') + (h.atelier ? ' · Atelier' : '') + ' · <span class="discret">' + quand + '</span>' }),
          el('span', { html: 'Meilleure main <b>' + fmt(h.meilleureMain) + '</b> · graine <b>' + h.graine + '</b>' }),
        ]));
        // v7 : le journal de la partie.
        const jr = h.journal;
        if (jr && (jr.main || jr.combo)) {
          const bouts = [];
          if (jr.main) bouts.push('Plus grosse main : <b>' + (MAINS.find((x) => x.id === jr.main.type) || { nom: jr.main.type }).nom + '</b> ' + jr.main.cartes.join(' ') + ' = <b>' + fmt(jr.main.total) + '</b> (palier ' + jr.main.palier + ')');
          if (jr.combo) bouts.push('Plus beau combo : <b>' + jr.combo.n + ' jokers</b> ensemble (' + jr.combo.jokers.map((id) => (JOKERS.find((x) => x.id === id) || { nom: id }).nom).join(', ') + ') pour ' + fmt(jr.combo.total));
          if (h.crescendoMax) bouts.push('Crescendo : marche ' + h.crescendoMax + (h.crescendoMax >= 5 ? ', apothéose !' : ''));
          corps.append(el('div', { class: 'journal discret', html: bouts.join('<br>') }));
        }
      }
    }
  };
  dessiner();
  return fenetre('Collection', corps, [bouton('Fermer', 'nuit', () => fermer(app))]);
}

// ----------------------------------------------------------- Défi du jour

function panneauDefi(app) {
  const d = defiDuJour(dateParis());
  const mien = app.meta.defis[d.date];
  const jour = new Date(d.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const corps = [
    el('p', { html: 'Défi du <b>' + jour + '</b>. Une seule graine pour tout le monde, 5 paliers, et un score à battre.' }),
    el('h3', { texte: 'Règles du jour' }),
    el('div', { class: 'grille g3' }, [
      el('div', { class: 'tuile', style: 'cursor:default' }, [el('b', { texte: JEU[d.jeu].nom }), el('small', { html: versHtml(JEU[d.jeu].desc) })]),
      ...d.modifs.map((m) => el('div', { class: 'tuile', style: 'cursor:default' }, [el('b', { texte: m.nom }), el('small', { texte: m.desc })])),
    ]),
    el('h3', { texte: 'Joker du jour' }),
    (() => {
      const j = JOKERS.find((x) => x.id === d.jokerDuJour);
      if (!j) return el('p', { class: 'discret', texte: '' });
      return el('div', { class: 'joker-jour', 'data-joker': j.id }, [
        el('div', { class: 'vignette' }, copie(spriteJoker(j.id), 0.75)),
        el('div', {}, [el('b', { texte: j.nom }), el('small', { class: 'rar-' + j.r, texte: ' ' + RARETES[j.r].nom }), el('p', { html: versHtml(descDef(j)) }), el('p', { class: 'discret', texte: 'Offert à tout le monde au départ du défi. La maison a relevé son score en conséquence.' })]),
      ]);
    })(),
    el('h3', { texte: 'Score à battre' }),
    el('div', { class: 'stat' }, [el('span', { texte: 'Score de la maison (total marqué sur la partie)' }), el('b', { texte: fmt(d.scoreMaison) })]),
    el('div', { class: 'stat' }, [el('span', { texte: 'Ton meilleur score du jour' }), el('b', { class: mien && mien.score >= d.scoreMaison ? 'gagne' : '', texte: mien ? fmt(mien.score) + (mien.score >= d.scoreMaison ? ' : maison battue' : '') : 'Pas encore joué' })]),
    el('div', { class: 'stat' }, [el('span', { texte: 'Graine du jour' }), el('b', { texte: d.graine })]),
    el('h3', { texte: 'Ton classement, semaine par semaine' }),
  ];
  const semaines = semainesDefis(app.meta).slice(0, 8);
  if (!semaines.length) corps.push(el('p', { class: 'discret', texte: 'Rien encore. Joue le défi du jour, puis reviens demain pour le suivant.' }));
  const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  for (const s of semaines) {
    const cases = el('span', { class: 'semaine' }, s.jours.map((j, i) => el('span', {
      class: 'jour' + (j ? (j.battu ? ' battu' : ' joue') : '') + (j && j.date === d.date ? ' auj' : ''),
      texte: JOURS[i],
      title: j ? new Date(j.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) + ' : ' + fmt(j.score) + ' contre ' + fmt(j.maison) + (j.battu ? ', maison battue' : '') : 'Pas joué',
    })));
    corps.push(el('div', { class: 'stat' }, [
      el('span', {}, [el('span', { html: 'Semaine du <b>' + new Date(s.lundi + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) + '</b>' + (s.record ? ' · <span class="gagne">ta meilleure</span>' : '') + ' ' }), cases]),
      el('span', { html: pluriel(s.battus, 'maison') + ' battue' + (s.battus > 1 ? 's' : '') + ' sur ' + s.joues + ' · total <b>' + fmt(s.total) + '</b>' }),
    ]));
  }
  const tente = defiTente(app.meta, d.date);
  corps.splice(1, 0, el('p', { class: tente ? 'gagne' : 'discret', 'data-essai': tente ? 'fait' : 'libre', texte: tente ? 'Ton essai du jour est joué. Le prochain défi ouvre demain à minuit (heure de Paris).' : 'Un seul essai par jour : le défi compte dès que tu le lances.' }));
  corps.push(el('div', { class: 'stat' }, [el('span', { texte: 'Ton record, tous défis confondus' }), el('b', { texte: fmt(Math.max(app.meta.stats.meilleurDefi || 0, ...Object.values(app.meta.defis || {}).map((d) => (d && d.score) || 0))) })]));
  return fenetre('Défi du jour', corps, [
    bouton('Retour', 'nuit', () => fermer(app)),
    tente ? bouton('Reviens demain', 'nuit', () => fermer(app)) : bouton('Relever le défi', 'or', () => {
      fermer(app);
      app.nouvellePartie({ graine: d.graine, regles: d.regles, defi: d, toutDebloque: true });
    }),
  ], 'moyenne');
}

// ------------------------------------------------------------ Épreuves (v4)

function panneauEpreuves(app) {
  let choisie = EPREUVES.find((ep) => epreuveOuverte(app.meta, ep.id) && !(app.meta.epreuves[ep.id] || {}).gagne) || EPREUVES[0];
  const tuiles = EPREUVES.map((ep) => {
    const ouverte = epreuveOuverte(app.meta, ep.id);
    const r = app.meta.epreuves[ep.id];
    const etatTxt = r && r.gagne ? 'Réussie' : r ? 'Meilleur palier : ' + r.palierMax : 'Pas encore tentée';
    const t = el('div', { class: 'tuile' + (ouverte ? '' : ' verrou') + (ep === choisie ? ' choisie' : ''), 'data-epreuve': ep.id }, [
      el('b', { texte: (r && r.gagne ? '★ ' : '') + ep.nom + '  ' + '•'.repeat(ep.niveau) }),
      el('small', { texte: ouverte ? ep.desc : 'Réussis une épreuve de niveau ' + (ep.niveau - 1) + ' pour l\'ouvrir.' }),
      el('small', { class: r && r.gagne ? 'gagne' : 'discret', texte: ouverte ? etatTxt : '' }),
      ep.recompense ? el('small', { class: 't-l', texte: (r && r.gagne ? 'Débloqué : ' : 'Débloque : ') + JOKERS.find((j) => j.id === ep.recompense).nom }) : null,
    ].filter(Boolean));
    if (ouverte) t.addEventListener('click', () => {
      son.clic();
      choisie = ep;
      for (const x of tuiles) x.classList.toggle('choisie', x === t);
    });
    return t;
  });
  const corps = [
    el('p', { html: 'Des parties <b>scénarisées</b> : une contrainte forte, un départ imposé, et moins de paliers. Chaque réussite rapporte de la renommée et ouvre l\'épreuve suivante.' }),
    el('div', { class: 'grille g2' }, tuiles),
  ];
  return fenetre('Épreuves', corps, [
    bouton('Retour', 'nuit', () => fermer(app)),
    bouton('Tenter l\'épreuve', 'or', () => {
      if (!epreuveOuverte(app.meta, choisie.id)) return;
      fermer(app);
      app.nouvellePartie({ epreuve: choisie.id });
    }),
  ], 'moyenne');
}

// --------------------------------------------------------- Leçon de poker (v4)

// Une petite rangée de cartes dessinées avec les sprites du jeu.
function rangee(codes) {
  return el('span', { class: 'rangee' }, codes.map((code) => {
    const ens = code.slice(-1);
    const r = code.slice(0, -1);
    const rang = { V: 11, D: 12, R: 13, A: 14 }[r] || Number(r);
    return copie(spriteCarte({ rang, ens }), 0.5);
  }));
}

const EXEMPLES_LECON = [
  ['carte_haute', ['AP', '9C', '6K', '4T', '2P'], 'Rien d\'assorti : seule ta plus haute carte marque.'],
  ['paire', ['DP', 'DC'], 'Deux cartes du même rang.'],
  ['double_paire', ['8P', '8K', '4C', '4T'], 'Deux paires différentes.'],
  ['brelan', ['7P', '7C', '7T'], 'Trois cartes du même rang.'],
  ['suite', ['5C', '6P', '7K', '8T', '9C'], 'Cinq rangs qui se suivent, enseignes mélangées.'],
  ['couleur', ['2C', '6C', '9C', 'VC', 'AC'], 'Cinq cartes de la même enseigne, dans n\'importe quel ordre.'],
  ['full', ['RP', 'RC', 'RT', '3K', '3P'], 'Un brelan et une paire ensemble.'],
  ['carre', ['9P', '9C', '9K', '9T'], 'Quatre cartes du même rang.'],
  ['quinte_flush', ['6T', '7T', '8T', '9T', '10T'], 'Une suite, toute de la même enseigne.'],
];

function panneauLecon(app, args) {
  const lignes = EXEMPLES_LECON.map(([id, codes, txt]) => {
    const m = MAINS.find((x) => x.id === id);
    return el('div', { class: 'stat lecon' }, [
      el('span', {}, [el('b', { texte: m.nom }), el('br'), el('small', { texte: txt })]),
      rangee(codes),
      el('span', { class: 'base', html: '<span class="t-j">' + m.jetons + '</span> × <span class="t-m">' + m.multi + '</span>' }),
    ]);
  });
  const corps = [
    el('p', { html: 'Pas besoin de connaître le poker. Tu joues <b>1 à 5 cartes</b>, le jeu reconnaît la <b>meilleure combinaison</b> et seules les cartes qui la forment marquent. Plus la main est rare, plus elle vaut.' }),
    el('p', { html: 'Score = <span class="t-j">jetons</span> × <span class="t-m">multi</span>. Les jetons de base de la main s\'ajoutent à la valeur des cartes (2 à 10, les têtes valent 10, l\'As 11). Les chiffres ci-dessous sont les valeurs de départ.' }),
    ...lignes,
    el('p', { class: 'discret', html: 'Astuce : en partie, l\'aperçu au centre affiche le nom de la main et le total <b>avant</b> que tu joues. Essaie, puis défausse si ça ne te plaît pas. Le bouton MAINS (ou la touche H) rappelle ce tableau.' }),
  ];
  return fenetre('Les mains du poker', corps, [bouton('C\'est parti', 'or', () => (args && args.retour ? ouvrir(app, args.retour) : fermer(app)))], 'moyenne');
}

// ------------------------------------------------------------------ Pause

// Un curseur de volume, de 0 à 100, mémorisé dès qu'on le bouge.
function curseurVolume(app, libelle, cle) {
  const o = app.meta.options;
  const val = el('span', { class: 'val', texte: Math.round(o[cle] * 100) + ' %' });
  const id = 'vol-' + cle;
  const curseur = el('input', {
    type: 'range', min: 0, max: 100, step: 5, id, value: Math.round(o[cle] * 100),
    oninput: (e) => {
      app.reglerVolume(cle, Number(e.target.value) / 100);
      val.textContent = e.target.value + ' %';
    },
    onchange: () => {
      if (cle !== 'volMusique') son.choisir();
    },
  });
  return el('div', { class: 'ligne' }, [el('label', { for: id, texte: libelle }), curseur, val]);
}

function panneauPause(app) {
  const o = app.meta.options;
  const enJeu = app.ecran === 'jeu' && app.etat;
  const liste = el('div', { class: 'menu-pause' });
  const redessiner = () => ouvrir(app, 'pause');
  if (enJeu) liste.append(bouton('Reprendre', 'or', () => fermer(app)));
  liste.append(
    bouton(o.muet ? 'Son : coupé' : 'Son : actif', 'nuit', () => {
      app.basculerSon();
      redessiner();
    }),
    bouton(o.musique ? 'Musique : oui' : 'Musique : non', 'nuit', () => {
      o.musique = !o.musique;
      reglerMusique(o.musique);
      app.sauverMeta();
      redessiner();
    }),
    el('div', { class: 'volumes' }, [
      curseurVolume(app, 'Volume général', 'volume'),
      curseurVolume(app, 'Musique', 'volMusique'),
      curseurVolume(app, 'Effets', 'volEffets'),
    ]),
    bouton('Vitesse des animations : ×' + o.vitesse, 'nuit', () => {
      app.changerVitesse();
      redessiner();
    }),
    bouton(o.tremblement !== false ? 'Tremblement d\'écran : oui' : 'Tremblement d\'écran : non', 'nuit', () => {
      o.tremblement = o.tremblement === false;
      SENSATION.tremblement = o.tremblement;
      app.sauverMeta();
      redessiner();
    }),
    bouton(o.arretImage !== false ? 'Arrêt sur image : oui' : 'Arrêt sur image : non', 'nuit', () => {
      o.arretImage = o.arretImage === false;
      SENSATION.pause = o.arretImage;
      app.sauverMeta();
      redessiner();
    }),
    bouton(o.vibration !== false ? 'Vibration : oui' : 'Vibration : non', 'nuit', () => {
      o.vibration = o.vibration === false;
      SENSATION.vibration = o.vibration;
      if (o.vibration) vibrer(30);
      app.sauverMeta();
      redessiner();
    }),
    bouton(o.cartesDeco !== false ? 'Cartes : art déco' : 'Cartes : classiques', 'nuit', () => {
      o.cartesDeco = o.cartesDeco === false;
      reglerDeco(o.cartesDeco);
      app.sauverMeta();
      redessiner();
    }),
    bouton(o.relief !== false ? 'Rares en relief : oui' : 'Rares en relief : non', 'nuit', () => {
      o.relief = o.relief === false;
      VISUEL.relief = o.relief;
      app.sauverMeta();
      redessiner();
    }),
    bouton(o.crt ? 'Lignes d\'écran : oui' : 'Lignes d\'écran : non', 'nuit', () => {
      o.crt = !o.crt;
      document.body.classList.toggle('sans-crt', !o.crt);
      app.sauverMeta();
      redessiner();
    }),
    bouton('Tapis : ' + (TAPIS.find((t) => t.id === o.tapis) || TAPIS[0]).nom + ' (' + tapisDebloques(app.meta).length + '/' + TAPIS.length + ')', 'nuit', () => {
      const dispo = tapisDebloques(app.meta);
      const i = dispo.findIndex((t) => t.id === o.tapis);
      o.tapis = dispo[(i + 1) % dispo.length].id;
      reglerTapis(o.tapis);
      son.choisir();
      app.sauverMeta();
      redessiner();
    }),
    bouton(o.mentor ? 'Mode Mentor : oui' : 'Mode Mentor : non', o.mentor ? 'vert' : 'nuit', () => {
      o.mentor = !o.mentor;
      app.sauverMeta();
      redessiner();
    }),
    o.mentor ? el('div', { class: 'volumes' }, [
      bouton(o.mentorRevue !== false ? 'Revue après chaque main : oui' : 'Revue après chaque main : non', 'nuit', () => {
        o.mentorRevue = o.mentorRevue === false;
        app.sauverMeta();
        redessiner();
      }),
      bouton(o.mentorAstuces !== false ? 'Astuces de stratégie : oui' : 'Astuces de stratégie : non', 'nuit', () => {
        o.mentorAstuces = o.mentorAstuces === false;
        app.sauverMeta();
        redessiner();
      }),
      el('p', { class: 'discret', texte: 'Le Mentor est un joueur fort : un bouton MENTOR montre le meilleur coup et explique pourquoi. Les parties où il sert sont marquées « avec le Mentor » et ne débloquent pas d\'enjeu.' }),
    ]) : el('span'),
    bouton('Comment jouer', 'nuit', () => ouvrir(app, 'aide', { retour: 'pause' })),
    bouton('Sauvegarde : exporter, importer', 'nuit', () => ouvrir(app, 'sauvegarde', { retour: 'pause' })),
    bouton(o.toutDebloque ? 'Tout débloqué : oui' : 'Tout débloqué : non', o.toutDebloque ? 'vert' : 'nuit', () => {
      o.toutDebloque = !o.toutDebloque;
      app.sauverMeta();
      redessiner();
    }),
    el('p', { class: 'discret', texte: 'Tout débloqué ouvre tous les jokers, jeux, enjeux, épreuves et tapis pour tout essayer. Ta vraie progression continue de compter en dessous : remets « non » pour la retrouver.' })
  );
  const nr = niveauRenommee(app.meta);
  liste.append(el('p', { class: 'discret', texte: 'Renommée ' + nr.niveau + ' (' + nr.rang + ') : ' + nr.dans + '/' + nr.besoin + (nr.prochainTapis ? '. Prochain tapis : ' + nr.prochainTapis.nom + ' au niveau ' + nr.prochainTapis.niveau + '.' : '.') }));
  if (enJeu) {
    liste.append(
      bouton(app.demo ? 'Quitter la démonstration' : 'Sauvegarder et revenir au menu', 'bleu', () => {
        fermer(app);
        app.retourTitre();
      })
    );
    if (!app.demo) {
      let arme = false;
      const b = bouton('Abandonner la partie', 'rouge', () => {
        if (!arme) {
          arme = true;
          b.textContent = 'Confirmer l\'abandon ?';
          return;
        }
        fermer(app);
        app.abandonner();
      });
      liste.append(b);
    }
  } else liste.append(bouton('Fermer', 'bleu', () => fermer(app)));
  const corps = [liste];
  if (enJeu) corps.push(el('p', { class: 'discret', texte: 'Ta partie est sauvegardée après chaque action. Graine : ' + app.etat.graine + '.' }));
  return fenetre(enJeu ? 'Pause' : 'Options', corps, null, 'etroite');
}

// v6 : sauvegarde. Export en fichier ou en texte, import depuis l'un ou l'autre.
function panneauSauvegarde(app, args) {
  const s = app.meta.stats;
  const etat = el('p', { class: 'discret' });
  const zoneTexte = el('textarea', { class: 'code-sauvegarde', rows: 5, spellcheck: 'false', placeholder: 'Colle ici le texte d\'une sauvegarde exportée, puis « Importer ce texte ».' });
  const dire = (t, ok = true) => {
    etat.innerHTML = '<span class="' + (ok ? 't-v' : 't-m') + '">' + t + '</span>';
  };
  const derniere = app.meta.dernierExport ? new Date(app.meta.dernierExport).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }) : null;
  const exporterFichier = () => {
    const json = app.exporterSauvegarde();
    const date = new Date().toISOString().slice(0, 10);
    try {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = el('a', { href: url, download: 'velours-sauvegarde-' + date + '.json' });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      dire('Fichier enregistré : velours-sauvegarde-' + date + '.json. Garde-le dans Fichiers ou iCloud.');
    } catch {
      zoneTexte.value = json;
      dire('Le téléchargement n\'a pas marché : le texte est dans le cadre, copie-le.', false);
    }
  };
  const exporterTexte = async () => {
    const json = app.exporterSauvegarde();
    zoneTexte.value = json;
    try {
      await navigator.clipboard.writeText(json);
      dire('Sauvegarde copiée. Colle-la dans une note pour la garder.');
    } catch {
      zoneTexte.select();
      dire('Le texte est dans le cadre : sélectionne-le et copie-le.', false);
    }
  };
  const importer = (texte) => {
    const r = app.importerSauvegarde(texte);
    if (!r.ok) return dire(r.raison, false);
    dire('Sauvegarde importée : ' + r.parties + ' partie' + (r.parties > 1 ? 's' : '') + (r.enCours ? ', et une partie en cours à reprendre.' : '.') + ' L\'ancienne est gardée de côté.');
  };
  const fichier = el('input', { type: 'file', accept: '.json,application/json,text/plain', hidden: true });
  fichier.addEventListener('change', () => {
    const f = fichier.files && fichier.files[0];
    if (!f) return;
    f.text().then(importer, () => dire('Impossible de lire ce fichier.', false));
  });
  const corps = [
    el('p', { html: 'Ta progression : <b>' + s.parties + ' partie' + (s.parties > 1 ? 's' : '') + '</b>, ' + s.victoires + ' victoire' + (s.victoires > 1 ? 's' : '') + ', palier max ' + s.palierMax + '.' + (derniere ? ' Dernier export : ' + derniere + '.' : ' Jamais exportée.') }),
    el('p', { class: 'discret', html: 'Velours garde tout dans ton navigateur. Sur iPhone, Safari peut effacer les données d\'un site que tu n\'as pas ouvert depuis sept jours : <b>ajoute Velours à l\'écran d\'accueil</b> (Partager, puis « Sur l\'écran d\'accueil ») et exporte de temps en temps. Velours garde aussi une copie qui ne recule jamais et la reprend toute seule si la sauvegarde principale disparaît.' + (app.persistant ? ' Ce navigateur a accepté de ne pas effacer le stockage du jeu.' : '') }),
    el('h3', { texte: 'Exporter' }),
    el('div', { class: 'ligne' }, [bouton('Enregistrer un fichier', 'or', exporterFichier), bouton('Copier le texte', 'nuit', exporterTexte)]),
    el('h3', { texte: 'Importer' }),
    el('div', { class: 'ligne' }, [bouton('Ouvrir un fichier', 'nuit', () => fichier.click()), bouton('Importer ce texte', 'nuit', () => importer(zoneTexte.value)), fichier]),
    zoneTexte,
    etat,
  ];
  return fenetre('Sauvegarde', corps, [bouton('Retour', 'bleu', () => (args.retour ? ouvrir(app, args.retour) : fermer(app)))], 'moyenne');
}

// Ce qui a changé depuis la dernière fois. Marqué comme lu à l'ouverture.
function panneauNouveautes(app) {
  if (app.meta.nouveautesVues !== VERSION_NOUVEAUTES) {
    app.meta.nouveautesVues = VERSION_NOUVEAUTES;
    app.sauverMeta();
  }
  const corps = [
    el('p', { class: 'discret', texte: 'Ce qui est arrivé sur scène depuis ta dernière visite.' }),
    el('h3', { texte: 'Version 7 (19 novembre 2026)' }),
    el('ul', { class: 'aide', 'data-version': '7' }, [
      el('li', { html: '<b>Cinq raretés qui se voient.</b> Commune en gris, peu commune en vert, rare en bleu, <span style="color:#cda2ff">épique en violet</span> (nouveau rang, huit jokers, contour qui pulse) et <span class="t-l">légendaire en or animé</span>, avec une lumière qui fait le tour de la carte. Les légendaires restent très rares.' }),
      el('li', { html: '<b>Le crescendo vaut le détour.</b> Il se garde d\'une manche à l\'autre, chaque marche donne <span class="t-m">+1 multi</span> à toutes tes mains, et la marche 5 déclenche l\'<b>apothéose</b> : <span class="t-x">×1,5 multi</span> et 5 louis. Une main plus faible ne fait redescendre que de deux marches.' }),
      el('li', { html: '<b>Le Mentor regarde tout le rayon.</b> Astres, Arcanes, Ombres et paquets entrent dans son calcul au même titre que les jokers. Il dit pourquoi en une ligne, propose de trier ta main par enseigne ou par rang, et donne une vue d\'ensemble (intérêts, places libres, main phare).' }),
      el('li', { html: '<b>Un thème par acte.</b> La musique change de morceau à chaque palier, garde le même velours, et monte d\'un cran à mesure que tu approches de la cible de la manche.' }),
      el('li', { html: '<b>Chaque joker a une voix.</b> Une réplique par personnage, dans sa fiche et quand il rejoint ta troupe. Tous ont maintenant une tenue choisie et l\'emblème de leur famille dans le coin.' }),
      el('li', { html: '<b>Des figures plus belles.</b> Le Roi tient son sceptre, la Dame sa rose, le Valet sa hallebarde, dans un cadre d\'or. Les As portent une couronne de lauriers.' }),
      el('li', { html: '<b>Deux Arcanes plus doux.</b> Le Calque copie une carte dans ton paquet (amélioration et sceau compris), La Laque rend deux cartes Brillantes.' }),
      el('li', { html: '<b>Joker du jour.</b> Chaque défi du jour offre un joker rare ou épique à tout le monde dès le départ.' }),
      el('li', { html: '<b>Journal de partie.</b> Ta plus grosse main (avec ses cartes), ton plus beau combo (le plus de jokers déclenchés ensemble) et la plus haute marche du crescendo, en fin de partie et dans Collection, onglet Parties.' }),
      el('li', { html: '<b>Équilibre.</b> Pour compenser la force du crescendo, les mises de la courbe classique montent un peu plus vite à partir du palier 2 (de 4 à 19 %, selon le palier). Le score de la maison du défi suit.' }),
      el('li', { html: '<b>Le patron s\'annonce.</b> Son pion garde sa couleur dès la petite mise, et la case Palier dit qui t\'attend et ce qu\'il fait.' }),
    ]),
    el('h3', { texte: 'Version 6 (19 novembre 2026)' }),
    el('ul', { class: 'aide', 'data-version': '6' }, [
      el('li', { html: '<b>Sept synergies.</b> Réunis les bons jokers et la troupe débloque un vrai effet, affiché en or au-dessus de la rangée : Les Têtes couronnées (Le Roi, La Reine, Le Valet) font valoir chaque figure ×1,2 ; L\'Orchestre retient le crescendo ; Le Vœu de silence donne une main de plus ; Le Casse du siècle, La Galerie des glaces, Le Bouquet et Le Blason. Toutes dans Collection, onglet Synergies.' }),
      el('li', { html: '<b>Les jokers montent de niveau.</b> Un doublon en boutique (marqué NIV +) ou une répétition payée font passer un joker au niveau 2 (effets ×1,4), puis 3 (effets ×1,8, une rejoue de plus). Une répétition par boutique.' }),
      el('li', { html: '<b>La retouche.</b> Une fois par boutique, choisis une carte de ton paquet parmi quatre : elle gagne un niveau (jusqu\'à 3), soit <span class="t-j">+15 jetons</span> et <span class="t-m">+2 multi</span> par niveau quand elle marque.' }),
      el('li', { html: '<b>Dix jokers de synergie</b> : Le Roi, La Reine, Le Valet, La Contrebasse, L\'Ermite, Le Moine, Le Pickpocket, Le Faussaire, Le Reflet, La Fleuriste.' }),
      el('li', { html: '<b>La boutique te guide.</b> Un joker qui complète ou fait avancer une de tes synergies est signalé, et sa fiche dit ce qu\'il manque encore.' }),
      el('li', { html: '<b>Tout débloqué</b> (Options) : tous les jokers, jeux, enjeux, épreuves et tapis, pour tout essayer.' }),
      el('li', { html: '<b>Ta sauvegarde est mieux gardée.</b> Exporte-la en fichier ou en texte et réimporte-la (Options, Sauvegarde). Une copie qui ne recule jamais la reprend toute seule si elle disparaît.' }),
    ]),
    el('h3', { texte: 'Version 5 (19 novembre 2026)' }),
    el('ul', { class: 'aide', 'data-version': '5' }, [
      el('li', { html: '<b>Seize jokers, quatre familles.</b> Les <b>Échos</b> rejouent l\'effet d\'un voisin (La Résonance, La Cascade, La Réverbération, Le Canon). Les <b>Pousses</b> grandissent à chaque manche mais ne valent rien à la revente. Les <b>Maudits</b> frappent très fort, avec une contrepartie : une main de moins, des cartes face cachée. Les <b>Duos secrets</b> cachent un bonus qui ne se révèle qu\'aux côtés de leur partenaire.' }),
      el('li', { html: '<b>Mode zen.</b> Coche-le dans Nouvelle partie : à court de mains, la manche passe quand même. Pour construire des combos sans pression. Il ne compte ni pour tes statistiques ni pour tes déblocages.' }),
      el('li', { html: '<b>Défi du jour, un seul essai.</b> Il compte dès que tu le lances, et ton record de tous les défis est gardé.' }),
      el('li', { html: '<b>Trois défis à contrainte</b> (Épreuves) : Cœurs brisés, Petite troupe, Sans repentir. Chacun débloque une carte : La Muse, Le Canon, Le Masque de plomb.' }),
      el('li', { html: '<b>La musique suit ton multi.</b> Plus il grimpe pendant une main, plus l\'orchestre s\'étoffe : shaker, cordes, cloches, cuivres. Chaque patron a désormais son thème. Cartes et jetons sonnent plus feutrés.' }),
      el('li', { html: '<b>Cartes art déco.</b> Filets d\'or à gradins, dos en soleil levant. Les rares et légendaires sont en relief et suivent l\'inclinaison du téléphone (ou ta souris). Sur les gros coups, l\'or coule du score.' }),
      el('li', { html: '<b>Sensation.</b> Le total grimpe chiffre par chiffre, l\'image se fige une fraction de seconde à l\'impact, l\'écran tremble et le téléphone vibre (quand il le permet). Tout se règle dans Options.' }),
      el('li', { html: '<b>Score prévu.</b> Avant de jouer, tu vois le score attendu et ce qu\'il manque. Sous chaque joker, une ligne dit ce qu\'il apporte, puis ce qu\'il vient d\'apporter.' }),
      el('li', { html: '<b>Ta sauvegarde est intacte.</b> Elle passe au nouveau format toute seule, et une copie de l\'ancienne est gardée dans ton navigateur.' }),
    ]),
    el('h3', { texte: 'Version 4.1 (18 novembre 2026)' }),
    el('ul', { class: 'aide' }, [
      el('li', { html: '<b>Le Mentor conseille partout.</b> Dans les paquets (quelle carte prendre, sur quelles cartes utiliser un Arcane, ou passer), pour tes consommables (quand et sur quoi), l\'ordre de tes jokers, et s\'il vaut mieux passer une mise pour son ticket. Chaque conseil dit pourquoi.' }),
      el('li', { html: '<b>Plus fort en boutique.</b> Avant d\'acheter, il rejoue des mains tirées de ton paquet avec chaque joker du rayon pour mesurer ce qu\'il t\'apporte vraiment.' }),
      el('li', { html: '<b>Bouton Préparer.</b> Il sélectionne pour toi les cartes et l\'objet conseillés : tu n\'as plus qu\'à valider.' }),
    ]),
    el('h3', { texte: 'Version 4 (17 novembre 2026)' }),
    el('ul', { class: 'aide' }, [
      el('li', { html: '<b>Un vrai format portrait.</b> Sur téléphone tenu droit, la table se réorganise pour jouer d\'une main : gros boutons Jouer et Défausser sous le pouce, informations en bandeau, lisible sur iPhone SE et mini.' }),
      el('li', { html: '<b>Les combos de la troupe.</b> Des jokers qui vont bien ensemble se relient par un fil coloré et prennent un nom (Le Salon des figures, La Grande rue, Le Coffre-fort...). Quand deux membres agissent sur la même main, le combo s\'annonce.' }),
      el('li', { html: '<b>La troupe fait la musique.</b> Chaque famille de jokers ajoute son pupitre : cloches pour l\'économie, cuivres, marimba, cordes, orgue, claps. Plus la rangée est soudée, plus la musique est riche.' }),
      el('li', { html: '<b>Sept épreuves.</b> Des parties scénarisées avec une contrainte forte et un départ imposé, de La Répétition au Grand Huit.' }),
      el('li', { html: '<b>Quatre jeux et trois enjeux de plus.</b> Le Soliste (une seule main, ×3), Le Parrain, Le Crépuscule, Le Géant ; enjeux Cristal, Ébène et Diamant.' }),
      el('li', { html: '<b>Équilibrage.</b> Des dizaines de milliers de parties simulées : les jokers trop forts sont rabotés, les oubliés relevés, Le Juge et Le Rabot adoucis.' }),
      el('li', { html: '<b>Les mains du poker</b> expliquées en une page, avec des exemples, pour qui n\'a jamais joué (Comment jouer).' }),
    ]),
    el('h3', { texte: 'Version 3' }),
    el('ul', { class: 'aide' }, [
      el('li', { html: '<b>Au doigt, sur téléphone.</b> Touche pour choisir, glisse pour réordonner, appui long pour lire une carte. Installe Velours sur ton écran d\'accueil : il marche hors ligne.' }),
      el('li', { html: '<b>Des morceaux de quatre minutes.</b> Intro, couplets, refrain, solo, pont, retombée, reprise un ton plus haut. Chaque morceau reprend là où il s\'était arrêté, et de courtes phrases saluent tes victoires.' }),
      el('li', { html: '<b>Les gros scores claquent.</b> La main s\'embrase quand elle suffit, la salle retient son souffle, le total défile, et les records se fêtent.' }),
      el('li', { html: '<b>La renommée.</b> Chaque partie, même perdue, te fait monter en rang et débloque des tapis de table. « Encore une partie » relance tout de suite.' }),
      el('li', { html: '<b>Nouvelle bande-son.</b> Cinq morceaux lo-fi et synthwave, joués en direct : piano électrique, nappes, basse, batterie feutrée, craquements de vinyle. La musique monte avec la tension de la manche et passe d\'un morceau à l\'autre en fondu.' }),
      el('li', { html: '<b>Le crescendo.</b> Chaque main qui marque plus que la précédente gravit une marche (5 au plus). Une main plus faible fait tout retomber. À 2 marches, la musique s\'emballe et les sons de score montent d\'un cran.' }),
      el('li', { html: '<b>Cinq jokers du crescendo</b> : Le Maestro, Le Métronome, La Montée des marches, La Souffleuse et Le Point d\'orgue.' }),
      el('li', { html: '<b>Le public.</b> Une rampe de dix ampoules suit la réaction de la salle. Varie tes mains, frappe fort, évite les redites : à dix, c\'est l\'ovation, et tu gagnes un <span class="t-l">rappel</span>, une main de plus le jour où tu tombes à court.' }),
      el('li', { html: '<b>De nouveaux visages.</b> Six jokers qui vivent du public, trois patrons (dont Les Deux Masques, en deux phases), deux privilèges et un ticket.' }),
      el('li', { html: '<b>La musique.</b> Volumes séparés (général, musique, effets) dans Options, touche <b>M</b> pour couper le son.' }),
      el('li', { html: '<b>Le Régisseur.</b> Un guide pas à pas pour la première manche. Tu peux le revoir depuis Comment jouer.' }),
      el('li', { html: '<b>Le carnet de la troupe.</b> Chaque joker retient ses parties, ses victoires et sa meilleure main (Collection).' }),
      el('li', { html: '<b>Les défis du jour</b> se classent maintenant semaine par semaine.' }),
      el('li', { html: '<b>Les consommables se glissent</b> sur une carte, sur ta sélection, ou sur la table.' }),
    ]),
  ];
  return fenetre('Nouveautés', corps, [bouton('En scène', 'or', () => fermer(app))], 'moyenne');
}

function panneauAide(app, args) {
  const corps = [
    el('ol', { class: 'aide' }, [
      el('li', { html: '<b>Choisis 1 à 5 cartes</b> dans ta main en cliquant dessus, puis <b>Jouer la main</b>. Seules les cartes qui forment la main de poker marquent.' }),
      el('li', { html: 'Ton score vaut <span class="t-j">jetons</span> × <span class="t-m">multi</span>. L\'aperçu au centre te montre le total avant de jouer.' }),
      el('li', { html: 'Pas la bonne main ? <b>Défausse</b> jusqu\'à 5 cartes pour repiocher. Mains et défausses sont comptées, à gauche.' }),
      el('li', { html: 'Atteins le <b>score à battre</b> pour gagner la manche, toucher tes <span class="t-l">louis</span> et passer en boutique.' }),
      el('li', { html: 'Les <b>jokers</b> changent tout. Ils se déclenchent <b>de gauche à droite</b> : glisse-les pour changer l\'ordre. Survole-en un pour voir les cartes qui lui plaisent.' }),
      el('li', { html: 'Chaque palier finit par un <b>patron</b> qui tord les règles. Bats celui du dernier palier pour gagner.' }),
      el('li', { html: '<b>Le public</b> te regarde. ' + versHtml(AIDE_PUBLIC) }),
      el('li', { html: '<b>Le crescendo.</b> Chaque main qui marque plus que la précédente gravit une marche (5 au plus), et il se garde d\'une manche à l\'autre. Chaque marche donne +1 multi ; à la marche 5, l\'apothéose donne ×1,5 multi et 5 louis. Une main plus faible, ou égale, fait redescendre de deux marches. Des jokers s\'en nourrissent, et la musique s\'emballe à partir de 2 marches.' }),
      el('li', { html: '<b>Les synergies.</b> Certains jokers réunis débloquent un effet (Collection, onglet Synergies). Un joker monte de niveau quand tu achètes son doublon ou une répétition en boutique ; la retouche fait monter une carte.' }),
      el('li', { html: 'Raccourcis : <b>Entrée</b> joue, <b>D</b> défausse, <b>R</b> et <b>E</b> trient, <b>1 à 9</b> choisissent une carte, <b>clic droit</b> désélectionne, <b>M</b> coupe le son, <b>Échap</b> ouvre le menu.' }),
      el('li', { html: 'Les <b>consommables</b> se glissent : lâche-les sur une carte (ou sur ta sélection) pour les utiliser, ou sur la table s\'ils ne visent aucune carte.' }),
    ]),
  ];
  const g = app.meta.guide;
  const revoir = bouton(g.fini ? 'Revoir le guide' : 'Guide prévu', 'nuit', () => {
    g.fini = false;
    app.sauverMeta();
    revoir.textContent = 'Guide prévu';
    note.textContent = 'Le Régisseur te guidera au début de ta prochaine partie.';
  });
  const note = el('span', { class: 'discret', texte: g.fini ? '' : 'Le Régisseur te guidera au début de ta prochaine partie.' });
  return fenetre('Comment jouer', corps, [el('div', { class: 'gauche' }, [revoir, bouton('Les mains du poker', 'nuit', () => ouvrir(app, 'lecon', { retour: 'aide' })), note]), bouton('Compris', 'or', () => (args.retour ? ouvrir(app, args.retour) : fermer(app)))], 'moyenne');
}

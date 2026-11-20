// Le Mentor calcule dans un Web Worker : la table reste fluide pendant qu'il cherche, même sur iPhone.
import { conseilManche, conseilBoutique, conseilPartout, revueMain, astuce } from '../noyau/mentor.js';

self.onmessage = (ev) => {
  const { id, quoi, etat, args } = ev.data;
  let res = null;
  try {
    if (quoi === 'manche') res = conseilManche(etat, args || {});
    else if (quoi === 'boutique') res = conseilBoutique(etat);
    else if (quoi === 'partout') res = conseilPartout(etat, args || {});
    else if (quoi === 'revue') res = revueMain(etat, args.ids, args.total, args);
    else if (quoi === 'astuce') res = astuce(etat, args.vues || []);
    self.postMessage({ id, res });
  } catch (e) {
    self.postMessage({ id, erreur: String(e && e.message || e) });
  }
};

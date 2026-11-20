// Service worker de Velours : le jeu reste jouable hors ligne.
// Stratégie : réseau d'abord (pour recevoir les mises à jour), cache en secours. L'API locale n'est jamais mise en cache.
const VERSION = "velours-8bbeeec0bd";
const PRECACHE = ["./", "icones/icone-180.png", "icones/icone-192.png", "icones/icone-512.png", "icones/icone-masquable-512.png", "index.html", "js/noyau/combos.js", "js/noyau/consommables.js", "js/noyau/donnees.js", "js/noyau/epreuves.js", "js/noyau/guide.js", "js/noyau/jokers.js", "js/noyau/mains.js", "js/noyau/mentor.js", "js/noyau/meta.js", "js/noyau/outils.js", "js/noyau/partie.js", "js/noyau/patrons.js", "js/noyau/public.js", "js/noyau/regles.js", "js/noyau/repliques.js", "js/noyau/rng.js", "js/noyau/score.js", "js/noyau/synergies.js", "js/noyau/valeurs-jokers.js", "js/ui/app.js", "js/ui/dessin.js", "js/ui/ecrans.js", "js/ui/guide.js", "js/ui/mentor-worker.js", "js/ui/mentor.js", "js/ui/moteur.js", "js/ui/partition.js", "js/ui/police.js", "js/ui/son.js", "js/ui/sprites.js", "js/ui/table.js", "manifest.webmanifest", "style.css"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE.length ? PRECACHE : ['./', 'index.html', 'style.css'])).then(() => self.skipWaiting()).catch(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r && r.ok) {
          const copie = r.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copie)).catch(() => {});
        }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});

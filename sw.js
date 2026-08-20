const CACHE = 'treino-v3'; // versão bumped — força atualização em todos os dispositivos

const ASSETS = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS).catch(() => {}))
      .then(() => self.skipWaiting()) // ativa a nova versão imediatamente, sem esperar todas as abas fecharem
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))) // apaga qualquer cache de versão antiga
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Deixa YouTube e GIFs externos passarem direto (precisam de internet)
  if (
    url.includes('youtube.com') ||
    url.includes('youtu.be') ||
    url.includes('w12evostorage') ||
    url.includes('fonts.gstatic.com')
  ) {
    e.respondWith(
      fetch(e.request).catch(() => new Response('', { status: 503 }))
    );
    return;
  }

  // index.html (e navegação para a raiz do app) — NETWORK FIRST.
  // Assim, toda vez que o Rafael atualizar o index.html no GitHub, o celular
  // busca a versão nova primeiro (se tiver internet) — só usa o cache como
  // fallback quando estiver offline. Isso evita ficar preso numa versão antiga
  // em cache depois de uma atualização.
  const ehHtmlPrincipal = e.request.mode === 'navigate' || url.endsWith('/') || url.endsWith('index.html');
  if (ehHtmlPrincipal) {
    e.respondWith(
      fetch(e.request).then(resp => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Demais recursos (fontes, etc.) — cache first, atualiza em background
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(resp => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => null);

      return cached || fetchPromise || new Response('Offline', { status: 503 });
    })
  );
});

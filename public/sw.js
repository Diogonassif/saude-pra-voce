// Service worker mínimo: permite instalar o app no celular. Não guarda cache (sempre busca a versão mais nova).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});

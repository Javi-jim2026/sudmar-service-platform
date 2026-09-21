// Cache the app shell only. Operational records and contacts are never cached here.
// On an authenticated release, retain this separation and handle logout on the server.
const CACHE='sudmar-shell-v03-20260921';
const ASSETS=['./','./index.html','./styles.css','./src/app.js','./src/config.js','./src/core.js','./src/icons.js','./src/repository.js','./manifest.webmanifest','./assets/brand/mark.svg','./assets/brand/icon-192.png','./assets/brand/icon-512.png','./assets/brand/icon-180.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('sudmar-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.includes('/data/')||url.pathname.includes('/api/'))return;
 const allowed=ASSETS.map(path=>new URL(path,self.registration.scope).pathname);
 if(!allowed.includes(url.pathname))return;
 event.respondWith(fetch(event.request).catch(()=>caches.match(event.request,{ignoreSearch:true}).then(cached=>cached||Response.error())));
});

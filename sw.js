// Genius Skies offline cache.
// The game page is always fetched fresh when online, so every published update shows up
// on the next launch; the saved copy is used when offline or on a very slow connection.
const VERSION='genius-skies-v2';
const SHELL=['./','index.html','three.min.js','manifest.webmanifest','icon-192.png','icon-512.png','icon-maskable-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(VERSION).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});

function savedPage(req){
  return caches.match(req,{ignoreSearch:true}).then(hit=>hit||caches.match('./'));
}

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  const ours=url.origin===self.location.origin;
  const font=/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if(!ours&&!font) return;

  // the game page: newest version first, saved copy if offline or slower than 3 s
  if(ours&&(req.mode==='navigate'||url.pathname.endsWith('/')||url.pathname.endsWith('.html'))){
    e.respondWith(new Promise(resolve=>{
      let done=false;
      const finish=r=>{ if(!done&&r){ done=true; resolve(r); } };
      const timer=setTimeout(()=>savedPage(req).then(finish),3000);
      fetch(req).then(r=>{
        clearTimeout(timer);
        if(r.ok){ const copy=r.clone(); caches.open(VERSION).then(c=>c.put(req,copy)); }
        finish(r);
      }).catch(()=>{
        clearTimeout(timer);
        savedPage(req).then(hit=>finish(hit||Response.error()));
      });
    }));
    return;
  }

  // three.js, icons, fonts: saved copy first (instant), refreshed in the background
  const net=fetch(req).then(r=>{
    if(r&&(r.ok||r.type==='opaque')){ const copy=r.clone(); caches.open(VERSION).then(c=>c.put(req,copy)); }
    return r;
  });
  e.respondWith(caches.match(req,{ignoreSearch:true}).then(hit=>hit||net));
  e.waitUntil(net.catch(()=>{}));
});

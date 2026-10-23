// 티맵 바로가기 서비스워커 v012: 인터넷 우선, 안 되면 저장본
const CN='tmapgo-v12';
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CN).then(c=>c.addAll(['./','index.html','manifest.webmanifest','icon_192.png','icon_512.png'])).catch(()=>{}))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('tmapgo-')&&k!==CN).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  e.respondWith(fetch(r).then(res=>{if(res.ok&&!/\.enc\.json/.test(r.url)){const cp=res.clone();caches.open(CN).then(c=>c.put(r,cp))}return res}).catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match('index.html'))));
});
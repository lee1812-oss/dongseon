// 티맵 바로가기 서비스워커 v016: 화면(html)은 항상 인터넷에서 새로 받고(캐시 안 씀), 안 되면 저장본
const CN='tmapgo-v16';
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CN).then(c=>c.addAll(['manifest.webmanifest','icon_192.png','icon_512.png','brand_croissant.png'])).catch(()=>{}))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('tmapgo-')&&k!==CN).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  const isPage=r.mode==='navigate'||/\/tmap\/(index\.html)?(\?|$)/.test(r.url);
  const net=isPage?fetch(r.url,{cache:'no-store'}):fetch(r);
  e.respondWith(net.then(res=>{if(res.ok&&!/\.enc\.json/.test(r.url)){const cp=res.clone();caches.open(CN).then(c=>c.put(isPage?'index.html':r,cp))}return res}).catch(()=>caches.match(isPage?'index.html':r,{ignoreSearch:true}).then(m=>m||caches.match('index.html'))));
});
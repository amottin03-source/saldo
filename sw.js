/* Service worker do Saldo — cache para funcionar offline */
var CACHE='saldo-v2';
var ARQUIVOS=[
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
];

self.addEventListener('install',function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(ARQUIVOS);}).then(function(){return self.skipWaiting();}));
});

self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.map(function(k){if(k!==CACHE)return caches.delete(k);}));
  }).then(function(){return self.clients.claim();}));
});

self.addEventListener('fetch',function(e){
  if(e.request.method!=='GET')return;
  e.respondWith(
    caches.match(e.request).then(function(hit){
      return hit || fetch(e.request).then(function(resp){
        var copia=resp.clone();
        caches.open(CACHE).then(function(c){try{c.put(e.request,copia);}catch(err){}});
        return resp;
      }).catch(function(){return caches.match('./index.html');});
    })
  );
});

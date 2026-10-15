/* Community pages are served network-first; do not keep stale HTML or app shells offline. */
self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('manlung-community')).map(key=>caches.delete(key)))),self.registration.unregister()]).then(()=>self.clients.matchAll({type:'window',includeUncontrolled:true})).then(clients=>Promise.all(clients.map(client=>client.navigate(client.url).catch(()=>{}))))) });

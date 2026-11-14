const SHELL_CACHE = "pushkar-shell-v2";
const VOLUNTEER_CACHE = "pushkar-volunteer-v2";
const PHOTO_CACHE = "pushkar-volunteer-photos-v2";
const APP_SHELL = ["/", "/manifest.json", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => ![SHELL_CACHE, VOLUNTEER_CACHE, PHOTO_CACHE].includes(key)).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function volunteerCacheKey(volunteerId) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(volunteerId));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return new Request(new URL(`/__offline/volunteer/${hash}`, self.location.origin));
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_VOLUNTEER_CACHE") {
    event.waitUntil(Promise.all([caches.delete(VOLUNTEER_CACHE), caches.delete(PHOTO_CACHE)]));
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method === "GET" && url.origin === self.location.origin && url.pathname === "/api/volunteer/missing") {
    const volunteerId = request.headers.get("x-volunteer-cache-key");
    if (!volunteerId) return;
    event.respondWith((async () => {
      const key = await volunteerCacheKey(volunteerId);
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(VOLUNTEER_CACHE);
          await cache.put(key, response.clone());
        }
        return response;
      } catch {
        const cached = await (await caches.open(VOLUNTEER_CACHE)).match(key);
        if (!cached) throw new Error("Offline volunteer list is not available on this device.");
        const headers = new Headers(cached.headers);
        headers.set("x-offline-cache", "true");
        return new Response(cached.body, { status: cached.status, headers });
      }
    })());
    return;
  }

  const isPrivatePhoto = request.method === "GET" &&
    url.pathname.includes("/family-photos/") &&
    (url.searchParams.has("X-Amz-Signature") || url.searchParams.has("x-amz-signature"));
  if (isPrivatePhoto) {
    event.respondWith((async () => {
      const cache = await caches.open(PHOTO_CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) {
          const headers = new Headers(response.headers);
          headers.set("x-pushkar-cached-at", String(Date.now()));
          await cache.put(request, new Response(await response.clone().blob(), {
            status: response.status, statusText: response.statusText, headers,
          }));
        }
        return response;
      } catch {
        const cached = await cache.match(request);
        if (!cached) throw new Error("Photo is not available offline.");
        const savedAt = Number(cached.headers.get("x-pushkar-cached-at") ?? 0);
        if (!savedAt || Date.now() - savedAt > 12 * 60 * 60 * 1000) {
          await cache.delete(request);
          throw new Error("Offline photo expired. Reconnect to load the latest photo.");
        }
        return cached;
      }
    })());
    return;
  }

  if (url.origin === self.location.origin && request.method === "GET" && request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) await (await caches.open(SHELL_CACHE)).put(request, response.clone());
        return response;
      } catch {
        const cache = await caches.open(SHELL_CACHE);
        const savedPage = await cache.match(request);
        if (savedPage) return savedPage;
        const home = await cache.match("/");
        if (home) return home;
        throw new Error("App shell is not available offline.");
      }
    })());
    return;
  }

  if (url.origin === self.location.origin && request.method === "GET" && url.pathname.startsWith("/_next/static/")) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })());
    return;
  }

  if (url.origin === self.location.origin && request.method === "GET" && APP_SHELL.includes(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })());
  }
});

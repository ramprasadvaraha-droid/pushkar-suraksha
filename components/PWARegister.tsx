"use client";

import { useEffect } from "react";

export function PWARegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      const workerUrl = new URL("/sw.js", window.location.href).href;
      const reloadKey = "pushkar-dev-worker-cleanup-reloaded";
      const controlledByAppWorker = navigator.serviceWorker.controller?.scriptURL === workerUrl;

      void navigator.serviceWorker.getRegistrations()
        .then(async (registrations) => {
          await Promise.all(registrations
            .filter((registration) =>
              [registration.active, registration.installing, registration.waiting]
                .some((worker) => worker?.scriptURL === workerUrl),
            )
            .map((registration) => registration.unregister()));
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames
            .filter((name) => name.startsWith("pushkar-"))
            .map((name) => caches.delete(name)));
          if (controlledByAppWorker && window.sessionStorage.getItem(reloadKey) !== "true") {
            window.sessionStorage.setItem(reloadKey, "true");
            window.location.reload();
          }
        })
        .catch((error: unknown) => {
          console.error("Pushkar Suraksha development service worker cleanup failed.", error);
        });
      return;
    }

    void navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.error("Pushkar Suraksha offline worker registration failed.", error);
    });
  }, []);
  return null;
}

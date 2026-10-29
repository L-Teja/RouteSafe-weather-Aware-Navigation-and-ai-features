"use strict";

const CACHE_NAME = "routesafe-shell-v5";

const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.webmanifest",
  "./icon.svg"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    await Promise.all(
      APP_FILES.map(async file => {
        try {
          const response = await fetch(file, {
            cache: "reload"
          });

          if (response.ok) {
            await cache.put(file, response);
          }
        } catch (error) {
          console.warn("Could not cache:", file);
        }
      })
    );

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();

    await Promise.all(
      cacheNames
        .filter(
          name =>
            name.startsWith("routesafe-shell-") &&
            name !== CACHE_NAME
        )
        .map(name => caches.delete(name))
    );

    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type !== "CACHE_APP_SHELL") {
    return;
  }

  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    await Promise.all(
      APP_FILES.map(async file => {
        try {
          const response = await fetch(file);

          if (response.ok) {
            await cache.put(file, response);
          }
        } catch (error) {
          // Previously cached files remain available.
        }
      })
    );
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Do not cache third-party API responses or map tiles.
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith((async () => {
    try {
      const response = await fetch(request);

      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);

        cache.put(
          request,
          response.clone()
        ).catch(() => {});
      }

      return response;

    } catch (error) {
      const cached = await caches.match(request);

      if (cached) {
        return cached;
      }

      if (request.mode === "navigate") {
        const home = await caches.match("./index.html");

        if (home) {
          return home;
        }

        return new Response(
          "RouteSafe is offline. Reconnect to the internet and reload.",
          {
            status: 503,
            headers: {
              "Content-Type": "text/plain; charset=utf-8"
            }
          }
        );
      }

      return new Response("", {
        status: 503,
        statusText: "Offline"
      });
    }
  })());
});
// PWA Cache Clearing Script
// Add this to your main App.js or index.js

if ("serviceWorker" in navigator) {
  // Clear existing service worker cache
  navigator.serviceWorker.getRegistrations().then(function (registrations) {
    for (let registration of registrations) {
      registration.unregister();
    }
  });

  // Clear all caches
  if ("caches" in window) {
    caches.keys().then(function (names) {
      for (let name of names) {
        caches.delete(name);
      }
    });
  }
}

// Force reload to clear cache
window.location.reload(true);

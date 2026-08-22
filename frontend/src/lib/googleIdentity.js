// The Google Identity Services script (<script async defer src="...gsi/client">)
// is injected in index.html and loads in parallel with the React app. If a
// component checks `window.google` only once, at mount time, it can run
// before the script has actually finished loading — especially on a slow
// connection or a cold cache — silently skipping initialization. That's why
// Google Sign-In sometimes "just works" and sometimes doesn't: it depends on
// which finishes loading first, a race the previous code didn't account for.
//
// This polls briefly until `window.google.accounts.id` is actually available,
// so callers always get a real, ready-to-use client instead of racing it.
export function waitForGoogleIdentity(timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve(window.google);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(interval);
        resolve(window.google);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(new Error('Google Identity script failed to load in time'));
      }
    }, 100);
  });
}

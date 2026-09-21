let MATOMO_URL = '';
let MATOMO_SITE = '';
try {
  // Vite replaces these with string literals at build; raw ESM throws here
  // (import.meta.env is undefined) and we keep analytics disabled.
  MATOMO_URL = import.meta.env.VITE_MATOMO_URL || '';
  MATOMO_SITE = import.meta.env.VITE_MATOMO_SITE_ID || '';
} catch { /* served raw — no analytics */ }

const CONSENT_KEY = 'zamorun-consent';

function configured() {
  return !!(MATOMO_URL && MATOMO_SITE);
}

// Loads the Matomo tracker (idempotent) and applies the cookie-consent state.
function initMatomo(cookieConsent) {
  const u = MATOMO_URL.endsWith('/') ? MATOMO_URL : MATOMO_URL + '/';
  const _paq = (window._paq = window._paq || []);

  if (_paq.__loaded) {
    if (cookieConsent) {
      _paq.push(['setCookieConsentGiven']);
    } else {
      _paq.push(['forgetCookieConsentGiven']);
      _paq.push(['disableCookies']);
    }
    return;
  }
  _paq.__loaded = true;

  // disableCookies() is widely supported and definitively prevents any cookie
  // from being set; setCookieConsentGiven() re-enables them once allowed.
  _paq.push(cookieConsent ? ['setCookieConsentGiven'] : ['disableCookies']);
  _paq.push(['setTrackerUrl', u + 'matomo.php']);
  _paq.push(['setSiteId', String(MATOMO_SITE)]);
  _paq.push(['trackPageView']);
  _paq.push(['enableLinkTracking']);

  const d = document;
  const g = d.createElement('script');
  const s = d.getElementsByTagName('script')[0];
  g.async = true;
  g.src = u + 'matomo.js';
  s.parentNode.insertBefore(g, s);
}

function showBanner() {
  const banner = document.getElementById('consent');
  if (!banner) return;
  const decide = (choice) => {
    try { localStorage.setItem(CONSENT_KEY, choice); } catch {}
    banner.hidden = true;
    if (configured()) initMatomo(choice === 'granted');
  };
  banner.querySelector('#consent-accept')
    ?.addEventListener('click', () => decide('granted'), { once: true });
  banner.querySelector('#consent-decline')
    ?.addEventListener('click', () => decide('denied'), { once: true });
  banner.hidden = false;
}

// Called once on app start. Starts anonymous (cookieless) tracking right away
// when configured, then asks once whether to upgrade to cookie-based measurement.
// `?consent` in the URL force-shows the banner for screenshots/preview.
export function initConsent() {
  const forced = new URLSearchParams(location.search).has('consent');
  if (!configured() && !forced) return;

  let choice = null;
  try { choice = localStorage.getItem(CONSENT_KEY); } catch {}

  // Anonymous tracking from the first frame; the choice only toggles cookies.
  if (configured()) initMatomo(choice === 'granted');

  if (choice === 'granted' || choice === 'denied') return;
  showBanner();
}

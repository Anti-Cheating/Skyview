// Google Analytics (gtag) for app.trueyy.com.
//
// Uses the SAME GA4 property as the marketing site (www.trueyy.com) with
// cross-domain linking, so a visitor who clicks "Start trial" on the
// marketing site and signs up here is stitched into one journey — and the
// `sign_up` event counts as a conversion end-to-end.
//
// Only runs on the production host. Local dev and any preview host stay
// out of the analytics data.

const GA_ID = 'G-W821YB92E7';
const CROSS_DOMAINS = ['trueyy.com', 'www.trueyy.com', 'app.trueyy.com'];

const ENABLED =
  typeof window !== 'undefined' &&
  import.meta.env.PROD &&
  window.location.hostname === 'app.trueyy.com';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

export function initAnalytics(): void {
  if (!ENABLED || document.getElementById('ga-gtag')) return;

  const script = document.createElement('script');
  script.id = 'ga-gtag';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, {
    // Stitch trueyy.com <-> app.trueyy.com into one session for funnel attribution.
    linker: { domains: CROSS_DOMAINS },
    // SPA: page_views are sent manually on route change (see RouteAnalytics).
    send_page_view: false,
  });
}

/** Send a SPA page_view. Called on every route change. */
export function trackPageview(path: string): void {
  if (!ENABLED || typeof window.gtag !== 'function') return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

/** Fire a GA4 event (e.g. the `sign_up` conversion). */
export function trackEvent(name: string, params: Record<string, unknown> = {}): void {
  if (!ENABLED || typeof window.gtag !== 'function') return;
  window.gtag('event', name, params);
}

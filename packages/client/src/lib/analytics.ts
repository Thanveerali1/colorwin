import posthog from 'posthog-js';

let initialized = false;

export function initAnalytics() {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST;

  if (!key || !host) {
    console.warn('PostHog not configured -- skipping analytics init.');
    return;
  }

  posthog.init(key, {
    api_host: host,
    capture_pageview: false,
    autocapture: true,
    disable_session_recording: true,
  });

  initialized = true;
}

export function trackPageView(path: string) {
  if (!initialized) return;
  posthog.capture('$pageview', { $current_url: window.location.origin + '/#' + path });
}

export function trackEvent(name: string, properties?: Record<string, unknown>) {
  if (!initialized) return;
  posthog.capture(name, properties);
}

export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  if (!initialized) return;
  posthog.identify(userId, traits);
}

export function resetAnalyticsIdentity() {
  if (!initialized) return;
  posthog.reset();
}

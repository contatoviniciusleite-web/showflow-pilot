import * as Sentry from "@sentry/react";

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export function initSentry() {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,
    enabled: import.meta.env.PROD,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: false,
      }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Network request failed",
      "Failed to fetch",
      "Load failed",
    ],
  });
}

export { Sentry };

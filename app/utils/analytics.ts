import * as Sentry from "@sentry/react";

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  userId?: string;
}

/**
 * Track custom analytics events
 */
export function trackEvent(event: AnalyticsEvent) {
  Sentry.captureMessage(event.name, "info", {
    tags: {
      event_type: event.name,
    },
    extra: event.properties,
  });

  // Also log to console in development
  if (import.meta.env.DEV) {
    console.log("[Analytics]", event.name, event.properties);
  }
}

/**
 * Set user context for error tracking
 */
export function setUserContext(userId: string, email?: string, name?: string) {
  Sentry.setUser({
    id: userId,
    email,
    username: name,
  });
}

/**
 * Clear user context on logout
 */
export function clearUserContext() {
  Sentry.setUser(null);
}

/**
 * Track page views
 */
export function trackPageView(path: string, title?: string) {
  trackEvent({
    name: "page_view",
    properties: {
      path,
      title,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Track user actions
 */
export function trackUserAction(action: string, details?: Record<string, any>) {
  trackEvent({
    name: `user_${action}`,
    properties: {
      action,
      ...details,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Track errors manually
 */
export function trackError(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Set custom tags for better error grouping
 */
export function setErrorTag(key: string, value: string) {
  Sentry.setTag(key, value);
}

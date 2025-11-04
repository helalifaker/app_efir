// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

// Only initialize Sentry if DSN is provided
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    debug: process.env.NODE_ENV === 'development',
  
  // Mask PII (Personally Identifiable Information)
  beforeSend(event) {
    // Remove sensitive data from event
    if (event.request) {
      // Remove sensitive headers
      if (event.request.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-api-key'];
      }
      
      // Remove sensitive query params
      if (event.request.query_string) {
        const params = new URLSearchParams(event.request.query_string);
        params.delete('token');
        params.delete('key');
        params.delete('secret');
        event.request.query_string = params.toString();
      }
    }
    
    // Remove sensitive user data
    if (event.user) {
      // Keep only safe user identifiers
      event.user = {
        id: event.user.id,
        // Don't include email, IP, or other PII
      };
    }
    
    return event;
  },
  
  // Ignore common non-critical errors
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
    'Network request failed',
  ],
  });
}


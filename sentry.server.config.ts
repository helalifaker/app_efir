// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs';

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
        delete event.request.headers['supabase-service-role-key'];
      }
      
      // Remove sensitive query params
      if (event.request.query_string) {
        const params = new URLSearchParams(event.request.query_string);
        params.delete('token');
        params.delete('key');
        params.delete('secret');
        event.request.query_string = params.toString();
      }
      
      // Remove request body for sensitive endpoints
      if (event.request && event.request.data && typeof event.request.data === 'object') {
        const requestData = event.request.data as Record<string, unknown>;
        const sensitiveKeys = ['password', 'token', 'secret', 'key', 'apiKey', 'accessToken'];
        sensitiveKeys.forEach(key => {
          if (key in requestData) {
            requestData[key] = '[REDACTED]';
          }
        });
      }
    }
    
    // Remove sensitive context data
    if (event.contexts) {
      // Remove environment variables that might contain secrets
      if (event.contexts.runtime) {
        delete event.contexts.runtime.env;
      }
    }
    
    // Remove sensitive user data
    if (event.user) {
      event.user = {
        id: event.user.id,
        // Don't include email, IP, or other PII
      };
    }
    
    return event;
  },
  
  // Ignore common non-critical errors
  ignoreErrors: [
    'Non-Error promise rejection captured',
    'ECONNREFUSED', // Database connection issues
  ],
});


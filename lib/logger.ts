// lib/logger.ts
// Leveled logging with PII masking

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  
  // Sensitive keys to mask in logs
  private sensitiveKeys = [
    'password',
    'token',
    'secret',
    'key',
    'apiKey',
    'accessToken',
    'refreshToken',
    'authorization',
    'cookie',
    'supabase-service-role-key',
    'service_role_key',
    'anon_key',
  ];
  
  /**
   * Mask sensitive data from objects
   */
  private maskSensitiveData(data: unknown): unknown {
    if (!data || typeof data !== 'object') {
      return data;
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.maskSensitiveData(item));
    }
    
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (this.sensitiveKeys.some(sk => lowerKey.includes(sk))) {
        masked[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        masked[key] = this.maskSensitiveData(value);
      } else {
        masked[key] = value;
      }
    }
    
    return masked;
  }
  
  /**
   * Format log message with context
   */
  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(this.maskSensitiveData(context))}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }
  
  /**
   * Debug level logging (development only)
   */
  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.debug(this.formatMessage('debug', message, context));
    }
  }
  
  /**
   * Info level logging
   */
  info(message: string, context?: LogContext): void {
    console.info(this.formatMessage('info', message, context));
  }
  
  /**
   * Warning level logging
   */
  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('warn', message, context));
  }
  
  /**
   * Error level logging
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext = error instanceof Error 
      ? { 
          ...context, 
          error: {
            name: error.name,
            message: error.message,
            stack: this.isDevelopment ? error.stack : undefined,
          }
        }
      : context;
    
    console.error(this.formatMessage('error', message, errorContext));
  }
}

// Export singleton instance
export const logger = new Logger();

// Export types
export type { LogLevel, LogContext };


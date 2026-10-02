import { env } from '../config/env';

type Level = 'debug' | 'info' | 'warn' | 'error';

function write(level: Level, message: string, meta?: unknown): void {
  if (env.NODE_ENV === 'test' && level !== 'error') return;
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}`;
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (meta === undefined) sink(line);
  else sink(line, meta);
}

/** Minimal structured logger. Never pass secrets, OTP codes or tokens as `meta`. */
export const logger = {
  debug: (message: string, meta?: unknown) => write('debug', message, meta),
  info: (message: string, meta?: unknown) => write('info', message, meta),
  warn: (message: string, meta?: unknown) => write('warn', message, meta),
  error: (message: string, meta?: unknown) => write('error', message, meta),
};

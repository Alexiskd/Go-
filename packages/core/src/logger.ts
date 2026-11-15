import { LOG_LEVELS, type LogLevel } from '@go-/types';

export interface LogRecord {
  level: Exclude<LogLevel, 'silent'>;
  time: string;
  name: string;
  msg: string;
  [key: string]: unknown;
}

export type LogSink = (record: LogRecord) => void;

export interface Logger {
  readonly level: LogLevel;
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  child(name: string, fields?: Record<string, unknown>): Logger;
  isEnabled(level: LogLevel): boolean;
}

export interface LoggerOptions {
  name?: string;
  level?: LogLevel;
  format?: 'json' | 'pretty';
  sink?: LogSink;
  /** Clés dont la valeur est masquée, à toute profondeur (insensible à la casse). */
  redact?: readonly string[];
  fields?: Record<string, unknown>;
}

export const DEFAULT_REDACT = ['password', 'passwordHash', 'secret', 'token', 'accessToken', 'refreshToken', 'authorization', 'cookie', 'apiKey'];

const rank = (level: LogLevel) => LOG_LEVELS.indexOf(level);

function redactValue(value: unknown, keys: Set<string>, depth = 0): unknown {
  if (depth > 8 || value === null || typeof value !== 'object') return value;
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  if (Array.isArray(value)) return value.map((v) => redactValue(v, keys, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = keys.has(k.toLowerCase()) ? '[REDACTED]' : redactValue(v, keys, depth + 1);
  return out;
}

const COLORS: Record<string, string> = { debug: '\x1b[90m', info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m' };

export function jsonSink(stream: NodeJS.WritableStream = process.stdout): LogSink {
  return (record) => stream.write(JSON.stringify(record) + '\n');
}

export function prettySink(stream: NodeJS.WritableStream = process.stdout): LogSink {
  return ({ level, time, name, msg, ...rest }) => {
    const extra = Object.keys(rest).length ? ' ' + JSON.stringify(rest) : '';
    stream.write(`${time.slice(11, 23)} ${COLORS[level]}${level.toUpperCase().padEnd(5)}\x1b[0m [${name}] ${msg}${extra}\n`);
  };
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const level = options.level ?? 'info';
  const threshold = rank(level);
  const sink = options.sink ?? (options.format === 'pretty' ? prettySink() : jsonSink());
  const redact = new Set((options.redact ?? DEFAULT_REDACT).map((k) => k.toLowerCase()));

  // Les loggers enfants partagent sink, niveau et liste de masquage : en créer un
  // (par requête, par module) ne coûte qu'une fermeture.
  const make = (name: string, base: Record<string, unknown>): Logger => {
    const write = (lvl: LogRecord['level'], msg: string, fields?: Record<string, unknown>) => {
      if (rank(lvl) < threshold) return;
      const extra = redactValue(fields ? { ...base, ...fields } : base, redact) as Record<string, unknown>;
      sink({ ...extra, level: lvl, time: new Date().toISOString(), name, msg });
    };
    return {
      level,
      debug: (m, f) => write('debug', m, f),
      info: (m, f) => write('info', m, f),
      warn: (m, f) => write('warn', m, f),
      error: (m, f) => write('error', m, f),
      isEnabled: (lvl) => lvl !== 'silent' && rank(lvl) >= threshold,
      child: (childName, fields) => make(`${name}:${childName}`, fields ? { ...base, ...fields } : base),
    };
  };
  return make(options.name ?? 'go-', options.fields ?? {});
}

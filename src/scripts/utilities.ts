import dayjs from 'dayjs';
import { parseMatchPattern } from '../common/match-pattern';
import { ErrorResult, Result, SuccessResult } from './types';

// #region AltURL
export class AltURL {
  readonly scheme: string;
  readonly host: string;
  readonly path: string;

  constructor(url: string) {
    const u = new URL(url);
    this.scheme = u.protocol.slice(0, -1);
    this.host = u.hostname;
    this.path = `${u.pathname}${u.search}`;
  }

  toString(): string {
    return `${this.scheme}://${this.host}${this.path}`;
  }
}

export function makeAltURL(url: string): AltURL | null {
  try {
    return new AltURL(url);
  } catch {
    return null;
  }
}
// #endregion AltURL

// #region Error
export class HTTPError extends Error {
  constructor(readonly status: number, readonly statusText: string) {
    super(`${status}${statusText ? ' ' : ''}${statusText}`);
    this.name = 'HTTPError';
  }
}

export class UnexpectedResponse extends Error {
  constructor(readonly response: unknown) {
    super(JSON.stringify(response));
    this.name = 'UnexpectedResponse';
  }
}
// #endregion Error

// #region MatchPattern
export { type MatchPatternScheme, parseMatchPattern } from '../common/match-pattern';

type SchemePattern = { type: 'any' } | { type: 'exact'; exact: string };

type HostPattern =
  | { type: 'any' }
  | { type: 'domain'; domain: string }
  | { type: 'exact'; exact: string };

type PathPattern =
  | { type: 'any' }
  | { type: 'prefix'; prefix: string }
  | { type: 'exact'; exact: string }
  | { type: 'regExp'; regExp: RegExp };

export class MatchPattern {
  private readonly schemePattern: SchemePattern;
  private readonly hostPattern: HostPattern;
  private readonly pathPattern: PathPattern;

  constructor(mp: string) {
    const parsed = parseMatchPattern(mp);
    if (!parsed) {
      throw new Error('Invalid match pattern');
    }
    const { scheme, host, path } = parsed;
    if (scheme === '*') {
      this.schemePattern = { type: 'any' };
    } else {
      this.schemePattern = { type: 'exact', exact: scheme };
    }
    if (host === '*') {
      this.hostPattern = { type: 'any' };
    } else if (host.startsWith('*.')) {
      this.hostPattern = { type: 'domain', domain: host.slice(2) };
    } else {
      this.hostPattern = { type: 'exact', exact: host };
    }
    if (path === '/*') {
      this.pathPattern = { type: 'any' };
    } else {
      const wildcardIndex = path.indexOf('*');
      if (wildcardIndex === path.length - 1) {
        this.pathPattern = { type: 'prefix', prefix: path.slice(0, -1) };
      } else if (wildcardIndex === -1) {
        this.pathPattern = { type: 'exact', exact: path };
      } else {
        this.pathPattern = {
          type: 'regExp',
          regExp: new RegExp(
            `^${path.replace(/[$^\\.+?()[\]{}|]/g, '\\$&').replace(/\*/g, '.*?')}$`,
          ),
        };
      }
    }
  }

  test(url: AltURL): boolean {
    if (this.hostPattern.type === 'domain') {
      if (
        url.host !== this.hostPattern.domain &&
        !url.host.endsWith(`.${this.hostPattern.domain}`)
      ) {
        return false;
      }
    } else if (this.hostPattern.type === 'exact') {
      if (url.host !== this.hostPattern.exact) {
        return false;
      }
    }
    if (this.schemePattern.type === 'any') {
      if (url.scheme !== 'http' && url.scheme !== 'https') {
        return false;
      }
    } else {
      if (url.scheme !== this.schemePattern.exact) {
        return false;
      }
    }
    if (this.pathPattern.type === 'prefix') {
      if (!url.path.startsWith(this.pathPattern.prefix)) {
        return false;
      }
    } else if (this.pathPattern.type === 'exact') {
      if (url.path !== this.pathPattern.exact) {
        return false;
      }
    } else if (this.pathPattern.type === 'regExp') {
      if (!this.pathPattern.regExp.test(url.path)) {
        return false;
      }
    }
    return true;
  }
}
// #endregion MatchPattern

// #region Mutex
export class Mutex {
  private queue: (() => Promise<void>)[] = [];

  lock<T>(func: () => T | Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          resolve(await Promise.resolve(func()));
        } catch (e: unknown) {
          reject(e);
        }
      });
      if (this.queue.length === 1) {
        void this.dequeue();
      }
    });
  }

  private async dequeue(): Promise<void> {
    if (!this.queue.length) {
      return;
    }
    await this.queue[0]();
    this.queue.shift();
    void this.dequeue();
  }
}
// #endregion Mutex

// #region Result
export function isErrorResult(result: Result): result is ErrorResult {
  return result.type === 'error';
}

export function isSuccessResult(result: Result): result is SuccessResult {
  return result.type === 'success';
}

export function errorResult(message: string): ErrorResult {
  return {
    type: 'error',
    message,
  };
}

export function successResult(): SuccessResult {
  return {
    type: 'success',
    timestamp: dayjs().toISOString(),
  };
}
// #endregion Result

// #region object
export function stringKeys<Key extends string, Value>(record: Readonly<Record<Key, Value>>): Key[] {
  return Object.keys(record) as Key[];
}

export function stringEntries<Key extends string, Value>(
  record: Readonly<Record<Key, Value>>,
): [Key, Value][] {
  return Object.entries(record) as [Key, Value][];
}

export function numberKeys<Key extends number, Value>(record: Readonly<Record<Key, Value>>): Key[] {
  return Object.keys(record).map(Number) as Key[];
}

export function numberEntries<Key extends number, Value>(
  record: Readonly<Record<Key, Value>>,
): [Key, Value][] {
  return Object.entries(record).map(([key, value]) => [Number(key), value]) as [Key, Value][];
}
// #endregion object

// #region string
export function lines(s: string): string[] {
  return s ? s.split('\n') : [];
}

export function unlines(ss: string[]): string {
  return ss.join('\n');
}

export const r = String.raw.bind(String);
// #endregion string

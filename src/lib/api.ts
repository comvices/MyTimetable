let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

const TIMESTAMP_KEYS = new Set([
  'createdAt',
  'updatedAt',
  'trialEndsAt',
  'currentPeriodStart',
  'currentPeriodEnd',
]);

export interface CompatTimestamp {
  toDate: () => Date;
  toMillis: () => number;
  toISOString: () => string;
}

export function toCompatTimestamp(value: unknown): CompatTimestamp | unknown {
  if (value === null || value === undefined) return value;
  if (
    typeof value === 'object' &&
    typeof (value as { toDate?: unknown }).toDate === 'function' &&
    typeof (value as { toMillis?: unknown }).toMillis === 'function'
  ) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const ms = typeof value === 'number' ? value : Date.parse(value);
    if (!Number.isNaN(ms)) {
      return {
        toDate: () => new Date(ms),
        toMillis: () => ms,
        toISOString: () => new Date(ms).toISOString(),
      };
    }
  }
  return value;
}

export function hydrateTimestamps<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((item) => hydrateTimestamps(item)) as unknown as T;
  }
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
      if (TIMESTAMP_KEYS.has(key) && (typeof val === 'string' || typeof val === 'number')) {
        out[key] = toCompatTimestamp(val);
      } else if (val && typeof val === 'object') {
        out[key] = hydrateTimestamps(val);
      } else {
        out[key] = val;
      }
    }
    return out as T;
  }
  return input;
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (inMemoryToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      typeof data.error === 'string' && data.error.trim()
        ? data.error
        : `เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ (${res.status})`;
    throw new Error(message);
  }

  return hydrateTimestamps(data as T);
}

// Lightweight in-app workspace reactivity bus
const workspaceListeners = new Map<string, Set<() => void>>();

export function subscribeWorkspaceEvents(schoolId: string, listener: () => void): () => void {
  let set = workspaceListeners.get(schoolId);
  if (!set) {
    set = new Set();
    workspaceListeners.set(schoolId, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
    if (set && set.size === 0) {
      workspaceListeners.delete(schoolId);
    }
  };
}

export function emitWorkspaceUpdate(schoolId: string): void {
  const set = workspaceListeners.get(schoolId);
  if (!set) return;
  for (const listener of set) {
    listener();
  }
}

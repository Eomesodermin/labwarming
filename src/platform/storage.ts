// Every storage call is wrapped in try and catch (design doc 9). If storage is unavailable
// (a private window, blocked site data) the game keeps running and the UI shows a banner.

let failed = false;

function ls(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function storageGet(key: string): string | null {
  try {
    return ls()?.getItem(key) ?? null;
  } catch {
    failed = true;
    return null;
  }
}

/** Returns false if the value could not be stored. */
export function storageSet(key: string, value: string): boolean {
  try {
    const s = ls();
    if (!s) {
      failed = true;
      return false;
    }
    s.setItem(key, value);
    return true;
  } catch {
    failed = true;
    return false;
  }
}

export function storageRemove(key: string): void {
  try {
    ls()?.removeItem(key);
  } catch {
    failed = true;
  }
}

/** True when a write has been tried and failed, or storage cannot be reached at all. */
export function storageFailed(): boolean {
  if (failed) return true;
  try {
    const s = ls();
    if (!s) return true;
    const k = 'labwarming.probe';
    s.setItem(k, '1');
    s.removeItem(k);
    return false;
  } catch {
    return true;
  }
}

export function clearStorageFailure(): void {
  failed = false;
}

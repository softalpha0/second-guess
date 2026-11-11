// Presage API key entered in Settings, stored encrypted with the operating
// system's own protection (Windows: DPAPI, macOS: Keychain) via Electron
// safeStorage. The key never goes back to the window — only "is it set" and
// its last 4 characters. A key in .env still works (for developers).
import { safeStorage } from 'electron';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type KeySource = 'settings' | 'env' | null;

export class KeyStore {
  private file: string;
  constructor(dataDir: string, private envKey: string | undefined) {
    this.file = join(dataDir, 'presage-key.bin');
  }

  private saved(): string | undefined {
    if (!existsSync(this.file) || !safeStorage.isEncryptionAvailable()) return undefined;
    try {
      return safeStorage.decryptString(readFileSync(this.file)).trim() || undefined;
    } catch {
      return undefined; // unreadable (e.g. copied from another PC): treat as not set
    }
  }

  /** The key to use: Settings first, then .env. */
  current(): string | undefined {
    return this.saved() ?? this.envKey;
  }

  status(): { source: KeySource; hint: string | null; canSave: boolean } {
    const saved = this.saved();
    const key = saved ?? this.envKey;
    return {
      source: saved ? 'settings' : this.envKey ? 'env' : null,
      hint: key ? `…${key.slice(-4)}` : null,
      canSave: safeStorage.isEncryptionAvailable(),
    };
  }

  save(key: string): { ok: boolean; error?: string } {
    const k = key.trim();
    if (k.length < 10 || /\s/.test(k)) return { ok: false, error: 'That doesn’t look like an API key (it should be one long word with no spaces).' };
    if (!safeStorage.isEncryptionAvailable()) return { ok: false, error: 'Secure storage isn’t available on this computer. Put the key in the .env file instead.' };
    writeFileSync(this.file, safeStorage.encryptString(k));
    return { ok: true };
  }

  remove(): void {
    rmSync(this.file, { force: true });
  }
}

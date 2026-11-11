import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Stand-in for Electron's safeStorage (Windows uses DPAPI in the real app).
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from(`enc:${Buffer.from(s).toString('base64')}`),
    decryptString: (b: Buffer) => {
      const t = b.toString();
      if (!t.startsWith('enc:')) throw new Error('bad');
      return Buffer.from(t.slice(4), 'base64').toString();
    },
  },
}));
const { KeyStore } = await import('../src/main/keystore');

const dir = () => mkdtempSync(join(tmpdir(), 'sg-key-'));
const KEY = 'pk_live_abcdefghijklmnop1234';

describe('API key store', () => {
  it('saves encrypted, prefers the Settings key over .env, and only reveals the last 4 characters', () => {
    const d = dir();
    const ks = new KeyStore(d, 'env_key_0000000000');
    expect(ks.status()).toMatchObject({ source: 'env', hint: '…0000' });
    expect(ks.save(`  ${KEY}  `)).toEqual({ ok: true });
    expect(ks.current()).toBe(KEY);
    expect(ks.status()).toMatchObject({ source: 'settings', hint: '…1234' });
    expect(readFileSync(join(d, 'presage-key.bin'), 'utf8')).not.toContain(KEY); // not stored as plain text
  });

  it('rejects things that are not a key', () => {
    const ks = new KeyStore(dir(), undefined);
    expect(ks.save('short').ok).toBe(false);
    expect(ks.save('has spaces in it 12345').ok).toBe(false);
    expect(ks.status().source).toBeNull();
  });

  it('remove falls back to .env (or nothing)', () => {
    const d = dir();
    const ks = new KeyStore(d, undefined);
    ks.save(KEY);
    ks.remove();
    expect(ks.current()).toBeUndefined();
    expect(new KeyStore(d, 'env_key_0000000000').current()).toBe('env_key_0000000000');
  });
});

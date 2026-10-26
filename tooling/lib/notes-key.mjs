// The notes posting key: a GitHub token sealed with the private vault's own key.
// The browser key saved after unlocking the vault is the PBKDF2 output for the current
// archive salt, so the token is encrypted with exactly that key and re-sealed whenever
// the vault is re-encrypted with a fresh salt.
import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
export const notesKeyPath = join(projectRoot, 'source', 'private', 'notes-key.enc.json');

export function vaultKey(bundle, password) {
  if (!bundle || bundle.empty || !bundle.kdf || !bundle.kdf.salt) {
    throw new Error('The private vault is empty. Posting needs at least one private post to derive its key.');
  }
  return pbkdf2Sync(password, Buffer.from(bundle.kdf.salt, 'base64'), bundle.kdf.iterations, 32, 'sha256');
}

export function sealNotesKey(payload, keyBytes, archiveSalt) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBytes, iv);
  const plain = Buffer.from(JSON.stringify({ version: 1, ...payload }), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
  return {
    version: 1,
    archive: archiveSalt,
    cipher: { name: 'AES-256-GCM', iv: iv.toString('base64') },
    ciphertext: encrypted.toString('base64')
  };
}

export function openNotesKey(bundle, keyBytes) {
  const encrypted = Buffer.from(bundle.ciphertext, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', keyBytes, Buffer.from(bundle.cipher.iv, 'base64'));
  decipher.setAuthTag(encrypted.subarray(-16));
  return JSON.parse(Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]).toString('utf8'));
}

export function readNotesKey() {
  return existsSync(notesKeyPath) ? JSON.parse(readFileSync(notesKeyPath, 'utf8')) : null;
}

export function writeNotesKey(bundle) {
  writeFileSync(notesKeyPath, `${JSON.stringify(bundle, null, 2)}\n`);
}

// Called by the vault tooling after it re-encrypts the archive with a new salt.
// Returns a short message for the terminal, or '' when there is no posting key.
export function resealNotesKey(previousArchive, nextArchive, password) {
  const sealed = readNotesKey();
  if (!sealed) return '';
  if (!nextArchive || nextArchive.empty) {
    return 'Warning: the vault is now empty, so the notes posting key can no longer be unlocked. Add a private post and run npm run notes:setup again.';
  }
  let payload;
  try {
    payload = openNotesKey(sealed, vaultKey(previousArchive, password));
  } catch {
    return 'Warning: the notes posting key did not open with this password and was left unchanged. Run npm run notes:setup again.';
  }
  const { version, ...rest } = payload;
  writeNotesKey(sealNotesKey(rest, vaultKey(nextArchive, password), nextArchive.kdf.salt));
  return 'Re-sealed the notes posting key for the new vault key.';
}

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const release = JSON.parse(await readFile(new URL('release.json', root), 'utf8'));
const { dmg, sha256, artifactURL } = release.macOS;
assert.match(dmg, /^\/downloads\/[A-Za-z0-9._-]+\.dmg$/);
assert.match(sha256, /^[a-f0-9]{64}$/);
const source = new URL(artifactURL);
assert.equal(source.origin, 'https://github.com');
assert(source.pathname.startsWith('/qq345386817/scroll-cadence/releases/download/'));
const target = new URL(dmg.slice(1), root);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

let existing;
try { existing = await readFile(target); } catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (existing) {
  assert.equal(hash(existing), sha256, 'Local DMG differs from release.json; inspect it before replacing');
  console.log('Local DMG matches the published release checksum.');
} else {
  const response = await fetch(source, { signal: AbortSignal.timeout(120_000) });
  assert(response.ok, `Release download returned HTTP ${response.status}`);
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    assert(size <= 25 * 1024 * 1024, 'DMG exceeds the Cloudflare Pages asset limit');
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  assert.equal(hash(bytes), sha256, 'Downloaded DMG checksum mismatch; deployment must stop');
  await mkdir(new URL('downloads/', root), { recursive: true });
  await writeFile(target, bytes, { flag: 'wx' });
  console.log(`Downloaded and verified release DMG (${bytes.length} bytes).`);
}

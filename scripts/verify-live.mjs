import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

const root = new URL('../', import.meta.url);
const release = JSON.parse(await readFile(new URL('release.json', root), 'utf8'));
const commit = process.env.SC_DEPLOY_COMMIT || process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA;
assert.match(commit || '', /^[a-f0-9]{40}$/, 'SC_DEPLOY_COMMIT or the CI commit variable is required to identify the deployed build');
const origin = release.origin;

async function retry(check) {
  for (let attempt = 0; ; attempt++) {
    try { return await check(); } catch (error) {
      if (attempt >= 5) throw error;
      console.log(`Waiting for production propagation: ${error.message}`);
      await delay(10_000);
    }
  }
}
async function get(path, options = {}) {
  const response = await fetch(new URL(path, origin), {
    signal: AbortSignal.timeout(30_000), ...options,
  });
  assert(response.ok, `${path}: HTTP ${response.status}`);
  return response;
}

await retry(async () => {
  const response = await get(`/deployment.json?commit=${commit}`, { cache: 'no-store' });
  assert.equal((await response.json()).commit, commit, 'Production commit has not updated');
});
for (const path of ['/BingSiteAuth.xml', '/google8bdd3bd447b6e703.html', '/sitemap.xml']) {
  await retry(async () => {
    const response = await get(path);
    assert.equal(await response.text(), await readFile(new URL(`dist${path}`, root), 'utf8'), `${path} differs from build`);
  });
}
await retry(async () => {
  const response = await get(release.macOS.dmg);
  const digest = createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
  assert.equal(digest, release.macOS.sha256, 'Public DMG checksum mismatch');
});
await retry(async () => {
  const response = await fetch(origin + '/', { redirect: 'manual', signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 301);
  assert.equal(new URL(response.headers.get('location'), origin).href, origin + '/en-US/');
  const old = await fetch(`https://scroll-cadence.pages.dev/zh-Hans/help/?commit=${commit}`, {
    redirect: 'manual', signal: AbortSignal.timeout(30_000),
  });
  assert.equal(old.status, 301);
  assert.equal(old.headers.get('location'), `${origin}/zh-Hans/help/?commit=${commit}`);
});
console.log(`Verified production commit ${commit}, Bing/Google verification files, sitemap, DMG and redirects.`);

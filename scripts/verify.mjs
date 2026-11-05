import { readFile, stat, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const config = JSON.parse(await readFile(new URL('locales.json', root)));
const release = JSON.parse(await readFile(new URL('release.json', root)));
const seo = JSON.parse(await readFile(new URL('seo.json', root)));
const store = JSON.parse(await readFile(new URL('store-metadata.json', root)));
const catalog = JSON.parse(await readFile(new URL('catalog.json', root)));
const esc = value => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const canonicalURLs = [];
assert.equal(config.default, 'en-US');
assert.equal(config.locales.length, 8);
assert.equal(new URL(release.origin).protocol, 'https:');
assert.deepEqual(Object.keys(seo).sort(), config.locales.map(l=>l.id).sort());
assert.deepEqual(Object.keys(store.locales).sort(), config.locales.map(l=>l.id).sort());
assert.equal(release.iOS.status, 'available');
assert.equal(release.iOS.price, 'free', 'Review localized pricing copy before changing price');
assert.equal(release.iOS.appStoreURL, 'https://apps.apple.com/app/id6827527960');
assert.notEqual(release.iOS.version, release.iOS.pendingVersion, 'Published and pending versions must stay distinct');

for (const { id } of config.locales) {
  const descriptions = new Set();
  for (const page of ['', 'help/', 'privacy/']) {
    const html = await readFile(new URL(`dist/${id}/${page}index.html`, root), 'utf8');
    const canonical = `${release.origin}/${id}/${page}`;
    canonicalURLs.push(canonical);
    assert(html.includes(`<html lang="${id}">`));
    assert.equal((html.match(/<h1[ >]/g) || []).length, 1);
    assert(!html.includes('undefined'));
    assert(!/<script[^>]+src="https?:/.test(html));
    assert(html.includes(`<link rel="canonical" href="${canonical}">`));
    const alternates = [...html.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)];
    assert.equal(alternates.length, 9);
    for (const alternate of config.locales) {
      assert(alternates.some(([, lang, url]) => lang === alternate.id && url === `${release.origin}/${alternate.id}/${page}`));
    }
    assert(alternates.some(([, lang, url]) => lang === 'x-default' && url === `${release.origin}/en-US/${page}`));
    const description = html.match(/name="description" content="([^"]+)"/)[1];
    assert(description.length > 35);
    descriptions.add(description);
    assert(html.includes(`<meta property="og:url" content="${canonical}">`));
    assert(html.includes('name="twitter:card"'));
    const schema = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    assert.equal(schema['@context'], 'https://schema.org');
    assert(schema['@graph'].some(item => item['@type'] === 'WebPage' && item.url === canonical && item.inLanguage === id));
    if (!page) {
      assert.equal((html.match(/<dt>/g) || []).length, 6, 'Six visible FAQ answers');
      const software = schema['@graph'].find(item => item['@type'] === 'SoftwareApplication');
      assert.equal(software.downloadUrl, release.origin + release.macOS.dmg);
      assert(!software.aggregateRating, 'No invented ratings');
      assert.equal(software.softwareVersion, release.version);
      const ios = schema['@graph'].find(item => item['@id'] === release.origin + '/#ios-safari');
      assert.equal(ios.softwareVersion, release.iOS.version, 'Only publish the live App Store version in app schema');
      assert.equal(ios.downloadUrl, release.iOS.appStoreURL);
      assert.equal(ios.offers.price, 0);
      assert.equal(ios.description, store.locales[id].summary);
      assert.deepEqual(ios.featureList, store.locales[id].features);
      assert.equal(ios.featureList.length, 6);
      for (const feature of ios.featureList) assert(html.includes(`<li>${esc(feature)}</li>`), 'Schema features must be visible');
      assert(html.includes(`<h1>${esc(seo[id].heading)}</h1>`));
      assert(html.includes(`<title>${esc(seo[id].title)}</title>`));
      assert.equal(description, esc(seo[id].description));
      assert(html.includes(`href="${release.iOS.appStoreURL}"`));
      assert(!html.includes(esc(catalog[id]['iOS App Store release in preparation. Chrome supports manual installation.'])));
      assert(!html.includes(esc(catalog[id]['Safari for Mac App Store release in preparation.'])));
      const visible = [...html.matchAll(/<dt>(.*?)<\/dt><dd>(.*?)<\/dd>/gs)];
      const faq = schema['@graph'].find(item => item['@type'] === 'FAQPage');
      assert.equal(faq.mainEntity.length, visible.length);
      faq.mainEntity.forEach((question, index) => {
        assert.equal(esc(question.name), visible[index][1]);
        assert.equal(question.acceptedAnswer.text.split('\n').map(text=>`<p>${esc(text)}</p>`).join(''), visible[index][2]);
      });
      assert(!schema['@graph'].some(item=>item['@type']==='SoftwareApplication' && item.operatingSystem?.includes('macOS') && item.downloadUrl===release.iOS.appStoreURL));
    }
    for (const href of [...html.matchAll(/(?:href|src)="(\/[^"#]*)/g)].map(m => m[1])) {
      let target = new URL('dist' + href, root);
      if (href.endsWith('/')) target = new URL('index.html', target);
      assert((await stat(target)).isFile(), href);
    }
    assert.equal((html.match(/(?:href|src)="\/assets\/[^"/]+\.[a-f0-9]{12}\.(?:css|js)"/g) || []).length, 4);
  }
  assert.equal(descriptions.size, 3, `Distinct home, help and privacy descriptions: ${id}`);
}

const sitemap = await readFile(new URL('dist/sitemap.xml', root), 'utf8');
assert.deepEqual([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]), canonicalURLs);
assert((await readFile(new URL('dist/robots.txt', root), 'utf8')).includes(`Sitemap: ${release.origin}/sitemap.xml`));
const legacyDownloads = Object.entries(release.legacyDownloads ?? {});
for (const [from, to] of legacyDownloads) {
  assert.match(from, /^\/downloads\/ScrollCadence-[\d.]+\.dmg$/);
  assert(to.startsWith('https://github.com/qq345386817/scroll-cadence/releases/download/'));
}
assert.equal(await readFile(new URL('dist/_redirects', root), 'utf8'), '/ /en-US/ 301\n' + legacyDownloads.map(([from,to])=>`${from} ${to} 301\n`).join(''));
const index = await readFile(new URL('dist/llms.txt', root), 'utf8');
assert(index.includes(`The published iOS version is ${release.iOS.version}`));
assert(index.includes(release.iOS.appStoreURL));
for (const feature of store.locales['en-US'].features) assert(index.includes(feature));
assert(!index.includes('release is in preparation'));
for (const url of canonicalURLs) assert(index.includes(`](${url})`));
for (const file of await readdir(new URL('public/', root))) {
  assert.equal(await readFile(new URL(`dist/${file}`, root), 'utf8'), await readFile(new URL(`public/${file}`, root), 'utf8'));
}
const dmg = await readFile(new URL('dist' + release.macOS.dmg, root));
assert.equal(createHash('sha256').update(dmg).digest('hex'), release.macOS.sha256, 'Download matches the published checksum');
console.log('Verified 24 localized pages, absolute reciprocal hreflang, canonical URLs, unique descriptions, structured data, FAQ, hashed assets, sitemap, robots, verification files, optional llms index and DMG checksum.');

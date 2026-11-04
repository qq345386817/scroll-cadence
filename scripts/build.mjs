import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await readFile(root+'locales.json'));
const catalog = JSON.parse(await readFile(root+'catalog.json'));
const release = JSON.parse(await readFile(root+'release.json'));
const out = root+'dist/';
await rm(out, {recursive:true,force:true}); await mkdir(out,{recursive:true});
await cp(root+'assets',out+'assets',{recursive:true});
await cp(root+'public',out,{recursive:true});
const deployCommit = process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA;
if (deployCommit && /^[a-f0-9]{40}$/.test(deployCommit)) {
 await writeFile(out+'deployment.json', JSON.stringify({commit: deployCommit})+'\n');
}
const assets = {};
for (const file of ['design-tokens.css','site.css','engine.js','site.js']) {
 const bytes = await readFile(root+'assets/'+file);
 const dot = file.lastIndexOf('.');
 assets[file] = `/assets/${file.slice(0,dot)}.${createHash('sha256').update(bytes).digest('hex').slice(0,12)}${file.slice(dot)}`;
 await writeFile(out+assets[file].slice(1),bytes);
}
const routeFor = (id,page) => `/${id}/${page==='home'?'':page+'/'}`;
const absolute = path => new URL(path,release.origin).href;
const json = value => JSON.stringify(value).replace(/</g,'\\u003c');
const faq = [
 ['Which platforms does ScrollCadence support?', ['Automatic scrolling for macOS, Safari, and Chrome.','Signed and notarized DMG · macOS 14+ · Apple silicon & Intel','iOS App Store release in preparation. Chrome supports manual installation.','Safari for Mac App Store release in preparation.']],
 ['How do continuous scrolling and timed pages differ?', ['Adjust speed for continuous reading, or set a page interval. Choose up, down, left or right.']],
 ['Can macOS scroll several background windows?', ['Control supported windows independently, even in the background.','Open a document or list in the target app, then refresh. Only writable scrollbars appear; scanning does not activate windows.','Background support depends on the target app’s Accessibility interface. Minimizing, hiding, revoking access or manual wheel input pauses scrolling.']],
 ['Can the iOS app scroll other apps?', ['Safari on iPhone & iPad','Browser system pages, some PDFs, canvases and cross-origin frames may be unsupported. This app does not scroll other iPhone apps.']],
 ['How do I install the macOS app?', ['Open the downloaded DMG, drag ScrollCadence to Applications, then launch it and grant Accessibility access when prompted.']],
 ['Does ScrollCadence upload my reading activity?', ['Only scroll settings are saved locally. No account, analytics or content uploads. Manual scrolling or switching tabs pauses; resume when you return.']]
];
if(release.macOS?.dmg) await cp(root+'downloads',out+'downloads',{recursive:true});
const esc = s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for (const locale of config.locales) for (const page of ['home','help','privacy']) {
 const t = key => { if (!catalog[locale.id]?.[key]) throw Error(`Missing ${locale.id}: ${key}`); return esc(catalog[locale.id][key]); };
 const href = p => routeFor(locale.id,p);
 const switcher = `<label class="language"><span class="sr-only">${t('Language')}</span><select aria-label="${t('Language')}" data-language>${config.locales.map(l=>`<option value="/${l.id}/${page==='home'?'':page+'/'}" ${l.id===locale.id?'selected':''}>${esc(l.name)}</option>`).join('')}</select></label>`;
 const nav = `<a href="${href('help')}">${t('Help')}</a><a href="${href('privacy')}">${t('Privacy')}</a>${switcher}`;
 const mark = `<img class="mark" src="/assets/app-icon.png" width="44" height="44" alt="">`;
 const header = `<header><div class="wrap nav"><a class="brand" href="${href('home')}">${mark}ScrollCadence</a><nav aria-label="${t('Guide')}">${nav}</nav></div></header>`;
 const foot = `<footer class="wrap"><div class="privacy-line"><svg class="shield" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z"></path><path d="m8 12 3 3 5-6"></path></svg><div><strong>${t('Your page stays on your device.')}</strong><p>${t('No accounts. No analytics. Settings stored locally.')}</p></div></div><nav>${nav}</nav></footer>`;
 const paragraph = key=>`<p>${t(key)}</p>`;
 const article = keys=>keys.map(paragraph).join('');
 const block = (title,keys)=>`<section><h2>${t(title)}</h2>${article(keys)}</section>`;
 let body='';
 if(page==='home') {
 body=`<main><section class="wrap hero"><div class="intro"><p class="eyebrow">${t('Your reading pace')}</p><h1>${t('Reading, at your pace.')}</h1><p class="lead">${t('Automatic scrolling for macOS, Safari, and Chrome.')}<br>${t('Choose a direction, set a speed, or turn pages on a timer.')}</p><div class="hero-actions">${release.macOS?.dmg ? `<a class="primary link-button" href="${esc(release.macOS.dmg)}" download>${t("Download for macOS")}</a>` : ""}<a class="${release.macOS?.dmg ? "text-link" : "primary link-button"}" href="#demo">${t('Explore the controls')} <span aria-hidden="true">→</span></a><a class="text-link" href="${href('help')}">${t('Read the guide')} <span aria-hidden="true">→</span></a></div><p class="preview">${release.macOS?.dmg ? t('Signed and notarized DMG · macOS 14+ · Apple silicon & Intel')+'<br>' : ''}${t('iOS App Store release in preparation. Chrome supports manual installation.')}<br>${t('Safari for Mac App Store release in preparation.')}</p></div><div class="demo" id="demo"><div class="demo-heading"><div><p class="demo-label">${t('Local scrolling demo')}</p><h2>${t('Find your rhythm')}</h2></div><p class="demo-status" role="status" aria-live="polite">${t('Ready')}</p></div><div class="reading" tabindex="0" aria-label="${t('Local scrolling demo')}"><div class="reading-content">${Array.from({length:6},(_,i)=>`<div><h3>${t('A little room to read')} ${String(i+1).padStart(2,'0')}</h3>${Array.from({length:4},()=>paragraph('Set a comfortable pace. Let the words move while your attention stays with the story.')).join('')}</div>`).join('')}</div></div><fieldset><legend>${t('Direction')}</legend><div class="direction">${[['up','↑','↑ Up'],['down','↓','↓ Down'],['left','←','← Left'],['right','→','→ Right']].map(([d,a,k])=>`<button data-direction="${d}" aria-label="${t(k)}" aria-pressed="${d==='down'}">${a}</button>`).join('')}</div></fieldset><fieldset><legend>${t('Reading mode')}</legend><div class="segmented"><button data-mode="continuous" aria-pressed="true">${t('Continuous')}</button><button data-mode="paged" aria-pressed="false">${t('Paged')}</button></div></fieldset><label class="setting"><span data-setting-label>${t('Scroll speed')}</span><output id="speed-output">40 CSS px / s</output><input type="range" min="1" max="150" value="40" aria-label="${t('Scroll speed')}" id="speed"></label><label class="setting" id="interval-setting" hidden>${t('Page interval (seconds)')}<input type="number" min="0.5" max="3600" step="0.5" value="3" id="interval"></label><div class="demo-actions"><button class="primary" id="start">${t('Start')}</button><button id="stop">${t('Stop')}</button></div><p class="demo-note">${t('This demo scrolls only this reading area. It does not control other pages or apps.')}</p></div></section><section class="platforms"><div class="wrap platform-grid"><article><span class="platform-number" aria-hidden="true">01</span><h2>macOS</h2>${paragraph('Scroll in the foreground under your pointer, or use fixed mode for supported background windows.')}</article><article><span class="platform-number" aria-hidden="true">02</span><h2>${t('Safari on iPhone & iPad')}</h2>${paragraph('Automatic scrolling on webpages you authorize, with controls that stay close to your reading.')}</article><article><span class="platform-number" aria-hidden="true">03</span><h2>Chrome</h2>${paragraph('Use the same four directions, continuous speed, and timed pages in your active Chrome tab.')}</article></div></section></main>`;
 } else if(page==='help') {
 body=`<main class="wrap document"><a class="back" href="${href('home')}">← ${t('Home')}</a><h1>${t('Guide')}</h1><p class="lead">${t('Choose a direction, set a speed, or turn pages on a timer.')}</p>${block('Safari on iPhone & iPad',['Open Settings → Apps → Safari → Extensions → ScrollCadence and enable it. On iOS 17: Settings → Safari → Extensions.','In Safari’s page menu, enable ScrollCadence under Manage Extensions, then open ScrollCadence. Access applies to the current page when you invoke it.','Choose the full page or an inner area, set direction and mode, then Start. The floating bar lets you pause or stop anytime.'])}${block('Safari on Mac',['Safari for Mac App Store release in preparation.','The Mac Safari edition scrolls Safari webpages only and does not require Accessibility access. The native macOS DMG edition is a separate app.','Open Safari → Settings → Extensions and enable ScrollCadence.','Open a regular webpage in Safari, then choose ScrollCadence in the toolbar. Allow access to the current website when asked.'])}${block('Install the macOS app',['Open the downloaded DMG, drag ScrollCadence to Applications, then launch it and grant Accessibility access when prompted.','After updating the native macOS edition, macOS may ask you to grant Accessibility access again.'])}<section><h2>macOS</h2>${article(['ScrollCadence uses Accessibility to locate windows and send wheel input or adjust writable scrollbars. No screen recording or document text reading. Return here after granting access.','After Start, activate the target app and keep the pointer over its content. Moving the pointer, changing apps or covering the window pauses. One pointer session at a time; use fixed mode for multiple windows. Boundaries cannot be detected reliably. Adjust input to the content; a paged input is not a native screenful.','Open a document or list in the target app, then refresh. Only writable scrollbars appear; scanning does not activate windows.','Speed is relative to the scrollbar range. On-screen movement depends on content length.'])}<p><kbd>⌃⌥⌘.</kbd> — ${t('Stop all')}</p></section>${block('Install the unpacked Chrome build',['Open chrome://extensions, enable Developer mode, then Load unpacked and select the extension folder from the build. Open a regular webpage and invoke ScrollCadence from the toolbar.'])}${block('Permissions and safety stops',['Background support depends on the target app’s Accessibility interface. Minimizing, hiding, revoking access or manual wheel input pauses scrolling.','Only scroll settings are saved locally. No account, analytics or content uploads. Manual scrolling or switching tabs pauses; resume when you return.','Browser system pages, some PDFs, canvases and cross-origin frames may be unsupported. This app does not scroll other iPhone apps.'])}<a class="text-link" href="https://github.com/qq345386817/scroll-cadence/issues">${t('Report an issue')} ↗</a></main>`;
 } else {
 body=`<main class="wrap document"><a class="back" href="${href('home')}">← ${t('Home')}</a><h1>${t('Privacy policy')}</h1><p class="updated">${t('Last updated: October 27, 2026')}</p><p class="lead">${t('Your page stays on your device.')}</p>${block('Data handled on your device',['The macOS app uses window titles, app identities, bounds and scrollbar positions to identify selected targets. It observes manual wheel input to pause sessions and registers a stop shortcut. It does not record keystrokes or screen images.','The extensions inspect scrollable element geometry and page visibility to operate the area you choose. They use activeTab, scripting and local storage. They do not upload page text, browsing history or scroll activity.'])}${block('Storage, deletion and network requests',['Scroll settings stay in app preferences or the browser’s local extension storage. Clear app data or remove the extension to delete them. No account, advertising SDK, analytics service or telemetry endpoint is included.','This website uses no analytics, cookies or remote fonts. Your hosting provider may process ordinary request logs. External webpages you open, such as an example page, follow their own privacy policies.'])}<a class="text-link" href="https://github.com/qq345386817/scroll-cadence/issues">${t('Report an issue')} ↗</a></main>`;
 }
 if(page==='home') body=body.replace('</main>',`<section class="wrap faq" id="faq"><h2>${t('Frequently asked questions')}</h2><dl>${faq.map(([question,answers])=>`<div><dt>${t(question)}</dt><dd>${answers.map(paragraph).join('')}</dd></div>`).join('')}</dl><a class="text-link" href="${href('help')}">${t('Read the guide')} →</a></section></main>`);
 const title=page==='home'?'ScrollCadence — '+t('Automatic scrolling for macOS, Safari & Chrome'):'ScrollCadence — '+t(page==='help'?'Guide':'Privacy policy');
 const route=locale.id+'/'+(page==='home'?'':page+'/');
 const snippets={}; for(const key of ['Completed','Needs attention','Countdown','Running','Ready','Start','Pause','Resume','Stop','Scroll speed','{0} CSS px / second','Page interval (seconds)','Manual interaction; paused.','Paused','Stopped'])snippets[key]=catalog[locale.id][key];
 const description = page==='home'
     ? t('Automatic scrolling for macOS, Safari, and Chrome.')+' '+t('Choose a direction, set a speed, or turn pages on a timer.')
     : t(page==='help'?'Set up ScrollCadence on macOS, iPhone, iPad and Chrome. Learn about permissions, scrolling modes and safety stops.':'Learn how ScrollCadence handles window information, webpage access and local settings, without accounts or analytics.');
 const canonical = absolute(href(page));
 const graph = [
   {'@type':'WebSite','@id':release.origin+'/#website',url:release.origin+'/',name:'ScrollCadence',inLanguage:config.locales.map(l=>l.id)},
   {'@type':'WebPage','@id':canonical+'#webpage',url:canonical,name:page==='home'?catalog[locale.id]['Automatic scrolling for macOS, Safari & Chrome']:catalog[locale.id][page==='help'?'Guide':'Privacy policy'],inLanguage:locale.id,isPartOf:{'@id':release.origin+'/#website'}}
 ];
 if(page==='home' && release.macOS?.dmg) graph.push({'@type':'SoftwareApplication',name:'ScrollCadence',applicationCategory:'UtilitiesApplication',operatingSystem:'macOS 14 or later',softwareVersion:release.version,url:canonical,downloadUrl:absolute(release.macOS.dmg),image:absolute('/assets/app-icon.png'),description:catalog[locale.id]['Scroll in the foreground under your pointer, or use fixed mode for supported background windows.']});
 const html=`<!doctype html><html lang="${locale.id}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="description" content="${description}"><meta property="og:type" content="website"><meta property="og:site_name" content="ScrollCadence"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${absolute('/assets/app-icon.png')}"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${description}"><meta name="twitter:image" content="${absolute('/assets/app-icon.png')}"><link rel="icon" href="/assets/app-icon.png" type="image/png"><link rel="stylesheet" href="${assets['design-tokens.css']}"><link rel="stylesheet" href="${assets['site.css']}">${config.locales.map(l=>`<link rel="alternate" hreflang="${l.id}" href="${absolute(routeFor(l.id,page))}">`).join('')}<link rel="canonical" href="${canonical}"><link rel="alternate" hreflang="x-default" href="${absolute(routeFor(config.default,page))}"><script type="application/ld+json">${json({'@context':'https://schema.org','@graph':graph})}</script></head><body>${header}${body}${foot}<script id="translations" type="application/json">${json(snippets)}</script><script src="${assets['engine.js']}"></script><script src="${assets['site.js']}"></script></body></html>`;
 await mkdir(out+route,{recursive:true}); await writeFile(out+route+'index.html',html);
}
await writeFile(out+'index.html',`<!doctype html><html lang="en-US"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/en-US/"><title>ScrollCadence</title><a href="/en-US/">ScrollCadence — English (US)</a></html>`);
await writeFile(out+'404.html','<!doctype html><html lang="en-US"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found — ScrollCadence</title><h1>Page not found</h1><a href="/en-US/">ScrollCadence home</a></html>');
await writeFile(out+'_redirects','/ /en-US/ 301\n');
await writeFile(out+'_headers',Object.values(assets).map(path=>`${path}\n  Cache-Control: public, max-age=31536000, immutable`).join('\n')+'\n');
console.log('Built 24 localized home/help/privacy pages. Default: en-US.');

await writeFile(out+"robots.txt",`User-agent: *\nAllow: /\nSitemap: ${release.origin}/sitemap.xml\n`);
await writeFile(out+"sitemap.xml",`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${config.locales.flatMap(l=>["","help/","privacy/"].map(p=>`<url><loc>${release.origin}/${l.id}/${p}</loc></url>`)).join("")}</urlset>`);

// Optional reading index for systems that support llms.txt; not a ranking signal.
await writeFile(out+'llms.txt',`# ScrollCadence

> Automatic scrolling for macOS, Safari on iPhone and iPad, and Chrome.

Continuous mode has an adjustable speed; paged mode advances at a chosen interval. All four directions are supported where the target can scroll that way.

Native macOS DMG: version ${release.version}, build ${release.macOS.build}, bundle ${release.macOS.bundleIdentifier}, macOS 14+, one universal download for Apple silicon and Intel. General mode sends wheel input to foreground content under the pointer. Fixed mode supports multiple background windows only when they expose enabled, writable Accessibility scrollbars. It does not support every app or window.

Mac App Store: a separate sandboxed Safari Web Extension edition is in preparation. It scrolls Safari webpages only, with no Accessibility access.

iOS: Safari Web Extension only; it does not scroll other iPhone or iPad apps. The App Store release is in preparation. Chrome: manual unpacked installation. Browser system pages, some PDFs, canvases and cross-origin frames may be unsupported.

No account, analytics or content uploads. Scroll settings stay locally on the device. See the privacy policy for the exact platform behavior.

## Official pages
${config.locales.map(l=>`- [${l.name}](${absolute(routeFor(l.id,'home'))}): Product and release availability.
- [${l.name} guide](${absolute(routeFor(l.id,'help'))}): Setup, permissions, controls and compatibility.
- [${l.name} privacy](${absolute(routeFor(l.id,'privacy'))}): Data use and local storage.`).join('\n')}

## Downloads and discovery
- [macOS DMG](${absolute(release.macOS.dmg)}): Signed and notarized universal app.
- [Sitemap](${release.origin}/sitemap.xml): Canonical localized HTML pages.

The linked pages are authoritative. Check them for current release availability and limitations.
`);

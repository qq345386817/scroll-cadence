import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await readFile(root+'locales.json'));
const catalog = JSON.parse(await readFile(root+'catalog.json'));
const release = JSON.parse(await readFile(root+'release.json'));
const reading = JSON.parse(await readFile(root+'reading.json'));
const seo = JSON.parse(await readFile(root+'seo.json'));
const storeMetadata = JSON.parse(await readFile(root+'store-metadata.json'));
const format = (text, values) => text.replace(/\{(\w+)\}/g, (_, key) => {
 if (values[key] === undefined) throw Error(`Missing copy parameter: ${key}`);
 return String(values[key]);
});
const availability = id => [
 release.macOS?.dmg && catalog[id]['Signed and notarized DMG · macOS 14+ · Apple silicon & Intel'],
 release.iOS.status === 'available' && format(seo[id].iosAvailable, {version:release.iOS.version}),
 release.iOS.pendingVersion && format(seo[id].iosReview, {version:release.iOS.pendingVersion}),
 release.SafariMac.pendingVersion && format(seo[id].macReview, {version:release.SafariMac.pendingVersion}),
 seo[id].chromeStatus,
].filter(Boolean);
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
 ['Which platforms does ScrollCadence support?', []],
 ['How do continuous scrolling and timed pages differ?', ['Adjust speed for continuous reading, or set a page interval. Choose up, down, left or right.']],
 ['Can macOS scroll several background windows?', ['Control supported windows independently, even in the background.','Open a document or list in the target app, then refresh. Only writable scrollbars appear; scanning does not activate windows.','Background support depends on the target app’s Accessibility interface. Minimizing, hiding, revoking access or manual wheel input pauses scrolling.']],
 ['Can the iOS app scroll other apps?', ['Safari on iPhone & iPad','Browser system pages, some PDFs, canvases and cross-origin frames may be unsupported. This app does not scroll other iPhone apps.']],
 ['How do I install the macOS app?', ['Open the downloaded DMG, drag ScrollCadence to Applications, then launch it and grant Accessibility access when prompted.']],
 ['Does ScrollCadence upload my reading activity?', ['Only scroll settings are saved locally. No account, analytics or content uploads. Manual scrolling or switching tabs pauses; resume when you return.']]
];
if (release.macOS?.dmg) {
 const dmg = release.macOS.dmg;
 if (!/^\/downloads\/[A-Za-z0-9._-]+\.dmg$/.test(dmg)) throw Error('Invalid release DMG path');
 await mkdir(out+'downloads', {recursive:true});
 await cp(root+dmg.slice(1), out+dmg.slice(1));
}
const esc = s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for (const locale of config.locales) for (const page of ['home','help','privacy']) {
 const copy = seo[locale.id];
 const metadata = storeMetadata.locales[locale.id];
 if (!copy || !metadata) throw Error(`Missing website metadata: ${locale.id}`);
 const localizedFAQ = faq.map(([question, answers], index) => ({
   question:catalog[locale.id][question],
   answers:index === 0 ? availability(locale.id) : index === 1 ? [copy.pagingAnswer] : index === 3 ? [metadata.limitations] : answers.map(key=>catalog[locale.id][key]),
 }));
 const t = key => { if (!catalog[locale.id]?.[key]) throw Error(`Missing ${locale.id}: ${key}`); return esc(catalog[locale.id][key]); };
 const href = p => routeFor(locale.id,p);
 const switcher = `<label class="language"><span class="sr-only">${t('Language')}</span><select aria-label="${t('Language')}" data-language>${config.locales.map(l=>`<option value="/${l.id}/${page==='home'?'':page+'/'}" ${l.id===locale.id?'selected':''}>${esc(l.name)}</option>`).join('')}</select></label>`;
 const nav = ['help','privacy'].map(p => `<a href="${href(p)}"${page === p ? ' aria-current="page"' : ''}>${t(p === 'help' ? 'Help' : 'Privacy')}</a>`).join('') + switcher;
 const mark = `<img class="mark" src="/assets/app-icon.png" width="44" height="44" alt="">`;
 const header = `<header><div class="wrap nav"><a class="brand" href="${href('home')}">${mark}ScrollCadence</a><nav aria-label="${t('Guide')}">${nav}</nav></div></header>`;
 const foot = `<footer class="wrap"><div class="privacy-line"><svg class="shield" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z"></path><path d="m8 12 3 3 5-6"></path></svg><div><strong>${t('Your page stays on your device.')}</strong><p>${t('No accounts. No analytics. Settings stored locally.')}</p></div></div><nav>${nav}</nav></footer>`;
 const paragraph = key=>`<p>${t(key)}</p>`;
 const article = keys=>keys.map(paragraph).join('');
 let body='';
 if(page==='home') {
 const directionKeys = [['up','↑','↑ Up'],['down','↓','↓ Down'],['left','←','← Left'],['right','→','→ Right']];
 const directions = directionKeys.map(([id,arrow,label]) =>
   `<button data-direction="${id}" aria-label="${t(label)}" title="${t(label)}" aria-pressed="${id === 'down'}">${arrow}</button>`).join('');
 const paragraphs = reading[locale.id];
 const readingPage = (title, content, position) => `<article class="sheet">
   <img src="/assets/coast-reading.jpg" class="coast coast-${position}" width="1280" height="853" alt="">
   <div class="prose"><h3>${title}</h3>${content.map(text => `<p>${esc(text)}</p>`).join('')}</div>
 </article>`;
 const preview = `<div class="demo-stage" id="demo"><section class="demo" aria-labelledby="demo-title">
   <div class="demo-heading"><span class="traffic" aria-hidden="true"><i></i><i></i><i></i></span>
   <h2 id="demo-title" tabindex="-1">${t('Find your rhythm')}</h2><p class="demo-status" role="status">${t('Ready')}</p></div>
   <div class="reading" tabindex="0" aria-label="${t('Local scrolling demo')}"><div class="reading-content">
   ${readingPage(t('A little room to read'), paragraphs, 'first')}
   ${readingPage(t('Your reading pace'), [catalog[locale.id]['Set a comfortable pace. Let the words move while your attention stays with the story.'], copy.pagingAnswer], 'next')}
   </div></div>
   <div class="console"><div class="control-pair"><fieldset><legend>${t('Reading mode')}</legend>
   <div class="segmented"><button data-mode="continuous" aria-pressed="true">${t('Continuous')}</button><button data-mode="paged" aria-pressed="false">${t('Paged')}</button></div></fieldset>
   <fieldset><legend>${t('Direction')}</legend><div class="direction">${directions}</div></fieldset></div>
   <div class="transport"><label class="setting"><span>${t('Scroll speed')}</span><output for="speed" id="speed-output">${esc(format(catalog[locale.id]['{0} CSS px / second'], {0:40}))}</output><input type="range" min="1" max="150" value="40" aria-label="${t('Scroll speed')}" id="speed"></label>
   <label class="setting" id="interval-setting" hidden>${t('Page interval (seconds)')}<input type="number" min="0.5" max="3600" step="0.5" value="3" id="interval"></label>
   <div class="demo-actions"><button class="primary" id="start">${t('Start')}</button><button id="stop" disabled>${t('Stop')}</button></div></div></div>
   </section><p class="demo-note">${t('This demo scrolls only this reading area. It does not control other pages or apps.')}</p></div>`;
 const platform = (symbol, title, key, anchor) => `<article><a href="${href('help')}#${anchor}"><span class="platform-icon" aria-hidden="true">${symbol}</span><h2>${title}</h2></a>${paragraph(key)}</article>`;
 const icon = path => `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
 const laptop = icon('<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M1 21h22"/>');
 const compass = icon('<circle cx="12" cy="12" r="9.5"/><path d="m16 7-2.5 6.5L7 17l3-7Z"/>');
 const browser = icon('<rect x="2.5" y="4" width="19" height="16" rx="3"/><path d="M3 9h18M6 6.5h1"/>');
 body=`<main><section class="wrap hero"><div class="intro">
   <h1>${esc(copy.heading)}</h1><p class="lead">${t('Automatic scrolling for macOS, Safari, and Chrome.')}</p>
   <p class="intro-detail">${t('Choose a direction, set a speed, or turn pages on a timer.')}</p>
   <div class="hero-actions">${release.macOS?.dmg ? `<a class="primary link-button" href="${esc(release.macOS.dmg)}" download>${icon('<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>')}${t('Download for macOS')}</a>` : ''}
   ${release.iOS.status === 'available' ? `<a class="secondary link-button" href="${esc(release.iOS.appStoreURL)}">${esc(copy.iosDownload)}</a>` : ''}</div>
   ${release.macOS?.dmg ? `<p class="preview">${t('Signed and notarized DMG · macOS 14+ · Apple silicon & Intel')}</p>` : ''}
   <a class="jump" href="#demo-title">${t('Explore the controls')} ↓</a></div>${preview}</section>
   <section class="platforms"><div class="wrap platform-grid">
   ${platform(laptop,'macOS','Scroll in the foreground under your pointer, or use fixed mode for supported background windows.','native-mac')}
   ${platform(compass,esc(copy.safariHeading),'Automatic scrolling on webpages you authorize, with controls that stay close to your reading.','safari-ios')}
   ${platform(browser,'Chrome','Use the same four directions, continuous speed, and timed pages in your active Chrome tab.','chrome')}</div></section>
   <div class="wrap learn"><section id="safari-controls"><h2>${esc(copy.featuresHeading)}</h2><p>${esc(metadata.summary)}</p>
   <ul>${metadata.features.map(feature=>`<li>${esc(feature)}</li>`).join('')}</ul></section>
   <section id="faq"><h2>${t('Frequently asked questions')}</h2>
   ${localizedFAQ.map(({question,answers})=>`<details><summary>${esc(question)}</summary><div class="answer">${answers.map(answer=>`<p>${esc(answer)}</p>`).join('')}</div></details>`).join('')}
   <a class="text-link" href="${href('help')}">${t('Read the guide')} →</a></section></div></main>`;
 } else {
   const guide = page === 'help';
   const sections = guide ? [
     { id:'safari-ios', title:t('Safari on iPhone & iPad'), content:article(['Open Settings → Apps → Safari → Extensions → ScrollCadence and enable it. On iOS 17: Settings → Safari → Extensions.','In Safari’s page menu, enable ScrollCadence under Manage Extensions, then open ScrollCadence. Access applies to the current page when you invoke it.','Choose the full page or an inner area, set direction and mode, then Start. The floating bar lets you pause or stop anytime.']) },
     { id:'safari-mac', title:t('Safari on Mac'), content:article(['The Mac Safari edition scrolls Safari webpages only and does not require Accessibility access. The native macOS DMG edition is a separate app.','Open Safari → Settings → Extensions and enable ScrollCadence.','Open a regular webpage in Safari, then choose ScrollCadence in the toolbar. Allow access to the current website when asked.']) + (release.SafariMac.pendingVersion ? `<p>${esc(format(copy.macReview,{version:release.SafariMac.pendingVersion}))}</p>` : '') },
     { id:'native-mac', title:t('Install the macOS app'), content:article(['Open the downloaded DMG, drag ScrollCadence to Applications, then launch it and grant Accessibility access when prompted.','After updating the native macOS edition, macOS may ask you to grant Accessibility access again.']) },
     { id:'windows', title:'macOS', content:`${article(['ScrollCadence uses Accessibility to locate windows and send wheel input or adjust writable scrollbars. No screen recording or document text reading. Return here after granting access.','After Start, activate the target app and keep the pointer over its content. Moving the pointer, changing apps or covering the window pauses. One pointer session at a time; use fixed mode for multiple windows. Boundaries cannot be detected reliably. Adjust input to the content; a paged input is not a native screenful.','Open a document or list in the target app, then refresh. Only writable scrollbars appear; scanning does not activate windows.','Speed is relative to the scrollbar range. On-screen movement depends on content length.'])}<p><kbd>⌃⌥⌘.</kbd> — ${t('Stop all')}</p>` },
     { id:'chrome', title:t('Install the unpacked Chrome build'), content:article(['Open chrome://extensions, enable Developer mode, then Load unpacked and select the extension folder from the build. Open a regular webpage and invoke ScrollCadence from the toolbar.']) },
     { id:'features', title:esc(copy.featuresHeading), content:`<p>${esc(metadata.summary)}</p><ul>${metadata.features.map(feature=>`<li>${esc(feature)}</li>`).join('')}</ul>` },
     { id:'permissions', title:t('Permissions and safety stops'), content:article(['Background support depends on the target app’s Accessibility interface. Minimizing, hiding, revoking access or manual wheel input pauses scrolling.','Only scroll settings are saved locally. No account, analytics or content uploads. Manual scrolling or switching tabs pauses; resume when you return.','Browser system pages, some PDFs, canvases and cross-origin frames may be unsupported. This app does not scroll other iPhone apps.']) }
   ] : [
     { id:'device', title:t('Data handled on your device'), content:article(['The macOS app uses window titles, app identities, bounds and scrollbar positions to identify selected targets. It observes manual wheel input to pause sessions and registers a stop shortcut. It does not record keystrokes or screen images.','The extensions inspect scrollable element geometry and page visibility to operate the area you choose. They use activeTab, scripting and local storage. They do not upload page text, browsing history or scroll activity.']) },
     { id:'storage', title:t('Storage, deletion and network requests'), content:article(['Scroll settings stay in app preferences or the browser’s local extension storage. Clear app data or remove the extension to delete them. No account, advertising SDK, analytics service or telemetry endpoint is included.','This website uses no analytics, cookies or remote fonts. Your hosting provider may process ordinary request logs. External webpages you open, such as an example page, follow their own privacy policies.']) }
   ];
   const title = t(guide ? 'Guide' : 'Privacy policy');
   const intro = guide ? t('Choose a direction, set a speed, or turn pages on a timer.') : t('Your page stays on your device.');
   body = `<main class="wrap document"><a class="back" href="${href('home')}">← ${t('Home')}</a>
     <h1>${title}</h1>${guide ? '' : `<p class="updated">${t('Last updated: October 27, 2026')}</p>`}<p class="lead">${intro}</p>
     <div class="doc-layout"><nav class="contents" aria-label="${title}">${sections.map(({id,title})=>`<a href="#${id}">${title}</a>`).join('')}</nav>
     <div class="doc-copy">${sections.map(({id,title,content})=>`<section id="${id}"><h2>${title}</h2>${content}</section>`).join('')}
     <a class="text-link" href="https://github.com/qq345386817/scroll-cadence/issues">${t('Report an issue')} ↗</a></div></div></main>`;
 }
 const title=page==='home'?esc(copy.title):'ScrollCadence — '+t(page==='help'?'Guide':'Privacy policy');
 const route=locale.id+'/'+(page==='home'?'':page+'/');
 const snippets={}; for(const key of ['Completed','Needs attention','Countdown','Running','Ready','Start','Pause','Resume','Stop','Scroll speed','{0} CSS px / second','Page interval (seconds)','Manual interaction; paused.','Paused','Stopped'])snippets[key]=catalog[locale.id][key];
 const description = page==='home'
     ? esc(copy.description)
     : t(page==='help'?'Set up ScrollCadence on macOS, iPhone, iPad and Chrome. Learn about permissions, scrolling modes and safety stops.':'Learn how ScrollCadence handles window information, webpage access and local settings, without accounts or analytics.');
 const canonical = absolute(href(page));
 const graph = [
   {'@type':'WebSite','@id':release.origin+'/#website',url:release.origin+'/',name:'ScrollCadence',inLanguage:config.locales.map(l=>l.id)},
   {'@type':'WebPage','@id':canonical+'#webpage',url:canonical,name:page==='home'?copy.title:catalog[locale.id][page==='help'?'Guide':'Privacy policy'],description:page==='home'?copy.description:catalog[locale.id][page==='help'?'Set up ScrollCadence on macOS, iPhone, iPad and Chrome. Learn about permissions, scrolling modes and safety stops.':'Learn how ScrollCadence handles window information, webpage access and local settings, without accounts or analytics.'],inLanguage:locale.id,isPartOf:{'@id':release.origin+'/#website'}}
 ];
 if(page==='home' && release.macOS?.dmg) graph.push({'@type':'SoftwareApplication','@id':release.origin+'/#desktop-app',name:'ScrollCadence',applicationCategory:'UtilitiesApplication',operatingSystem:'macOS 14 or later',softwareVersion:release.version,url:canonical,downloadUrl:absolute(release.macOS.dmg),image:absolute('/assets/app-icon.png'),description:catalog[locale.id]['Scroll in the foreground under your pointer, or use fixed mode for supported background windows.']});
 if(page==='home' && release.iOS.status==='available') graph.push({'@type':'SoftwareApplication','@id':release.origin+'/#ios-safari',name:'ScrollCadence',alternateName:metadata.name,applicationCategory:'UtilitiesApplication',operatingSystem:`iOS ${release.iOS.minimumOS}+; iPadOS ${release.iOS.minimumOS}+`,softwareVersion:release.iOS.version,url:canonical+'#safari-controls',downloadUrl:release.iOS.appStoreURL,image:absolute('/assets/app-icon.png'),description:metadata.summary,featureList:metadata.features,offers:{'@type':'Offer',price:0,priceCurrency:'USD',url:release.iOS.appStoreURL}});
 if(page==='home') graph.push({'@type':'FAQPage','@id':canonical+'#faq',mainEntity:localizedFAQ.map(({question,answers})=>({'@type':'Question',name:question,acceptedAnswer:{'@type':'Answer',text:answers.join('\n')}}))});
 const html=`<!doctype html><html lang="${locale.id}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="description" content="${description}"><meta property="og:type" content="website"><meta property="og:site_name" content="ScrollCadence"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${absolute('/assets/app-icon.png')}"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${description}"><meta name="twitter:image" content="${absolute('/assets/app-icon.png')}"><link rel="icon" href="/assets/app-icon.png" type="image/png"><link rel="stylesheet" href="${assets['design-tokens.css']}"><link rel="stylesheet" href="${assets['site.css']}">${config.locales.map(l=>`<link rel="alternate" hreflang="${l.id}" href="${absolute(routeFor(l.id,page))}">`).join('')}<link rel="canonical" href="${canonical}"><link rel="alternate" hreflang="x-default" href="${absolute(routeFor(config.default,page))}"><script type="application/ld+json">${json({'@context':'https://schema.org','@graph':graph})}</script></head><body>${header}${body}${foot}<script id="translations" type="application/json">${json(snippets)}</script><script src="${assets['engine.js']}"></script><script src="${assets['site.js']}"></script></body></html>`;
 await mkdir(out+route,{recursive:true}); await writeFile(out+route+'index.html',html);
}
await writeFile(out+'index.html',`<!doctype html><html lang="en-US"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/en-US/"><title>ScrollCadence</title><a href="/en-US/">ScrollCadence — English (US)</a></html>`);
await writeFile(out+'404.html','<!doctype html><html lang="en-US"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found — ScrollCadence</title><h1>Page not found</h1><a href="/en-US/">ScrollCadence home</a></html>');
await writeFile(out+'_redirects','/ /en-US/ 301\n'+Object.entries(release.legacyDownloads ?? {}).map(([from,to])=>`${from} ${to} 301\n`).join(''));
await writeFile(out+'_headers',Object.values(assets).map(path=>`${path}\n  Cache-Control: public, max-age=31536000, immutable`).join('\n')+'\n');
console.log('Built 24 localized home/help/privacy pages. Default: en-US.');

await writeFile(out+"robots.txt",`User-agent: *\nAllow: /\nSitemap: ${release.origin}/sitemap.xml\n`);
await writeFile(out+"sitemap.xml",`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${config.locales.flatMap(l=>["","help/","privacy/"].map(p=>`<url><loc>${release.origin}/${l.id}/${p}</loc></url>`)).join("")}</urlset>`);

// Optional reading index for systems that support llms.txt; not a ranking signal.
await writeFile(out+'llms.txt',`# ScrollCadence

> Automatic scrolling for macOS, Safari on iPhone and iPad, and Chrome.

Continuous mode has an adjustable speed; paged mode advances at a chosen interval. All four directions are supported where the target can scroll that way.

Native macOS DMG: version ${release.version}, build ${release.macOS.build}, bundle ${release.macOS.bundleIdentifier}, macOS 14+, one universal download for Apple silicon and Intel. General mode sends wheel input to foreground content under the pointer. Fixed mode supports multiple background windows only when they expose enabled, writable Accessibility scrollbars. It does not support every app or window.

## Safari extension
${storeMetadata.locales['en-US'].summary}
${storeMetadata.locales['en-US'].features.map(feature=>'- '+feature).join('\n')}

${availability('en-US').slice(1).join('\n\n')}

iOS App Store download: ${release.iOS.appStoreURL}. The published iOS version is ${release.iOS.version}; an update awaiting review is not a published release.

Mac Safari is a separate sandboxed Safari Web Extension with no Accessibility access. Safari editions scroll webpages only; they do not control other apps or scroll while an iPhone is locked. Chrome uses manual unpacked installation. Browser system pages, some PDFs, canvases and cross-origin frames may be unsupported.

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

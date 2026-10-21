import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
const root = path.resolve("dist");
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? walk(path.join(directory, entry.name))
          : [path.join(directory, entry.name)],
      ),
    )
  ).flat();
}
const files = (await walk(root)).filter(
  (file) =>
    /\.(html|js|css|wasm|ttf|woff2?|png|jpg|svg|json)$/.test(file) &&
    !file.endsWith("sw.js"),
);
const urls = files.map(
  (file) => "/" + path.relative(root, file).split(path.sep).join("/"),
);
const hash = createHash("sha256");
for (const file of files) hash.update(await readFile(file));
const cache = "apisense-" + hash.digest("hex").slice(0, 16);
await writeFile(
  path.join(root, "sw.js"),
  `const CACHE=${JSON.stringify(cache)},ASSETS=${JSON.stringify(urls)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.open(CACHE).then(cache=>cache.match('/index.html'))));return;}if(ASSETS.includes(url.pathname))event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(event.request))||fetch(event.request)));});
`,
);
console.log(`Offline shell prepared: ${urls.length} assets, ${cache}`);

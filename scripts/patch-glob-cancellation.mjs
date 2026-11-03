import { pathToFileURL } from "node:url";

// 14.0.2 stops recursive reads, but stat/realpath continuations and pre-aborted
// stream aliases can still queue I/O. Protect bundled AND raw module dialects.
export async function patchGlobCancellation(require, guardedPatch) {
  const pkg = require.resolve("glob/package.json");
  if (require("glob/package.json").version !== "14.0.2")
    throw new Error("Revisa la cancelación de glob antes de actualizarlo.");
  const abort = "if(this.signal?.aborted)return;";
  const raw = [
    [
      "async matchCheck(inPath, ifDir) {",
      `*abortable(items) { for (const item of items) { if (this.signal?.aborted) return; yield item; } }\n    async matchCheck(inPath, ifDir) { ${abort}`,
    ],
    [
      "matchCheckSync(inPath, ifDir) {",
      `matchCheckSync(inPath, ifDir) { ${abort}`,
    ],
    [
      "const needStat = e.isUnknown() || this.opts.stat;",
      `${abort}\n        const needStat = e.isUnknown() || this.opts.stat;`,
      2,
    ],
    [
      "const s = needStat ? await e.lstat() : e;",
      `const s = needStat ? await e.lstat() : e; ${abort}`,
    ],
    [
      "const s = needStat ? e.lstatSync() : e;",
      `const s = needStat ? e.lstatSync() : e; ${abort}`,
    ],
    [
      "const target = await s.realpath();",
      `const target = await s.realpath(); ${abort}`,
    ],
    [
      "const target = s.realpathSync();",
      `const target = s.realpathSync(); ${abort}`,
    ],
    ["matchFinish(e, absolute) {", `matchFinish(e, absolute) { ${abort}`],
    [
      "#matchEmitChecked(e, absolute) {",
      `#matchEmitChecked(e, absolute) { ${abort}`,
    ],
    [
      "walkCB3(target, entries, processorx, cb) {",
      "walkCB3(target, entries, processorx, cb) { if(this.signal?.aborted)return cb();",
    ],
    [
      "walkCB3Sync(target, entries, processor, cb) {",
      "walkCB3Sync(target, entries, processor, cb) { if(this.signal?.aborted)return cb();",
    ],
    ["stream() {", "stream() { if(this.signal?.aborted)return this.results;"],
    [
      "streamSync() {",
      "streamSync() { if(this.signal?.aborted)return this.results;",
    ],
    ...[
      "processor.matches.store",
      "proc.matches.store",
      "processor.subwalkTargets()",
      "proc.subwalks.entries()",
    ].map((value) => [`of ${value})`, `of this.abortable(${value}))`, 2]),
  ];
  for (const [dialect, walkerHash, bundleHash, stat, target, proc] of [
    [
      "commonjs",
      "01c5ee096dbe9aa7266f6bf859ebabc233dde2160322cee321eed734958e5b6e",
      "f32848848f1b4a52ae62f1ec4d209b69a825ce7fdf5735b1e3237e2202a03604",
      "h",
      "o",
      "r",
    ],
    [
      "esm",
      "20446f7048e8234e1fc1ac2c754ebd41217168d7b3a1bebf4d8d00f773aa4cbf",
      "399221c4e0d6ff9994d284c9402105738721572d9f8532c94649826ff5c7e207",
      "o",
      "h",
      "n",
    ],
  ]) {
    const min = [
      [
        "async matchCheck(t,e){",
        `*abortable(items){for(let item of items){if(this.signal?.aborted)return;yield item}}async matchCheck(t,e){${abort}`,
      ],
      ["matchCheckSync(t,e){", `matchCheckSync(t,e){${abort}`],
      ...["await ", ""].map((awaited) => {
        const expression = `let ${stat}=i.isUnknown()||this.opts.stat?${awaited}i.${awaited ? "lstat" : "lstatSync"}():i;`;
        return [expression, `${abort}${expression}${abort}`];
      }),
      [
        `let ${target}=await ${stat}.realpath();`,
        `let ${target}=await ${stat}.realpath();${abort}`,
      ],
      [
        `let ${target}=${stat}.realpathSync();`,
        `let ${target}=${stat}.realpathSync();${abort}`,
      ],
      ["matchFinish(t,e){", `matchFinish(t,e){${abort}`],
      ["#d(t,e){", `#d(t,e){${abort}`],
      [
        "walkCB3(t,e,s,i){",
        "walkCB3(t,e,s,i){if(this.signal?.aborted)return i();",
      ],
      [
        "walkCB3Sync(t,e,s,i){",
        "walkCB3Sync(t,e,s,i){if(this.signal?.aborted)return i();",
      ],
      [
        "stream(){let t=this.path;",
        "stream(){if(this.signal?.aborted)return this.results;let t=this.path;",
      ],
      [
        "streamSync(){return this.path",
        "streamSync(){if(this.signal?.aborted)return this.results;return this.path",
      ],
      ...[
        "s.matches.store",
        `${proc}.matches.store`,
        "s.subwalkTargets()",
        `${proc}.subwalks.entries()`,
      ].map((value) => [`of ${value})`, `of this.abortable(${value}))`, 2]),
    ];
    await guardedPatch(
      new URL(`dist/${dialect}/walker.js`, pathToFileURL(pkg)),
      walkerHash,
      raw,
    );
    await guardedPatch(
      new URL(`dist/${dialect}/index.min.js`, pathToFileURL(pkg)),
      bundleHash,
      min,
    );
  }
}

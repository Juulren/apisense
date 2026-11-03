import { beforeAll, afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const cliRoot = path.dirname(require.resolve("expo/package.json"));
const cliRequire = createRequire(path.join(cliRoot, "package.json"));
const cliPackage = cliRequire.resolve("@expo/cli/package.json");
const server = path.join(path.dirname(cliPackage), "build/src/start/server");
let root;
beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "apisense-tooling-"));
  for (const file of [
    "app/index.tsx",
    "app/nested/data+api.ts",
    "app/.hidden.ts",
    "android/app/build.gradle",
    "packages/one/package.json",
    "node_modules/ignored/file.ts",
    "app/readme.txt",
    ...Array.from({ length: 20 }, (_, n) => `tree/${n}/nested/leaf.txt`),
  ]) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), "fixture");
  }
});
afterAll(async () => {
  if (
    root &&
    path.dirname(path.resolve(root)) === path.resolve(tmpdir()) &&
    path.basename(root).startsWith("apisense-tooling-")
  )
    await rm(root, { recursive: true });
});

describe("deepmerge returned-object prototype boundary", () => {
  const cjs = require("deepmerge");
  const umdContext = { module: { exports: {} }, exports: {} };
  vm.runInNewContext(
    fs.readFileSync(require.resolve("deepmerge/dist/umd.js"), "utf8"),
    umdContext,
  );
  for (const [name, merge] of [
    ["CommonJS", cjs],
    ["UMD", umdContext.module.exports],
  ]) {
    it(`${name} preserves prototypes for null targets and both operands`, () => {
      const payload = JSON.parse(
        '{"__proto__":{"apisenseInjected":true},"ordinary":7}',
      );
      const results = [
        merge(Object.create(null), payload),
        merge({ branch: null }, { branch: payload }).branch,
        merge(payload, { other: true }),
        merge({}, { list: [payload] }).list[0],
        merge.all([{ branch: null }, { branch: payload }]).branch,
      ];
      for (const result of results) {
        expect(result.apisenseInjected).toBeUndefined();
        expect(result.ordinary).toBe(7);
        const literal = Object.getOwnPropertyDescriptor(result, "__proto__");
        if (literal) expect(literal.value.apisenseInjected).toBe(true);
      }
      expect({}.apisenseInjected).toBeUndefined();
    });
    it(`${name} preserves arrays, symbols, custom merge and clone semantics`, () => {
      const symbol = Symbol("config");
      const original = { list: [1], nested: { value: 2 }, [symbol]: "kept" };
      const out = merge(original, { list: [3], nested: { other: 4 } });
      expect(out.list).toEqual([1, 3]);
      expect(out.nested).toEqual({ value: 2, other: 4 });
      expect(out[symbol]).toBe("kept");
      expect(original.list).toEqual([1]);
      expect(
        merge(
          { settings: { a: 1 } },
          { settings: { b: 2 } },
          {
            customMerge: (key) =>
              key === "settings"
                ? (a, b) => ({ ...a, ...b, combined: true })
                : undefined,
          },
        ).settings,
      ).toEqual({ a: 1, b: 2, combined: true });
      expect(merge({}, { nested: original }, { clone: false }).nested).toBe(
        original,
      );
    });
  }
});

describe("glob cancellation and Expo compatibility", () => {
  for (const entry of ["glob", "glob/raw"]) {
    for (const dialect of ["require", "import"]) {
      it(`${entry} ${dialect} stops traversal through each async API`, async () => {
        const glob =
          dialect === "require" ? require(entry) : await import(entry);
        for (const api of ["glob", "stream", "iterate", "walk"]) {
          const controller = new AbortController();
          const reason = new Error("bounded traversal probe");
          let reads = 0;
          const wrappedFs = {
            ...fs,
            readdir: (file, options, callback) => {
              reads++;
              fs.readdir(file, options, (error, entries) => {
                if (!controller.signal.aborted) controller.abort(reason);
                callback(error, entries);
              });
            },
          };
          const options = {
            cwd: root,
            signal: controller.signal,
            fs: wrappedFs,
          };
          let failure;
          try {
            if (api === "glob") await glob.glob("**/*", options);
            else if (api === "walk")
              await new glob.Glob("**/*", options).walk();
            else {
              const iterator =
                api === "stream"
                  ? glob.globStream("**/*", options)
                  : glob.globIterate("**/*", options);
              for await (const ignored of iterator) void ignored;
            }
          } catch (error) {
            failure = error;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
          expect(failure?.message, api).toBe(reason.message);
          expect(
            reads,
            `${api}: directory reads after first callback abort`,
          ).toBe(1);
        }
        const controller = new AbortController();
        controller.abort(new Error("already aborted"));
        let reads = 0;
        const options = {
          cwd: root,
          signal: controller.signal,
          fs: {
            ...fs,
            readdirSync: (...args) => {
              reads++;
              return fs.readdirSync(...args);
            },
          },
        };
        try {
          glob.globSync("**/*", options);
        } catch (error) {
          expect(error.message).toBe("already aborted");
        }
        expect(reads).toBe(0);
      });
      it(`${entry} ${dialect} retains Expo discovery patterns`, async () => {
        const glob =
          dialect === "require" ? require(entry) : await import(entry);
        const options = {
          cwd: root,
          dot: true,
          ignore: ["node_modules/**"],
          posix: true,
        };
        expect((await glob.glob("**/*.@(ts|tsx)", options)).sort()).toEqual([
          "app/.hidden.ts",
          "app/index.tsx",
          "app/nested/data+api.ts",
        ]);
        expect(await glob.glob("**/*+api.@(ts|tsx|js|jsx)", options)).toEqual([
          "app/nested/data+api.ts",
        ]);
        expect(glob.globSync("android/**/*.gradle", options)).toEqual([
          "android/app/build.gradle",
        ]);
        expect(await glob.glob("packages/*/package.json", options)).toEqual([
          "packages/one/package.json",
        ]);
      });
      it(`${entry} ${dialect} queues no stat/realpath work after cancellation`, async () => {
        const glob =
          dialect === "require" ? require(entry) : await import(entry);
        for (const phase of ["readdir", "realpath"]) {
          const controller = new AbortController();
          let afterAbort = 0;
          const record = () => {
            if (controller.signal.aborted) afterAbort++;
          };
          const wrappedFs = {
            ...fs,
            readdir(file, options, callback) {
              record();
              fs.readdir(file, options, (error, entries) => {
                if (phase === "readdir")
                  controller.abort(new Error("phase abort"));
                callback(error, entries);
              });
            },
            promises: {
              ...fs.promises,
              async lstat(...args) {
                record();
                return fs.promises.lstat(...args);
              },
              async realpath(...args) {
                record();
                const result = await fs.promises.realpath(...args);
                if (phase === "realpath")
                  controller.abort(new Error("phase abort"));
                return result;
              },
            },
          };
          await expect(
            glob.glob("**/*", {
              cwd: root,
              stat: true,
              realpath: true,
              signal: controller.signal,
              fs: wrappedFs,
            }),
          ).rejects.toThrow("phase abort");
          await new Promise((resolve) => setTimeout(resolve, 100));
          expect(afterAbort, phase).toBe(0);
        }
      });
      it(`${entry} ${dialect} performs no I/O for pre-aborted stream/iterator aliases`, async () => {
        const glob =
          dialect === "require" ? require(entry) : await import(entry);
        for (const api of [
          "globStream",
          "globStreamSync",
          "globIterate",
          "globIterateSync",
        ]) {
          const controller = new AbortController();
          controller.abort(new Error("already cancelled"));
          let operations = 0;
          const wrappedFs = {
            ...fs,
            lstatSync(...args) {
              operations++;
              return fs.lstatSync(...args);
            },
            realpathSync(...args) {
              operations++;
              return fs.realpathSync(...args);
            },
            readdirSync(...args) {
              operations++;
              return fs.readdirSync(...args);
            },
            readdir(...args) {
              operations++;
              return fs.readdir(...args);
            },
            promises: {
              ...fs.promises,
              async lstat(...args) {
                operations++;
                return fs.promises.lstat(...args);
              },
              async realpath(...args) {
                operations++;
                return fs.promises.realpath(...args);
              },
            },
          };
          try {
            const result = glob[api]("**/*", {
              cwd: root,
              signal: controller.signal,
              fs: wrappedFs,
            });
            if (api === "globIterateSync") for (const item of result) void item;
            else for await (const item of result) void item;
          } catch (error) {
            expect(error.message).toBe("already cancelled");
          }
          await new Promise((resolve) => setTimeout(resolve, 10));
          expect(operations, api).toBe(0);
        }
      });
    }
  }
  it("preserves Expo's early-match helper and fingerprint ignore negation", async () => {
    const helper = require(
      path.join(path.dirname(cliPackage), "build/src/utils/glob.js"),
    );
    expect(
      await helper.anyMatchAsync("app/**/*.tsx", { cwd: root, posix: true }),
    ).toEqual(["app/index.tsx"]);
    const fingerprint = require("@expo/fingerprint/build/utils/Path.js");
    expect(
      fingerprint.isIgnoredPath("app/index.tsx", ["app/**", "!app/index.tsx"]),
    ).toBe(false);
    expect(
      fingerprint.isIgnoredPath("app/other.ts", ["app/**", "!app/index.tsx"]),
    ).toBe(true);
  });
});

describe("minimatch preprocessing amplification", () => {
  for (const dialect of ["require", "import"]) {
    it(`${dialect} bounds optimization while retaining matching and Windows paths`, async () => {
      const { Minimatch, minimatch } =
        dialect === "require"
          ? require("minimatch")
          : await import("minimatch");
      const matcher = new Minimatch(Array(8).fill("**/../a/b").join("/"), {
        optimizationLevel: 2,
        braceExpandMax: 8,
      });
      expect(matcher.globParts.length).toBeLessThanOrEqual(8);
      expect(
        minimatch("app/nested/data+api.ts", "**/*+api.@(ts|tsx|js|jsx)"),
      ).toBe(true);
      expect(minimatch("app/index.txt", "**/*.tsx")).toBe(false);
      expect(
        minimatch("C:/project/app/index.tsx", "C:\\project\\**\\*.tsx", {
          platform: "win32",
          windowsPathsNoEscape: true,
        }),
      ).toBe(true);
      expect(
        minimatch("//server/share/app/index.ts", "//server/share/**/*.ts", {
          platform: "win32",
        }),
      ).toBe(true);
    });
  }
});

describe("Expo DevTools collection boundary", () => {
  const schemas = require(path.join(server, "DevToolsPlugin.schema.js"));
  const command = {
    name: "inspect",
    title: "Inspect",
    environments: ["cli", "mcp"],
    parameters: [{ name: "hive", type: "text" }],
  };
  const plugin = {
    packageName: "fixture-plugin",
    packageRoot: "/fixture",
    cliExtensions: {
      description: "test",
      entryPoint: "index.js",
      commands: [command],
    },
  };
  it("rejects oversized output before touching any element", async () => {
    let visited = 0;
    const item = {
      get type() {
        visited++;
        throw new Error("must not visit");
      },
    };
    const oversized = Array(1025).fill(item);
    expect(() =>
      schemas.DevToolsPluginOutputSchema.safeParse(oversized),
    ).not.toThrow();
    expect(
      schemas.DevToolsPluginOutputSchema.safeParse(oversized).success,
    ).toBe(false);
    expect(
      (await schemas.DevToolsPluginOutputSchema.safeParseAsync(oversized))
        .success,
    ).toBe(false);
    expect(visited).toBe(0);
  });
  it("rejects oversized nested plugin collections before child parsing", () => {
    for (const [field, size] of [
      ["environments", 3],
      ["parameters", 65],
    ]) {
      let visited = 0;
      const array = Array(size).fill(null);
      Object.defineProperty(array, "0", {
        get() {
          visited++;
          throw new Error("must not visit");
        },
      });
      const input = {
        ...plugin,
        cliExtensions: {
          ...plugin.cliExtensions,
          commands: [{ ...command, [field]: array }],
        },
      };
      expect(() => schemas.PluginSchema.safeParse(input)).not.toThrow();
      expect(schemas.PluginSchema.safeParse(input).success).toBe(false);
      expect(visited).toBe(0);
    }
    const commands = Array(129).fill(command);
    expect(
      schemas.PluginSchema.safeParse({
        ...plugin,
        cliExtensions: { ...plugin.cliExtensions, commands },
      }).success,
    ).toBe(false);
  });
  it("preserves valid plugin metadata, CLI output and strict legacy MCP scalar schemas", () => {
    expect(schemas.PluginSchema.safeParse(plugin).success).toBe(true);
    const output = [
      { type: "text", text: "Ready", level: "info" },
      { type: "image", url: "https://example.com/image.png" },
      { type: "audio", url: "https://example.com/clip.wav" },
    ];
    expect(schemas.DevToolsPluginOutputSchema.parse(output)).toEqual(output);
    const { DevToolsPluginCliExtensionResults } = require(
      path.join(server, "DevToolsPluginCliExtensionResults.js"),
    );
    const results = new DevToolsPluginCliExtensionResults();
    expect(results.parseOutputText(JSON.stringify(output))).toEqual(output);
    expect(results.parseOutputText("plain text")[0].text).toBe("plain text");
    expect(
      results.parseOutputText(JSON.stringify(Array(1025).fill({})))[0].level,
    ).toBe("error");
    const { createMCPDevToolsExtensionSchema } = require(
      path.join(server, "createMCPDevToolsExtensionSchema.js"),
    );
    const schema = createMCPDevToolsExtensionSchema(plugin);
    expect(schema._def.typeName).toBe("ZodObject");
    expect(schema.parse({ command: "inspect", hive: "01" })).toEqual({
      command: "inspect",
      hive: "01",
    });
    expect(schema.safeParse({ command: "other" }).success).toBe(false);
    expect(
      schema.safeParse({ command: "inspect", unknown: true }).success,
    ).toBe(false);
  });
});

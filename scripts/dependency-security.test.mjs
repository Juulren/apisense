import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";
import { generateKeyPairSync } from "node:crypto";
import decode from "decode-uri-component";

const require = createRequire(import.meta.url);
const query = require("query-string");
const forge = require("node-forge");

describe("Dependency security boundaries", () => {
  it("parses native routing parameters with the ESM decoder", () => {
    expect({
      ...query.parse("name=Colmena%20%C3%B1&tag=a&tag=b&empty=&flag"),
    }).toEqual({
      name: "Colmena ñ",
      tag: ["a", "b"],
      empty: "",
      flag: null,
    });
    expect(
      query.stringify({ name: "Colmena ñ", id: "a/b" }, { sort: false }),
    ).toBe("name=Colmena%20%C3%B1&id=a%2Fb");
    expect(query.parse("broken=%zz&valid=%E2%9C%93").valid).toBe("✓");
  });

  it("decodes many distinct percent runs without quadratic replacement", () => {
    // Bounded version of GHSA-qr28-fpjm-wq7f; trailing malformed byte forces fallback.
    const input =
      Array.from(
        { length: 16000 },
        (_, i) =>
          `%${Math.floor(i / 256)
            .toString(16)
            .padStart(2, "0")}%${(i % 256).toString(16).padStart(2, "0")}x`,
      ).join("") + "%zz";
    const started = performance.now();
    const result = decode(input);
    expect(result.endsWith("%zz")).toBe(true);
    expect(performance.now() - started).toBeLessThan(1500);
    expect(decode("%E2%9C%93%FF%41")).toBe("✓%FFA");
  });

  const pair = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
  });
  const privateKey = forge.pki.privateKeyFromPem(pair.privateKey);
  const publicKey = forge.pki.publicKeyFromPem(pair.publicKey);
  const digest = () =>
    forge.md.sha256.create().update("Apisense synthetic signing control");

  it("preserves legitimate SHA256 signatures and PEM Buffer inputs", () => {
    const signature = privateKey.sign(digest());
    expect(publicKey.verify(digest().digest().getBytes(), signature)).toBe(
      true,
    );
    expect(forge.pem.decode(Buffer.from(pair.publicKey))[0].type).toBe(
      "PUBLIC KEY",
    );
  });

  it("preserves Expo's actual certificate generation and validation", () => {
    const signing = require("@expo/code-signing-certificates");
    const keyPair = { publicKey, privateKey };
    const certificate = signing.generateSelfSignedCodeSigningCertificate({
      keyPair,
      validityNotBefore: new Date(Date.now() - 60000),
      validityNotAfter: new Date(Date.now() + 60000),
      commonName: "Apisense synthetic dependency test",
    });
    expect(() =>
      signing.validateSelfSignedCertificate(certificate, keyPair),
    ).not.toThrow();
  });

  it.each([false, true])(
    "rejects extra nested DigestAlgorithm elements (null=%s)",
    (extraNull) => {
      const { asn1 } = forge;
      const element = (type, constructed, value) =>
        asn1.create(asn1.Class.UNIVERSAL, type, constructed, value);
      const algorithm = [
        element(
          asn1.Type.OID,
          false,
          asn1.oidToDer(forge.oids.sha256).getBytes(),
        ),
        element(asn1.Type.NULL, false, ""),
        element(
          extraNull ? asn1.Type.NULL : asn1.Type.OCTETSTRING,
          false,
          extraNull ? "" : "extra",
        ),
      ];
      const malformed = asn1
        .toDer(
          element(asn1.Type.SEQUENCE, true, [
            element(asn1.Type.SEQUENCE, true, algorithm),
            element(asn1.Type.OCTETSTRING, false, digest().digest().getBytes()),
          ]),
        )
        .getBytes();
      // Sign a synthetic non-canonical DigestInfo; older Forge accepts this shape.
      const signature = privateKey.sign(malformed, "NONE");
      expect(() =>
        publicKey.verify(digest().digest().getBytes(), signature),
      ).toThrow();
    },
  );
});

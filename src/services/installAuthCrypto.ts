import { CryptoDigestAlgorithm, digest, getRandomValues } from "expo-crypto";

// Supabase's PKCE implementation uses WebCrypto. Hermes may not expose it;
// install only the primitives Auth needs using native Expo implementations,
// so it cannot fall back to Math.random or a plain PKCE challenge.
export function installAuthCrypto(target: object = globalThis) {
  let crypto = Reflect.get(target, "crypto") as Partial<Crypto> | undefined;
  if (!crypto) {
    crypto = {};
    Object.defineProperty(target, "crypto", {
      value: crypto,
      configurable: true,
    });
  }
  if (!crypto.getRandomValues)
    Object.defineProperty(crypto, "getRandomValues", {
      value: getRandomValues,
    });
  if (!crypto.subtle?.digest) {
    const subtle = crypto.subtle ?? {};
    Object.defineProperty(subtle, "digest", {
      value: async (algorithm: AlgorithmIdentifier, data: BufferSource) => {
        const name = typeof algorithm === "string" ? algorithm : algorithm.name;
        if (name.toUpperCase() !== "SHA-256")
          throw new Error("El adaptador de autenticación solo admite SHA-256");
        return digest(CryptoDigestAlgorithm.SHA256, data);
      },
    });
    if (!crypto.subtle)
      Object.defineProperty(crypto, "subtle", { value: subtle });
  }
}

installAuthCrypto();

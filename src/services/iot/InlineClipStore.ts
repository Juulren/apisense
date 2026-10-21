import { fromByteArray, toByteArray } from "base64-js";
export interface ClipStore {
  write(id: string, bytes: Uint8Array): Promise<string>;
  read(uri: string): Promise<ArrayBuffer>;
}
export const clips: ClipStore = {
  async write(_id, bytes) {
    return `data:audio/wav;base64,${fromByteArray(bytes)}`;
  },
  async read(uri) {
    if (!uri.startsWith("data:audio/wav;base64,"))
      throw new Error("Clip local inválido");
    return Uint8Array.from(toByteArray(uri.slice(uri.indexOf(",") + 1))).buffer;
  },
};

import { createReadStream } from "node:fs";
import { toByteArray } from "base64-js";
import { JsonLineFramer, validateFrame } from "../src/services/iot/protocol.ts";
import { decodeWav } from "../src/services/iot/wav.ts";

// Offline validation only: never connects to a device/broker or writes records.
async function main() {
  const path = process.argv[2];
  if (!path) throw new Error("Uso: npm run iot:validate -- captura.ndjson");
  const framer = new JsonLineFramer();
  let count = 0;
  const validate = (input) => {
    const frame = validateFrame(input);
    if (frame.wav_base64) {
      const wav = decodeWav(toByteArray(frame.wav_base64));
      if (
        wav.sampleRate !== frame.sampling_rate_hz ||
        Math.abs(wav.pcm.length / wav.sampleRate - frame.duration_seconds) >
          0.05
      )
        throw new Error("Clip y telemetría no coinciden");
    }
    count++;
  };
  // Files have no radio timeout; preserve a fragmented final line across reads.
  for await (const chunk of createReadStream(path, { encoding: "utf8" }))
    framer.push(chunk, 0).forEach(validate);
  framer.push("\n", 0).forEach(validate);
  if (!count) throw new Error("La captura no contiene tramas");
  console.log(
    `${count} tramas válidas; formato, rangos y clips coherentes. Esto no certifica radio, ACL ni el modelo.`,
  );
}
main().catch((error) => {
  console.error(
    error instanceof SyntaxError
      ? "La captura contiene JSON inválido"
      : error.message,
  );
  process.exitCode = 1;
});

import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from "expo-audio";

let player: AudioPlayer | null = null;
let ready: Promise<unknown> | null = null;

/**
 * The short, soft tone for "saved". It stays quiet when the phone is on silent
 * or vibrate and never pauses other audio. Failing to play must not break what
 * was just saved, so nothing is thrown.
 */
export function playDone() {
  void (async () => {
    ready ??= setAudioModeAsync({
      playsInSilentMode: false,
      interruptionMode: "mixWithOthers",
    });
    await ready;
    player ??= createAudioPlayer(require("../../assets/sounds/done.wav"));
    await player.seekTo(0);
    player.play();
  })().catch(() => {
    // Try again from the start next time.
    ready = null;
  });
}

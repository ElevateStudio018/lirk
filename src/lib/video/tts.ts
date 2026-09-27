/**
 * Voice-over is pluggable. The lesson player only talks to this interface, so a
 * cloud TTS (pre-rendered audio files, streaming voices, …) can replace the
 * browser implementation later without touching the player.
 *
 * The app must work fully without voice-over: captions are always available.
 */
export interface TTSProvider {
  readonly id: string;
  readonly label: string;
  /** Whether this provider can produce audio in the current environment. */
  isAvailable(): boolean;
  /** Speaks the text. Resolves when finished or cancelled. */
  speak(text: string, options: { rate: number; lang: string }): Promise<void>;
  pause(): void;
  resume(): void;
  cancel(): void;
}

/** No audio at all – captions only. */
export class SilentTTSProvider implements TTSProvider {
  readonly id = "silent";
  readonly label = "Ingen röst";
  isAvailable() {
    return true;
  }
  async speak() {}
  pause() {}
  resume() {}
  cancel() {}
}

/** Uses the browser's built-in speech synthesis (works on iOS Safari and most desktops). */
export class WebSpeechTTSProvider implements TTSProvider {
  readonly id = "web-speech";
  readonly label = "Enhetens röst";
  private utterance: SpeechSynthesisUtterance | null = null;

  isAvailable() {
    return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  }

  private pickVoice(lang: string): SpeechSynthesisVoice | null {
    const voices = window.speechSynthesis.getVoices();
    const prefix = lang.slice(0, 2).toLowerCase();
    return (
      voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase() && v.localService) ??
      voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ??
      voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) ??
      null
    );
  }

  speak(text: string, { rate, lang }: { rate: number; lang: string }) {
    if (!this.isAvailable() || !text.trim()) return Promise.resolve();
    this.cancel();
    return new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = Math.min(2, Math.max(0.5, rate));
      const voice = this.pickVoice(lang);
      if (voice) u.voice = voice;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      this.utterance = u;
      window.speechSynthesis.speak(u);
    });
  }

  pause() {
    if (this.isAvailable()) window.speechSynthesis.pause();
  }

  resume() {
    if (this.isAvailable()) window.speechSynthesis.resume();
  }

  cancel() {
    if (this.isAvailable()) window.speechSynthesis.cancel();
    this.utterance = null;
  }
}

export function getDefaultTTSProvider(): TTSProvider {
  const web = new WebSpeechTTSProvider();
  return web.isAvailable() ? web : new SilentTTSProvider();
}

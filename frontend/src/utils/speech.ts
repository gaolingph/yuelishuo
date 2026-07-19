let preferredVoice: SpeechSynthesisVoice | null = null;

function getPreferredVoice(): SpeechSynthesisVoice | null {
  if (preferredVoice) return preferredVoice;

  const voices = window.speechSynthesis.getVoices();
  // Priority list: natural-sounding English voices
  const preferredNames = [
    'Google UK English Female',
    'Google US English',
    'Microsoft Zira',
    'Microsoft Hazel',
    'Samantha',
    'Google UK English Male',
  ];

  for (const name of preferredNames) {
    const found = voices.find(
      (v) => v.name.includes(name) && v.lang.startsWith('en')
    );
    if (found) {
      preferredVoice = found;
      return found;
    }
  }

  // Fallback: any English voice
  const englishVoice = voices.find((v) => v.lang.startsWith('en'));
  if (englishVoice) {
    preferredVoice = englishVoice;
    return englishVoice;
  }

  return null;
}

export function speak(text: string, rate = 0.9) {
  if (!('speechSynthesis' in window)) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = rate;

  const voice = getPreferredVoice();
  if (voice) {
    utterance.voice = voice;
    // Some Chrome versions need this to trigger Google TTS
    utterance.lang = voice.lang;
  }

  window.speechSynthesis.speak(utterance);
}

/** Speak and invoke callback when speech ends. Useful for auto-advance flows. */
export function speakWithCallback(text: string, rate: number, onEnd: () => void) {
  if (!('speechSynthesis' in window)) {
    onEnd();
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = rate;

  const voice = getPreferredVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }

  utterance.onend = onEnd;
  utterance.onerror = onEnd;

  window.speechSynthesis.speak(utterance);
}

// Preload voices (they load asynchronously)
export function initSpeech() {
  if ('speechSynthesis' in window) {
    // Trigger voice loading
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      preferredVoice = null; // Reset cache so next call picks up voices
      getPreferredVoice();
    };
  }
}

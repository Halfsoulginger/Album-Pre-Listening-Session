/**
 * Extracts normalized waveform peak bars (0..1) from an Audio File or generates
 * authentic musical envelopes for demo tracks.
 */

export async function extractWaveformFromBlob(blob: Blob, numberOfBars = 120): Promise<{ peaks: number[]; duration: number }> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioContext = new AudioContextClass();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const channelData = audioBuffer.getChannelData(0);
    const totalSamples = channelData.length;
    const blockSize = Math.floor(totalSamples / numberOfBars);
    const peaks: number[] = [];

    for (let i = 0; i < numberOfBars; i++) {
      const start = i * blockSize;
      let sum = 0;
      let max = 0;
      for (let j = 0; j < blockSize; j++) {
        const val = Math.abs(channelData[start + j] || 0);
        sum += val * val;
        if (val > max) max = val;
      }
      // Combine RMS and peak for pleasing visual fullness
      const rms = Math.sqrt(sum / blockSize);
      const combined = Math.min(1, Math.max(0.08, rms * 2.2 + max * 0.3));
      peaks.push(Math.round(combined * 100) / 100);
    }

    await audioContext.close();
    return {
      peaks,
      duration: Math.round(audioBuffer.duration),
    };
  } catch (err) {
    console.warn('Could not decode audio data for waveform, generating simulated envelope:', err);
    return {
      peaks: generateSimulatedWaveform(0, numberOfBars),
      duration: 180,
    };
  }
}

/**
 * Generates an authentic musical waveform envelope with verses, build-ups, and drops.
 */
export function generateSimulatedWaveform(seed = 0, numberOfBars = 120): number[] {
  const peaks: number[] = [];
  const baseFreq = 0.05 + (seed % 3) * 0.02;

  for (let i = 0; i < numberOfBars; i++) {
    const progress = i / numberOfBars;

    // Intro: 0 - 0.15 (medium)
    // Verse 1: 0.15 - 0.35 (steady bounce)
    // Build 1: 0.35 - 0.45 (rising intensity)
    // Drop 1 / Chorus: 0.45 - 0.65 (heavy peaks)
    // Bridge: 0.65 - 0.75 (quiet breakdown)
    // Drop 2 / Climax: 0.75 - 0.90 (maximum intensity)
    // Outro: 0.90 - 1.0 (fadeout)

    let intensity = 0.3;
    if (progress < 0.15) {
      intensity = 0.2 + progress * 1.5;
    } else if (progress < 0.35) {
      intensity = 0.4 + 0.15 * Math.sin(i * baseFreq * 6);
    } else if (progress < 0.45) {
      // Build up
      const buildProgress = (progress - 0.35) / 0.1;
      intensity = 0.45 + buildProgress * 0.45;
    } else if (progress < 0.65) {
      // Big Drop 1
      intensity = 0.8 + 0.18 * Math.sin(i * 1.2);
    } else if (progress < 0.75) {
      // Breakdown
      intensity = 0.25 + 0.1 * Math.cos(i * 0.8);
    } else if (progress < 0.9) {
      // Drop 2 / Climax
      intensity = 0.88 + 0.12 * Math.sin(i * 1.5);
    } else {
      // Outro fade
      const fadeProgress = (progress - 0.9) / 0.1;
      intensity = Math.max(0.1, 0.7 * (1 - fadeProgress));
    }

    // Add high frequency jitter / transients
    const transient = (Math.sin(i * 13.7 + seed * 5) * 0.5 + 0.5) * 0.25;
    const finalVal = Math.min(1, Math.max(0.1, intensity * (0.8 + transient)));
    peaks.push(Math.round(finalVal * 100) / 100);
  }

  return peaks;
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

import type { MicrophoneState } from "./microphoneManager";

const BUFFER_SIZE = 4096;

export type RecordingStatus =
  | "idle"
  | "countdown"
  | "recording"
  | "recorded"
  | "previewing";

export interface RecordingResult {
  samples: Float32Array;
  durationSeconds: number;
  sampleRate: number;
}

let workletNode: AudioWorkletNode | null = null;
let scriptProcessorNode: ScriptProcessorNode | null = null;
let recordedChunks: Float32Array[] = [];
let totalSamples = 0;

export function startCapture(micState: MicrophoneState): void {
  recordedChunks = [];
  totalSamples = 0;
  console.info("[AudioPipeline][Capture] start", {
    captureMode: micState.captureMode,
    contextState: micState.audioContext.state,
    sampleRate: micState.audioContext.sampleRate,
  });

  if (micState.audioContext.state === "suspended") {
    micState.audioContext.resume().then(() => {
      console.log("[RecEngine] AudioContext resumed before capture");
    });
  }

  // Use AudioWorklet if in high-fidelity mode and module is loaded
  if (micState.captureMode === "high-fidelity") {
    try {
      workletNode = new AudioWorkletNode(micState.audioContext, "audio-processor");
      workletNode.port.onmessage = (event) => {
        const input = event.data; // Float32Array
        const copy = new Float32Array(input.length);
        copy.set(input);
        recordedChunks.push(copy);
        totalSamples += copy.length;
      };
      
      micState.gainNode.connect(workletNode);
      workletNode.connect(micState.audioContext.destination); // Keep alive
      console.info("[AudioPipeline][Capture] worklet-started");
      return;
    } catch (e) {
      console.warn("[RecEngine] AudioWorklet failed, falling back to ScriptProcessor", e);
    }
  }

  // Fallback / Standard capture
  scriptProcessorNode = micState.audioContext.createScriptProcessor(
    BUFFER_SIZE,
    1,
    1
  );

  scriptProcessorNode.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);
    const copy = new Float32Array(input.length);
    copy.set(input);
    recordedChunks.push(copy);
    totalSamples += copy.length;
  };

  micState.gainNode.connect(scriptProcessorNode);
  scriptProcessorNode.connect(micState.audioContext.destination);
  console.info("[AudioPipeline][Capture] script-processor-started", {
    sampleRate: micState.audioContext.sampleRate,
    bufferSize: BUFFER_SIZE,
  });
}

export function stopCapture(micState: MicrophoneState): RecordingResult {
  console.info("[AudioPipeline][Capture] stopping", {
    chunksCount: recordedChunks.length,
    totalSamples,
  });

  if (workletNode) {
    try {
      micState.gainNode.disconnect(workletNode);
      workletNode.disconnect();
    } catch (e) {
      console.warn("[RecEngine] worklet disconnect warning:", e);
    }
    workletNode = null;
  }

  if (scriptProcessorNode) {
    try {
      micState.gainNode.disconnect(scriptProcessorNode);
    } catch (e) {
      console.warn("[RecEngine] gainNode disconnect warning:", e);
    }
    scriptProcessorNode.disconnect();
    scriptProcessorNode = null;
  }

  const samples = new Float32Array(totalSamples);
  let offset = 0;
  for (const chunk of recordedChunks) {
    samples.set(chunk, offset);
    offset += chunk.length;
  }
  recordedChunks = [];
  totalSamples = 0;

  const sampleRate = micState.audioContext.sampleRate || 48000;
  const durationSeconds = samples.length / sampleRate;
  console.info("[AudioPipeline][Capture] stopped", {
    samplesLength: samples.length,
    durationSeconds,
    sampleRate,
  });

  return { samples, durationSeconds, sampleRate };
}

export function createPreviewUrl(wavBlob: Blob): string {
  return URL.createObjectURL(wavBlob);
}

export function revokePreviewUrl(url: string): void {
  URL.revokeObjectURL(url);
}

export function playCountdownBeep(
  audioContext: AudioContext,
  frequency: number = 880,
  duration: number = 0.12
): void {
  const osc = audioContext.createOscillator();
  const env = audioContext.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, audioContext.currentTime);
  env.gain.setValueAtTime(0.3, audioContext.currentTime);
  env.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  osc.connect(env);
  env.connect(audioContext.destination);
  osc.start();
  osc.stop(audioContext.currentTime + duration);
}

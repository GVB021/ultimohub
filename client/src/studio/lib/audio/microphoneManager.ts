const SAMPLE_RATE = 48000;
const FFT_SIZE = 2048;

export type VoiceCaptureMode = "studio" | "original" | "high-fidelity";

export interface MicrophoneState {
  stream: MediaStream;
  audioContext: AudioContext;
  sourceNode: MediaStreamAudioSourceNode;
  gainNode: GainNode;
  analyserNode: AnalyserNode;
  captureMode: VoiceCaptureMode;
  filterNodes: AudioNode[];
  workletNode?: AudioWorkletNode;
}

let currentState: MicrophoneState | null = null;

export async function requestMicrophone(
  mode: VoiceCaptureMode = "original",
  deviceId?: string
): Promise<MicrophoneState> {
  if (currentState && currentState.audioContext.state !== "closed") {
    // If asking for same mode AND same device (or no device specified and we have one), return current
    const currentTrack = currentState.stream.getAudioTracks()[0];
    const currentDeviceId = currentTrack.getSettings().deviceId;
    
    if (currentState.captureMode === mode && (!deviceId || currentDeviceId === deviceId)) {
      return currentState;
    }
  }

  const isStudio = mode === "studio";
  const isHighFidelity = mode === "high-fidelity";
  
  let stream: MediaStream;
  try {
    const constraints: MediaTrackConstraints = {
      sampleRate: SAMPLE_RATE,
      channelCount: 1,
    };

    if (deviceId) {
      constraints.deviceId = { exact: deviceId };
    }

    if (isHighFidelity) {
      // Strict constraints for lossless/raw capture
      Object.assign(constraints, {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        highpassFilter: false,
        sampleSize: 24, // Attempt 24-bit capture if supported
      });
    } else {
      Object.assign(constraints, {
        echoCancellation: isStudio,
        noiseSuppression: isStudio,
        autoGainControl: isStudio,
      });
    }

    stream = await navigator.mediaDevices.getUserMedia({
      audio: constraints,
    });
  } catch (err) {
    console.error("[Mic] getUserMedia failed for mode", mode, err);
    if (currentState && currentState.audioContext.state !== "closed") {
      console.log("[Mic] Keeping existing mic state as fallback");
      return currentState;
    }
    throw err;
  }

  if (currentState && currentState.audioContext.state !== "closed") {
    await releaseMicrophoneAsync();
  }

  const audioContext = new AudioContext({ 
    sampleRate: SAMPLE_RATE,
    latencyHint: "interactive"
  });
  
  if (isHighFidelity) {
    try {
      await audioContext.audioWorklet.addModule("/audio-processor.js");
      console.log("[Mic] AudioWorklet module loaded");
    } catch (e) {
      console.error("[Mic] Failed to load AudioWorklet", e);
    }
  }

  if (audioContext.state === "suspended") {
    await audioContext.resume();
    console.log("[Mic] AudioContext resumed from suspended state");
  }

  const sourceNode = audioContext.createMediaStreamSource(stream);
  const gainNode = audioContext.createGain();
  gainNode.gain.value = 1.0;

  const analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = FFT_SIZE;
  analyserNode.smoothingTimeConstant = 0.6;
  analyserNode.minDecibels = -90;
  analyserNode.maxDecibels = 0;

  const filterNodes: AudioNode[] = [];

  if (isStudio) {
    const highPassFilter = audioContext.createBiquadFilter();
    highPassFilter.type = "highpass";
    highPassFilter.frequency.value = 80;
    highPassFilter.Q.value = 0.7;
    filterNodes.push(highPassFilter);

    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.15;
    filterNodes.push(compressor);

    sourceNode.connect(highPassFilter);
    highPassFilter.connect(compressor);
    compressor.connect(gainNode);
    console.log("[Mic] Studio mode: highpass(80Hz) → compressor → gain");
  } else if (isHighFidelity) {
    // Direct path for high fidelity
    sourceNode.connect(gainNode);
    console.log("[Mic] High-Fidelity mode: RAW capture (24-bit/48kHz requested)");
  } else {
    sourceNode.connect(gainNode);
    console.log("[Mic] Original mode: source → gain (no processing)");
  }

  gainNode.connect(analyserNode);

  currentState = {
    stream,
    audioContext,
    sourceNode,
    gainNode,
    analyserNode,
    captureMode: mode,
    filterNodes,
  };
  return currentState;
}

export function getFrequencyData(state: MicrophoneState): Uint8Array {
  const data = new Uint8Array(state.analyserNode.frequencyBinCount);
  state.analyserNode.getByteFrequencyData(data);
  return data;
}

export function getTimeDomainData(state: MicrophoneState): Uint8Array {
  const data = new Uint8Array(state.analyserNode.fftSize);
  state.analyserNode.getByteTimeDomainData(data);
  return data;
}

export function getAnalyserData(state: MicrophoneState): Uint8Array {
  return getFrequencyData(state);
}

export function setGain(state: MicrophoneState, value: number): void {
  const clamped = Math.max(0, Math.min(2, value));
  state.gainNode.gain.setTargetAtTime(clamped, state.audioContext.currentTime, 0.01);
}

async function releaseMicrophoneAsync(): Promise<void> {
  if (!currentState) return;
  currentState.stream.getTracks().forEach((t) => t.stop());
  if (currentState.audioContext.state !== "closed") {
    await currentState.audioContext.close().catch(() => {});
  }
  currentState = null;
}

export function releaseMicrophone(): void {
  if (!currentState) return;
  currentState.stream.getTracks().forEach((t) => t.stop());
  if (currentState.audioContext.state !== "closed") {
    currentState.audioContext.close().catch(() => {});
  }
  currentState = null;
}

export function getMicState(): MicrophoneState | null {
  return currentState;
}

export function getEstimatedInputLatencyMs(state: MicrophoneState): number {
  const baseLatency = Number(state.audioContext.baseLatency || 0);
  const outputLatency = Number((state.audioContext as any).outputLatency || 0);
  return (baseLatency + outputLatency) * 1000;
}

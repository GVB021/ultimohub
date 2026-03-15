import { useState, useEffect, useMemo, useRef } from "react";
import { Mic, Volume2, Sliders, Check, Headphones, Speaker, Smartphone, AlertTriangle, ShieldCheck, Waves } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@studio/components/ui/dialog";
import { Label } from "@studio/components/ui/label";
import { Slider } from "@studio/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@studio/components/ui/select";
import { useToast } from "@studio/hooks/use-toast";
import type { DeviceSettings, MicrophoneState } from "@studio/pages/room";

interface DeviceSettingsPanelProps {
  open: boolean;
  onClose: () => void;
  settings: DeviceSettings;
  onSettingsChange: (settings: DeviceSettings) => void;
  micState: MicrophoneState | null;
}

export function DeviceSettingsPanel({
  open,
  onClose,
  settings,
  onSettingsChange,
  micState,
}: DeviceSettingsPanelProps) {
  const { toast } = useToast();
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [micPermission, setMicPermission] = useState<"granted" | "denied" | "prompt" | "unknown">("unknown");
  const [consent, setConsent] = useState({
    microphone: false,
    systemAudioConfig: false,
    deviceControl: false,
  });
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [isTestingOutput, setIsTestingOutput] = useState(false);
  const [meterDb, setMeterDb] = useState(-60);
  const [isMicCapturing, setIsMicCapturing] = useState(false);
  const meterRafRef = useRef<number | null>(null);
  const testerAudioRef = useRef<HTMLAudioElement | null>(null);

  const saveConsent = (next: typeof consent) => {
    setConsent(next);
    try {
      localStorage.setItem("vhub_audio_permission_consent", JSON.stringify(next));
    } catch {}
  };

  const syncDevices = async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      setInputDevices(allDevices.filter((d) => d.kind === "audioinput"));
      setOutputDevices(allDevices.filter((d) => d.kind === "audiooutput"));
    } catch (err) {
      console.error("Error enumerating devices:", err);
    }
  };

  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicPermission("granted");
      return true;
    } catch {
      setMicPermission("denied");
      return false;
    }
  };

  useEffect(() => {
    if (!open) return;
    const hydrate = async () => {
      try {
        const raw = localStorage.getItem("vhub_audio_permission_consent");
        if (raw) {
          const parsed = JSON.parse(raw);
          setConsent({
            microphone: Boolean(parsed?.microphone),
            systemAudioConfig: Boolean(parsed?.systemAudioConfig),
            deviceControl: Boolean(parsed?.deviceControl),
          });
        }
      } catch {}
      await syncDevices();
      try {
        if (!navigator.permissions?.query) return;
        const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
        setMicPermission(status.state as "granted" | "denied" | "prompt");
      } catch {
        setMicPermission("unknown");
      }
    };
    void hydrate();
    navigator.mediaDevices.addEventListener("devicechange", syncDevices);
    return () => navigator.mediaDevices.removeEventListener("devicechange", syncDevices);
  }, [open]);

  useEffect(() => {
    if (!open || !micState) return;
    const timeDomain = new Uint8Array(micState.analyserNode.fftSize);
    const tick = () => {
      micState.analyserNode.getByteTimeDomainData(timeDomain);
      let sum = 0;
      for (let i = 0; i < timeDomain.length; i++) {
        const sample = (timeDomain[i] - 128) / 128;
        sum += sample * sample;
      }
      const rms = Math.sqrt(sum / timeDomain.length);
      const db = Math.max(-60, Math.min(0, 20 * Math.log10(Math.max(rms, 0.0001))));
      setMeterDb(db);
      setIsMicCapturing(db > -45);
      meterRafRef.current = window.requestAnimationFrame(tick);
    };
    meterRafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (meterRafRef.current) {
        window.cancelAnimationFrame(meterRafRef.current);
        meterRafRef.current = null;
      }
    };
  }, [open, micState]);

  const meterPercent = useMemo(() => ((meterDb + 60) / 60) * 100, [meterDb]);
  const meterColorClass = meterDb >= -6 ? "bg-red-500" : meterDb >= -18 ? "bg-yellow-400" : "bg-emerald-500";
  const mobileDetected = useMemo(() => /iphone|ipad|ipod|android/i.test(navigator.userAgent), []);
  const losslessActive = settings.voiceCaptureMode === "high-fidelity";
  const estimatedLatencyMs = useMemo(() => {
    if (!micState) return null;
    const baseLatency = Number(micState.audioContext.baseLatency || 0);
    const outputLatency = Number((micState.audioContext as any).outputLatency || 0);
    return (baseLatency + outputLatency) * 1000;
  }, [micState]);

  const ensurePermissionAndConsent = async (type: "microphone" | "deviceControl" | "systemAudioConfig") => {
    if (!consent[type]) {
      toast({
        title: "Consentimento pendente",
        description: "Autorize este tipo de acesso no bloco de permissões para aplicar a configuração.",
        variant: "destructive",
      });
      return false;
    }
    if (type === "microphone" && micPermission !== "granted") {
      const granted = await requestMicPermission();
      if (!granted) {
        toast({
          title: "Permissão de microfone negada",
          description: "Sem permissão, não é possível monitorar ou testar captação.",
          variant: "destructive",
        });
        return false;
      }
    }
    return true;
  };

  const handleSafeSettingsChange = async (next: DeviceSettings) => {
    const micReady = await ensurePermissionAndConsent("microphone");
    if (!micReady) return;
    if (next.monitorVolume > 0.85 && next.inputGain > 1.5) {
      toast({
        title: "Configuração bloqueada para evitar feedback",
        description: "Reduza ganho ou volume de monitor para aplicar sem risco de microfonia.",
        variant: "destructive",
      });
      return;
    }
    onSettingsChange(next);
  };

  const handleMicTest = async () => {
    if (!micState?.stream) {
      toast({ title: "Microfone indisponível", description: "Ative o microfone antes de testar.", variant: "destructive" });
      return;
    }
    const granted = await ensurePermissionAndConsent("microphone");
    if (!granted) return;
    setIsTestingMic(true);
    const recorder = new MediaRecorder(micState.stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: "audio/webm" });
      const url = URL.createObjectURL(blob);
      if (testerAudioRef.current) {
        testerAudioRef.current.pause();
      }
      const audio = new Audio(url);
      testerAudioRef.current = audio;
      const sinkCapable = audio as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
      if (settings.outputDeviceId && typeof sinkCapable.setSinkId === "function") {
        await sinkCapable.setSinkId(settings.outputDeviceId).catch(() => {});
      }
      audio.play().catch(() => {});
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      setIsTestingMic(false);
      toast({ title: "Teste concluído", description: "Reprodução automática iniciada para validar o dispositivo." });
    };
    recorder.start();
    window.setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
    }, 5000);
  };

  const handleOutputTest = async () => {
    const granted = await ensurePermissionAndConsent("deviceControl");
    if (!granted) return;
    setIsTestingOutput(true);
    const context = new AudioContext({ sampleRate: 48000 });
    const destination = context.createMediaStreamDestination();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 1000;
    gain.gain.value = 0.2;
    oscillator.connect(gain);
    gain.connect(destination);
    const audio = new Audio();
    audio.srcObject = destination.stream;
    const sinkCapable = audio as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
    if (settings.outputDeviceId && typeof sinkCapable.setSinkId === "function") {
      await sinkCapable.setSinkId(settings.outputDeviceId).catch(() => {});
    }
    await audio.play().catch(() => {});
    oscillator.start();
    oscillator.stop(context.currentTime + 2);
    window.setTimeout(async () => {
      await context.close().catch(() => {});
      setIsTestingOutput(false);
    }, 2100);
  };

  const outputLabel = (device: MediaDeviceInfo) => {
    const lower = (device.label || "").toLowerCase();
    if (lower.includes("head")) return { icon: Headphones, text: device.label || "Fones de ouvido" };
    if (lower.includes("speaker") || lower.includes("alto")) return { icon: Speaker, text: device.label || "Alto-falantes" };
    if (lower.includes("bluetooth")) return { icon: Smartphone, text: device.label || "Saída Bluetooth" };
    return { icon: Volume2, text: device.label || `Saída ${device.deviceId.slice(0, 5)}` };
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="w-[min(96vw,920px)] max-h-[90vh] overflow-y-auto bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-primary" />
            Painel Avançado de Áudio
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-2">
          <div className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Permissões e Consentimento
              </div>
              <span className="text-[11px] text-muted-foreground">Microfone: {micPermission}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="flex items-center gap-2 text-xs rounded-md border border-border/60 p-2" title="Necessário para monitorar captação, teste de microfone e gravação.">
                <input
                  type="checkbox"
                  checked={consent.microphone}
                  onChange={(event) => saveConsent({ ...consent, microphone: event.target.checked })}
                />
                Acesso ao microfone
              </label>
              <label className="flex items-center gap-2 text-xs rounded-md border border-border/60 p-2" title="Permite alterar o modo de captura e otimizações avançadas de qualidade.">
                <input
                  type="checkbox"
                  checked={consent.systemAudioConfig}
                  onChange={(event) => saveConsent({ ...consent, systemAudioConfig: event.target.checked })}
                />
                Ajustes de áudio
              </label>
              <label className="flex items-center gap-2 text-xs rounded-md border border-border/60 p-2" title="Necessário para selecionar entrada/saída e aplicar testes de dispositivo.">
                <input
                  type="checkbox"
                  checked={consent.deviceControl}
                  onChange={(event) => saveConsent({ ...consent, deviceControl: event.target.checked })}
                />
                Controle de dispositivos
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Waves className="w-4 h-4 text-primary" />
                Monitor de áudio em tempo real
              </div>
              <div className={`text-xs font-semibold ${isMicCapturing ? "text-emerald-500" : "text-amber-400"}`}>
                {isMicCapturing ? "Captando áudio" : "Sem captação"}
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 rounded-full bg-background border border-border/60 overflow-hidden">
                <div className={`h-full transition-all ${meterColorClass}`} style={{ width: `${Math.max(0, Math.min(100, meterPercent))}%` }} />
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>-60dB</span>
                <span>{meterDb.toFixed(1)} dB</span>
                <span>0dB</span>
              </div>
            </div>
            <button
              onClick={() => void handleMicTest()}
              disabled={isTestingMic || !micState}
              className="h-9 px-3 rounded-md border border-border bg-background hover:bg-muted text-xs font-medium disabled:opacity-50"
              title="Grava 5 segundos e reproduz automaticamente para validar o microfone selecionado."
            >
              {isTestingMic ? "Testando microfone..." : "Testar Microfone (5s)"}
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="mic-select" className="text-foreground" title="Escolha o dispositivo de entrada para gravação.">Microfone de Entrada</Label>
              <Select
                value={settings.inputDeviceId || "default"}
                onValueChange={(val) => void handleSafeSettingsChange({ ...settings, inputDeviceId: val })}
              >
                <SelectTrigger id="mic-select" className="bg-background border-border text-foreground">
                  <SelectValue placeholder="Selecione o microfone" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  <SelectItem value="default">Padrão do Sistema</SelectItem>
                  {inputDevices.map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label || `Microfone ${device.deviceId.slice(0, 5)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="output-select" className="text-foreground" title="Escolha para onde o áudio de monitor/reprodução será enviado.">Dispositivo de Saída</Label>
              <Select
                value={settings.outputDeviceId || "default"}
                onValueChange={async (val) => {
                  const granted = await ensurePermissionAndConsent("deviceControl");
                  if (!granted) return;
                  onSettingsChange({ ...settings, outputDeviceId: val === "default" ? "" : val });
                }}
              >
                <SelectTrigger id="output-select" className="bg-background border-border text-foreground">
                  <SelectValue placeholder="Selecione a saída" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-popover-foreground">
                  <SelectItem value="default">Saída Padrão do Sistema</SelectItem>
                  {outputDevices.map((device) => {
                    const meta = outputLabel(device);
                    return (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        <span className="flex items-center gap-2">
                          <meta.icon className="w-3.5 h-3.5" />
                          {meta.text}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <button
                onClick={() => void handleOutputTest()}
                disabled={isTestingOutput}
                className="h-8 px-3 rounded-md border border-border bg-background hover:bg-muted text-xs font-medium disabled:opacity-50"
                title="Emite tom senoidal de 1kHz por 2 segundos na saída selecionada."
              >
                {isTestingOutput ? "Testando saída..." : "Teste de saída (1kHz / 2s)"}
              </button>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <Label className="text-foreground flex items-center gap-2" title="Ajusta sensibilidade de entrada do microfone.">
                <Mic className="w-4 h-4" />
                Ganho de Entrada
              </Label>
              <span className="text-xs font-mono text-primary">
                {Math.round(settings.inputGain * 100)}%
              </span>
            </div>
            <Slider
              value={[settings.inputGain * 100]}
              min={0}
              max={200}
              step={1}
              onValueChange={([val]) => void handleSafeSettingsChange({ ...settings, inputGain: val / 100 })}
              className="py-2"
            />
          </div>

          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <Label className="text-foreground flex items-center gap-2" title="Controla volume local de retorno para monitoramento durante a sessão.">
                <Volume2 className="w-4 h-4" />
                Volume do Monitor
              </Label>
              <span className="text-xs font-mono text-primary">
                {Math.round(settings.monitorVolume * 100)}%
              </span>
            </div>
            <Slider
              value={[settings.monitorVolume * 100]}
              min={0}
              max={100}
              step={1}
              onValueChange={([val]) => void handleSafeSettingsChange({ ...settings, monitorVolume: val / 100 })}
              className="py-2"
            />
            {settings.monitorVolume > 0.85 && settings.inputGain > 1.5 && (
              <div className="text-xs rounded-md border border-red-500/30 bg-red-500/10 text-red-300 px-2 py-1.5 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                Risco de feedback detectado. Reduza ganho ou monitor.
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-3">
            <Label className="text-foreground" title="Lossless usa cadeia de captura de alta fidelidade quando suportado pelo dispositivo.">Modo de Captura</Label>
            <Select
              value={settings.voiceCaptureMode}
              onValueChange={async (val) => {
                const granted = await ensurePermissionAndConsent("systemAudioConfig");
                if (!granted) return;
                onSettingsChange({ ...settings, voiceCaptureMode: val as DeviceSettings["voiceCaptureMode"] });
              }}
            >
              <SelectTrigger className="bg-background border-border text-foreground">
                <SelectValue placeholder="Selecione o modo de captura" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-popover-foreground">
                <SelectItem value="original">Padrão</SelectItem>
                <SelectItem value="studio">Processado (Studio)</SelectItem>
                <SelectItem value="high-fidelity">Lossless (48kHz / 24-bit)</SelectItem>
              </SelectContent>
            </Select>
            {losslessActive && (
              <div className="text-xs rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 px-2 py-1.5 flex items-center gap-2">
                <Check className="w-3.5 h-3.5" />
                Modo lossless ativo para maior fidelidade e menor processamento.
              </div>
            )}
            {mobileDetected && (
              <div className="text-xs text-muted-foreground">
                Dispositivo móvel detectado: o sistema prioriza modo lossless automaticamente quando disponível.
              </div>
            )}
            {estimatedLatencyMs !== null && (
              <div className={`text-xs ${estimatedLatencyMs < 5 ? "text-emerald-400" : "text-amber-400"}`}>
                Latência estimada: {estimatedLatencyMs.toFixed(2)}ms {estimatedLatencyMs < 5 ? "(meta atingida)" : "(acima da meta < 5ms)"}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

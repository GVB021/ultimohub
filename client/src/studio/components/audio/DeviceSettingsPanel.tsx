import { useState, useEffect } from "react";
import { Mic, Volume2, Sliders, Check } from "lucide-react";
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
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    const updateDevices = async () => {
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        setDevices(allDevices.filter((d) => d.kind === "audioinput"));
      } catch (err) {
        console.error("Error enumerating devices:", err);
      }
    };

    if (open) {
      updateDevices();
      navigator.mediaDevices.addEventListener("devicechange", updateDevices);
    }
    return () => navigator.mediaDevices.removeEventListener("devicechange", updateDevices);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-primary" />
            Configurações de Áudio
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label htmlFor="mic-select" className="text-foreground">Microfone</Label>
            <Select
              value={settings.inputDeviceId || "default"}
              onValueChange={(val) => onSettingsChange({ ...settings, inputDeviceId: val })}
            >
              <SelectTrigger id="mic-select" className="bg-background border-border text-foreground">
                <SelectValue placeholder="Selecione o microfone" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-popover-foreground">
                <SelectItem value="default">Padrão do Sistema</SelectItem>
                {devices.map((device) => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microfone ${device.deviceId.slice(0, 5)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <Label className="text-foreground flex items-center gap-2">
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
              onValueChange={([val]) => onSettingsChange({ ...settings, inputGain: val / 100 })}
              className="py-4"
            />
          </div>

          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <Label className="text-foreground flex items-center gap-2">
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
              onValueChange={([val]) => onSettingsChange({ ...settings, monitorVolume: val / 100 })}
              className="py-4"
            />
          </div>

          <div className="grid gap-2">
            <Label className="text-foreground">Modo de Captura</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onSettingsChange({ ...settings, voiceCaptureMode: "original" })}
                className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all ${
                  settings.voiceCaptureMode === "original"
                    ? "bg-primary/20 border-primary text-primary"
                    : "bg-muted/60 border-border text-foreground hover:bg-muted"
                }`}
              >
                {settings.voiceCaptureMode === "original" && <Check className="w-3 h-3" />}
                Original
              </button>
              <button
                onClick={() => onSettingsChange({ ...settings, voiceCaptureMode: "studio" })}
                className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all ${
                  settings.voiceCaptureMode === "studio"
                    ? "bg-primary/20 border-primary text-primary"
                    : "bg-muted/60 border-border text-foreground hover:bg-muted"
                }`}
              >
                {settings.voiceCaptureMode === "studio" && <Check className="w-3 h-3" />}
                Processado (Studio)
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

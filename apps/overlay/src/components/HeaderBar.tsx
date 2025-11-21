import { Minus, X, Settings, Mic, Circle, Square } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface HeaderBarProps {
  isRecording: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  connectionQuality: { quality: 'good' | 'fair' | 'poor'; latency?: number } | null;
  micGain: number;
  onRecordToggle: () => void;
  onMicGainChange: (gain: number) => void;
}

export function HeaderBar({
  isRecording,
  connectionStatus,
  connectionQuality,
  micGain,
  onRecordToggle,
  onMicGainChange,
}: HeaderBarProps) {
  const handleClose = async () => {
    if (window.electronAPI) {
      await window.electronAPI.closeWindow();
    }
  };

  const handleMinimize = async () => {
    if (window.electronAPI) {
      await window.electronAPI.minimizeWindow();
    }
  };

  const handleSettings = () => {
    // Placeholder for settings
    console.log('Settings clicked');
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return connectionQuality?.quality === 'poor' ? 'bg-red-500' : 'bg-emerald-500';
      case 'connecting':
        return 'bg-amber-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    if (connectionStatus === 'connected' && connectionQuality?.latency) {
      return `Connected (${Math.round(connectionQuality.latency)}ms)`;
    }
    return connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1);
  };

  return (
    <div
      className="h-[50px] glass-panel-light flex items-center justify-between px-4"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      {/* Left: Empty space for drag handle */}
      <div className="flex items-center gap-2 flex-1">
      </div>

      {/* Center: Controls */}
      <div
        className="flex items-center gap-3 flex-1 justify-center"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        {/* Record button */}
        <Button
          variant={isRecording ? 'destructive' : 'default'}
          className={cn(
            "h-7 !px-8 text-[11px] gap-1.5 bg-white text-black hover:bg-white/90",
            isRecording && "animate-pulse bg-red-500 text-white hover:bg-red-600"
          )}
          onClick={onRecordToggle}
        >
          {isRecording ? (
            <>
              <Square className="size-3" />
              <span>Stop</span>
            </>
          ) : (
            <>
              <Circle className="size-3" />
              <span>Start</span>
            </>
          )}
        </Button>

        {/* Mic Gain */}
        <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-black/20">
          <Mic className="size-3 text-white/70" />
          <input
            type="range"
            min="1"
            max="5"
            step="0.1"
            value={micGain}
            onChange={(e) => onMicGainChange(parseFloat(e.target.value))}
            className="w-10 h-1 bg-white/20 rounded-full appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2
                     [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-white/90"
          />
          <span className="text-[8px] text-white/80 font-semibold min-w-[20px] text-center">
            {micGain.toFixed(1)}x
          </span>
        </div>

        {/* Connection Status */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/20">
          <div className={cn("size-1.5 rounded-full", getStatusColor())} />
          <span className="text-[9px] text-white/70 font-medium">
            {getStatusText()}
          </span>
        </div>
      </div>

      {/* Right: Window controls */}
      <div
        className="flex items-center gap-2 flex-1 justify-end !mr-4"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <Button
          size="icon"
          variant="ghost"
          className="size-5 hover:bg-emerald-500/20 text-white"
          onClick={handleSettings}
        >
          <Settings className="size-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-5 hover:bg-amber-500/20 text-white"
          onClick={handleMinimize}
        >
          <Minus className="size-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-5 hover:bg-red-500/20 text-white"
          onClick={handleClose}
        >
          <X className="size-3" />
        </Button>
      </div>
    </div>
  );
}

import React, { useState, useRef, useMemo, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import { VideoPlayer } from "./VideoPlayer";
import type { VideoPlayerRef } from "./VideoPlayer";
import { CaptionEditor } from "./CaptionEditor";
import { ExportBar } from "./ExportBar";
import type { CaptionSegment } from "../types";

interface WorkspaceProps {
  videoUrl: string;
  segments: CaptionSegment[];
  onUpdateSegment: (id: string, newText: string) => void;
  onExport: (format: "srt" | "vtt" | "txt") => void;
  onBack?: () => void;
}

export const Workspace: React.FC<WorkspaceProps> = ({
  videoUrl,
  segments,
  onUpdateSegment,
  onExport,
  onBack,
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const playerRef = useRef<VideoPlayerRef>(null);

  // Time seeking callback triggered from Editor clicks
  const handleSeek = useCallback((time: number) => {
    playerRef.current?.seekTo(time);
  }, []);

  // Compute active caption for the current playback time
  const activeCaption = useMemo(() => {
    const activeSeg = segments.find(
      (seg) => currentTime >= seg.start && currentTime <= seg.end
    );
    return activeSeg ? activeSeg.text : "";
  }, [segments, currentTime]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
      {/* Workspace top options panel */}
      <div className="relative z-50 flex items-center justify-between bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4 backdrop-blur-xl">
        <div className="flex items-center space-x-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white"
              title="Back to Home"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h3 className="font-bold text-slate-100 text-base">Workspace Panel</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Click segment block to jump to timestamp. Edit text areas to update.
            </p>
          </div>
        </div>
        <ExportBar onExport={onExport} />
      </div>

      {/* Bento-grid Dual-pane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Video Player Section */}
        <div className="lg:col-span-7 space-y-4">
          <VideoPlayer
            ref={playerRef}
            videoUrl={videoUrl}
            currentTime={currentTime}
            onTimeUpdate={setCurrentTime}
            activeCaption={activeCaption}
          />
        </div>

        {/* Right Captions Editor Section */}
        <div className="lg:col-span-5 glass-card rounded-2xl p-5 border border-white/[0.06] shadow-2xl flex flex-col h-[400px] lg:h-auto lg:min-h-[445px]">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.06] select-none">
            <span className="font-bold text-sm text-slate-200 uppercase tracking-widest text-[11px]">
              Captions Timeline
            </span>
            <span className="text-[10px] bg-primary-500/10 text-primary-400 px-2.5 py-0.5 rounded-full border border-primary-500/20 font-bold font-mono">
              {segments.length} BLOCKS
            </span>
          </div>
          <CaptionEditor
            segments={segments}
            currentTime={currentTime}
            onSeek={handleSeek}
            onUpdateSegment={onUpdateSegment}
          />
        </div>
      </div>
    </div>
  );
};

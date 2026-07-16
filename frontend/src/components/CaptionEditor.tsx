import React, { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import type { CaptionSegment } from "../types";

interface CaptionEditorProps {
  segments: CaptionSegment[];
  currentTime: number;
  onSeek: (time: number) => void;
  onUpdateSegment: (id: string, newText: string) => void;
}

export const CaptionEditor: React.FC<CaptionEditorProps> = ({
  segments,
  currentTime,
  onSeek,
  onUpdateSegment,
}) => {
  const activeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const formatTime = (sec: number) => {
    if (isNaN(sec)) return "00:00.00";
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 100);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
  };

  // Scroll active caption into view
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [currentTime]);

  return (
    <div 
      ref={containerRef}
      className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin max-h-[60vh] md:max-h-[68vh]"
    >
      {segments.map((seg) => {
        const isActive = currentTime >= seg.start && currentTime <= seg.end;

        return (
          <motion.div
            key={seg.id}
            ref={isActive ? activeRef : null}
            onClick={() => onSeek(seg.start)}
            whileHover={{ scale: 1.005 }}
            className={`p-4 rounded-xl border transition-all duration-300 flex flex-col gap-3 relative overflow-hidden cursor-pointer group/card
              ${
                isActive
                  ? "bg-primary-500/10 border-primary-500/30 shadow-lg shadow-primary-500/5 glow-indigo border-l-4 border-l-primary-500"
                  : "bg-white/[0.01] hover:bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12] border-l-4 border-l-transparent"
              }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-500 group-hover/card:text-slate-400 font-bold uppercase tracking-wider select-none">
                Segment #{seg.index + 1}
              </span>
              <div className="flex items-center space-x-1.5 text-xs font-mono text-slate-400 select-none">
                <span className="bg-white/5 border border-white/[0.06] px-1.5 py-0.5 rounded">
                  {formatTime(seg.start)}
                </span>
                <span className="opacity-50">→</span>
                <span className="bg-white/5 border border-white/[0.06] px-1.5 py-0.5 rounded">
                  {formatTime(seg.end)}
                </span>
              </div>
            </div>

            <textarea
              value={seg.text}
              onClick={(e) => e.stopPropagation()} // Prevent seek trigger when clicking input area
              onChange={(e) => onUpdateSegment(seg.id, e.target.value)}
              className="w-full bg-white/[0.02] border border-white/[0.06] focus:border-primary-500 rounded-lg p-2.5 text-[14px] text-slate-200 focus:text-white outline-none transition-colors resize-none h-18 scrollbar-none"
              placeholder="Caption text..."
            />
          </motion.div>
        );
      })}
    </div>
  );
};

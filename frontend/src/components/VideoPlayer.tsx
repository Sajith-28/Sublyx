import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";

export interface VideoPlayerRef {
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
}

interface VideoPlayerProps {
  videoUrl: string;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  activeCaption: string;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({ videoUrl, currentTime, onTimeUpdate, activeCaption }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(true);

    useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
        }
      },
      getCurrentTime: () => {
        return videoRef.current ? videoRef.current.currentTime : 0;
      },
    }));

    // Auto-hide controls timer
    useEffect(() => {
      if (!isPlaying) {
        setShowControls(true);
        return;
      }
      const timer = setTimeout(() => setShowControls(false), 2000);
      return () => clearTimeout(timer);
    }, [isPlaying, showControls]);

    const handlePlayPause = useCallback(() => {
      if (!videoRef.current) return;
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }, [isPlaying]);

    const handleTimeUpdate = () => {
      if (!videoRef.current) return;
      onTimeUpdate(videoRef.current.currentTime);
    };

    const handleLoadedMetadata = () => {
      if (!videoRef.current) return;
      setDuration(videoRef.current.duration);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const vol = parseFloat(e.target.value);
      setVolume(vol);
      setIsMuted(vol === 0);
      if (videoRef.current) {
        videoRef.current.volume = vol;
        videoRef.current.muted = vol === 0;
      }
    };

    const toggleMute = () => {
      if (!videoRef.current) return;
      const nextMute = !isMuted;
      setIsMuted(nextMute);
      videoRef.current.muted = nextMute;
    };

    const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!videoRef.current) return;
      const time = parseFloat(e.target.value);
      videoRef.current.currentTime = time;
      onTimeUpdate(time);
    };

    const handleFullscreen = () => {
      if (!containerRef.current) return;
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen().catch(() => {});
      }
    };

    const formatTimeHelper = (time: number) => {
      if (isNaN(time)) return "00:00";
      const mins = Math.floor(time / 60);
      const secs = Math.floor(time % 60);
      return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    };

    return (
      <div
        ref={containerRef}
        className="w-full aspect-video bg-black rounded-2xl border border-white/[0.06] shadow-2xl relative overflow-hidden group select-none"
        onMouseMove={() => setShowControls(true)}
        onMouseLeave={() => isPlaying && setShowControls(false)}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onClick={handlePlayPause}
        />

        {/* Dynamic Caption Overlay */}
        <div className="absolute bottom-16 inset-x-0 flex justify-center px-8 pointer-events-none z-10">
          <AnimatePresence mode="wait">
            {activeCaption && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="px-6 py-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl max-w-2xl text-center shadow-lg"
              >
                <p className="text-white text-base md:text-lg font-bold tracking-wide select-none drop-shadow-md">
                  {activeCaption}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Controls Overlay */}
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 flex flex-col justify-end p-4 z-20"
            >
              <div className="space-y-3">
                {/* Custom timeline bar */}
                <div className="flex items-center space-x-3">
                  <span className="text-[10px] font-mono text-slate-300">
                    {formatTimeHelper(currentTime)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    step={0.05}
                    onChange={handleProgressChange}
                    className="flex-1 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-primary-500 outline-none"
                  />
                  <span className="text-[10px] font-mono text-slate-300">
                    {formatTimeHelper(duration)}
                  </span>
                </div>

                {/* Buttons controls */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={handlePlayPause}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-all active:scale-95 cursor-pointer"
                    >
                      {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                    </button>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={toggleMute}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-all active:scale-95 cursor-pointer"
                      >
                        {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-16 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-primary-500 outline-none"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleFullscreen}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-all active:scale-95 cursor-pointer"
                  >
                    <Maximize size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";

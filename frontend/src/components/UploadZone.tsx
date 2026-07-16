import React, { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Film, X } from "lucide-react";

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onRemoveFile: () => void;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  onFileSelect,
  selectedFile,
  onRemoveFile,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.preventDefault();
      if (e.target.files && e.target.files[0]) {
        onFileSelect(e.target.files[0]);
      }
    },
    [onFileSelect]
  );

  const onButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="video/*,audio/*"
        onChange={handleChange}
      />

      <AnimatePresence mode="wait">
        {!selectedFile ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={onButtonClick}
            className={`min-h-[240px] w-full flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300 relative overflow-hidden group select-none
              ${
                dragActive
                  ? "border-cyan-500 bg-cyan-500/[0.04] shadow-[0_0_30px_rgba(6,182,212,0.15)]"
                  : "border-slate-800 bg-white/[0.02] hover:border-primary-500/50 hover:bg-white/[0.04]"
              }`}
          >
            <div className="absolute inset-0 bg-radial-[circle_at_center,rgba(99,102,241,0.03)_0%,transparent_80%] pointer-events-none" />

            <div className="flex flex-col items-center space-y-4 text-center relative z-10">
              <motion.div
                className={`p-4 rounded-2xl transition-all duration-300
                  ${
                    dragActive
                      ? "bg-cyan-500/20 text-cyan-400"
                      : "bg-white/[0.03] border border-white/[0.06] text-slate-400 group-hover:text-primary-400 group-hover:bg-primary-500/10 group-hover:border-primary-500/20"
                  }`}
                animate={dragActive ? { scale: 1.05 } : { scale: 1 }}
              >
                <Upload size={28} />
              </motion.div>
              <div>
                <p className="font-semibold text-slate-200">
                  {dragActive ? "Drop the file here" : "Drag & drop your video here"}
                </p>
                <p className="text-sm text-slate-400 mt-1 max-w-[280px]">
                  or <span className="text-primary-400 group-hover:underline font-semibold">click to browse</span> • MP4, MOV, MKV, WEBM, MP3, WAV
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="filecard"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            className="w-full p-5 bg-white/[0.02] border border-white/[0.08] backdrop-blur-xl rounded-2xl flex items-center justify-between shadow-2xl relative group overflow-hidden"
          >
            <div className="absolute inset-0 bg-radial-[circle_at_center,rgba(99,102,241,0.02)_0%,transparent_80%] pointer-events-none" />

            <div className="flex items-center space-x-4 relative z-10">
              <div className="w-12 h-12 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-400 shadow-lg shadow-primary-500/5">
                <Film size={22} />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-200 truncate max-w-[240px] sm:max-w-[400px]">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  {formatBytes(selectedFile.size)}
                </p>
              </div>
            </div>

            <motion.button
              type="button"
              onClick={onRemoveFile}
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-rose-500/20 border border-white/[0.06] hover:border-rose-500/30 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer relative z-10"
            >
              <X size={16} />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

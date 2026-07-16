import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, FileText, ChevronDown } from "lucide-react";

interface ExportBarProps {
  onExport: (format: "srt" | "vtt" | "txt") => void;
}

export const ExportBar: React.FC<ExportBarProps> = ({ onExport }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formats = [
    {
      id: "srt" as const,
      name: "SubRip Subtitle (.srt)",
      desc: "Standard format supported by video players & YouTube.",
    },
    {
      id: "vtt" as const,
      name: "WebVTT Subtitle (.vtt)",
      desc: "Modern format commonly used on web platforms.",
    },
    {
      id: "txt" as const,
      name: "Plain Text (.txt)",
      desc: "Raw transcript text separated by newlines.",
    },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-500 hover:to-purple-500 text-white rounded-xl text-sm font-semibold transition-all duration-300 shadow-md shadow-primary-500/10 cursor-pointer select-none active:scale-[0.98]"
      >
        <Download size={15} />
        <span>Export</span>
        <ChevronDown size={14} className={`opacity-80 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-64 bg-slate-900/90 border border-white/[0.08] backdrop-blur-xl rounded-xl shadow-2xl z-30 py-1.5 overflow-hidden origin-top-right"
          >
            {formats.map((format) => (
              <button
                key={format.id}
                onClick={() => {
                  onExport(format.id);
                  setIsOpen(false);
                }}
                className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors flex items-start space-x-3 cursor-pointer"
              >
                <div className="p-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-primary-400 mt-0.5">
                  <FileText size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-200">{format.name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">{format.desc}</p>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

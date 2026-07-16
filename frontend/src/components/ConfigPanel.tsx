import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronDown, Check } from "lucide-react";

interface Option {
  value: string;
  label: string;
  badge?: string;
}

interface CustomSelectProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: Option[];
}

const CustomSelect: React.FC<CustomSelectProps> = ({ label, value, onChange, options }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = options.find((o) => o.value === value) || options[0];

  return (
    <div className="relative text-left" ref={containerRef}>
      <label className="block text-[11px] font-bold tracking-widest uppercase text-slate-500 mb-2 select-none">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.08] hover:border-primary-500/50 rounded-xl text-sm font-medium text-slate-200 transition-all duration-200 outline-none shadow-sm active:scale-[0.99] cursor-pointer"
      >
        <span className="truncate flex items-center space-x-2">
          <span>{selected.label}</span>
          {selected.badge && (
            <span className="bg-primary-500/20 text-primary-300 border border-primary-500/30 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
              {selected.badge}
            </span>
          )}
        </span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 ${isOpen ? "rotate-180 text-primary-400" : ""}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute top-[calc(100%+6px)] left-0 w-full bg-slate-900/90 border border-white/[0.08] rounded-xl py-1.5 shadow-2xl z-50 max-h-60 overflow-y-auto backdrop-blur-xl scrollbar-thin"
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors text-left hover:bg-white/5 hover:text-white cursor-pointer
                  ${
                    option.value === value
                      ? "text-primary-400 font-semibold bg-primary-500/5"
                      : "text-slate-350"
                  }`}
              >
                <span className="flex items-center space-x-2">
                  <span>{option.label}</span>
                  {option.badge && (
                    <span className="bg-primary-500/25 text-primary-300 text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase">
                      {option.badge}
                    </span>
                  )}
                </span>
                {option.value === value && <Check size={14} className="text-primary-400 shrink-0 ml-2" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface ConfigPanelProps {
  sourceLang: string;
  targetLang: string;
  onSourceLangChange: (lang: string) => void;
  onTargetLangChange: (lang: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  hasFile: boolean;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({
  sourceLang,
  targetLang,
  onSourceLangChange,
  onTargetLangChange,
  onGenerate,
  isGenerating,
  hasFile,
}) => {
  const sourceOptions: Option[] = [
    { value: "detect", label: "🔍 Auto-Detect" },
    { value: "ta", label: "🇮🇳 Tamil" },
    { value: "en", label: "🇬🇧 English" },
    { value: "hi", label: "🇮🇳 Hindi" },
    { value: "te", label: "🇮🇳 Telugu" },
    { value: "kn", label: "🇮🇳 Kannada" },
  ];

  const targetOptions: Option[] = [
    { value: "tanglish", label: "Tanglish", badge: "🔥 Trending" },
    { value: "tamil", label: "Tamil (தமிழ்)" },
    { value: "english", label: "English" },
    { value: "hindi", label: "Hindi (हिंदी)" },
    { value: "telugu", label: "Telugu (తెలుగు)" },
    { value: "kannada", label: "Kannada (ಕನ್ನಡ)" },
    { value: "french", label: "French (Français)" },
    { value: "spanish", label: "Spanish (Español)" },
    { value: "german", label: "German (Deutsch)" },
  ];

  return (
    <div className="glass-card rounded-2xl p-6 border border-white/[0.06] shadow-2xl space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <CustomSelect
          label="Audio Language"
          value={sourceLang}
          onChange={onSourceLangChange}
          options={sourceOptions}
        />
        <CustomSelect
          label="Caption Language"
          value={targetLang}
          onChange={onTargetLangChange}
          options={targetOptions}
        />
      </div>

      <motion.button
        onClick={onGenerate}
        disabled={!hasFile || isGenerating}
        whileHover={hasFile && !isGenerating ? { scale: 1.01, translateY: -2 } : {}}
        whileTap={hasFile && !isGenerating ? { scale: 0.99 } : {}}
        className={`w-full py-4 px-6 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all duration-300 relative overflow-hidden cursor-pointer select-none
          ${
            !hasFile || isGenerating
              ? "bg-white/[0.04] text-slate-500 border border-white/[0.04] cursor-not-allowed"
              : "bg-gradient-to-r from-primary-600 via-primary-500 to-cyan-500 text-white shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40"
          }`}
      >
        {isGenerating ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Generating...</span>
          </>
        ) : (
          <>
            <Sparkles size={16} className="text-cyan-300" />
            <span>Generate Captions</span>
          </>
        )}
      </motion.button>
    </div>
  );
};

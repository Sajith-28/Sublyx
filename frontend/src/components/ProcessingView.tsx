import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AudioWaveform, Mic, Languages, Clock, Check } from "lucide-react";

interface ProcessingViewProps {
  currentStep: number;
  targetLanguage: string;
  progressPct: number;
}

export const ProcessingView: React.FC<ProcessingViewProps> = ({
  currentStep,
  targetLanguage,
  progressPct,
}) => {
  const steps = [
    { label: "Extracting Audio", icon: AudioWaveform },
    { label: "Transcribing with Whisper", icon: Mic },
    { label: `Translating to ${targetLanguage}`, icon: Languages },
    { label: "Syncing Timestamps", icon: Clock },
  ];

  return (
    <div className="glass-card rounded-2xl p-8 border border-white/[0.06] shadow-2xl relative overflow-hidden max-w-md w-full">
      {/* Animated subtle grid/noise in card background */}
      <div className="absolute inset-0 bg-radial-[circle_at_center,rgba(99,102,241,0.05)_0%,transparent_100%] pointer-events-none" />

      <h3 className="text-xl font-bold gradient-text-brand mb-6 text-center tracking-tight">
        Generating Captions...
      </h3>

      <div className="space-y-6 relative z-10">
        {steps.map((step, idx) => {
          const StepIcon = step.icon;
          const isCompleted = idx < currentStep;
          const isActive = idx === currentStep;

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`flex items-center space-x-4 p-3 rounded-xl border transition-all duration-300
                ${
                  isCompleted
                    ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400"
                    : isActive
                    ? "bg-primary-500/10 border-primary-500/30 text-primary-400 shadow-lg shadow-primary-500/5 font-semibold"
                    : "bg-white/[0.01] border-white/[0.04] text-slate-500"
                }`}
            >
              <div className="relative">
                {isActive && (
                  <motion.div
                    className="absolute -inset-1.5 bg-primary-500/30 rounded-full blur"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  />
                )}
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center relative z-10 transition-colors duration-300
                    ${
                      isCompleted
                        ? "bg-emerald-500/20 text-emerald-400"
                        : isActive
                        ? "bg-primary-500/25 text-primary-300"
                        : "bg-white/[0.03] text-slate-600"
                    }`}
                >
                  {isCompleted ? <Check className="w-5 h-5" /> : <StepIcon className="w-5 h-5" />}
                </div>
              </div>

              <div className="flex-1">
                <p className="text-sm tracking-wide">{step.label}</p>
              </div>

              <AnimatePresence>
                {isActive && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-xs bg-primary-500/20 text-primary-300 px-2.5 py-0.5 rounded-full font-mono font-medium animate-pulse"
                  >
                    Processing
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Progress slider bar */}
      <div className="mt-8 space-y-2 relative z-10">
        <div className="flex justify-between items-center text-xs font-mono text-slate-400 px-1">
          <span>PIPELINE PROGRESS</span>
          <span className="font-bold text-white">{Math.round(progressPct)}%</span>
        </div>
        <div className="h-2 w-full bg-white/[0.04] border border-white/[0.06] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary-500 via-purple-500 to-cyan-500 animate-gradient-x"
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ ease: "easeOut", duration: 0.5 }}
          />
        </div>
      </div>
    </div>
  );
};

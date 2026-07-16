import React from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface ProcessingStepperProps {
  status: string;
  progressPct: number;
  error: string | null;
}

export const ProcessingStepper: React.FC<ProcessingStepperProps> = ({ status, progressPct, error }) => {
  const steps = [
    { key: "queued", label: "Queued", range: [0, 9] },
    { key: "extracting_audio", label: "Audio Extraction", range: [10, 19] },
    { key: "transcribing", label: "Speech Transcription", range: [20, 79] },
    { key: "transliterating", label: "Tanglish Transliteration", range: [80, 95] },
    { key: "done", label: "Done", range: [100, 100] }
  ];

  const getStepState = (_stepKey: string, stepRange: number[]) => {
    if (status === "failed") {
      if (progressPct >= stepRange[0] && progressPct <= stepRange[1]) return "failed";
      if (progressPct > stepRange[1]) return "completed";
      return "pending";
    }
    if (status === "done") return "completed";
    if (progressPct >= stepRange[0] && progressPct <= stepRange[1]) return "active";
    if (progressPct > stepRange[1]) return "completed";
    return "pending";
  };

  return (
    <div className="w-full max-w-2xl mx-auto glass rounded-3xl p-8 shadow-xl">
      <h3 className="text-2xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-primary-400 mb-2">
        Processing Video...
      </h3>
      <p className="text-slate-500 dark:text-slate-400 text-center text-sm mb-8">
        This can take a few minutes for longer videos. Please keep this tab open.
      </p>

      {/* Progress Bar */}
      <div className="mb-8 space-y-2">
        <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
          <div 
            className={`h-full transition-all duration-700 ease-out ${status === 'failed' ? 'bg-red-500' : 'bg-gradient-to-r from-primary-500 to-primary-400'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="text-right">
          <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">{progressPct}%</span>
        </div>
      </div>

      {/* Stepper Timeline */}
      <div className="relative space-y-4">
        {steps.map((step, idx) => {
          const state = getStepState(step.key, step.range);
          return (
            <div key={step.key} className="flex items-start">
              <div className="flex flex-col items-center mr-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors z-10 bg-white dark:bg-slate-900
                  ${state === 'completed' ? 'border-primary-500 text-primary-500' : ''}
                  ${state === 'active' ? 'border-primary-500 text-primary-500 shadow-md shadow-primary-500/20' : ''}
                  ${state === 'failed' ? 'border-red-500 text-red-500' : ''}
                  ${state === 'pending' ? 'border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600' : ''}
                `}>
                  {state === "completed" && <CheckCircle2 size={16} />}
                  {state === "active" && <Loader2 size={16} className="animate-spin" />}
                  {state === "failed" && <AlertCircle size={16} />}
                  {state === "pending" && <div className="w-2 h-2 rounded-full bg-current" />}
                </div>
                {idx < steps.length - 1 && (
                  <div className={`w-0.5 h-8 mt-2 rounded-full ${progressPct > step.range[1] ? 'bg-primary-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
                )}
              </div>
              <div className="pt-1.5 flex flex-col pb-4">
                <span className={`font-medium text-sm transition-colors
                  ${state === 'active' ? 'text-slate-900 dark:text-white font-semibold' : ''}
                  ${state === 'completed' ? 'text-slate-700 dark:text-slate-300' : ''}
                  ${state === 'failed' ? 'text-red-600 dark:text-red-400' : ''}
                  ${state === 'pending' ? 'text-slate-400 dark:text-slate-600' : ''}
                `}>
                  {step.label}
                </span>
                <span className="text-xs text-slate-500 mt-0.5">
                  {state === "completed" && "Completed"}
                  {state === "active" && "Processing..."}
                  {state === "failed" && "Failed"}
                  {state === "pending" && "Pending"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Error Message */}
      {status === "failed" && error && (
        <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start space-x-3 text-red-700 dark:text-red-400">
          <AlertCircle size={20} className="shrink-0 mt-0.5" />
          <div className="text-sm">
            <strong className="block font-semibold mb-1">Processing Error</strong>
            <p>{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};

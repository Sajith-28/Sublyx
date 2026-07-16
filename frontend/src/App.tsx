import React, { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Film, ArrowLeft, Zap } from "lucide-react";

import { Background3D } from "./components/Background3D";
import { UploadZone } from "./components/UploadZone";
import { ConfigPanel } from "./components/ConfigPanel";
import { ProcessingView } from "./components/ProcessingView";
import { Workspace } from "./components/Workspace";
import { ToastProvider, useToast } from "./components/Toast";
import { RecentJobs } from "./components/RecentJobs";

// ------ Types ------
import type { CaptionSegment } from "./types";

type AppPhase = "upload" | "processing" | "workspace";

// ------ API Base ------
const API_BASE = "";

// ------ Inner App (needs toast context) ------
const AppInner: React.FC = () => {
  const { addToast } = useToast();

  // Phase management
  const [phase, setPhase] = useState<AppPhase>("upload");

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceLang, setSourceLang] = useState("ta");
  const [targetLang, setTargetLang] = useState("tanglish");

  // Processing state
  const [processingStep, setProcessingStep] = useState(0);
  const [progressPct, setProgressPct] = useState(0);

  // Workspace state
  const [segments, setSegments] = useState<CaptionSegment[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // ---------- File handling ----------
  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
  }, []);

  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null);
  }, []);

  // ---------- Generate captions ----------
  const handleGenerate = useCallback(async () => {
    if (!selectedFile) return;

    setPhase("processing");
    setProcessingStep(0);
    setProgressPct(0);

    // Try real backend first, fallback to mock
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("source_lang", sourceLang);
      formData.append("target_lang", targetLang);

      const response = await fetch(`${API_BASE}/api/jobs`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      const data = await response.json();
      const jobId = data.job_id;
      setActiveJobId(jobId);

      let stepIdx = 0;

      const pollInterval = setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE}/api/jobs/${jobId}`);
          if (!res.ok) throw new Error("Poll failed");
          const jobData = await res.json();

          const pct = jobData.progress_pct || 0;
          setProgressPct(pct);

          // Map progress to steps
          if (pct >= 25 && stepIdx < 1) { stepIdx = 1; setProcessingStep(1); }
          if (pct >= 50 && stepIdx < 2) { stepIdx = 2; setProcessingStep(2); }
          if (pct >= 75 && stepIdx < 3) { stepIdx = 3; setProcessingStep(3); }

          if (jobData.status === "done") {
            clearInterval(pollInterval);
            setProcessingStep(4);
            setProgressPct(100);

            // Fetch segments
            const segRes = await fetch(`${API_BASE}/api/jobs/${jobId}/segments`);
            if (!segRes.ok) throw new Error("Segments failed");
            const segData = await segRes.json();

            const mappedSegments: CaptionSegment[] = segData.map((seg: any) => ({
              id: seg.id,
              index: seg.index,
              start: seg.start_ms / 1000,
              end: seg.end_ms / 1000,
              text: seg.caption_text,
            }));

            setSegments(mappedSegments);
            setVideoUrl(`${API_BASE}/api/jobs/${jobId}/audio`);

            setTimeout(() => {
              setPhase("workspace");
              addToast("Captions generated successfully!", "success");
            }, 600);
          } else if (jobData.status === "failed") {
            clearInterval(pollInterval);
            addToast(`Processing failed: ${jobData.error || "Unknown error"}`, "error");
            setPhase("upload");
          }
        } catch (pollErr) {
          console.error("Polling error:", pollErr);
          // Silently continue polling, the server might just be restarting
        }
      }, 2000);
    } catch (e: any) {
      console.error("Failed to generate:", e);
      addToast(e.message || "Failed to connect to the server. Please ensure the backend is running.", "error");
      setPhase("upload");
    }
  }, [selectedFile, sourceLang, targetLang, addToast]);

  // ---------- Load existing job ----------
  const handleSelectJob = useCallback(async (jobId: string) => {
    try {
      setPhase("processing");
      setProcessingStep(4);
      setProgressPct(100);
      setActiveJobId(jobId);
      
      const res = await fetch(`${API_BASE}/api/jobs/${jobId}`);
      if (!res.ok) throw new Error("Failed to fetch job");
      const jobData = await res.json();
      
      if (jobData.status === "done") {
        const segRes = await fetch(`${API_BASE}/api/jobs/${jobId}/segments`);
        if (!segRes.ok) throw new Error("Segments failed");
        const segData = await segRes.json();
        
        const mappedSegments: CaptionSegment[] = segData.map((seg: any) => ({
          id: seg.id,
          index: seg.index,
          start: seg.start_ms / 1000,
          end: seg.end_ms / 1000,
          text: seg.caption_text,
        }));
        
        setSegments(mappedSegments);
        setVideoUrl(`${API_BASE}/api/jobs/${jobId}/audio`);
        setPhase("workspace");
        addToast("Loaded project successfully!", "success");
      } else {
        addToast("Job is not finished yet", "info");
        setPhase("upload");
      }
    } catch (e) {
      addToast("Error loading project", "error");
      setPhase("upload");
    }
  }, [addToast]);

  // ---------- Segment update ----------
  const handleUpdateSegment = useCallback(
    async (id: string, newText: string) => {
      setSegments((prev) =>
        prev.map((seg) => (seg.id === id ? { ...seg, text: newText } : seg))
      );

      // Try to update on backend
      if (activeJobId) {
        try {
          await fetch(`${API_BASE}/api/jobs/${activeJobId}/segments/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ caption_text: newText }),
          });
        } catch {
          // Silently fail for mock mode
        }
      }
    },
    [activeJobId]
  );

  // ---------- Export ----------
  const handleExport = useCallback(
    (format: "srt" | "vtt" | "txt") => {
      if (activeJobId) {
        // Real backend export
        window.location.href = `${API_BASE}/api/jobs/${activeJobId}/export?format=${format}`;
        addToast(`Downloading ${format.toUpperCase()} file...`, "success");
      } else {
        addToast("Cannot export: No active job.", "error");
      }
    },
    [activeJobId, addToast]
  );

  // ---------- Reset ----------
  const resetApp = useCallback(() => {
    setPhase("upload");
    setSelectedFile(null);
    setSegments([]);
    setVideoUrl("");
    setActiveJobId(null);
    setProcessingStep(0);
    setProgressPct(0);
  }, []);

  // ---------- Language label helper ----------
  const getTargetLabel = (val: string) => {
    const map: Record<string, string> = {
      tanglish: "Tanglish",
      tamil: "Tamil",
      english: "English",
      hindi: "Hindi",
      telugu: "Telugu",
      kannada: "Kannada",
      french: "French",
      spanish: "Spanish",
      german: "German",
    };
    return map[val] || val;
  };

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* 3D Background */}
      <Background3D />

      {/* Main UI Layer */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="glass-strong sticky top-0 z-50 border-b border-white/[0.06]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <motion.div
              className="flex items-center space-x-3 cursor-pointer group"
              onClick={resetApp}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-primary-500/20 group-hover:shadow-primary-500/40 transition-shadow duration-300">
                <Film size={18} className="text-white" />
              </div>
              <h1 className="text-lg font-bold gradient-text-brand tracking-tight">
                Sublyx
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-500/10 text-primary-400 border border-primary-500/20">
                <Zap size={10} className="mr-1" />
                BETA
              </span>
            </motion.div>

            <AnimatePresence>
              {phase !== "upload" && (
                <motion.button
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200"
                  onClick={resetApp}
                >
                  <ArrowLeft size={16} />
                  <span className="hidden sm:inline">New Project</span>
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col">
          <AnimatePresence mode="wait">
            {phase === "upload" && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12"
              >
                <div className="w-full max-w-2xl mx-auto space-y-6">
                  {/* Hero text */}
                  <div className="text-center space-y-3 mb-8">
                    <motion.h2
                      className="text-4xl sm:text-5xl font-extrabold gradient-text leading-tight"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      AI Video Captions
                    </motion.h2>
                    <motion.p
                      className="text-slate-400 text-lg max-w-md mx-auto"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      Upload a video, choose your language, and get precise
                      captions powered by Whisper AI.
                    </motion.p>
                  </div>

                  {/* Upload Zone */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <UploadZone
                      onFileSelect={handleFileSelect}
                      selectedFile={selectedFile}
                      onRemoveFile={handleRemoveFile}
                    />
                  </motion.div>

                  {/* Config Panel - slides in when file is selected */}
                  <AnimatePresence>
                    {selectedFile && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                      >
                        <ConfigPanel
                          sourceLang={sourceLang}
                          targetLang={targetLang}
                          onSourceLangChange={setSourceLang}
                          onTargetLangChange={setTargetLang}
                          onGenerate={handleGenerate}
                          isGenerating={false}
                          hasFile={!!selectedFile}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Recent Jobs */}
                  {!selectedFile && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      <RecentJobs onSelectJob={handleSelectJob} />
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {phase === "processing" && (
              <motion.div
                key="processing"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12"
              >
                <div className="w-full max-w-lg mx-auto">
                  <ProcessingView
                    currentStep={processingStep}
                    targetLanguage={getTargetLabel(targetLang)}
                    progressPct={progressPct}
                  />
                </div>
              </motion.div>
            )}

            {phase === "workspace" && (
              <motion.div
                key="workspace"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="flex-1"
              >
                <Workspace
                  videoUrl={videoUrl}
                  segments={segments}
                  onUpdateSegment={handleUpdateSegment}
                  onExport={handleExport}
                  onBack={resetApp}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer className="border-t border-white/[0.04] py-6 mt-auto">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-slate-600 text-sm flex items-center justify-center space-x-2">
              <span className="gradient-text-brand font-semibold">Sublyx</span>
              <span className="w-1 h-1 rounded-full bg-slate-700" />
              <span>AI-Powered Multi-Language Video Captioning</span>
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

// ------ Root App with Providers ------
const App: React.FC = () => (
  <ToastProvider>
    <AppInner />
  </ToastProvider>
);

export default App;

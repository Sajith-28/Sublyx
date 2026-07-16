import React, { useState } from "react";
import { Copy, Check, Search, Download, FileText, Globe } from "lucide-react";

interface Segment {
  id: string;
  job_id: string;
  index: number;
  start_ms: number;
  end_ms: number;
  detected_language: string;
  raw_text: string;
  caption_text: string;
  edited: boolean;
  confidence: number;
}

interface CaptionViewerProps {
  segments: Segment[];
  onUpdateSegment: (segmentId: string, newText: string) => Promise<void>;
  onExport: (format: string) => void;
}

export const CaptionViewer: React.FC<CaptionViewerProps> = ({ segments: initialSegments, onUpdateSegment, onExport }) => {
  const [segments, setSegments] = useState<Segment[]>(initialSegments);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedLineId, setCopiedLineId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  React.useEffect(() => {
    setSegments(initialSegments);
  }, [initialSegments]);

  const formatTime = (ms: number) => {
    const total_sec = Math.floor(ms / 1000);
    const msec = ms % 1000;
    const sec = total_sec % 60;
    const min = Math.floor(total_sec / 60) % 60;
    const hrs = Math.floor(total_sec / 3600);
    
    const pad = (num: number) => String(num).padStart(2, "0");
    const padMs = (num: number) => String(num).padStart(3, "0");
    
    if (hrs > 0) return `${pad(hrs)}:${pad(min)}:${pad(sec)},${padMs(msec)}`;
    return `${pad(min)}:${pad(sec)},${padMs(msec)}`;
  };

  const handleTextChange = (id: string, newText: string) => {
    setSegments(prev => prev.map(seg => seg.id === id ? { ...seg, caption_text: newText } : seg));
  };

  const handleBlur = async (id: string, originalText: string, currentText: string) => {
    if (originalText === currentText) return;
    setSavingId(id);
    try {
      await onUpdateSegment(id, currentText);
      setSegments(prev => prev.map(seg => seg.id === id ? { ...seg, edited: true } : seg));
    } catch (e) {
      console.error("Failed to save segment edit:", e);
      alert("Failed to save edit.");
    } finally {
      setSavingId(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLineId(id);
    setTimeout(() => setCopiedLineId(null), 1500);
  };

  const copyAllCaptions = () => {
    const fullTranscript = segments.map(seg => seg.caption_text).join("\n");
    navigator.clipboard.writeText(fullTranscript);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const filteredSegments = segments.filter(seg => 
    seg.caption_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    seg.raw_text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getLangBadgeStyle = (lang: string) => {
    switch (lang.toLowerCase()) {
      case "ta":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "en":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "mixed":
        return "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-800";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    }
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg overflow-hidden flex flex-col h-[700px]">
      {/* Header controls */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:max-w-xs">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-slate-400" />
          </div>
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all text-sm outline-none"
            placeholder="Search captions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <button 
            type="button" 
            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors text-slate-700 dark:text-slate-200"
            onClick={copyAllCaptions}
          >
            {copiedAll ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
            <span>{copiedAll ? "Copied All!" : "Copy Transcript"}</span>
          </button>
          
          <div className="relative flex-1 sm:flex-none">
            <button 
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
              onClick={() => setExportOpen(!exportOpen)}
            >
              <Download size={16} />
              <span>Export</span>
            </button>
            
            {exportOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)}></div>
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 py-1 overflow-hidden origin-top-right animate-in fade-in zoom-in-95 duration-200">
                  <button 
                    onClick={() => { onExport("srt"); setExportOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center space-x-2 text-slate-700 dark:text-slate-200"
                  >
                    <FileText size={14} className="text-slate-400" /> <span>SRT (.srt)</span>
                  </button>
                  <button 
                    onClick={() => { onExport("vtt"); setExportOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center space-x-2 text-slate-700 dark:text-slate-200"
                  >
                    <FileText size={14} className="text-slate-400" /> <span>WebVTT (.vtt)</span>
                  </button>
                  <button 
                    onClick={() => { onExport("txt"); setExportOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center space-x-2 text-slate-700 dark:text-slate-200"
                  >
                    <FileText size={14} className="text-slate-400" /> <span>Plain Text (.txt)</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Captions list */}
      <div className="flex-1 overflow-hidden flex flex-col bg-white dark:bg-slate-900">
        <div className="grid grid-cols-[40px_160px_60px_1fr_40px] md:grid-cols-[60px_180px_80px_1fr_60px] gap-2 md:gap-4 p-3 md:p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <div className="text-center">#</div>
          <div>Time</div>
          <div className="text-center">Lang</div>
          <div>Caption Text</div>
          <div></div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
          {filteredSegments.length > 0 ? (
            filteredSegments.map((seg) => (
              <div key={seg.id} className="grid grid-cols-[40px_160px_60px_1fr_40px] md:grid-cols-[60px_180px_80px_1fr_60px] gap-2 md:gap-4 p-2 md:p-3 items-start rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                <div className="text-center text-slate-400 dark:text-slate-500 font-mono text-sm mt-2">{seg.index + 1}</div>
                
                <div className="font-mono text-xs text-slate-500 dark:text-slate-400 flex flex-col md:flex-row md:items-center mt-2.5">
                  <span className="bg-slate-100 dark:bg-slate-800 px-1.5 rounded">{formatTime(seg.start_ms)}</span>
                  <span className="mx-1 hidden md:inline text-slate-300 dark:text-slate-600">→</span>
                  <span className="bg-slate-100 dark:bg-slate-800 px-1.5 rounded mt-1 md:mt-0">{formatTime(seg.end_ms)}</span>
                </div>
                
                <div className="text-center mt-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getLangBadgeStyle(seg.detected_language)}`}>
                    {seg.detected_language.toUpperCase()}
                  </span>
                </div>
                
                <div className="flex flex-col min-w-0">
                  <div className="relative w-full group/input">
                    <input
                      type="text"
                      className={`w-full bg-transparent px-3 py-2 text-[15px] text-slate-900 dark:text-slate-100 rounded-lg outline-none border focus:ring-2 transition-all
                        ${savingId === seg.id ? 'border-primary-300 ring-2 ring-primary-100 dark:border-primary-700 dark:ring-primary-900' : 'border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-primary-500 focus:bg-white dark:focus:bg-slate-950'}`}
                      value={seg.caption_text}
                      onChange={(e) => handleTextChange(seg.id, e.target.value)}
                      onBlur={() => {
                        const original = initialSegments.find(s => s.id === seg.id)?.caption_text || "";
                        handleBlur(seg.id, original, seg.caption_text);
                      }}
                    />
                    <div className="absolute right-2 top-2.5 flex items-center space-x-1.5">
                      {seg.edited && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 rounded" title="Edited manually">
                          Edited
                        </span>
                      )}
                      {savingId === seg.id && (
                        <span className="text-[10px] text-primary-500 animate-pulse font-medium">Saving...</span>
                      )}
                    </div>
                  </div>
                  {seg.detected_language !== "en" && (
                    <div className="flex items-center space-x-1.5 px-3 py-1 mt-1 text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded inline-flex self-start">
                      <Globe size={12} className="opacity-70" />
                      <span className="truncate max-w-full" title={seg.raw_text}>{seg.raw_text}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-center mt-2">
                  <button
                    type="button"
                    className="p-1.5 text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                    onClick={() => copyToClipboard(seg.caption_text, seg.id)}
                    title="Copy line"
                  >
                    {copiedLineId === seg.id ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500 space-y-3">
              <Search size={32} className="opacity-20" />
              <p>{segments.length === 0 ? "No speech detected in this video." : "No captions matched your search query."}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

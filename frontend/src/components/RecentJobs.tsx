import React, { useEffect, useState } from 'react';
import { Clock, Play, FileText, AlertCircle } from 'lucide-react';

interface Job {
  id: string;
  status: string;
  progress_pct: number;
  video_path: string;
  duration_sec: number;
  created_at: string;
  source_lang?: string;
  target_lang?: string;
}

interface RecentJobsProps {
  onSelectJob: (jobId: string) => void;
}

const API_BASE = import.meta.env.VITE_API_BASE || "";

// Helper to map codes to display names
const getLangLabel = (code: string) => {
  const mapping: Record<string, string> = {
    ta: "Tamil",
    detect: "Auto-Detect",
    en: "English",
    hi: "Hindi",
    te: "Telugu",
    kn: "Kannada",
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
  return mapping[code.toLowerCase()] || code;
};

export const RecentJobs: React.FC<RecentJobsProps> = ({ onSelectJob }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/jobs`);
        if (res.ok) {
          const data = await res.json();
          setJobs(data);
        }
      } catch (e) {
        console.error("Failed to fetch jobs history:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();
  }, []);

  if (loading || jobs.length === 0) return null;

  return (
    <div className="mt-12 w-full animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 fill-mode-both">
      <div className="flex items-center space-x-2 mb-4 px-2">
        <Clock size={18} className="text-slate-400" />
        <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300">Recent Uploads</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {jobs.map((job) => {
          // Extract filename from path
          const filename = job.video_path.split(/[\\/]/).pop() || "Unknown Video";
          const date = new Date(job.created_at).toLocaleDateString(undefined, { 
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
          });
          
          const source = job.source_lang ? getLangLabel(job.source_lang) : "Tamil";
          const target = job.target_lang ? getLangLabel(job.target_lang) : "Tanglish";
          
          return (
            <div 
              key={job.id}
              onClick={() => onSelectJob(job.id)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-primary-400 dark:hover:border-primary-600 hover:shadow-md transition-all group"
            >
              <div className="flex items-center space-x-4 overflow-hidden">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  job.status === 'done' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                  job.status === 'failed' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                  'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                }`}>
                  {job.status === 'done' ? <FileText size={20} /> :
                   job.status === 'failed' ? <AlertCircle size={20} /> :
                   <Play size={20} />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate pr-4">
                    {filename}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {date} • {source} → {target} • {job.status === 'done' ? 'Completed' : job.status === 'failed' ? 'Failed' : 'Processing...'}
                  </p>
                </div>
              </div>
              <div className="text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity">
                <Play size={18} className="fill-current" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

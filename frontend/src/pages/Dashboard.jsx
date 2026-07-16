import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Film, Loader2, LogOut, Play, Plus, RefreshCcw, Trash2 } from "lucide-react";

import { Background3D } from "../components/Background3D";
import { useToast } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

const formatDate = (value) =>
  new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));

const getProjectInitials = (name) =>
  (name || "Project")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export const Dashboard = ({ onNewProject, onOpenProject }) => {
  const { addToast } = useToast();
  const { signOut, user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");

  const userLabel = useMemo(() => user?.email ?? "Account", [user]);

  const fetchProjects = useCallback(
    async ({ silent = false } = {}) => {
      if (!supabase || !user) {
        setLoading(false);
        return;
      }

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      try {
        const { data, error: fetchError } = await supabase
          .from("projects")
          .select("id, user_id, project_name, video_url, captions_data, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (fetchError) throw fetchError;
        setProjects(data ?? []);
      } catch (projectError) {
        console.error("Failed to load projects:", projectError);
        setError("Could not load your saved projects. Please try again.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user]
  );

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  const handleDelete = async (event, projectId) => {
    event.stopPropagation();
    if (!supabase || !user) return;

    setDeletingId(projectId);
    setError("");
    try {
      const { error: deleteError } = await supabase
        .from("projects")
        .delete()
        .eq("id", projectId)
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;
      setProjects((current) => current.filter((project) => project.id !== projectId));
      addToast("Project deleted.", "success");
    } catch (deleteError) {
      console.error("Failed to delete project:", deleteError);
      setError("Could not delete this project.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    const { error: signOutError } = await signOut();
    if (signOutError) {
      setError("Could not sign out. Please try again.");
      setSigningOut(false);
      return;
    }
    addToast("Signed out.", "success");
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Background3D />
      <div className="relative z-10 min-h-screen px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
          <header className="glass-strong flex flex-col gap-4 rounded-2xl border border-white/[0.08] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-cyan-500 shadow-lg shadow-primary-500/20">
                <Film className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-lg font-bold gradient-text-brand">Sublyx</p>
                <p className="max-w-[260px] truncate text-xs text-slate-500 sm:max-w-none">
                  {userLabel}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={refreshing}
                onClick={() => fetchProjects({ silent: true })}
                title="Refresh projects"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-400 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
              <button
                type="button"
                onClick={onNewProject}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-cyan-600 px-4 text-sm font-bold text-white shadow-lg shadow-primary-500/20 transition hover:from-primary-500 hover:to-cyan-500"
              >
                <Plus className="h-4 w-4" />
                New Project
              </button>
              <button
                type="button"
                disabled={signingOut}
                onClick={handleSignOut}
                title="Sign out"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-400 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              </button>
            </div>
          </header>

          <section>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="mb-6"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-300/80">
                Project Memory
              </p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Your caption projects
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                Pick up saved caption timelines or start a fresh upload.
              </p>
            </motion.div>

            {error && (
              <div className="mb-5 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200">
                {error}
              </div>
            )}

            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-64 rounded-2xl border border-white/[0.06] bg-white/[0.03] shimmer" />
                ))}
              </div>
            ) : projects.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/[0.12] bg-white/[0.03] p-8 text-center backdrop-blur-xl"
              >
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary-400/20 bg-primary-400/10 text-primary-300">
                  <Film className="h-7 w-7" />
                </div>
                <h2 className="text-xl font-bold text-white">No saved projects yet</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
                  Create your first caption project and it will appear here automatically.
                </p>
                <button
                  type="button"
                  onClick={onNewProject}
                  className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-white text-sm font-bold text-slate-950 px-5 transition hover:bg-slate-100"
                >
                  <Plus className="h-4 w-4" />
                  New Project
                </button>
              </motion.div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((project, index) => (
                  <motion.article
                    key={project.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04, duration: 0.3, ease: "easeOut" }}
                    onClick={() => onOpenProject(project)}
                    className="group cursor-pointer overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] shadow-2xl shadow-black/20 backdrop-blur-xl transition hover:-translate-y-1 hover:border-primary-400/35 hover:bg-white/[0.06]"
                  >
                    <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-primary-950/50 to-cyan-950/40">
                      <div className="absolute inset-0 bg-radial-[circle_at_center,rgba(255,255,255,0.12)_0%,transparent_60%]" />
                      <div className="absolute left-4 top-4 rounded-full border border-white/[0.1] bg-black/30 px-3 py-1 text-xs font-semibold text-slate-300 backdrop-blur">
                        {Array.isArray(project.captions_data) ? project.captions_data.length : 0} captions
                      </div>
                      <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-white/[0.12] bg-white/[0.08] text-2xl font-black text-white shadow-xl">
                        {getProjectInitials(project.project_name)}
                      </div>
                      <div className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-950 opacity-0 shadow-lg transition group-hover:opacity-100">
                        <Play className="h-4 w-4 fill-current" />
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="truncate text-base font-bold text-slate-100">
                            {project.project_name || "Untitled Project"}
                          </h2>
                          <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(project.created_at)}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={deletingId === project.id}
                          onClick={(event) => handleDelete(event, project.id)}
                          title="Delete project"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-500 opacity-0 transition hover:border-rose-400/30 hover:bg-rose-500/10 hover:text-rose-300 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingId === project.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

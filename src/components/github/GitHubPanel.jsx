import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  Github, GitBranch, GitCommit, Star, GitFork,
  ExternalLink, RefreshCw, Lock, AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * GitHubPanel — connects to GitHub via the Base44 platform connector
 * and calls the githubProxy backend function for all API requests.
 *
 * Usage: <GitHubPanel />  or  <GitHubPanel className="..." />
 */
export default function GitHubPanel({ className }) {
  const [state, setState] = useState('loading'); // loading | disconnected | connected | error
  const [profile, setProfile] = useState(null);
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [commits, setCommits] = useState([]);
  const [loadingCommits, setLoadingCommits] = useState(false);

  useEffect(() => {
    init();
  }, []);

  const invoke = (action, extra = {}) =>
    base44.functions.invoke('githubProxy', { action, ...extra });

  const init = async () => {
    setState('loading');
    try {
      const res = await invoke('profile');
      if (res?.data?.login) {
        setProfile(res.data);
        loadRepos();
        setState('connected');
      } else {
        setState('disconnected');
      }
    } catch (e) {
      // 401 = not connected, anything else = error
      if (e?.status === 401 || e?.message?.includes('not connected')) {
        setState('disconnected');
      } else {
        setState('error');
      }
    }
  };

  const loadRepos = async () => {
    try {
      const res = await invoke('repos', { per_page: 20 });
      if (Array.isArray(res?.data)) setRepos(res.data);
    } catch (_) {}
  };

  const loadCommits = async (repo) => {
    setSelectedRepo(repo);
    setCommits([]);
    setLoadingCommits(true);
    try {
      const res = await invoke('commits', { repo: repo.full_name, per_page: 10 });
      if (Array.isArray(res?.data)) setCommits(res.data);
    } catch (_) {}
    setLoadingCommits(false);
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  // ── Loading ──
  if (state === 'loading') {
    return (
      <div className={cn('rounded-2xl border border-border/60 bg-card p-8 text-center', className)}>
        <RefreshCw className="w-7 h-7 text-primary mx-auto mb-3 animate-spin" />
        <p className="text-sm text-muted-foreground">Connecting to GitHub…</p>
      </div>
    );
  }

  // ── Not connected ──
  if (state === 'disconnected') {
    return (
      <div className={cn('rounded-2xl border border-border/60 bg-card p-8 text-center', className)}>
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Github className="w-7 h-7 text-primary" />
        </div>
        <h3 className="font-bold text-lg mb-1">Connect GitHub</h3>
        <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
          Link your GitHub account to browse repos and recent commits inside AuraDJ.
        </p>
        <p className="text-xs text-muted-foreground">
          Connect via <span className="font-medium text-foreground">Profile → Services → GitHub</span>
        </p>
      </div>
    );
  }

  // ── Error ──
  if (state === 'error') {
    return (
      <div className={cn('rounded-2xl border border-destructive/30 bg-card p-8 text-center', className)}>
        <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
        <p className="text-sm font-medium mb-1">Something went wrong</p>
        <p className="text-xs text-muted-foreground mb-4">Could not load GitHub data</p>
        <Button size="sm" variant="outline" className="rounded-full gap-2" onClick={init}>
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </Button>
      </div>
    );
  }

  // ── Connected ──
  return (
    <div className={cn('rounded-2xl border border-border/60 bg-card overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/40">
        <div className="flex items-center gap-3">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Github className="w-4 h-4 text-primary" />
            </div>
          )}
          <div>
            <p className="font-semibold text-sm leading-tight">{profile?.name || profile?.login}</p>
            <p className="text-xs text-muted-foreground">
              @{profile?.login} · {profile?.public_repos} repos
            </p>
          </div>
        </div>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-full" onClick={init}>
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Body: repo list + commit viewer */}
      <div className="flex divide-x divide-border/40" style={{ minHeight: '18rem', maxHeight: '22rem' }}>
        {/* Repo list */}
        <div className="w-1/2 overflow-y-auto">
          {repos.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />
            </div>
          ) : repos.map((repo) => (
            <button
              key={repo.id}
              onClick={() => loadCommits(repo)}
              className={cn(
                'w-full text-left px-4 py-3 hover:bg-secondary/60 transition-colors border-b border-border/20 last:border-0',
                selectedRepo?.id === repo.id && 'bg-primary/5 border-l-2 border-l-primary'
              )}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                {repo.private
                  ? <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  : <GitBranch className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                }
                <span className="text-sm font-medium truncate">{repo.name}</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                {repo.language && <span>{repo.language}</span>}
                <span className="flex items-center gap-0.5">
                  <Star className="w-3 h-3" />{repo.stargazers_count}
                </span>
                <span className="flex items-center gap-0.5">
                  <GitFork className="w-3 h-3" />{repo.forks_count}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Commit viewer */}
        <div className="w-1/2 overflow-y-auto">
          {!selectedRepo ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 py-8">
              <GitCommit className="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">Select a repo to see recent commits</p>
            </div>
          ) : loadingCommits ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />
            </div>
          ) : (
            <div>
              <div className="px-4 py-2.5 border-b border-border/40 flex items-center justify-between sticky top-0 bg-card z-10">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate max-w-[120px]">
                  {selectedRepo.name}
                </p>
                <a
                  href={selectedRepo.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 flex-shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              {commits.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No commits found</p>
              ) : commits.map((commit, i) => (
                <motion.div
                  key={commit.sha}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="px-4 py-2.5 border-b border-border/20 last:border-0 hover:bg-secondary/40 transition-colors"
                >
                  <p className="text-xs font-medium leading-tight mb-1 line-clamp-2">
                    {commit.commit.message.split('\n')[0]}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                    <span className="font-mono bg-muted px-1 py-0.5 rounded">
                      {commit.sha.slice(0, 7)}
                    </span>
                    <span className="truncate max-w-[80px]">{commit.commit.author?.name}</span>
                    <span className="ml-auto">{timeAgo(commit.commit.author?.date)}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

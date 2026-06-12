import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Github, GitBranch, GitCommit, Star, GitFork, ExternalLink, RefreshCw, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * GitHubPanel — displays the app user's connected GitHub repos & recent commits.
 * Uses the workspace GitHub connector (BYO OAuth app registered in Base44 settings).
 *
 * Drop into any page: <GitHubPanel />
 */
export default function GitHubPanel({ className }) {
  const [state, setState] = useState('idle'); // idle | connecting | connected | error
  const [profile, setProfile] = useState(null);
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [commits, setCommits] = useState([]);
  const [loading, setLoading] = useState(false);

  // Check if user already has GitHub connected
  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const result = await base44.connectors.getConnection('github');
      if (result?.accessToken) {
        setState('connected');
        fetchProfile(result.accessToken);
        fetchRepos(result.accessToken);
      }
    } catch {
      setState('idle');
    }
  };

  const connect = async () => {
    setState('connecting');
    try {
      await base44.connectors.connect('github');
      await checkConnection();
    } catch (e) {
      setState('error');
    }
  };

  const fetchProfile = async (token) => {
    const r = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
    });
    if (r.ok) setProfile(await r.json());
  };

  const fetchRepos = async (token) => {
    setLoading(true);
    const r = await fetch('https://api.github.com/user/repos?sort=updated&per_page=20', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
    });
    if (r.ok) setRepos(await r.json());
    setLoading(false);
  };

  const fetchCommits = async (repo) => {
    setSelectedRepo(repo);
    setCommits([]);
    try {
      const conn = await base44.connectors.getConnection('github');
      const r = await fetch(`https://api.github.com/repos/${repo.full_name}/commits?per_page=10`, {
        headers: { Authorization: `Bearer ${conn.accessToken}`, Accept: 'application/vnd.github+json' }
      });
      if (r.ok) setCommits(await r.json());
    } catch {}
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  // ── Not connected state ──
  if (state === 'idle' || state === 'error') {
    return (
      <div className={cn('rounded-2xl border border-border/60 bg-card p-8 text-center', className)}>
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Github className="w-7 h-7 text-primary" />
        </div>
        <h3 className="font-bold text-lg mb-1">Connect GitHub</h3>
        <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
          Link your GitHub account to showcase your projects and activity inside AuraDJ.
        </p>
        <Button onClick={connect} className="rounded-full gap-2 bg-primary hover:bg-primary/90">
          <Github className="w-4 h-4" />
          {state === 'error' ? 'Try again' : 'Connect GitHub'}
        </Button>
      </div>
    );
  }

  if (state === 'connecting') {
    return (
      <div className={cn('rounded-2xl border border-border/60 bg-card p-8 text-center', className)}>
        <RefreshCw className="w-8 h-8 text-primary mx-auto mb-3 animate-spin" />
        <p className="text-muted-foreground text-sm">Connecting to GitHub…</p>
      </div>
    );
  }

  // ── Connected state ──
  return (
    <div className={cn('rounded-2xl border border-border/60 bg-card overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
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
            <p className="text-xs text-muted-foreground">@{profile?.login} · {profile?.public_repos} repos</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 rounded-full"
          onClick={checkConnection}
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="flex divide-x divide-border/40 h-72">
        {/* Repo list */}
        <div className="w-1/2 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : repos.map((repo) => (
            <button
              key={repo.id}
              onClick={() => fetchCommits(repo)}
              className={cn(
                'w-full text-left px-4 py-3 hover:bg-secondary/60 transition-colors border-b border-border/20 last:border-0',
                selectedRepo?.id === repo.id && 'bg-primary/5 border-l-2 border-l-primary'
              )}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                {repo.private ? (
                  <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                ) : (
                  <GitBranch className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                )}
                <span className="text-sm font-medium truncate">{repo.name}</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                {repo.language && <span>{repo.language}</span>}
                <span className="flex items-center gap-0.5"><Star className="w-3 h-3" />{repo.stargazers_count}</span>
                <span className="flex items-center gap-0.5"><GitFork className="w-3 h-3" />{repo.forks_count}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Commit list */}
        <div className="w-1/2 overflow-y-auto">
          {!selectedRepo ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <GitCommit className="w-8 h-8 text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">Select a repo to see recent commits</p>
            </div>
          ) : commits.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />
            </div>
          ) : (
            <div>
              <div className="px-4 py-2.5 border-b border-border/40 flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {selectedRepo.name}
                </p>
                <a
                  href={selectedRepo.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              {commits.map((commit, i) => (
                <motion.div
                  key={commit.sha}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="px-4 py-2.5 border-b border-border/20 last:border-0 hover:bg-secondary/40 transition-colors"
                >
                  <p className="text-xs font-medium truncate leading-tight mb-1">
                    {commit.commit.message.split('\n')[0]}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="font-mono bg-muted px-1 py-0.5 rounded">
                      {commit.sha.slice(0, 7)}
                    </span>
                    <span>{commit.commit.author?.name}</span>
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

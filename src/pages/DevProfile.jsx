import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Github, Star, GitFork, Code2, Activity, ExternalLink, Loader2, Music2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || '';
const GITHUB_REDIRECT = typeof window !== 'undefined' ? `${window.location.origin}/dev` : '';
const GITHUB_SCOPES = 'read:user public_repo';

function RepoCard({ repo, index }) {
  return (
    <motion.a
      href={repo.html_url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="block rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:bg-accent/20 transition-all group"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
            {repo.name}
          </span>
        </div>
        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
      {repo.description && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{repo.description}</p>
      )}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {repo.language && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-primary" />
            {repo.language}
          </span>
        )}
        {repo.stargazers_count > 0 && (
          <span className="flex items-center gap-1">
            <Star className="w-3 h-3" /> {repo.stargazers_count}
          </span>
        )}
        {repo.forks_count > 0 && (
          <span className="flex items-center gap-1">
            <GitFork className="w-3 h-3" /> {repo.forks_count}
          </span>
        )}
      </div>
    </motion.a>
  );
}

function ContribGraph({ weeks }) {
  if (!weeks?.length) return null;
  const flat = weeks.flatMap(w => w.contributionDays || []);
  const max = Math.max(...flat.map(d => d.contributionCount || 0), 1);
  const color = (n) => {
    if (!n) return 'bg-secondary';
    const pct = n / max;
    if (pct > 0.75) return 'bg-primary';
    if (pct > 0.5)  return 'bg-primary/70';
    if (pct > 0.25) return 'bg-primary/40';
    return 'bg-primary/20';
  };
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-0.5" style={{ minWidth: `${weeks.length * 13}px` }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {(week.contributionDays || []).map((day, di) => (
              <div
                key={di}
                title={`${day.date}: ${day.contributionCount} contributions`}
                className={`w-2.5 h-2.5 rounded-sm ${color(day.contributionCount)}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DevProfile() {
  const [user, setUser]     = useState(null);
  const [ghData, setGhData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [tasteProfile, setTasteProfile] = useState(null);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const me = await base44.auth.me();
        setUser(me);

        // Handle GitHub OAuth callback
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');
        if (code && state === 'github_dev') {
          window.history.replaceState({}, '', '/dev');
          setConnecting(true);
          try {
            const res = await base44.functions.invoke('spotifyAuth', { action: 'githubExchange', code });
            if (res?.data?.ok) {
              await loadGitHub(me);
            }
          } catch (_) {}
          setConnecting(false);
          setLoading(false);
          return;
        }

        // Try to load existing GitHub data
        if (me?.connected_services?.github?.access_token) {
          await loadGitHub(me);
        }

        // Load Spotify taste profile for the card
        const profileRes = await base44.functions.invoke('spotifyAnalyze', { action: 'profile' }).catch(() => null);
        if (profileRes?.data?.profile) setTasteProfile(profileRes.data.profile);
      } catch (_) {}
      setLoading(false);
    };
    init();
  }, []);

  const loadGitHub = async (me) => {
    try {
      const token = me?.connected_services?.github?.access_token;
      if (!token) return;
      const [userRes, reposRes] = await Promise.all([
        fetch('https://api.github.com/user', { headers: { Authorization: `token ${token}` } }),
        fetch('https://api.github.com/user/repos?sort=updated&per_page=12&type=owner', { headers: { Authorization: `token ${token}` } }),
      ]);
      const ghUser  = await userRes.json();
      const ghRepos = await reposRes.json();
      setGhData({ user: ghUser, repos: Array.isArray(ghRepos) ? ghRepos : [] });
    } catch (_) {}
  };

  const connectGitHub = () => {
    const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(GITHUB_REDIRECT)}&scope=${encodeURIComponent(GITHUB_SCOPES)}&state=github_dev`;
    window.location.href = url;
  };

  if (loading || connecting) {
    return (
      <div className="pt-20 flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="pt-14 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
              <Code2 className="w-6 h-6 text-primary" />
              Developer Profile
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Your GitHub activity + music taste in one place</p>
          </div>
        </div>

        {/* Profile Cards Row */}
        <div className="grid sm:grid-cols-2 gap-4">

          {/* GitHub Card */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-foreground/10 flex items-center justify-center">
                <Github className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">GitHub</p>
                <p className="text-xs text-muted-foreground">{ghData ? 'Connected' : 'Not connected'}</p>
              </div>
            </div>

            {ghData ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <img src={ghData.user.avatar_url} className="w-12 h-12 rounded-full border border-border" alt="" />
                  <div>
                    <p className="font-semibold text-sm">{ghData.user.name || ghData.user.login}</p>
                    <p className="text-xs text-muted-foreground">@{ghData.user.login}</p>
                    {ghData.user.bio && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{ghData.user.bio}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Repos', value: ghData.user.public_repos },
                    { label: 'Followers', value: ghData.user.followers },
                    { label: 'Following', value: ghData.user.following },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg bg-secondary/50 py-2">
                      <p className="text-sm font-bold">{value ?? '—'}</p>
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
                <a href={ghData.user.html_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="w-full gap-2 text-xs">
                    <Github className="w-3.5 h-3.5" /> View on GitHub
                    <ExternalLink className="w-3 h-3 ml-auto" />
                  </Button>
                </a>
              </div>
            ) : (
              <div className="text-center py-4 space-y-3">
                <p className="text-xs text-muted-foreground">Connect GitHub to see your repos and activity here</p>
                <Button size="sm" onClick={connectGitHub} className="gap-2 w-full">
                  <Github className="w-4 h-4" /> Connect GitHub
                </Button>
              </div>
            )}
          </div>

          {/* Spotify Taste Card */}
          <div className="rounded-2xl border border-[#1DB954]/20 bg-[#1DB954]/5 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-[#1DB954]/15 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#1DB954]" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1DB954]">Music DNA</p>
                <p className="text-xs text-muted-foreground">{tasteProfile ? 'Profile active' : 'Not analyzed yet'}</p>
              </div>
            </div>

            {tasteProfile ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-[#1DB954]/10 p-2.5">
                    <p className="text-[#1DB954] font-semibold mb-0.5">Top Genre</p>
                    <p className="font-bold">{tasteProfile.top_genres?.[0] || '—'}</p>
                  </div>
                  <div className="rounded-lg bg-[#1DB954]/10 p-2.5">
                    <p className="text-[#1DB954] font-semibold mb-0.5">Top Mood</p>
                    <p className="font-bold">{tasteProfile.top_moods?.[0] || '—'}</p>
                  </div>
                  <div className="rounded-lg bg-[#1DB954]/10 p-2.5">
                    <p className="text-[#1DB954] font-semibold mb-0.5">BPM Range</p>
                    <p className="font-bold">{tasteProfile.preferred_bpm_min}–{tasteProfile.preferred_bpm_max}</p>
                  </div>
                  <div className="rounded-lg bg-[#1DB954]/10 p-2.5">
                    <p className="text-[#1DB954] font-semibold mb-0.5">Sessions</p>
                    <p className="font-bold">{tasteProfile.total_sessions || 0}</p>
                  </div>
                </div>
                {(tasteProfile.spotify_top_artists || []).slice(0, 4).length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1.5">Top Artists</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(tasteProfile.spotify_top_artists || []).slice(0, 4).map(a => (
                        <Badge key={a} variant="secondary" className="text-[10px] bg-[#1DB954]/10 text-[#1DB954] border-[#1DB954]/20">
                          {a}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4 space-y-3">
                <p className="text-xs text-muted-foreground">Connect Spotify and build your profile to see your taste DNA here</p>
                <Link to="/services">
                  <Button size="sm" className="gap-2 w-full bg-[#1DB954] hover:bg-[#1DB954]/90 text-black font-semibold">
                    <Music2 className="w-3.5 h-3.5" /> Connect Spotify
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* GitHub Repos */}
        {ghData?.repos?.length > 0 && (
          <section>
            <h2 className="text-lg font-bold font-heading mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Recent Repositories
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ghData.repos.map((repo, i) => (
                <RepoCard key={repo.id} repo={repo} index={i} />
              ))}
            </div>
          </section>
        )}

        {/* CTA if no github */}
        {!ghData && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Connect GitHub above to see your repositories here.
          </div>
        )}
      </div>
    </div>
  );
}

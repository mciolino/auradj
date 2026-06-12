import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
  }

  const base44 = createClientFromRequest(req);
  const { action, repo, per_page = 10 } = await req.json();

  // Get GitHub connector token for the current user
  let token: string | null = null;
  try {
    token = await base44.connectors.getToken('github');
  } catch (_) {}

  if (!token) {
    return Response.json({ error: 'GitHub not connected', connected: false }, { status: 401 });
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  try {
    if (action === 'profile') {
      const r = await fetch('https://api.github.com/user', { headers });
      const data = await r.json();
      return Response.json({ data });
    }

    if (action === 'repos') {
      const r = await fetch(
        `https://api.github.com/user/repos?sort=updated&per_page=${per_page}&visibility=all`,
        { headers }
      );
      const data = await r.json();
      return Response.json({ data });
    }

    if (action === 'commits') {
      if (!repo) return Response.json({ error: 'repo is required' }, { status: 400 });
      const r = await fetch(
        `https://api.github.com/repos/${repo}/commits?per_page=${per_page}`,
        { headers }
      );
      const data = await r.json();
      return Response.json({ data });
    }

    if (action === 'stats') {
      const [profileRes, reposRes] = await Promise.all([
        fetch('https://api.github.com/user', { headers }),
        fetch('https://api.github.com/user/repos?sort=updated&per_page=100&visibility=all', { headers }),
      ]);
      const profile = await profileRes.json();
      const repos = await reposRes.json();

      const totalStars = Array.isArray(repos)
        ? repos.reduce((sum: number, r: any) => sum + (r.stargazers_count || 0), 0)
        : 0;

      const langMap: Record<string, number> = {};
      if (Array.isArray(repos)) {
        repos.forEach((r: any) => { if (r.language) langMap[r.language] = (langMap[r.language] || 0) + 1; });
      }
      const topLanguages = Object.entries(langMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([lang]) => lang);

      return Response.json({
        data: {
          profile,
          repo_count: Array.isArray(repos) ? repos.length : 0,
          total_stars: totalStars,
          top_languages: topLanguages,
        },
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});

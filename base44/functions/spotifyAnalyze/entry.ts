import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * AuraDJ — Spotify Intelligence Engine v1.0
 *
 * POST actions:
 *   analyze     — Fetch listening history, compute taste DNA, store UserTasteProfile
 *   recommend   — Predictive playlist seeded from taste DNA, sorted by energy arc
 *   mix_params  — Convert taste DNA → DJSession control values (genre/mood/bpm/energy)
 *   profile     — Return stored UserTasteProfile (no Spotify call)
 */

const SPOTIFY_CLIENT_ID = '4c10b0a13fe74b11a90713e21ca7eb3e';

// ─── Spotify helpers ──────────────────────────────────────────────────────────

async function getValidToken(user: any, base44: any): Promise<string> {
  const sp = user.connected_services?.spotify;
  if (!sp?.access_token) throw new Error('Spotify not connected');

  if (Date.now() > (sp.expires_at || 0) - 60_000) {
    const secret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
    if (!secret) throw new Error('SPOTIFY_CLIENT_SECRET not set');
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + btoa(`${SPOTIFY_CLIENT_ID}:${secret}`),
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: sp.refresh_token }),
    });
    const t = await res.json();
    if (t.error) throw new Error('Token refresh failed: ' + (t.error_description || t.error));
    const cs = { ...user.connected_services };
    cs.spotify = { ...sp, access_token: t.access_token, expires_at: Date.now() + t.expires_in * 1000, ...(t.refresh_token ? { refresh_token: t.refresh_token } : {}) };
    await base44.auth.updateMe({ connected_services: cs });
    return t.access_token;
  }
  return sp.access_token;
}

async function spGet(path: string, token: string) {
  const r = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(`Spotify ${path} → ${r.status}: ${e.error?.message || r.statusText}`);
  }
  return r.json();
}

async function getAudioFeatures(ids: string[], token: string): Promise<any[]> {
  if (!ids.length) return [];
  const out: any[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    try {
      const d = await spGet(`/audio-features?ids=${chunk.join(',')}`, token);
      out.push(...(d.audio_features || []).filter(Boolean));
    } catch (_) {}
  }
  return out;
}

// ─── Taste DNA computation ────────────────────────────────────────────────────

function computeTasteDNA(artists: any[], tracks: any[], recent: any[], features: any[]) {
  // ── Genre fingerprint ──
  const genreScore: Record<string, number> = {};
  artists.forEach((a, i) => {
    // Earlier in the list = higher rank = more weight
    const w = 1 / (i * 0.1 + 1);
    (a.genres || []).forEach((g: string) => {
      genreScore[g] = (genreScore[g] || 0) + w;
    });
  });
  const topGenres = Object.entries(genreScore)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([g]) => g);

  // ── Audio DNA from features ──
  const valid = features.filter(Boolean);
  const avg = (key: string) =>
    valid.length ? valid.reduce((s, f) => s + (f[key] || 0), 0) / valid.length : null;

  const avgBpm      = avg('tempo')        || 120;
  const avgEnergy   = avg('energy')       || 0.6;
  const avgValence  = avg('valence')      || 0.5;
  const avgDance    = avg('danceability') || 0.6;
  const avgAcoustic = avg('acousticness') || 0.2;

  // BPM spread (standard deviation → comfortable range)
  const bpms = valid.map(f => f.tempo).filter(Boolean);
  const bpmStd = bpms.length > 1
    ? Math.sqrt(bpms.reduce((s, b) => s + (b - avgBpm) ** 2, 0) / bpms.length)
    : 12;
  const bpmMin = Math.max(60,  Math.round(avgBpm - bpmStd));
  const bpmMax = Math.min(200, Math.round(avgBpm + bpmStd));

  // ── Mood vector → AuraDJ mood labels ──
  const moods: string[] = [];
  if (avgEnergy > 0.72 && avgValence > 0.6)  moods.push('Energy Boost', 'Rooftop Party');
  else if (avgEnergy > 0.72 && avgValence < 0.4) moods.push('Energy Boost', 'Deep Focus');
  else if (avgEnergy < 0.4  && avgValence > 0.5)  moods.push('Late Night Chill', 'Deep Focus');
  else if (avgEnergy < 0.4  && avgValence < 0.4)  moods.push('Melancholy', 'Late Night Chill');
  else if (avgDance > 0.72)                         moods.push('Rooftop Party', 'Energy Boost');
  else if (avgAcoustic > 0.5)                       moods.push('Late Night Chill', 'Melancholy');
  else                                              moods.push('Deep Focus', 'Late Night Chill');

  // ── Genre → AuraDJ genre label ──
  const G_MAP: Record<string, string> = {
    'house': 'House', 'deep house': 'House', 'tech house': 'House',
    'electronic': 'Electronic', 'edm': 'Electronic', 'dance pop': 'Electronic',
    'techno': 'Techno', 'minimal techno': 'Techno', 'melodic techno': 'Techno',
    'drum and bass': 'Drum & Bass', 'liquid funk': 'Drum & Bass',
    'lo-fi': 'Lo-Fi', 'chillhop': 'Lo-Fi', 'lofi': 'Lo-Fi',
    'ambient': 'Ambient', 'downtempo': 'Ambient', 'drone': 'Ambient',
    'afro house': 'House', 'afrobeats': 'Electronic',
    'synthwave': 'Synthwave', 'retrowave': 'Synthwave', 'darksynth': 'Synthwave',
    'jazz': 'Jazz', 'nu jazz': 'Jazz', 'jazz fusion': 'Jazz',
    'hip hop': 'Hip-Hop', 'rap': 'Hip-Hop', 'trap': 'Trap',
    'r&b': 'R&B', 'soul': 'R&B', 'neo soul': 'R&B',
    'classical': 'Classical', 'orchestral': 'Classical',
    'chillwave': 'Chillwave', 'indie pop': 'Indie',
  };
  const mappedGenre = (() => {
    for (const raw of topGenres) {
      const k = raw.toLowerCase();
      if (G_MAP[k]) return G_MAP[k];
      for (const [fragment, label] of Object.entries(G_MAP)) {
        if (k.includes(fragment)) return label;
      }
    }
    return 'Electronic';
  })();

  // ── Recent artist boost ──
  const recentArtistNames = [...new Set(
    recent.flatMap((r: any) => (r.track?.artists || []).map((a: any) => a.name))
  )].slice(0, 15) as string[];

  return {
    // Stored fields
    top_genres:          topGenres,
    top_moods:           moods.slice(0, 4),
    preferred_bpm_min:   bpmMin,
    preferred_bpm_max:   bpmMax,
    preferred_energy_min: Math.round(avgEnergy * 8),
    preferred_energy_max: Math.min(10, Math.round(avgEnergy * 10) + 1),
    spotify_connected:   true,
    spotify_top_artists: artists.slice(0, 12).map((a: any) => a.name),
    spotify_top_tracks:  tracks.slice(0, 12).map((t: any) => `${t.name}|${t.id}|${t.artists?.[0]?.name}`),
    last_updated:        new Date().toISOString(),
    // Internal scoring (stored for recommendation use)
    _dna: {
      avg_bpm: Math.round(avgBpm),
      avg_energy: +avgEnergy.toFixed(3),
      avg_valence: +avgValence.toFixed(3),
      avg_danceability: +avgDance.toFixed(3),
      avg_acousticness: +avgAcoustic.toFixed(3),
      mapped_genre: mappedGenre,
      recent_artists: recentArtistNames,
    },
  };
}

// ─── Energy-arc playlist sort ─────────────────────────────────────────────────
// Real DJ sets follow: intro (ease in) → buildup → peak → outro (come down)
// We sort the Spotify recommendation results into this shape.

function energyArcSort(tracks: any[]): any[] {
  if (tracks.length < 4) return tracks;
  const sorted = [...tracks].sort((a, b) => (a._energy || 0) - (b._energy || 0));
  const n = sorted.length;
  // Split into quartiles
  const q  = Math.max(1, Math.floor(n / 4));
  const intro  = sorted.slice(0, q);                            // lowest energy
  const build  = sorted.slice(q, q * 2);                       // building
  const peak   = sorted.slice(q * 2, n - q).sort((a, b) => (b._energy || 0) - (a._energy || 0)); // highest first
  const outro  = sorted.slice(n - q);                          // low again
  return [...intro, ...build, ...peak, ...outro];
}

// ─── Predictive playlist builder ──────────────────────────────────────────────

async function buildPredictivePlaylist(dna: any, token: string, limit: number) {
  // ── Resolve seed IDs from stored top tracks (format: "name|id|artist") ──
  const seedTrackIds: string[] = [];
  for (const raw of (dna.spotify_top_tracks || []).slice(0, 3)) {
    const parts = raw.split('|');
    if (parts[1]) seedTrackIds.push(parts[1]);
  }

  // ── Resolve seed artist IDs ──
  const seedArtistIds: string[] = [];
  for (const name of (dna.spotify_top_artists || []).slice(0, 2)) {
    try {
      const r = await spGet(`/search?q=${encodeURIComponent(name)}&type=artist&limit=1`, token);
      const id = r.artists?.items?.[0]?.id;
      if (id) seedArtistIds.push(id);
    } catch (_) {}
  }

  // Build seed string (max 5 total)
  const seedParams: string[] = [];
  if (seedArtistIds.length) seedParams.push(`seed_artists=${seedArtistIds.slice(0, 2).join(',')}`);
  if (seedTrackIds.length)  seedParams.push(`seed_tracks=${seedTrackIds.slice(0, 2).join(',')}`);
  // Fill remaining seed slots with genre if needed
  const totalSeeds = seedArtistIds.slice(0, 2).length + seedTrackIds.slice(0, 2).length;
  if (totalSeeds < 3) {
    const genreSeeds = (dna.top_genres || ['electronic']).slice(0, 3 - totalSeeds)
      .map((g: string) => encodeURIComponent(g.toLowerCase()));
    seedParams.push(`seed_genres=${genreSeeds.join(',')}`);
  }

  // ── Audio feature targets ──
  const energyMid  = ((dna.preferred_energy_min + dna.preferred_energy_max) / 2) / 10;
  const bpmMid     = Math.round((dna.preferred_bpm_min + dna.preferred_bpm_max) / 2);
  const dna_       = dna._dna || {};

  const targetParams = [
    `target_energy=${energyMid.toFixed(2)}`,
    `min_energy=${Math.max(0, energyMid - 0.18).toFixed(2)}`,
    `max_energy=${Math.min(1, energyMid + 0.18).toFixed(2)}`,
    `target_tempo=${bpmMid}`,
    `min_tempo=${dna.preferred_bpm_min}`,
    `max_tempo=${dna.preferred_bpm_max}`,
    `target_danceability=${Math.min(1, (dna_?.avg_danceability || 0.65) + 0.05).toFixed(2)}`,
    `target_valence=${(dna_?.avg_valence || 0.5).toFixed(2)}`,
    `limit=${Math.min(limit, 50)}`,
  ];

  const url = `/recommendations?${seedParams.join('&')}&${targetParams.join('&')}`;
  let recData: any;
  try {
    recData = await spGet(url, token);
  } catch (e) {
    // Fallback: broader seed with just genres
    const fallback = `/recommendations?seed_genres=electronic,house&target_energy=${energyMid.toFixed(2)}&target_tempo=${bpmMid}&limit=${limit}`;
    recData = await spGet(fallback, token);
  }

  const tracks = recData.tracks || [];

  // ── Fetch audio features for arc sort ──
  const ids = tracks.map((t: any) => t.id);
  const features = await getAudioFeatures(ids, token);
  const fMap: Record<string, any> = {};
  features.forEach(f => { if (f?.id) fMap[f.id] = f; });

  const withFeatures = tracks.map((t: any) => ({
    id:          t.id,
    name:        t.name,
    artists:     t.artists?.map((a: any) => a.name).join(', '),
    album:       t.album?.name,
    album_art:   t.album?.images?.[0]?.url || t.album?.images?.[1]?.url,
    preview_url: t.preview_url,
    uri:         t.uri,
    duration_ms: t.duration_ms,
    external_url: t.external_urls?.spotify,
    bpm:         Math.round(fMap[t.id]?.tempo || bpmMid),
    energy:      Math.round((fMap[t.id]?.energy || energyMid) * 10),
    valence:     Math.round((fMap[t.id]?.valence || 0.5) * 10),
    danceability: Math.round((fMap[t.id]?.danceability || 0.6) * 10),
    _energy:     fMap[t.id]?.energy || energyMid,
  }));

  return energyArcSort(withFeatures).map(({ _energy, ...t }) => t);
}

// ─── Taste DNA → DJSession params ─────────────────────────────────────────────

function dnaToSessionParams(dna: any) {
  const bpm    = Math.round((dna.preferred_bpm_min + dna.preferred_bpm_max) / 2);
  const energy = Math.round((dna.preferred_energy_min + dna.preferred_energy_max) / 2);
  const genre  = dna._dna?.mapped_genre || 'Electronic';
  const mood   = dna.top_moods?.[0] || 'Energy Boost';

  const topGenreStr   = dna.top_genres?.slice(0, 3).join(', ') || 'electronic music';
  const topArtistStr  = dna.spotify_top_artists?.slice(0, 2).join(' & ') || 'your top artists';

  return {
    suggested_genre:  genre,
    suggested_mood:   mood,
    suggested_bpm:    bpm,
    suggested_energy: energy,
    top_genres:       dna.top_genres?.slice(0, 5) || [],
    top_artists:      dna.spotify_top_artists?.slice(0, 6) || [],
    reasoning:        `Your Spotify DNA: mostly ${topGenreStr} (${dna.preferred_bpm_min}–${dna.preferred_bpm_max} BPM, energy ${dna.preferred_energy_min}–${dna.preferred_energy_max}/10) — inspired by ${topArtistStr}.`,
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action = 'analyze', playlist_size = 20 } = body;

    // ── profile: read stored DNA, no Spotify call ──────────────────────────
    if (action === 'profile') {
      const rows = await base44.entities.UserTasteProfile.list();
      const profile = rows.find((r: any) => r.user_id === user.id) || null;
      return Response.json({ ok: true, profile });
    }

    const token = await getValidToken(user, base44);

    // ── analyze: build full taste DNA ─────────────────────────────────────
    if (action === 'analyze') {
      // Parallel fetch — 5 Spotify calls
      const [artShort, artMedium, trShort, trMedium, recent] = await Promise.all([
        spGet('/me/top/artists?time_range=short_term&limit=20', token),
        spGet('/me/top/artists?time_range=medium_term&limit=30', token),
        spGet('/me/top/tracks?time_range=short_term&limit=25', token),
        spGet('/me/top/tracks?time_range=medium_term&limit=25', token),
        spGet('/me/player/recently-played?limit=50', token),
      ]);

      // Merge & dedupe, short_term weighted 2× for recency bias
      const mergeDedup = (a: any[], b: any[]) => {
        const seen = new Set<string>();
        return [...a, ...a, ...b].filter(x => { if (seen.has(x.id)) return false; seen.add(x.id); return true; });
      };
      const artists = mergeDedup(artShort.items || [], artMedium.items || []);
      const tracks  = mergeDedup(trShort.items || [], trMedium.items || []);

      // Fetch audio features
      const features = await getAudioFeatures(tracks.map((t: any) => t.id), token);

      // Compute DNA
      const dna = computeTasteDNA(artists, tracks, recent.items || [], features);

      // Upsert UserTasteProfile
      const existing = await base44.entities.UserTasteProfile.list();
      const row = existing.find((r: any) => r.user_id === user.id);
      const profileData = {
        user_id: user.id,
        total_sessions: row?.total_sessions || 0,
        total_tracks_played: (row?.total_tracks_played || 0) + tracks.length,
        total_minutes_listened: row?.total_minutes_listened || 0,
        favorite_session_ids: row?.favorite_session_ids || [],
        ...dna,
      };
      if (row) {
        await base44.entities.UserTasteProfile.update(row.id, profileData);
      } else {
        await base44.entities.UserTasteProfile.create(profileData);
      }

      return Response.json({
        ok: true,
        profile: profileData,
        stats: {
          artists_analyzed: artists.length,
          tracks_analyzed: tracks.length,
          recent_plays: recent.items?.length || 0,
          audio_features: features.length,
        },
      });
    }

    // ── recommend: predictive playlist ────────────────────────────────────
    if (action === 'recommend') {
      const rows = await base44.entities.UserTasteProfile.list();
      const dna  = rows.find((r: any) => r.user_id === user.id);
      if (!dna) return Response.json({ error: 'No taste profile. Call analyze first.' }, { status: 400 });

      const playlist = await buildPredictivePlaylist(dna, token, playlist_size);

      return Response.json({
        ok: true,
        playlist,
        mix_hint: dnaToSessionParams(dna),
        total: playlist.length,
      });
    }

    // ── mix_params: DJSession control pre-fill ─────────────────────────────
    if (action === 'mix_params') {
      const rows = await base44.entities.UserTasteProfile.list();
      const dna  = rows.find((r: any) => r.user_id === user.id);
      if (!dna) return Response.json({ error: 'No taste profile. Call analyze first.' }, { status: 400 });
      return Response.json({ ok: true, params: dnaToSessionParams(dna) });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (err: any) {
    console.error('[spotifyAnalyze]', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});

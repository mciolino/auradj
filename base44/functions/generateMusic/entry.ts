import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * generateMusic — AI music generation backend
 *
 * Priority chain:
 *   1. Suno via AceDataCloud API (chirp-v4-5, best quality)
 *   2. HuggingFace MusicGen (free, slower)
 *   3. SoundHelix demo tracks (always-available fallback)
 *
 * POST body:
 *   prompt       string  — style/mood description (required)
 *   title        string  — track title (optional)
 *   bpm          number  — target BPM hint, embedded in prompt
 *   genre        string  — genre tag, embedded in prompt
 *   instrumental boolean — no vocals (default: true)
 *   use_fallback boolean — skip to demo tracks immediately
 *   engine       string  — "suno" | "huggingface" | "fallback" (force a specific engine)
 */

// ── Suno via AceDataCloud ─────────────────────────────────────────────────────
async function trySuno(prompt: string, title: string, instrumental: boolean): Promise<{ success: boolean; audio_url?: string; title?: string; source?: string }> {
  const token = Deno.env.get('ACEDATACLOUD_API_TOKEN');
  if (!token || token.startsWith('https://')) {
    console.log('[generateMusic] No valid ACEDATACLOUD_API_TOKEN — skipping Suno');
    return { success: false };
  }

  try {
    // Step 1 — kick off async generation
    const genRes = await fetch('https://api.acedata.cloud/suno/audios', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        title: title || undefined,
        model: 'chirp-v4-5',
        instrumental,
        make_instrumental: instrumental,
      }),
    });

    const genData = await genRes.json();
    console.log('[generateMusic] Suno init:', JSON.stringify(genData).slice(0, 200));

    if (!genRes.ok || genData?.error) {
      console.log('[generateMusic] Suno error:', genData?.error?.message || genRes.status);
      return { success: false };
    }

    // Task id lives at different paths depending on API version
    const taskId = genData?.task_id || genData?.id || genData?.data?.task_id;
    if (!taskId) {
      console.log('[generateMusic] No task_id in Suno response');
      return { success: false };
    }

    console.log('[generateMusic] Suno task_id:', taskId);

    // Step 2 — poll up to 90s (18 × 5s)
    for (let i = 0; i < 18; i++) {
      await new Promise(r => setTimeout(r, 5000));

      const pollRes = await fetch('https://api.acedata.cloud/suno/tasks', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId }),
      });

      const pollData = await pollRes.json();
      const state   = pollData?.state || pollData?.data?.state || pollData?.status;
      console.log(`[generateMusic] Suno poll ${i+1}/18 state=${state}`);

      if (state === 'complete' || state === 'success' || state === 'succeeded') {
        // Audio URL lives at different depths
        const tracks = pollData?.data || pollData?.audios || pollData?.results || [];
        const track  = Array.isArray(tracks) ? tracks[0] : tracks;
        const audioUrl = track?.audio_url || track?.url || pollData?.audio_url;
        const trackTitle = track?.title || title || prompt.slice(0, 40);

        if (audioUrl) {
          console.log('[generateMusic] Suno complete:', audioUrl.slice(0, 80));
          return { success: true, audio_url: audioUrl, title: trackTitle, source: 'suno' };
        }
      }

      if (state === 'failed' || state === 'error') {
        console.log('[generateMusic] Suno task failed');
        return { success: false };
      }
    }

    console.log('[generateMusic] Suno polling timed out');
    return { success: false };

  } catch (err) {
    console.log('[generateMusic] Suno exception:', err.message);
    return { success: false };
  }
}

// ── HuggingFace MusicGen ───────────────────────────────────────────────────────
async function tryHuggingFace(base44: any, prompt: string): Promise<{ success: boolean; audio_url?: string; source?: string }> {
  try {
    const hfResponse = await base44.integrations.custom.call(
      'huggingface',
      'post:/models/{model}',
      {
        pathParams: { model: 'facebook/musicgen-small' },
        payload: { inputs: prompt, parameters: { max_new_tokens: 256 } }
      }
    );

    if (!hfResponse?.success) return { success: false };

    const audioData = hfResponse.data;
    if (!audioData) return { success: false };

    let uint8Array: Uint8Array;
    if (typeof audioData === 'string') {
      const bin = atob(audioData);
      uint8Array = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) uint8Array[i] = bin.charCodeAt(i);
    } else if (audioData instanceof ArrayBuffer) {
      uint8Array = new Uint8Array(audioData);
    } else if (audioData?.buffer) {
      uint8Array = new Uint8Array(audioData.buffer);
    } else {
      const vals = Object.values(audioData as Record<string, number>);
      if (!vals.length) return { success: false };
      uint8Array = new Uint8Array(vals);
    }

    const audioBlob = new Blob([uint8Array], { type: 'audio/flac' });
    const uploadResult = await base44.integrations.Core.UploadFile({ file: audioBlob });
    if (!uploadResult?.file_url) return { success: false };

    return { success: true, audio_url: uploadResult.file_url, source: 'huggingface' };
  } catch (err) {
    console.log('[generateMusic] HuggingFace error:', err.message);
    return { success: false };
  }
}

// ── Demo fallback tracks ──────────────────────────────────────────────────────
const DEMO_TRACKS = [
  { url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',  title: 'Neon Grid',        genre: 'Electronic', bpm: 128 },
  { url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',  title: 'Midnight Drive',   genre: 'Synthwave',  bpm: 120 },
  { url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',  title: 'Solar Flare',      genre: 'House',      bpm: 124 },
  { url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',  title: 'Deep Current',     genre: 'Tech House', bpm: 130 },
  { url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',  title: 'Chrome Horizon',   genre: 'Ambient',    bpm: 110 },
  { url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',  title: 'Vapor Trail',      genre: 'Chillwave',  bpm: 95  },
  { url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3', title: 'Pulse Protocol',   genre: 'Drum & Bass',bpm: 174 },
  { url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3', title: 'Fractal Garden',   genre: 'Techno',     bpm: 138 },
];

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const rawPrompt   = body.prompt    || 'electronic music';
    const title       = body.title     || '';
    const bpm         = body.bpm       || 128;
    const genre       = body.genre     || 'Electronic';
    const instrumental= body.instrumental !== false; // default true
    const forceEngine = body.engine;   // "suno" | "huggingface" | "fallback"
    const useFallback = body.use_fallback === true || forceEngine === 'fallback';

    // Enrich prompt with BPM + genre if not already present
    const prompt = rawPrompt.toLowerCase().includes('bpm')
      ? rawPrompt
      : `${rawPrompt}, ${genre}, ${bpm} BPM${instrumental ? ', instrumental' : ''}`;

    console.log('[generateMusic] prompt:', prompt, '| engine:', forceEngine || 'auto');

    // ── Engine selection ──────────────────────────────────────────────────────
    if (!useFallback && forceEngine !== 'huggingface') {
      const sunoResult = await trySuno(prompt, title, instrumental);
      if (sunoResult.success) {
        return Response.json({
          success: true,
          audio_url: sunoResult.audio_url,
          title: sunoResult.title || title || prompt.slice(0, 40),
          genre, bpm,
          source: 'suno',
          generated: true,
        });
      }
    }

    if (!useFallback && forceEngine !== 'fallback') {
      const hfResult = await tryHuggingFace(base44, prompt);
      if (hfResult.success) {
        return Response.json({
          success: true,
          audio_url: hfResult.audio_url,
          title: title || prompt.slice(0, 40),
          genre, bpm,
          source: 'huggingface',
          generated: true,
        });
      }
    }

    // ── Demo fallback ─────────────────────────────────────────────────────────
    const hash = Array.from(prompt).reduce((a, c) => a + c.charCodeAt(0), 0);
    const demo = DEMO_TRACKS[hash % DEMO_TRACKS.length];

    return Response.json({
      success: true,
      audio_url: demo.url,
      title: title || demo.title,
      genre: genre || demo.genre,
      bpm: bpm || demo.bpm,
      source: 'demo',
      generated: false,
    });

  } catch (err) {
    console.error('[generateMusic] Unhandled error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});

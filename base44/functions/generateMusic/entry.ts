import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Demo audio clips used as fallback while HuggingFace model warms up
// These are real, publicly accessible audio samples
const DEMO_TRACKS = [
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
];

async function tryMusicGen(base44, prompt) {
  try {
    const hfResponse = await base44.integrations.custom.call(
      'huggingface',
      'post:/models/{model}',
      {
        pathParams: { model: 'facebook/musicgen-small' },
        payload: {
          inputs: prompt,
          parameters: { max_new_tokens: 256 }
        }
      }
    );

    if (!hfResponse?.success) {
      console.log('[generateMusic] HF returned non-success:', hfResponse?.data?.error);
      return { success: false };
    }

    const audioData = hfResponse.data;
    if (!audioData) return { success: false };

    let uint8Array;
    if (typeof audioData === 'string') {
      const bin = atob(audioData);
      uint8Array = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) uint8Array[i] = bin.charCodeAt(i);
    } else if (audioData instanceof ArrayBuffer) {
      uint8Array = new Uint8Array(audioData);
    } else if (audioData?.buffer) {
      uint8Array = new Uint8Array(audioData.buffer);
    } else {
      const vals = Object.values(audioData);
      if (!vals.length) return { success: false };
      uint8Array = new Uint8Array(vals);
    }

    const audioBlob = new Blob([uint8Array], { type: 'audio/flac' });
    const uploadResult = await base44.integrations.Core.UploadFile({ file: audioBlob });

    if (!uploadResult?.file_url) return { success: false };
    return { success: true, audio_url: uploadResult.file_url };
  } catch (err) {
    console.log('[generateMusic] HF error (will use fallback):', err.message);
    return { success: false };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const prompt = body.prompt;
    const useFallback = body.use_fallback === true;

    if (!prompt) return Response.json({ error: 'prompt is required' }, { status: 400 });

    // Try HuggingFace MusicGen unless caller explicitly wants fallback
    if (!useFallback) {
      const result = await tryMusicGen(base44, prompt);
      if (result.success) {
        return Response.json({ audio_url: result.audio_url, success: true, generated: true });
      }
      console.log('[generateMusic] HF unavailable, using fallback demo track');
    }

    // Fallback: return a demo track (deterministic based on prompt hash)
    const hash = Array.from(prompt).reduce((a, c) => a + c.charCodeAt(0), 0);
    const fallbackUrl = DEMO_TRACKS[hash % DEMO_TRACKS.length];

    return Response.json({
      audio_url: fallbackUrl,
      success: true,
      generated: false,
      fallback: true
    });
  } catch (error) {
    console.error('[generateMusic] Unexpected error:', error.message);
    // Even on unexpected errors, return a usable fallback so the UI never breaks
    const fallbackUrl = DEMO_TRACKS[0];
    return Response.json({ audio_url: fallbackUrl, success: true, generated: false, fallback: true });
  }
});
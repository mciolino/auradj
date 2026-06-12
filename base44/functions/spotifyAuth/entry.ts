import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const CLIENT_ID = '4c10b0a13fe74b11a90713e21ca7eb3e';
const REDIRECT_URI = 'https://echo-dj-flow.base44.app/services';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const CLIENT_SECRET = Deno.env.get('SPOTIFY_CLIENT_SECRET');
    const body = await req.json();
    const { action, code, query } = body;

    // ── Exchange authorization code for tokens ───────────────────────────────
    if (action === 'exchange') {
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: REDIRECT_URI,
        });

        const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`),
            },
            body: params.toString(),
        });

        const tokens = await tokenRes.json();
        if (tokens.error) {
            console.error('[spotifyAuth] exchange error:', tokens.error, tokens.error_description);
            return Response.json({ error: tokens.error_description || tokens.error }, { status: 400 });
        }

        const profileRes = await fetch('https://api.spotify.com/v1/me', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const profile = await profileRes.json();

        const connected_services = user.connected_services || {};
        connected_services.spotify = {
            connected: true,
            connected_at: new Date().toISOString(),
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: Date.now() + tokens.expires_in * 1000,
            display_name: profile.display_name,
            spotify_id: profile.id,
        };
        await base44.auth.updateMe({ connected_services });

        return Response.json({ success: true, display_name: profile.display_name });
    }

    // ── Refresh access token ─────────────────────────────────────────────────
    if (action === 'refresh') {
        const refreshToken = user.connected_services?.spotify?.refresh_token;
        if (!refreshToken) {
            console.error('[spotifyAuth] refresh: no refresh token stored');
            return Response.json({ error: 'No refresh token stored' }, { status: 400 });
        }

        const params = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        });

        const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`),
            },
            body: params.toString(),
        });

        const tokens = await tokenRes.json();
        if (tokens.error) {
            console.error('[spotifyAuth] refresh error:', tokens.error, tokens.error_description);
            return Response.json({ error: tokens.error_description || tokens.error }, { status: 400 });
        }

        const connected_services = user.connected_services || {};
        connected_services.spotify = {
            ...connected_services.spotify,
            access_token: tokens.access_token,
            expires_at: Date.now() + tokens.expires_in * 1000,
            ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
        };
        await base44.auth.updateMe({ connected_services });

        return Response.json({ success: true, access_token: tokens.access_token });
    }

    // ── Search proxy (keeps token server-side) ───────────────────────────────
    if (action === 'search') {
        if (!query) return Response.json({ tracks: [] });

        let accessToken = user.connected_services?.spotify?.access_token;
        const expiresAt = user.connected_services?.spotify?.expires_at || 0;

        // Auto-refresh if within 60 seconds of expiry
        if (!accessToken || Date.now() > expiresAt - 60000) {
            const refreshToken = user.connected_services?.spotify?.refresh_token;
            if (!refreshToken) return Response.json({ error: 'Not connected' }, { status: 401 });

            const params = new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            });
            const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`),
                },
                body: params.toString(),
            });
            const newTokens = await tokenRes.json();
            if (newTokens.error) {
                console.error('[spotifyAuth] search auto-refresh error:', newTokens.error);
                return Response.json({ error: 'Token refresh failed' }, { status: 401 });
            }
            accessToken = newTokens.access_token;
            const connected_services = user.connected_services || {};
            connected_services.spotify = {
                ...connected_services.spotify,
                access_token: accessToken,
                expires_at: Date.now() + newTokens.expires_in * 1000,
                ...(newTokens.refresh_token ? { refresh_token: newTokens.refresh_token } : {}),
            };
            await base44.auth.updateMe({ connected_services });
        }

        const searchRes = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=8`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const data = await searchRes.json();
        return Response.json({ tracks: data.tracks?.items || [] });
    }

    // ── Get valid access token (with auto-refresh) ───────────────────────────
    if (action === 'getToken') {
        let accessToken = user.connected_services?.spotify?.access_token;
        const expiresAt = user.connected_services?.spotify?.expires_at || 0;

        if (!accessToken || Date.now() > expiresAt - 60000) {
            const refreshToken = user.connected_services?.spotify?.refresh_token;
            if (!refreshToken) return Response.json({ error: 'Not connected' }, { status: 401 });

            const params = new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            });
            const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`),
                },
                body: params.toString(),
            });
            const newTokens = await tokenRes.json();
            if (newTokens.error) {
                console.error('[spotifyAuth] getToken refresh error:', newTokens.error);
                return Response.json({ error: 'Token refresh failed' }, { status: 401 });
            }
            accessToken = newTokens.access_token;
            const connected_services = user.connected_services || {};
            connected_services.spotify = {
                ...connected_services.spotify,
                access_token: accessToken,
                expires_at: Date.now() + newTokens.expires_in * 1000,
                ...(newTokens.refresh_token ? { refresh_token: newTokens.refresh_token } : {}),
            };
            await base44.auth.updateMe({ connected_services });
        }

        return Response.json({ success: true, access_token: accessToken });
    }

    // ── Disconnect ───────────────────────────────────────────────────────────
    if (action === 'disconnect') {
        const connected_services = user.connected_services || {};
        delete connected_services.spotify;
        await base44.auth.updateMe({ connected_services });
        return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * AuraDJ — Builder Bridge v1.0
 * Allows the Superagent to perform privileged read/write ops inside EchoDJ.
 * Admin-only. Deploy this in the EchoDJ app builder under Functions > builderBridge.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { action, entity, id, data, query, fields, limit = 100, skip = 0, sort } = body;
    if (!action) return Response.json({ error: 'action is required' }, { status: 400 });

    const db = base44.asServiceRole.entities;

    if (action === 'entity.read') {
      if (!entity) return Response.json({ error: 'entity is required' }, { status: 400 });
      const E = db[entity];
      if (!E) return Response.json({ error: `Entity "${entity}" not found` }, { status: 404 });
      if (id) { const record = await E.get(id); return Response.json({ ok: true, record }); }
      const opts: any = { limit, skip };
      if (sort) opts.sort = sort;
      if (fields?.length) opts.fields = fields;
      const results = query && Object.keys(query).length ? await E.filter(query, opts) : await E.list(opts);
      return Response.json({ ok: true, records: results, count: results?.length || 0 });
    }

    if (action === 'entity.create') {
      if (!entity || !data) return Response.json({ error: 'entity and data required' }, { status: 400 });
      const E = db[entity];
      if (!E) return Response.json({ error: `Entity "${entity}" not found` }, { status: 404 });
      const record = await E.create(data);
      return Response.json({ ok: true, record });
    }

    if (action === 'entity.update') {
      if (!entity || !id || !data) return Response.json({ error: 'entity, id, and data required' }, { status: 400 });
      const E = db[entity];
      if (!E) return Response.json({ error: `Entity "${entity}" not found` }, { status: 404 });
      const record = await E.update(id, data);
      return Response.json({ ok: true, record });
    }

    if (action === 'entity.delete') {
      if (!entity || !id) return Response.json({ error: 'entity and id required' }, { status: 400 });
      const E = db[entity];
      if (!E) return Response.json({ error: `Entity "${entity}" not found` }, { status: 404 });
      await E.delete(id);
      return Response.json({ ok: true, deleted_id: id });
    }

    if (action === 'entity.schema') {
      return Response.json({ ok: true, entities: Object.keys(db) });
    }

    if (action === 'function.call') {
      const { function_name, function_payload = {} } = body;
      if (!function_name) return Response.json({ error: 'function_name is required' }, { status: 400 });
      const result = await base44.functions.invoke(function_name, function_payload);
      return Response.json({ ok: true, result });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('[builderBridge]', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});

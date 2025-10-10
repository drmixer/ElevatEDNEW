import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js';

import type { ImportProviderId } from '../../../shared/import-providers.ts';
import { IMPORT_PROVIDER_MAP } from '../../../shared/import-providers.ts';
import { coerceImportRunRow } from '../../../server/importRuns.ts';
import { processImportRun } from '../../../server/providerPipeline.ts';

const requireEnv = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const JSON_RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
};

const claimPendingRun = async (client: ReturnType<typeof createClient>) => {
  const { data, error } = await client
    .from('import_runs')
    .select()
    .eq('status', 'pending')
    .order('started_at', { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(`Failed to locate pending import runs: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return null;
  }

  const run = coerceImportRunRow(data[0] as Record<string, unknown>);

  const { data: updated, error: updateError } = await client
    .from('import_runs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', run.id)
    .eq('status', 'pending')
    .select()
    .maybeSingle();

  if (updateError) {
    throw new Error(`Failed to claim import run: ${updateError.message}`);
  }

  if (!updated) {
    return null;
  }

  return coerceImportRunRow(updated as Record<string, unknown>);
};

serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: JSON_RESPONSE_HEADERS,
    });
  }

  try {
    const { runId } = (await request.json()) as { runId?: number };
    const supabaseUrl = requireEnv('SUPABASE_URL');
    const supabaseKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

    const client = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    let run;
    if (typeof runId === 'number' && Number.isFinite(runId)) {
      const { data, error } = await client.from('import_runs').select().eq('id', runId).maybeSingle();
      if (error) {
        throw new Error(`Failed to load import run ${runId}: ${error.message}`);
      }
      if (!data) {
        return new Response(JSON.stringify({ error: `Run ${runId} not found.` }), {
          status: 404,
          headers: JSON_RESPONSE_HEADERS,
        });
      }
      run = coerceImportRunRow(data as Record<string, unknown>);
    } else {
      run = await claimPendingRun(client);
      if (!run) {
        return new Response(JSON.stringify({ message: 'No pending runs.' }), {
          status: 200,
          headers: JSON_RESPONSE_HEADERS,
        });
      }
    }

    const providerId = (run.input?.provider ?? run.source) as ImportProviderId;
    if (!providerId || !IMPORT_PROVIDER_MAP.has(providerId)) {
      await client
        .from('import_runs')
        .update({
          status: 'error',
          finished_at: new Date().toISOString(),
          errors: [`Unknown provider "${providerId}".`],
        })
        .eq('id', run.id);

      return new Response(JSON.stringify({ error: `Unknown provider "${providerId}".` }), {
        status: 400,
        headers: JSON_RESPONSE_HEADERS,
      });
    }

    const outcome = await processImportRun(client, providerId, run);

    await client
      .from('import_runs')
      .update({
        status: outcome.errors.length > 0 ? 'error' : 'success',
        finished_at: new Date().toISOString(),
        totals: outcome.totals ?? {},
        errors: outcome.errors,
      })
      .eq('id', run.id);

    return new Response(
      JSON.stringify({
        runId: run.id,
        provider: providerId,
        totals: outcome.totals,
        errors: outcome.errors,
        warnings: outcome.warnings ?? [],
      }),
      {
        status: 200,
        headers: JSON_RESPONSE_HEADERS,
      },
    );
  } catch (error) {
    console.error('[process-import-run] failed', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: JSON_RESPONSE_HEADERS,
      },
    );
  }
});

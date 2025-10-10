ElevatEDNEW
===

## OER Importer
- Place normalized JSON datasets in `data/oer/`.
- Run `pnpm tsx tools/importers/oer/index.ts --path ./data/oer`.
- Optional flags: `--dryRun`, `--limit <n>`, `--subject "<Name>"`, `--triggeredBy <uuid>`, `--source "<Provider>"`.

## Adaptive Suggestions
Call the Supabase RPC from Node:
```ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { data, error } = await supabase.rpc('suggest_next_lessons', {
  p_student_id: '00000000-0000-0000-0000-000000000000',
  limit_count: 3,
});
```

The helper script `pnpm tsx tools/adaptive/test_suggest.ts` seeds demo data and prints the results of each rule branch.

## License & Attribution Notes
- New provenance columns (`source`, `source_url`, `license`, `attribution`, plus `external_id`, `slug`, `media`, `metadata`) exist on subjects/topics/lessons.
- Always persist the provider’s license and attribution string on every imported record.
- Keep NC-licensed or otherwise restricted material out of paid experiences unless you have explicit permission.

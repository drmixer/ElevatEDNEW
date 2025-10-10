ElevatEDNEW
===

## CK-12 Importer
- Place CK-12 JSON dumps in `data/ck12/`.
- Run `pnpm tsx tools/importers/ck12/index.ts --path ./data/ck12`.
- Optional flags: `--dryRun`, `--limit <n>`, `--subject "<Name>"`, `--triggeredBy <uuid>`.

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
- Always persist CK-12’s license (often **CC BY-NC**) and attribution string on every imported record.
- Keep NC-licensed material out of paid experiences unless you have explicit permission.

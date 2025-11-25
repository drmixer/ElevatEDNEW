# ElevatED API v1

Base path: `/api/v1`. All responses are JSON. Errors follow `{ "error": { "message": string, "code": string, "details"?: any } }`. Public endpoints run on the RLS client; service-role access is limited to admin/import actions and a fallback insert when provisioning parent profiles for assignments.

## Public endpoints
- `POST /ai/tutor` – Body `{ prompt: string, systemPrompt?: string, knowledge?: string, mode?: "learning" | "marketing" }`, optional auth; returns `{ message, model }`.
- `GET /modules` – Query filters: `subject`, `grade`, `strand`, `topic`, `standards` (csv), `openTrack` (bool), `sort` (`featured|title-asc|title-desc|grade-asc|grade-desc`), `page` (>=1), `pageSize` (1-50). Returns `{ data, total }`.
- `GET /modules/:id` – Module details with lessons, assets, standards, assessments.
- `GET /modules/:id/assessment` – Baseline assessment details for a module.
- `GET /lessons/:id` – Lesson detail plus module context.
- `GET /recommendations?moduleId=:id&lastScore=:number` – Recommended modules for a given module.
- `POST /assignments/assign` – Auth required (`parent` or `admin`). Body `{ moduleId: number, studentIds: string[], dueAt?: ISO string | null, title?: string }`; returns `{ assignmentId, lessonsAttached, assignedStudents }`.

## Admin endpoints (service role)
- `GET /admins` – List admins.
- `POST /admins/promote` – Body `{ email?: string, userId?: string, title?: string, permissions?: string[] }`; promotes a user.
- `POST /admins/demote` – Body `{ userId: string, targetRole?: "student" | "parent" }`; demotes an admin.

## Import endpoints (service role)
- `GET /import/providers` – Available import providers.
- `GET /import/runs` – Recent import runs.
- `GET /import/runs/:id` – Single import run.
- `POST /import/runs` – Queue a run: `{ provider, mapping?, dataset?, input?, fileName?, notes?, dryRun?, limits? }`.
- `POST /import/openstax`, `/import/gutenberg`, `/import/federal` – Mapping payloads for their respective importers.

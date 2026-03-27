export const extractWriteMode = (args: string[]): { apply: boolean; rest: string[] } => {
  let apply = false;
  const rest: string[] = [];

  for (const arg of args) {
    if (arg === '--apply') {
      apply = true;
      continue;
    }
    if (arg === '--dry-run') {
      apply = false;
      continue;
    }
    rest.push(arg);
  }

  return { apply, rest };
};

export const logWriteMode = (apply: boolean, label = 'rows'): void => {
  console.log(apply ? `APPLY MODE: ${label} will be written.` : `DRY RUN MODE: no ${label} will be written.`);
};

/** A Zapier boolean input arrives as a boolean or as the text "true" or "false". */
export function bool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

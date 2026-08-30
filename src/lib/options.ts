import {
  LIVE_CONVERT_TARGET_FORMATS,
  LIVE_GENERATE_PRESETS,
  LIVE_GENERATE_STANDARDS,
  LIVE_PARSE_FORMATS,
  LIVE_PROFILES,
  LIVE_VALIDATE_FORMATS,
  isProfileAllowedForStandard,
  type Standard,
} from '@beliq/sdk';

// Dropdown value-spaces are sourced straight from the SDK's LIVE_* lists, which
// are the publicly-offered subset of the beliq coverage SSOT. Provisional
// formats the API can technically accept stay out of the UI; reach them through
// the Advanced (JSON) field. Labels here are cosmetic only.
const LABELS: Record<string, string> = {
  auto: 'Auto-detect',
  cii: 'CII',
  ubl: 'UBL',
  xrechnung: 'XRechnung',
  zugferd: 'ZUGFeRD',
  facturx: 'Factur-X',
  'peppol-bis': 'Peppol BIS',
  basicwl: 'BASIC WL',
  en16931: 'EN 16931',
  extended: 'EXTENDED',
  'extended-ctc-fr': 'EXTENDED CTC FR',
};

/**
 * Turn a LIVE_* value list into a Zapier `choices` map: `{ value: label }`.
 * Zapier renders the label in the dropdown and stores the value.
 */
export function toChoices(values: readonly string[]): Record<string, string> {
  const choices: Record<string, string> = {};
  for (const value of values) {
    choices[value] = LABELS[value] ?? value;
  }
  return choices;
}

// Curated profile presets (e.g. NLCIUS = Peppol BIS + the netherlands-nlcius
// profile) are offered as extra generate targets beside the plain standards; a
// profile preset resolves to its standard + profile at call time.
const PROFILE_PRESETS = LIVE_GENERATE_PRESETS.filter((p) => p.profile);

export const GENERATE_STANDARD_CHOICES: Record<string, string> = {
  ...toChoices(LIVE_GENERATE_STANDARDS),
  ...Object.fromEntries(PROFILE_PRESETS.map((p) => [p.id, p.label])),
};

export interface GenerateTarget {
  standard: Standard;
  profile?: string;
  output?: 'xml' | 'pdf';
}

/** Resolve a Standard-field value to the generate standard (and profile) it means. */
export function resolveGenerateTarget(value: string): GenerateTarget {
  const preset = PROFILE_PRESETS.find((p) => p.id === value);
  if (preset) return { standard: preset.standard, profile: preset.profile, output: preset.output };
  return { standard: value as Standard };
}

// Zapier `choices` are static per field: they cannot narrow to another field's
// value without a dynamic dropdown, and there is no list-profiles endpoint to
// back one. So the field offers the Factur-X family list and `usableProfile`
// drops a value the chosen standard does not accept, rather than sending a pair
// the engine answers with 422 PROFILE_STANDARD_MISMATCH.
export const PROFILE_CHOICES = toChoices(LIVE_PROFILES);

/** Drop a profile the resolved standard does not accept. */
export function usableProfile(value: string, profile: string | undefined): string | undefined {
  if (!profile) return undefined;
  return isProfileAllowedForStandard(resolveGenerateTarget(value).standard, profile)
    ? profile
    : undefined;
}
export const VALIDATE_FORMAT_CHOICES = toChoices(LIVE_VALIDATE_FORMATS);
export const PARSE_FORMAT_CHOICES = toChoices(LIVE_PARSE_FORMATS);
export const CONVERT_TARGET_CHOICES = toChoices(LIVE_CONVERT_TARGET_FORMATS);

export const OUTPUT_CHOICES: Record<string, string> = {
  xml: 'XML',
  pdf: 'PDF (Hybrid)',
};

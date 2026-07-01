import {
  LIVE_CONVERT_TARGET_FORMATS,
  LIVE_GENERATE_STANDARDS,
  LIVE_PARSE_FORMATS,
  LIVE_PROFILES,
  LIVE_VALIDATE_FORMATS,
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

export const GENERATE_STANDARD_CHOICES = toChoices(LIVE_GENERATE_STANDARDS);
export const PROFILE_CHOICES = toChoices(LIVE_PROFILES);
export const VALIDATE_FORMAT_CHOICES = toChoices(LIVE_VALIDATE_FORMATS);
export const PARSE_FORMAT_CHOICES = toChoices(LIVE_PARSE_FORMATS);
export const CONVERT_TARGET_CHOICES = toChoices(LIVE_CONVERT_TARGET_FORMATS);

export const OUTPUT_CHOICES: Record<string, string> = {
  xml: 'XML',
  pdf: 'PDF (Hybrid)',
};

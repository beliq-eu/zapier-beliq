import type { PlainOutputField } from 'zapier-platform-core';
import type { RulesetArtifact, ValidationIssue, ValidationResult } from '@beliq/sdk';

export type Field = Omit<PlainOutputField, 'key' | 'children'> & { label: string };
/**
 * A list of objects, or one object. Zapier's field schema makes `children` and
 * `list` mutually exclusive, and only checks that for input fields. So each
 * child is declared on its own: `errors[]ruleId` for an item of a list,
 * `pdfInput__attachmentName` for a key of an object, as Zapier flattens them.
 */
export type Entry = Field | { label: string; items: Record<string, Field> } | { label: string; object: Record<string, Field> };
type PdfInput = NonNullable<ValidationResult['pdfInput']>;

function flatten(key: string, entry: Entry): PlainOutputField[] {
  const nested = 'items' in entry ? { sep: '[]', map: entry.items } : 'object' in entry ? { sep: '__', map: entry.object } : undefined;
  if (!nested) return [{ key, ...entry }];
  return Object.entries(nested.map).map(([child, field]) => ({
    ...field,
    key: `${key}${nested.sep}${child}`,
    label: `${entry.label} ${field.label}`,
  }));
}

const ISSUE_FIELDS = {
  ruleId: { label: 'Rule ID' },
  severity: { label: 'Severity' },
  location: { label: 'Location' },
  message: { label: 'Message' },
} satisfies Record<keyof ValidationIssue, Field>;

const ARTIFACT_FIELDS = {
  key: { label: 'Key' },
  version: { label: 'Version' },
  fileSha256: { label: 'File SHA-256' },
} satisfies Record<keyof RulesetArtifact, Field>;

const PDF_INPUT_FIELDS = {
  containerChecked: { label: 'Container Checked', type: 'boolean' },
  attachmentName: { label: 'Attachment Name' },
  attachmentFoundBy: { label: 'Attachment Found By' },
  attachmentCandidates: { label: 'Attachment Candidates', type: 'integer' },
} satisfies Record<keyof PdfInput, Field>;

/**
 * Every key of the SDK's `ValidationResult`, as Validate Invoice lists it. The
 * map is checked against that type, so a field the API gains fails the
 * typecheck at the SDK bump until it is given a label here.
 */
export const VALIDATION_FIELDS = {
  valid: { label: 'Valid', type: 'boolean' },
  verified: { label: 'Verified', type: 'boolean' },
  format: { label: 'Format' },
  profileDetected: { label: 'Profile Detected' },
  verificationBadgeLabel: { label: 'Verification Badge Label' },
  verificationBadge: { label: 'Verification Badge' },
  verificationTier: { label: 'Verification Tier' },
  franceCtcBlockingRuleIds: { label: 'France CTC Blocking Rule IDs', list: true },
  errors: { label: 'Error', items: ISSUE_FIELDS },
  warnings: { label: 'Warning', items: ISSUE_FIELDS },
  schematronVersion: { label: 'Schematron Version' },
  ciusVersion: { label: 'CIUS Version' },
  peppolVersion: { label: 'Peppol Version' },
  facturxProfile: { label: 'Factur-X Profile' },
  facturxVersion: { label: 'Factur-X Version' },
  franceCtcApplied: { label: 'France CTC Applied', type: 'boolean' },
  franceCtcVersion: { label: 'France CTC Version' },
  franceExtendedCtcApplied: { label: 'France EXTENDED-CTC-FR Applied', type: 'boolean' },
  italyFatturapaXsdBundle: { label: 'Italy FatturaPA XSD Bundle' },
  italyFatturapaRuntimeVersion: { label: 'Italy FatturaPA Runtime Version' },
  italySdiMessaggiXsdBundle: { label: 'Italy SDI Messaggi XSD Bundle' },
  italySdiMessaggiXsdVersion: { label: 'Italy SDI Messaggi XSD Version' },
  spainFacturaeXsdBundle: { label: 'Spain Facturae XSD Bundle' },
  spainFacturaeRuntimeVersion: { label: 'Spain Facturae Runtime Version' },
  sloveniaEslogXsdBundle: { label: 'Slovenia e-SLOG XSD Bundle' },
  sloveniaEslogRuntimeVersion: { label: 'Slovenia e-SLOG Runtime Version' },
  polandKsefFa3XsdBundle: { label: 'Poland KSeF FA(3) XSD Bundle' },
  polandKsefFa3RuntimeVersion: { label: 'Poland KSeF FA(3) Runtime Version' },
  romaniaRoCiusVersion: { label: 'Romania RO_CIUS Version' },
  netherlandsNlciusVersion: { label: 'Netherlands NLCIUS Version' },
  rulesetChannel: { label: 'Ruleset Channel' },
  rulesetFellBack: { label: 'Ruleset Fell Back', type: 'boolean' },
  rulesetSunsetsOn: { label: 'Ruleset Sunsets On' },
  pdfInput: { label: 'PDF Input', object: PDF_INPUT_FIELDS },
  sha256: { label: 'Document SHA-256' },
  rulesetSha256: { label: 'Ruleset SHA-256' },
  rulesetArtifacts: { label: 'Ruleset Artifact', items: ARTIFACT_FIELDS },
  driftCheckedAt: { label: 'Drift Checked At', type: 'datetime' },
} satisfies Record<keyof ValidationResult, Entry>;

export const VALIDATION_OUTPUT_FIELDS = Object.entries(VALIDATION_FIELDS).flatMap(([key, entry]) =>
  flatten(key, entry),
);

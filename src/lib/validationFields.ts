import type { PlainOutputField } from 'zapier-platform-core';
import type { RulesetArtifact, ValidationIssue, ValidationResult } from '@beliq/sdk';

type Field = Omit<PlainOutputField, 'key'>;
type PdfInput = NonNullable<ValidationResult['pdfInput']>;

function fields(map: Record<string, Field>): PlainOutputField[] {
  return Object.entries(map).map(([key, field]) => ({ key, ...field }));
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
  containerChecked: { label: 'PDF Container Checked', type: 'boolean' },
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
  errors: { label: 'Errors', list: true, children: fields(ISSUE_FIELDS) },
  warnings: { label: 'Warnings', list: true, children: fields(ISSUE_FIELDS) },
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
  pdfInput: { label: 'PDF Input', children: fields(PDF_INPUT_FIELDS) },
  sha256: { label: 'Document SHA-256' },
  rulesetSha256: { label: 'Ruleset SHA-256' },
  rulesetArtifacts: { label: 'Ruleset Artifacts', list: true, children: fields(ARTIFACT_FIELDS) },
  driftCheckedAt: { label: 'Drift Checked At', type: 'datetime' },
} satisfies Record<keyof ValidationResult, Field>;

export const VALIDATION_OUTPUT_FIELDS = fields(VALIDATION_FIELDS);

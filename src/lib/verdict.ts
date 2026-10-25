import type { ValidationResult } from '@beliq/sdk';
import {
  checkDepth,
  franceBlockLines,
  pdfInputLine,
  rulesetChannelLine,
  verdictWord,
} from '@beliq/sdk/helpers';

export interface VerdictOutput {
  summary: string;
  checkDepth?: string;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/**
 * The verdict in the API's own words, for a step a user maps into the next one.
 * A France CTC block leads, because the API reports it apart from `valid`: a
 * document can be valid and still be refused for transmission. The check depth
 * is the label the API sent, or says that none was stated. Nothing ran when
 * `verified` is false, so no depth is named then.
 */
export function verdictOutput(result: ValidationResult): VerdictOutput {
  const word = verdictWord(result);
  if (result.verified === false) return { summary: word };

  const depth = checkDepth(result);
  const counts = `${plural(result.errors.length, 'error')}, ${plural(result.warnings.length, 'warning')}`;
  const lines = [
    ...franceBlockLines(result),
    `${word} (${depth}): ${counts}`,
    rulesetChannelLine(result),
    pdfInputLine(result),
  ].filter((line): line is string => line !== undefined);
  return { summary: lines.join('\n'), checkDepth: depth };
}

/** The two output fields `verdictOutput` fills, in the order Zapier lists them. */
export const VERDICT_OUTPUT_FIELDS = [
  { key: 'summary', label: 'Summary' },
  { key: 'checkDepth', label: 'Check Depth' },
];

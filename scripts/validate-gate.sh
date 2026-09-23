#!/usr/bin/env bash
# Run `zapier-platform validate` and fail on Zapier's integration checks, not
# only on the schema. zapier-platform-cli sets a non-zero exit code for a schema
# error alone (src/oclif/commands/validate.js in 19.1.0). A failed check
# ("Errors", which block `push`) or a publishing task (which blocks `promote`)
# is printed and the command still exits 0. General warnings ("Warnings" in the
# CLI's table, such as D003 and D004) block nothing, so they are tolerated.
#
# The counts come from the CLI's own summary lines. When a line is missing or
# unreadable (checks skipped, or reworded by a CLI update) the gate fails
# rather than passing on output it could not read.
set -euo pipefail
cd "$(dirname "$0")/.."

out="$(mktemp)"
trap 'rm -f "$out"' EXIT

node_modules/.bin/zapier-platform validate | tee "$out"

count() {
  sed -nE "s/^ +- ([0-9]+) $1\$/\\1/p" "$out"
}

failed="$(count 'checks failed')"
publishing="$(count 'checks with publishing warning')"

if ! [[ "$failed" =~ ^[0-9]+$ && "$publishing" =~ ^[0-9]+$ ]]; then
  echo "could not read the integration check summary above, so the checks are unverified." >&2
  exit 1
fi
if [ "$failed" -ne 0 ] || [ "$publishing" -ne 0 ]; then
  echo "Zapier integration checks: $failed failed, $publishing publishing tasks (see the table above)." >&2
  exit 1
fi
echo "Zapier integration checks: 0 failed, 0 publishing tasks."

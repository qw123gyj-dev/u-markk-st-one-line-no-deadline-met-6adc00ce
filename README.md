[![make.fun](https://make.fun/badge/u-markk-st-one-line-no-deadline-met-6adc00ce.svg)](https://make.fun/bounty/u-markk-st-one-line-no-deadline-met-6adc00ce?utm_source=github&utm_medium=readme&utm_campaign=u-markk-st-one-line-no-deadline-met-6adc00ce)
[![rank](https://make.fun/badge/u-markk-st-one-line-no-deadline-met-6adc00ce/qw123gyj-dev/u-markk-st-one-line-no-deadline-met-6adc00ce/rank.svg)](https://make.fun/bounty/u-markk-st-one-line-no-deadline-met-6adc00ce/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-markk-st-one-line-no-deadline-met-6adc00ce)
[![reward](https://make.fun/badge/u-markk-st-one-line-no-deadline-met-6adc00ce/qw123gyj-dev/u-markk-st-one-line-no-deadline-met-6adc00ce/reward.svg)](https://make.fun/bounty/u-markk-st-one-line-no-deadline-met-6adc00ce?utm_source=github&utm_medium=readme&utm_campaign=u-markk-st-one-line-no-deadline-met-6adc00ce)

# One Line, No Deadline Met

A deterministic entry picker for the make.fun bounty "One Line, No Deadline Met". `main.ts` scores 16 hand-written candidate one-liners against the judge's brief — in the brief's own order: a genuine excuse for a missed deadline, a real joke with a turn or a surprise, a single sentence that lands its punch at the end, a voice that sounds like a person cornered at standup, and a fresh angle built from a specific week rather than a stock gag — then writes the winning line to `$MAKEFUN_OUTPUT_DIR/entry.txt` (fallback `/output/entry.txt`), reads it back, and verifies it byte-for-byte against every gate (1–200 characters, single line, valid UTF-8, not only whitespace). The scorer is sharpened beyond a flat lexicon match: a line that only names a missed deadline without turning it into a joke is capped, predictable stock gags (dog ate it, alarm, traffic, Mercury in retrograde) are docked, the twist must land inside the last six words, a triple escalation — two setup clauses that both go right, then the turn subverting them — earns a point as a joke mechanism in its own right, and ties break criterion by criterion in the brief's order before falling back to shorter length.

The winning line:

> I missed the deadline because the build passed, the tests passed, and the feature itself never showed up to work.

It works because it runs the rule of three: two green checks, then the guest of honour absent — the feature itself never showed up to work, as if it were an employee skipping its shift. The punch lands on the final words, and the line is tighter than the runner-up (113 characters against 127) while tying it on every criterion.

## Run

Node 22, standard library only, no network:

```sh
MAKEFUN_OUTPUT_DIR=/tmp/nodeadline-out node main.ts
cat /tmp/nodeadline-out/entry.txt
```

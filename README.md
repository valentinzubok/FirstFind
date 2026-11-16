# FirstFind

<p align="center">
  <img src="assets/logo.png" alt="FirstFind" width="120" />
</p>

<p align="center">
  <strong>A bounty pot shared by the unique findings: validators rule on each report in the order it arrived, a repeat of an earlier finding earns nothing, and the code splits the pot.</strong>
</p>

<p align="center">
  <a href="https://valentinzubok.github.io/FirstFind/"><img src="https://img.shields.io/badge/Live-Console-f59e0b?style=flat-square" alt="Live console" /></a>
  <a href="https://github.com/valentinzubok/FirstFind/actions/workflows/ci.yml"><img src="https://github.com/valentinzubok/FirstFind/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/GenLayer-Studio%20Dev%2061997-f59e0b?style=flat-square" alt="Studio Dev" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="MIT" /></a>
</p>

---

## The trust problem

A team posts a bug bounty. Reports arrive. Two arguments follow that nobody wants to referee: "does
this report meet the criteria?" and "somebody already reported that". The funder says no to both,
the finders say yes, and a human judge in between is a person you have to trust. A model that reads
the reports is not enough either: a report can talk to it, and one odd reading would decide who is paid.

**FirstFind fixes the criteria before any report exists, freezes every report whole on chain, asks
validators one narrow question per report in arrival order, and leaves the arithmetic to the contract.**

```
open_bounty(bounty_id, title, criteria, reports_close_in, ruling_window,
            rounds_required, round_interval, max_reports)        PAYABLE, >= 1 GEN
submit(bounty_id, report_url, note)
                         anyone but the funder, one report per address, strictly BEFORE reports
                         close; the page (at most 1500 characters) is frozen whole on chain.
                         The order of submission is the order of ruling
rule(bounty_id)          anyone, once reports have closed and before the final deadline: one ruling
                         round of the next unruled report. Validators see the criteria, the earlier
                         UNIQUE reports and this one, and answer exactly one of
                             invalid     it does not meet the criteria
                             unique      it meets them and no earlier unique report says the same
                             dup:J       it meets them and repeats earlier unique report J
                         rounds_required agreeing rounds, a full round_interval apart, make the
                         verdict final; a different answer restarts the count
finalize(bounty_id)      anyone: before the final deadline once every report is ruled, from the
                         final deadline on always (an unruled report counts as not unique).
                         The pot is split equally between the unique reports; none -> VOID
claim(bounty_id, index)  anyone, for a unique report of a FINAL bounty: pays that finder its share
withdraw_funder(id)      the funder, once VOID
withdraw_credit()        take back what open_bounty refused to escrow
get_round(id, i, k)      every ruling round, kept for good
```

## What a finder and a funder can check

| Question | Answer |
|---|---|
| What counts as a finding? | The criteria, the deadlines, the number of agreeing rounds and the cap on reports are fixed when the pot is posted. There are no setters and no owner. |
| Can the funder reject a good report? | The funder cannot rule, cannot submit and cannot touch the pot until the bounty is VOID. Anyone calls `rule`; only validators judge. |
| Can a report talk the model into a ruling? | Every page is fenced as untrusted data, instruction-like phrasing is flagged and stored with every round, and the answer is one of three tokens. Anything else counts for nothing and is kept as evidence. |
| Can validators invent a duplicate? | `dup:J` is accepted only if J is an earlier report whose **final** verdict is unique. A made-up J, a later report or an invalid one is a malformed answer. The contract re-checks the verdict after consensus. |
| Can one odd reading decide a report? | With `rounds_required = 2` a verdict needs two agreeing rounds a full interval apart; a different answer restarts the count. The interval applies after any round, unclear ones included. |
| What is judged? | The page frozen when the finder submitted it (at most 1500 characters, so validators read all of it). Editing the live page afterwards changes nothing. |
| Can transaction order choose who is paid? | No. `rule` works only before the final deadline and `finalize` over unruled reports only at or after it; `get_schedule` never offers both. |
| What if nobody rules? | At the final deadline an unruled report counts as not unique. With no unique report the bounty is VOID and the funder takes the pot back. |
| Can the registry fill up? | No cap: bounties, reports, rounds and events live in `TreeMap`s with a `DynArray` index; a pot costs at least 1 GEN; views are paged. |
| A refused call that swallows money? | `open_bounty` never raises once value is attached: what cannot be escrowed becomes a credit and `withdraw_credit` pays it back. |
| Dust? | The pot splits as `pot // unique`; the remainder goes to the first unique report, so the books always balance to the wei. |

**What you still trust:** that the criteria ask for what the funder meant (read them before you
submit), and that validators agree on which side of "unique" a report falls. A report they cannot
agree on moves nothing: the round reverts, records nothing and is sent again.

## Live

| | |
|---|---|
| Console | **https://valentinzubok.github.io/FirstFind/** (reads work with no wallet) |
| Network | GenLayer Studio Dev / Studio Next — chain `61997` |
| Contract | [`0xA4fD941728C77cbb8D860a165Ab4B6e7EeCb2A1E`](https://explorer-studio-dev.genlayer.com/address/0xA4fD941728C77cbb8D860a165Ab4B6e7EeCb2A1E) — CI checks the deployed code equals [`contracts/FirstFind.py`](contracts/FirstFind.py) |
| Deploy record | [`STUDIO_DEV_DEPLOY.md`](STUDIO_DEV_DEPLOY.md) — every transaction of the demo, including the refused ones |

## Demo report pages

Files in this repository, read from `raw.githubusercontent.com`:
[`report-a.md`](web/public/fixtures/reports/report-a.md) (a reentrancy bug in `withdraw`),
[`report-b.md`](web/public/fixtures/reports/report-b.md) (the same bug in other words),
[`report-c.md`](web/public/fixtures/reports/report-c.md) (a different bug: fee rounding) and
[`report-d.md`](web/public/fixtures/reports/report-d.md) (vague, no bug named).

## Lint

`sh scripts/lint_current_sdk.sh` runs the official GenVM linter (`lint`, `check`, `typecheck`); CI
runs it on every push. Every refusal raises `gl.vm.UserError`; every method takes `self`.

## The console

[`web/`](web/) — Next.js 16 + `genlayer-js` + MetaMask, static export to Pages. It shows the trust
card before any money moves, every report frozen on chain, every ruling round with its verdict, who
was first and the share each unique finder gets. Success is decided by reading the contract **after**
the call ([`outcome.ts`](web/src/lib/outcome.ts)): a refused bounty is shown as "NOT opened" with the
credit and a button to take it back.

```bash
cd web && npm install
npm test        # 13 tests
npm run dev     # http://localhost:3022
```

## Tests

```bash
pip install -r requirements-dev.txt
python3 -m pytest -q      # 75 tests
```

[`tests/test_firstfind.py`](tests/test_firstfind.py): opening and the refusals that credit; who may
submit (the funder, a second report, after close, over the cap); the three verdicts and the answers
the code refuses (an invented `dup:J`, a later J, a non-unique J, wrong types); rounds and the
interval after unclear rounds; the final deadline (one second before, at, after; competing calls; the
schedule at every second); the pot split, dust and VOID; claims and withdrawals; the registry without
a cap; and the books balancing through a 240-step random run.

## License

[MIT](LICENSE) © 2026 Valentyn Zubok

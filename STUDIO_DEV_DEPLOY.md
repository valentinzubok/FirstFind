# FirstFind — Studio Dev (chain 61997) deploy record

| | |
|---|---|
| **Network** | GenLayer Studio Dev / Studio Next — chain `61997` |
| **Contract** | [`0xA4fD941728C77cbb8D860a165Ab4B6e7EeCb2A1E`](https://explorer-studio-dev.genlayer.com/address/0xA4fD941728C77cbb8D860a165Ab4B6e7EeCb2A1E) |
| **Deploy tx** | [`0xb55d8266…8a51a8`](https://explorer-studio-dev.genlayer.com/tx/0xb55d826630a96185cc5c5a67ea27ab4fb840f75c409c3ccddb2ff826fe8a51a8) from `0xf62E72FdB9F383Cc9b97b44e7e58fe5c30D734f9`, which has no role in the contract |
| **Source** | [`contracts/FirstFind.py`](contracts/FirstFind.py) — runner `py-genlayer:kzybg95x1gn21dw72m7hyg0maaap04n4nx55j9yt6fkdqxtz6bz0` |
| **Source sha256** | `09d26bc8d2a68704270eba4a7ae4529655cfd25f65ad432ab8bbf774ec2dad92` |

## Verify the source yourself

```bash
curl -s -X POST https://studio-dev.genlayer.com/api -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"gen_getContractCode","params":["0xA4fD941728C77cbb8D860a165Ab4B6e7EeCb2A1E"]}' \
  | python3 -c "import sys,json,base64,hashlib; print(hashlib.sha256(base64.b64decode(json.load(sys.stdin)['result'])).hexdigest())"
shasum -a 256 contracts/FirstFind.py
# both print 09d26bc8d2a68704270eba4a7ae4529655cfd25f65ad432ab8bbf774ec2dad92
```

CI runs the same comparison on every push (`scripts/verify_deployment.py`).

## Runner

Studio Dev moved to GenVM v0.4 on 2026-11-16. This contract uses the runner listed as current on the
[official runners page](https://sdk.genlayer.com/main/executors/v0.4/python-sdk/available-runners.html):
`py-genlayer:kzybg95x1gn21dw72m7hyg0maaap04n4nx55j9yt6fkdqxtz6bz0` (the `# v0.3.0` header line is accepted).

## Lint

`sh scripts/lint_current_sdk.sh` — `genvm-lint lint` on the file as deployed, then `check` and `typecheck`
on a copy whose header uses the runner bundled with the public linter (`1jb45aa8…`); the linter cannot yet
download the v0.4 runner. The contract body is byte-identical. Passed, in CI.

## The run

Accounts (throwaway test keys): funder `0xc1dFE7F2b62eB9240BE3d3E7B23b2294cdDeba02`, finders
`0x87860386…55ba` (1), `0xA2A9F805…84be` (2), `0xe37Ca39E…3656` (3), `0xd2266EDC…56BC` (4), stranger
`0xAd5aaA51788Db9e7f4Ead2ea2466c9Db19e8D7a6`. Report pages are files of this repository, read from
`raw.githubusercontent.com`. The run was made on 2026-11-16 in two parts: the script stopped at tx 26 on the
network's rate limit (30 requests per minute) and its remaining half (txs 27–42) was started again, nothing
edited in between; the script reads the chain to find where it was.

| # | Call | Sender | Result | What happened | Tx |
|---|------|--------|--------|---------------|----|
| 1 | `open_bounty(late-1)` value 1 GEN | funder | SUCCESS | `late-1`: 1 GEN, reports close in 240 s, window 300 s, 1 round — for the deadline boundary | [`0x1e2fd153…05ff09`](https://explorer-studio-dev.genlayer.com/tx/0x1e2fd153eb1fdbed1f6490ea6b477d0670393dd1a69131d1f8cfa0cbc405ff09) |
| 2 | `open_bounty(void-1)` value 1 GEN | funder | SUCCESS | `void-1`: 1 GEN, reports close in 300 s, 1 round, cap 2 — for an all-invalid bounty | [`0x55bfed08…bafd0c`](https://explorer-studio-dev.genlayer.com/tx/0x55bfed085dfc5e89cfc86038d3b954722c9f489bf7a31b1255100d12e5bafd0c) |
| 3 | `open_bounty(first-1)` value 3 GEN | funder | SUCCESS | `first-1`: 3 GEN, reports close in 600 s, window 1800 s, 2 agreeing rounds, interval 60 s, cap 4 | [`0xa5b9706d…ccdac7`](https://explorer-studio-dev.genlayer.com/tx/0xa5b9706d91aaeae23dcf6a4617b977f21c042d283b73a7235fb13a924accdac7) |
| 4 | `submit(late-1)` | finder 3 | SUCCESS | `late-1` report frozen (`report-c.md`) | [`0xceb0c164…919b50`](https://explorer-studio-dev.genlayer.com/tx/0xceb0c16491cad51142ce9d14cd88796823c98d8ee18f332c5689e4b94f919b50) |
| 5 | `submit(void-1)` | finder 1 | SUCCESS | `void-1` report 0 frozen (`report-d.md`, vague) | [`0x6ea8c3c9…d37f3c`](https://explorer-studio-dev.genlayer.com/tx/0x6ea8c3c95696b3947cc075bcfeeff24aa732a3d1436298e01887faf304d37f3c) |
| 6 | `submit(void-1)` | finder 2 | SUCCESS | `void-1` report 1 frozen (`report-d.md`) | [`0xe399bb72…572db4`](https://explorer-studio-dev.genlayer.com/tx/0xe399bb72f03b7bcd8682fdf0a05b35b28d58a2af6950bf7673e6ae5607572db4) |
| 7 | `submit(first-1)` | finder 1 | SUCCESS | `first-1` report 0 frozen (`report-a.md`, reentrancy in `withdraw`) | [`0x9a1b5da2…4c14c1`](https://explorer-studio-dev.genlayer.com/tx/0x9a1b5da2b7f85229a55968af04082b3cf62b56442b0f727e6e28b40d294c14c1) |
| 8 | `submit(first-1)` | funder | **ERROR** | the funder submits to its own bounty: **UserError** `the funder cannot submit` | [`0xb4a181b2…a5a446`](https://explorer-studio-dev.genlayer.com/tx/0xb4a181b2494e3a708e6fcef44c79b1e83cc920a45dc1fbe0cb7ef3cb2ba5a446) |
| 9 | `submit(first-1)` | finder 1 | **ERROR** | a second report from the same address: **UserError** `one report per address` | [`0x70f293a4…ce8d2d`](https://explorer-studio-dev.genlayer.com/tx/0x70f293a47d0a7b8c1c8db05c2221d79decf52ea972f990717ed8874395ce8d2d) |
| 10 | `submit(first-1)` | finder 2 | SUCCESS | `first-1` report 1 frozen (`report-b.md`, the same bug in other words) | [`0x2c6511a0…6fc826`](https://explorer-studio-dev.genlayer.com/tx/0x2c6511a0bc22ba2e512d9836a5661262c8cd698265c311c61471531a116fc826) |
| 11 | `submit(first-1)` | finder 3 | SUCCESS | `first-1` report 2 frozen (`report-c.md`, a different bug) | [`0x894e9ab9…cc677c`](https://explorer-studio-dev.genlayer.com/tx/0x894e9ab956546318cc476999e6d5e1ed94ea52922a8666a9463af010adcc677c) |
| 12 | `submit(first-1)` | finder 4 | SUCCESS | `first-1` report 3 frozen (`report-d.md`, vague) | [`0x30ed3296…e34f8c`](https://explorer-studio-dev.genlayer.com/tx/0x30ed32964eee27c75640e8adc5354b1cf30a7b78feb950a9805185a7e4e34f8c) |
| 13 | `rule(first-1)` | stranger | **ERROR** | `rule(first-1)` before reports close: **UserError** `reports close at 1794855727` | [`0x2c4d2a80…0c230f`](https://explorer-studio-dev.genlayer.com/tx/0x2c4d2a80f06404e8075785199041c82623edeab3e84087478ff3aaf2970c230f) |
| 14 | `open_bounty(dust-1)` value 0.5 GEN | funder | SUCCESS | `dust-1`: 0.5 GEN → refused in the return value (below the 1 GEN minimum), credited | [`0x9d61f033…ff301c`](https://explorer-studio-dev.genlayer.com/tx/0x9d61f033b2c6df5455b27422b39079d92e8d44c2a5ae1b9b35c4bc51dcff301c) |
| 15 | `open_bounty(first-1)` value 1 GEN | funder | SUCCESS | `first-1` again with 1 GEN: id already exists → refused, 1 GEN credited | [`0xa83e3aa3…a6506f`](https://explorer-studio-dev.genlayer.com/tx/0xa83e3aa3ead2a7cca10a2a44ed55e5bbda69a135cfbd9310b72d3ed6dca6506f) |
| 16 | `submit(late-1)` | stranger | **ERROR** | `submit(late-1)` after close: **UserError** `reports are closed` | [`0x82c559ef…9c9c57`](https://explorer-studio-dev.genlayer.com/tx/0x82c559ef4ed21504162c440acde4eea246e81ebef522b6a5c11ed8727e9c9c57) |
| 17 | `rule(late-1)` | stranger | **ERROR** | `rule(late-1)` after the final deadline: **UserError** `the final deadline has passed at 1794855650; only finalize is accepted` | [`0x94f71900…664c24`](https://explorer-studio-dev.genlayer.com/tx/0x94f719003f806300344a019d4419bc41cba3d1629a321f13a5469ce774664c24) |
| 18 | `finalize(late-1)` | stranger | SUCCESS | `finalize(late-1)`: nobody ruled, the report counts as not unique → VOID | [`0x66ff6d13…e7ab2a`](https://explorer-studio-dev.genlayer.com/tx/0x66ff6d13bcdc6679a5dac7aa80b08ed8b4ce7dbc4b493f99466d433306e7ab2a) |
| 19 | `withdraw_funder(late-1)` | stranger | **ERROR** | `withdraw_funder(late-1)` by a stranger: **UserError** `only the funder may withdraw` | [`0x9971a789…c6f931`](https://explorer-studio-dev.genlayer.com/tx/0x9971a7890a1f15eee9a93f51465ece42e914d08f07fd10264c6fbb33b1c6f931) |
| 20 | `withdraw_funder(late-1)` | funder | SUCCESS | the funder takes the 1 GEN pot back | [`0xd392224a…b7219b`](https://explorer-studio-dev.genlayer.com/tx/0xd392224a0eb88f3eb6f4ffa409b3f43d67d985f7eceacd7bb243d85971b7219b) |
| 21 | `withdraw_funder(late-1)` | funder | **ERROR** | the funder again: **UserError** `the pot was already returned` | [`0x8e0c5599…964b84`](https://explorer-studio-dev.genlayer.com/tx/0x8e0c5599c898ffc46680833a657f3a7bd5bd308b0b6460180ba7d31cd7964b84) |
| 22 | `rule(void-1)` | stranger | SUCCESS | `void-1` report 0, round 1: `invalid` → final (1 round) | [`0xf516c463…776a77`](https://explorer-studio-dev.genlayer.com/tx/0xf516c4637c8c3bce326f05e42dadabe2bfe47a9eca2ae6abeb22760635776a77) |
| 23 | `rule(void-1)` | stranger | SUCCESS | `void-1` report 1, round 1: `invalid` → final | [`0x29c5a6a4…f283bb`](https://explorer-studio-dev.genlayer.com/tx/0x29c5a6a4a7768cd442dfaea539c445c9fa13573d5c82a44317aa38948ef283bb) |
| 24 | `finalize(void-1)` | stranger | SUCCESS | `finalize(void-1)`: every report ruled, none unique → VOID | [`0x74c6a71a…2be8a2`](https://explorer-studio-dev.genlayer.com/tx/0x74c6a71a13861e9890db7e76a98b378c880268c34ef72949462e4637732be8a2) |
| 25 | `withdraw_funder(void-1)` | finder 1 | **ERROR** | `withdraw_funder(void-1)` by a finder: **UserError** `only the funder may withdraw` | [`0xc4f58d5e…b2e42a`](https://explorer-studio-dev.genlayer.com/tx/0xc4f58d5e9a7aa3619632b87e3b6922f3a26a0510b3cee05669bd9ff3bbb2e42a) |
| 26 | `withdraw_funder(void-1)` | funder | SUCCESS | the funder takes the 1 GEN pot back | [`0x44d0099e…5107bd`](https://explorer-studio-dev.genlayer.com/tx/0x44d0099e3d7de32c6478b21640b372b6ac5f0ac935e165df00e2f9048f5107bd) |
| 27 | `rule(first-1)` | stranger | SUCCESS | `first-1` report 0, round 1 (19:04:37 UTC): `unique`, 1 of 2 | [`0xc7ee6bac…05b456`](https://explorer-studio-dev.genlayer.com/tx/0xc7ee6bace06047a9fa7512be1a3099c4f73fc395c4eedc8a883f8179a105b456) |
| 28 | `rule(first-1)` | stranger | SUCCESS | `first-1` report 0, round 2 (19:05:57 UTC): `unique` → final | [`0xb15e742c…268020`](https://explorer-studio-dev.genlayer.com/tx/0xb15e742c1a6a5e2976d5c3fe6da2f99006a68cde1c9968a88aa5ced42f268020) |
| 29 | `rule(first-1)` | stranger | SUCCESS | `first-1` report 1, round 1 (19:06:31 UTC): `dup:0` (repeats report 0), 1 of 2 | [`0x5a8efad6…7589ed`](https://explorer-studio-dev.genlayer.com/tx/0x5a8efad6f6928df8f1ba1273d9b38adc68571fce5fe970b45b985c947a7589ed) |
| 30 | `rule(first-1)` | stranger | SUCCESS | `first-1` report 1, round 2 (19:07:36 UTC): `dup:0` → final | [`0x88a380c9…973cfd`](https://explorer-studio-dev.genlayer.com/tx/0x88a380c957b85be9beab40f57c023d26b65dbae43c76896ae96fa2ac0f973cfd) |
| 31 | `rule(first-1)` | stranger | SUCCESS | `first-1` report 2, round 1 (19:07:59 UTC): `unique`, 1 of 2 | [`0x61ddee50…8674e0`](https://explorer-studio-dev.genlayer.com/tx/0x61ddee50ff97db289dd9a4430cdc4509fbdfaf3af344402e70c131ea1b8674e0) |
| 32 | `rule(first-1)` | stranger | SUCCESS | `first-1` report 2, round 2 (19:09:04 UTC): `unique` → final | [`0x05d1cfca…958eda`](https://explorer-studio-dev.genlayer.com/tx/0x05d1cfca3bd4266a5c264bc2afcb774748ac825b61ec446a3ce5e0c5c0958eda) |
| 33 | `rule(first-1)` | stranger | SUCCESS | `first-1` report 3, round 1 (19:09:28 UTC): `invalid`, 1 of 2 | [`0x47e0c572…edfe1a`](https://explorer-studio-dev.genlayer.com/tx/0x47e0c57284dd001fc9c54499ec6524f321d6f0428f1ab4eb2df218f795edfe1a) |
| 34 | `rule(first-1)` | stranger | SUCCESS | `first-1` report 3, round 2 (19:10:34 UTC): `invalid` → final | [`0x7b5acc99…984b51`](https://explorer-studio-dev.genlayer.com/tx/0x7b5acc99432a6eaecbc16e54c58b300515135cd46f3202e510790fe655984b51) |
| 35 | `claim(first-1, 0)` | stranger | **ERROR** | `claim(first-1, 0)` before finalize: **UserError** `the bounty is not final` | [`0x5c4e28fc…1f8ff1`](https://explorer-studio-dev.genlayer.com/tx/0x5c4e28fc76e782330c3059c65e0ca457d0a75cc3c3d4e9f7088f1712a21f8ff1) |
| 36 | `finalize(first-1)` | stranger | SUCCESS | `finalize(first-1)`: reports 0 and 2 are unique → FINAL, 1.5 GEN each | [`0xbced623c…202b2a`](https://explorer-studio-dev.genlayer.com/tx/0xbced623c6549cdd27a24d10a6ed7b2d57b585ce099bb82e5f0e1f1e1c1202b2a) |
| 37 | `withdraw_funder(first-1)` | funder | **ERROR** | `withdraw_funder(first-1)` on a FINAL bounty: **UserError** `the funder can withdraw only from a void bounty` | [`0xf2d44d4f…64a786`](https://explorer-studio-dev.genlayer.com/tx/0xf2d44d4f7f6e78acfc993acf0984b9ddb79f847391b21e65d3f7ad263b64a786) |
| 38 | `claim(first-1, 1)` | finder 2 | **ERROR** | `claim(first-1, 1)` for the duplicate: **UserError** `that report is not a unique finding` | [`0x58cafe9b…1ba281`](https://explorer-studio-dev.genlayer.com/tx/0x58cafe9b6539a3ec0060ef9109b1bce614e4b168247ea4be69e820762c1ba281) |
| 39 | `claim(first-1, 0)` | finder 1 | SUCCESS | claim report 0: 1.5 GEN | [`0x1822e76d…0a33d0`](https://explorer-studio-dev.genlayer.com/tx/0x1822e76d7238065cd2b9068282b9ed081651afacf7534c8e352e0386770a33d0) |
| 40 | `claim(first-1, 2)` | finder 3 | SUCCESS | claim report 2: 1.5 GEN | [`0x36c2f47e…1046b4`](https://explorer-studio-dev.genlayer.com/tx/0x36c2f47ee5061470a960f7bb066bb2a575448df19aac71fb100ca6c5d41046b4) |
| 41 | `claim(first-1, 0)` | finder 1 | **ERROR** | claim report 0 again: **UserError** `this share was already paid` | [`0xff4633cd…940af5`](https://explorer-studio-dev.genlayer.com/tx/0xff4633cd3bc4f227aa72f39fec718f1c5fb505fbbf0f2feefe16dde73e940af5) |
| 42 | `withdraw_credit()` | funder | SUCCESS | the funder withdraws the 1.5 GEN credit from the two refused bounties | [`0xb1597d2e…04aaba`](https://explorer-studio-dev.genlayer.com/tx/0xb1597d2e7126f5e76097677aea4a853c37b2eedc044a42762ae4237fe204aaba) |

### What the run shows

* **First finder, not later finders.** `first-1` held four reports. Validators ruled report 0 `unique`, report 1
  `dup:0` (the same reentrancy bug in other words), report 2 `unique` (a different bug) and report 3 `invalid`
  (vague). Each verdict took two agreeing rounds a full interval apart. The pot of 3 GEN went 1.5 / 1.5 to reports
  0 and 2; the duplicate could not claim, a share could not be claimed twice.
* **The sums are the contract's.** Shares come from `get_shares`; the contract balance ended at 0
  (`get_balance` → `{"balance":"0","credits":"0","held":"0"}`).
* **The deadline splits time in two.** On `late-1` nobody ruled: `rule` after the final deadline is refused, `finalize`
  works and counts the unruled report as not unique → VOID, the funder takes the pot back once.
* **All invalid → VOID** (`void-1`), and a FINAL bounty cannot be withdrawn by the funder.
* **Guards.** The funder cannot submit; one report per address; reports after close and `rule` before close are
  refused; a refused open (below the minimum, duplicate id) credits the full amount; `withdraw_credit` returned 1.5 GEN.
* **Evidence kept per round.** `get_round("first-1", 1, 1)` keeps the verdict `dup:0`, the earlier unique reports
  it was judged against and the report hash.

### What this run did not show

* A round on which validators disagree, an `unclear` answer, and an invented `dup:J`. In this run every ruling
  round was recorded on the first try, so the "revert and send again" path was not exercised on chain; these are
  covered by unit tests (`tests/test_firstfind.py`).
* The 260-bounty registry and event paging are covered by unit tests, not by 260 transactions.

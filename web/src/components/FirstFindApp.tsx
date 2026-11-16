"use client";

import { useCallback, useEffect, useState } from "react";
import { CHAIN_ID, CONTRACT_ADDRESS, DEMO_CRITERIA, DEMO_REPORT, EXPLORER, GITHUB, txUrl } from "@/lib/config";
import {
  PAGE_SIZE,
  claim,
  finalize,
  getBooks,
  getBounty,
  getCredit,
  getRecentEvents,
  getReport,
  getRound,
  getSchedule,
  getShares,
  listBounties,
  openBounty,
  rule,
  submit,
  withdrawCredit,
  withdrawFunder,
  type Books,
  type Bounty,
  type EventRow,
  type Report,
  type RoundRecord,
  type Schedule,
  type Share,
} from "@/lib/contracts";
import {
  claimOutcome,
  creditOutcome,
  finalizeOutcome,
  openOutcome,
  refundOutcome,
  roundOutcome,
  submitOutcome,
  type Outcome,
} from "@/lib/outcome";
import { fundWithTestGen, getNativeBalance, type TxStage } from "@/lib/genlayer";
import { useWallet } from "./WalletProvider";

const short = (h: string, n = 10) => (h ? `${h.slice(0, n)}…${h.slice(-4)}` : "—");
const utc = (seconds: number) =>
  seconds ? `${new Date(seconds * 1000).toISOString().replace("T", " ").slice(0, 19)} UTC` : "—";

/** Wei as GEN, trimmed: 1500000000000000000 -> "1.5". */
const fmtGen = (wei: string | number | undefined) => {
  let v: bigint;
  try {
    v = BigInt(wei || 0);
  } catch {
    return "0";
  }
  const whole = v / BigInt(10 ** 18);
  const frac = (v % BigInt(10 ** 18)).toString().padStart(18, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac.slice(0, 6)}` : `${whole}`;
};

/** GEN typed by a person as wei, or "" when it is not a number. */
const toWei = (text: string) => {
  const m = /^(\d+)(?:\.(\d{1,18}))?$/.exec(text.trim());
  if (!m) return "";
  return (BigInt(m[1]) * BigInt(10 ** 18) + BigInt((m[2] || "").padEnd(18, "0") || "0")).toString();
};

const STATUS: Record<string, string> = {
  open: "open · reports, rulings and the final split are in progress",
  final: "FINAL · each unique finding claims its share",
  void: "VOID · no unique finding, the funder takes the pot back",
};

const REASON: Record<string, string> = {
  model_failed: "the model did not answer",
  not_json: "the model did not answer in JSON",
  not_object: "the model answer was not an object",
  bad_verdict: "the answer was not invalid, unique, or a repeat of an earlier unique report",
};

const verdictText = (v: string) => {
  if (!v) return "not ruled yet";
  if (v.startsWith("dup:")) return `repeat of report ${v.slice(4)} · earns nothing`;
  if (v === "unique") return "UNIQUE · shares the pot";
  if (v === "invalid") return "invalid · does not meet the criteria";
  return v;
};

function Flow() {
  return (
    <div className="roundsbox" aria-hidden="true">
      <p className="q">Who found it first, and does it count?</p>
      <div className="lane">
        <span>submit</span>
        <span className="bar yes">each report is frozen whole, in arrival order</span>
      </div>
      <div className="lane">
        <span>rule</span>
        <span className="bar yes">invalid · unique · repeat of an earlier unique report</span>
      </div>
      <div className="lane">
        <span>sum</span>
        <span className="bar no">the pot is split equally between the unique findings</span>
      </div>
      <p className="gap">⋮ the code does the sums, before the final deadline</p>
      <div className="lane">
        <span>result</span>
        <span className="bar final">first finders are paid · repeats earn nothing</span>
      </div>
    </div>
  );
}

function ReportView({
  b,
  r,
  rounds,
  share,
  canRule,
  me,
  disabled,
  onRule,
  onClaim,
}: {
  b: Bounty;
  r: Report;
  rounds: RoundRecord[];
  share?: Share;
  canRule: boolean;
  me: string | null;
  disabled: boolean;
  onRule: () => void;
  onClaim: () => void;
}) {
  const [showPage, setShowPage] = useState(false);
  const mine = !!me && r.entrant.toLowerCase() === me.toLowerCase();
  return (
    <li>
      <strong>
        report {r.index}: {verdictText(r.final_verdict)}
        {!r.final_verdict && r.standing.verdict ? ` (leaning ${r.standing.verdict}, ${r.standing.confirmations} of ${b.rounds_required} agreeing)` : ""}
      </strong>{" "}
      <span className="muted">
        · {short(r.entrant)}
        {mine ? " (you)" : ""} · {utc(r.submitted_at)} · page sha-256 {r.content_hash.slice(0, 12)}… ·{" "}
        <button className="ghost tiny" onClick={() => setShowPage(!showPage)}>
          {showPage ? "hide the frozen page" : `show the frozen page (${r.total_chars} chars)`}
        </button>
      </span>
      {showPage && (
        <div className="hashline" style={{ whiteSpace: "pre-wrap", marginTop: "0.4rem" }}>
          {r.url}
          {"\n"}
          {r.text}
        </div>
      )}
      <ul className="timeline">
        {rounds.map((x) => (
          <li key={x.round}>
            round {x.round}: {x.finding === "ruled" ? x.verdict : "no verdict"}{" "}
            <span className="muted">
              ({x.outcome}
              {x.reason ? ` · ${REASON[x.reason] || x.reason}` : ""}
              {x.earlier_unique.length ? ` · compared with unique: ${x.earlier_unique.join(", ")}` : " · nothing earlier to compare"}) · {x.at_text}
            </span>
          </li>
        ))}
      </ul>
      {!r.final_verdict && (
        <button className="ghost tiny" disabled={disabled || !canRule} onClick={onRule}>
          {canRule ? "run a ruling round" : r.rounds > 0 ? `next round from ${utc(r.last_round_at + b.round_interval)}` : "waiting for earlier reports"}
        </button>
      )}
      {share && (
        <button className="ghost tiny" style={{ marginLeft: "0.5rem" }} disabled={disabled || share.claimed} onClick={onClaim}>
          {share.claimed ? "share paid" : `pay ${fmtGen(share.amount)} GEN to ${short(share.entrant)}`}
        </button>
      )}
    </li>
  );
}

function BountyCard({
  b,
  sch,
  reports,
  rounds,
  shares,
  me,
  disabled,
  reportUrl,
  onPick,
  onSubmit,
  onRule,
  onFinalize,
  onClaim,
  onRefund,
}: {
  b: Bounty;
  sch?: Schedule;
  reports: Report[];
  rounds: Record<number, RoundRecord[]>;
  shares: Share[];
  me: string | null;
  disabled: boolean;
  reportUrl: string;
  onPick: () => void;
  onSubmit: () => void;
  onRule: () => void;
  onFinalize: () => void;
  onClaim: (i: number) => void;
  onRefund: () => void;
}) {
  const same = (a: string) => !!me && a.toLowerCase() === me.toLowerCase();
  const nextIndex = b.ruled_count;
  return (
    <article className="card" style={{ marginTop: "1rem" }}>
      <div className="head">
        <span className="id">{b.bounty_id}</span>
        <span className="muted">{STATUS[b.status] || b.status}</span>
      </div>
      <p>
        <button className="ghost tiny" onClick={onPick}>
          use this bounty above
        </button>
      </p>
      <p className="claimtext">{b.title}</p>
      <p className="hashline">
        pot {fmtGen(b.funding)} GEN · funder {short(b.funder)} · up to {b.max_reports} reports · {b.rounds_required} agreeing round
        {b.rounds_required === 1 ? "" : "s"} per report, {b.round_interval}s apart
      </p>
      <p className="hashline">
        reports until {utc(b.reports_close_at)} · final deadline {utc(b.final_deadline)}
      </p>
      <p className="hashline">criteria: {b.criteria}</p>
      {b.injection_flags.length > 0 && <p className="msg">Instruction-like phrasing was flagged: {b.injection_flags.join(", ")}.</p>}
      {reports.length > 0 && (
        <ul className="timeline">
          {reports.map((r) => (
            <ReportView
              key={r.index}
              b={b}
              r={r}
              rounds={rounds[r.index] || []}
              share={shares.find((s) => s.index === r.index)}
              canRule={!!sch?.can_rule && r.index === nextIndex}
              me={me}
              disabled={disabled}
              onRule={onRule}
              onClaim={() => onClaim(r.index)}
            />
          ))}
        </ul>
      )}
      {sch?.can_submit && !same(b.funder) && (
        <button className="ghost" disabled={disabled || !reportUrl} onClick={onSubmit}>
          submit the report page above
        </button>
      )}
      {b.status === "open" && (
        <button className="ghost" style={{ marginLeft: "0.5rem" }} disabled={disabled || !sch?.can_finalize} onClick={onFinalize}>
          {sch?.can_finalize
            ? "finalize: split the pot"
            : sch && sch.now < sch.reports_close_at
              ? "waiting for reports to close"
              : "waiting for every report to be ruled"}
        </button>
      )}
      {sch?.can_withdraw_funder && same(b.funder) && (
        <button className="ghost" style={{ marginLeft: "0.5rem" }} disabled={disabled} onClick={onRefund}>
          take the pot back ({fmtGen(b.funding)} GEN)
        </button>
      )}
    </article>
  );
}

export function FirstFindApp() {
  const { address, provider, connect, error: walletError } = useWallet();
  const [rows, setRows] = useState<Bounty[]>([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const [schedules, setSchedules] = useState<Record<string, Schedule>>({});
  const [reports, setReports] = useState<Record<string, Report[]>>({});
  const [rounds, setRounds] = useState<Record<string, Record<number, RoundRecord[]>>>({});
  const [shares, setShares] = useState<Record<string, Share[]>>({});
  const [books, setBooks] = useState<Books | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [credit, setCredit] = useState(BigInt(0));
  const [gen, setGen] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [err, setErr] = useState("");
  const [tx, setTx] = useState("");
  const [stage, setStage] = useState<TxStage | "">("");

  const [bid, setBid] = useState("harbor/vault-bugs");
  const [title, setTitle] = useState("Vault bug bounty");
  const [criteria, setCriteria] = useState(DEMO_CRITERIA);
  const [closeIn, setCloseIn] = useState("300");
  const [windowS, setWindowS] = useState("1800");
  const [roundsReq, setRoundsReq] = useState("1");
  const [interval, setIntervalSeconds] = useState("60");
  const [maxReports, setMaxReports] = useState("4");
  const [potGen, setPotGen] = useState("2");
  const [reportUrl, setReportUrl] = useState(DEMO_REPORT);

  const loadBounties = useCallback(async (count: number) => {
    // Newest first, one page at a time: the console never reads the whole registry.
    const first = await listBounties(0, 1);
    const n = first.total;
    setTotal(n);
    const start = Math.max(0, n - count);
    const page = await listBounties(start, Math.min(count, n));
    const ids = page.items.map((x) => x[0]).reverse();
    const list = (await Promise.all(ids.map((id) => getBounty(id)))).filter(Boolean) as Bounty[];
    setRows(list);
    setLoaded(ids.length);
    const sc = await Promise.all(ids.map((id) => getSchedule(id)));
    setSchedules(Object.fromEntries(sc.filter(Boolean).map((x) => [(x as Schedule).bounty_id, x as Schedule])));
    const rp = await Promise.all(
      list.map(async (b) => (await Promise.all(Array.from({ length: b.report_count }, (_, i) => getReport(b.bounty_id, i)))).filter(Boolean) as Report[]),
    );
    setReports(Object.fromEntries(list.map((b, i) => [b.bounty_id, rp[i]])));
    const rs = await Promise.all(
      list.map(async (b, i) => {
        const byReport: Record<number, RoundRecord[]> = {};
        for (const r of rp[i]) {
          byReport[r.index] = (await Promise.all(Array.from({ length: r.rounds }, (_, k) => getRound(b.bounty_id, r.index, k + 1)))).filter(Boolean) as RoundRecord[];
        }
        return byReport;
      }),
    );
    setRounds(Object.fromEntries(list.map((b, i) => [b.bounty_id, rs[i]])));
    const sh = await Promise.all(list.map((b) => (b.status === "final" ? getShares(b.bounty_id) : Promise.resolve([] as Share[]))));
    setShares(Object.fromEntries(list.map((b, i) => [b.bounty_id, sh[i]])));
  }, []);

  const refresh = useCallback(
    async (count = Math.max(PAGE_SIZE, loaded)) => {
      setLoading(true);
      try {
        const [ev, b] = await Promise.all([getRecentEvents(10), getBooks()]);
        setBooks(b);
        setEvents(ev);
        await loadBounties(count);
        if (address) {
          setGen(await getNativeBalance(address));
          setCredit(await getCredit(address));
        } else {
          setCredit(BigInt(0));
        }
      } catch (e) {
        setErr(`Error: ${e instanceof Error ? e.message : "read failed"}`);
      } finally {
        setLoading(false);
      }
    },
    [address, loadBounties, loaded],
  );

  useEffect(() => {
    void refresh(PAGE_SIZE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const onStage = (next: TxStage, hash: string) => {
    setTx(hash);
    setStage(next);
    if (next === "finalized") void refresh();
  };

  /** Send, then decide success from chain state - never from the receipt alone. */
  const run = async (name: string, fn: () => Promise<string | void>, check?: () => Promise<Outcome>) => {
    if (!address || !provider) {
      setErr("Connect MetaMask for writes");
      return;
    }
    setBusy(name);
    setErr("");
    setOutcome(null);
    setStage("");
    try {
      const hash = await fn();
      if (hash) setTx(hash);
      if (check) setOutcome(await check());
      await refresh();
    } catch (e) {
      setErr(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy("");
    }
  };

  const acct = address as `0x${string}`;
  const disabled = !!busy || !address;
  const potWei = toWei(potGen);

  const doOpen = () => {
    const before = credit;
    void run(
      "open_bounty",
      () => openBounty(acct, provider, { id: bid, title, criteria, closeIn, window: windowS, rounds: roundsReq, interval, maxReports, pot: potWei }, onStage),
      async () => openOutcome(await getBounty(bid), acct, before, await getCredit(acct), BigInt(potWei || "0")),
    );
  };

  const doSubmit = (b: Bounty) => {
    const before = b.report_count;
    void run(
      "submit",
      () => submit(acct, provider, b.bounty_id, reportUrl, "", onStage),
      async () => submitOutcome(before, (await getBounty(b.bounty_id))?.report_count ?? before),
    );
  };

  const doRule = (b: Bounty) => {
    const index = b.ruled_count;
    const before = (reports[b.bounty_id] || []).find((r) => r.index === index)?.rounds ?? 0;
    void run(
      "rule",
      () => rule(acct, provider, b.bounty_id, onStage),
      async () => {
        const r = await getReport(b.bounty_id, index);
        return roundOutcome(before, r ? await getRound(b.bounty_id, index, r.rounds) : null);
      },
    );
  };

  const doFinalize = (b: Bounty) =>
    void run(
      "finalize",
      () => finalize(acct, provider, b.bounty_id, onStage),
      async () => {
        const x = await getBounty(b.bounty_id);
        return finalizeOutcome(x?.status ?? "open", x?.unique.length ?? 0);
      },
    );

  const doClaim = (b: Bounty, i: number) =>
    void run(
      "claim",
      () => claim(acct, provider, b.bounty_id, i, onStage),
      async () => claimOutcome(!!(await getBounty(b.bounty_id))?.claimed[String(i)]),
    );

  const doRefund = (b: Bounty) =>
    void run("withdraw_funder", () => withdrawFunder(acct, provider, b.bounty_id, onStage), async () => refundOutcome(!!(await getBounty(b.bounty_id))?.refunded));

  return (
    <main className="wrap">
      <section className="hero">
        <div>
          <h1>
            First<span className="accent">Find</span>
          </h1>
          <p className="lede">
            A bug or idea bounty without the two arguments nobody wants to referee. Each report is{" "}
            <strong>frozen whole on chain</strong> in the order it arrived, validators rule on it{" "}
            <strong>one report at a time</strong> (invalid, unique, or a repeat of an earlier unique one), and the{" "}
            <strong>contract splits the pot</strong> equally between the unique findings. The first finder is paid; a repeat earns nothing.
          </p>
          <div className="chips">
            <span className="chip">
              chain <b>{CHAIN_ID}</b>
            </span>
            <span className="chip">
              bounties <b>{total}</b>
            </span>
            {books && (
              <span className="chip">
                held now <b>{fmtGen(books.balance)} GEN</b>
              </span>
            )}
          </div>
          <p className="muted" style={{ marginTop: "0.8rem" }}>
            Contract <a href={EXPLORER}>{short(CONTRACT_ADDRESS, 12)}</a> · nobody is privileged ·{" "}
            <a href={GITHUB}>source</a>
          </p>
          <div>
            {!address ? (
              <button onClick={() => void connect()}>Connect MetaMask</button>
            ) : (
              <span className="pill">
                <span className="dot" /> {short(address)} · {gen || "?"} GEN
              </span>
            )}
            {address && (
              <button
                className="ghost"
                style={{ marginLeft: "0.5rem" }}
                disabled={!!busy}
                onClick={() =>
                  void run("Get test GEN", async () => {
                    await fundWithTestGen(acct);
                  })
                }
              >
                Get test GEN
              </button>
            )}
          </div>
          {address && credit > BigInt(0) && (
            <p className="verdictbox">
              The contract holds <strong>{fmtGen(credit.toString())} GEN</strong> for you from a bounty it refused.{" "}
              <button
                className="ghost tiny"
                disabled={!!busy}
                onClick={() => {
                  const before = credit;
                  void run("withdraw_credit", () => withdrawCredit(acct, provider, onStage), async () => creditOutcome(before, await getCredit(acct)));
                }}
              >
                take it back
              </button>
            </p>
          )}
          {outcome && (
            <p className={outcome.verdict === "done" ? "okmsg" : "msg"}>
              <strong>{outcome.title}.</strong> {outcome.detail}
            </p>
          )}
          {walletError && <p className="msg">{walletError}</p>}
          {err && <p className="msg">{err}</p>}
          {tx && (
            <p className="tx muted">
              last tx <a href={txUrl(tx)}>{short(tx, 14)}</a>{" "}
              {stage === "finalized" ? (
                <span className="stagepill final">finalized · payouts have landed</span>
              ) : (
                <span className="stagepill accepted">accepted — awaiting finalization</span>
              )}
            </p>
          )}
        </div>
        <Flow />
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Before you join a bounty: what is fixed, and what you trust</h2>
        <ul className="decide">
          <li>
            <span className="tag">the criteria</span> are written by the funder and fixed when the pot is escrowed. You trust that they
            ask for what you can deliver; read them before you spend time on a report.
          </li>
          <li>
            <span className="tag">the order</span> reports are ruled in the order they arrived. A report can only be a repeat of an{" "}
            <strong>earlier</strong> report that was ruled unique, so being first is decided by the chain, not by anyone&apos;s opinion.
          </li>
          <li>
            <span className="tag">the ruling</span> validators only propose invalid, unique or &quot;repeat of report J&quot;; anything else counts for
            nothing. With two rounds the same answer has to come twice, a full interval apart, and a different answer restarts the count.
          </li>
          <li>
            <span className="tag">the pages</span> each report is frozen whole (at most 1500 characters). Edits afterwards change nothing. One
            report per address; the funder cannot submit.
          </li>
          <li>
            <span className="tag">the deadline</span> rulings and finalizing before the final deadline never overlap; from it on, only
            finalize, and a report nobody ruled counts as not unique. No unique finding: the funder takes the pot back.
          </li>
        </ul>
      </section>

      <div className="row">
        <section className="card">
          <h2>Open a bounty</h2>
          <label htmlFor="bid">Bounty id</label>
          <input id="bid" value={bid} onChange={(e) => setBid(e.target.value)} />
          <label htmlFor="title">Title</label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <label htmlFor="criteria">Criteria a report has to meet</label>
          <textarea id="criteria" rows={3} value={criteria} onChange={(e) => setCriteria(e.target.value)} />
          <div className="grid2">
            <div>
              <label htmlFor="pot">Pot (GEN, at least 1)</label>
              <input id="pot" value={potGen} onChange={(e) => setPotGen(e.target.value)} />
            </div>
            <div>
              <label htmlFor="maxr">Reports accepted (1–4)</label>
              <input id="maxr" value={maxReports} onChange={(e) => setMaxReports(e.target.value)} />
            </div>
            <div>
              <label htmlFor="close">Reports close in (s)</label>
              <input id="close" value={closeIn} onChange={(e) => setCloseIn(e.target.value)} />
            </div>
            <div>
              <label htmlFor="win">Ruling window after it (s)</label>
              <input id="win" value={windowS} onChange={(e) => setWindowS(e.target.value)} />
            </div>
            <div>
              <label htmlFor="rounds">Agreeing rounds (1 or 2)</label>
              <input id="rounds" value={roundsReq} onChange={(e) => setRoundsReq(e.target.value)} />
            </div>
            <div>
              <label htmlFor="interval">Interval between rounds (s)</label>
              <input id="interval" value={interval} onChange={(e) => setIntervalSeconds(e.target.value)} />
            </div>
          </div>
          <button disabled={disabled || !bid || !title || !criteria || potWei === ""} onClick={doOpen}>
            {busy === "open_bounty" ? (
              <span className="working">
                <span className="spinner" /> opening the bounty…
              </span>
            ) : (
              `escrow ${potGen || "0"} GEN as the pot`
            )}
          </button>
        </section>

        <section className="card">
          <h2>Report</h2>
          <p className="muted">
            Anyone but the funder hands in one page per bounty before reports close; it is frozen whole when the transaction lands. Pick a bounty
            below and press <em>submit the report page</em>.
          </p>
          <label htmlFor="rurl">Report page (https, at most 1500 characters)</label>
          <input id="rurl" value={reportUrl} onChange={(e) => setReportUrl(e.target.value)} />
          <ol className="decide">
            <li>The funder escrows the pot; finders submit before reports close.</li>
            <li>Anyone runs ruling rounds, one report at a time, in the order they arrived.</li>
            <li>Anyone finalizes once every report is ruled (or the final deadline has passed).</li>
            <li>Each unique finding is paid its share. No unique finding: the funder takes the pot back.</li>
          </ol>
          <p className="muted">
            Anything the contract refuses (pot below 1 GEN, a taken id, bad terms) is shown as &quot;NOT opened&quot; with your credit and a button to take
            it back.
          </p>
        </section>
      </div>

      <section style={{ marginTop: "2rem" }}>
        <div className="head">
          <h2>Bounties on chain (newest first)</h2>
          <button className="ghost" disabled={loading} onClick={() => void refresh()}>
            {loading ? "reading…" : "refresh"}
          </button>
        </div>
        {rows.length === 0 && !loading && <p className="muted">No bounties yet.</p>}
        {rows.map((b) => (
          <BountyCard
            key={b.bounty_id}
            b={b}
            sch={schedules[b.bounty_id]}
            reports={reports[b.bounty_id] || []}
            rounds={rounds[b.bounty_id] || {}}
            shares={shares[b.bounty_id] || []}
            me={address}
            disabled={disabled}
            reportUrl={reportUrl}
            onPick={() => setBid(b.bounty_id)}
            onSubmit={() => doSubmit(b)}
            onRule={() => doRule(b)}
            onFinalize={() => doFinalize(b)}
            onClaim={(i) => doClaim(b, i)}
            onRefund={() => doRefund(b)}
          />
        ))}
        {loaded < total && (
          <button className="ghost" style={{ marginTop: "1rem" }} disabled={loading} onClick={() => void refresh(loaded + PAGE_SIZE)}>
            load {Math.min(PAGE_SIZE, total - loaded)} older bounties ({total - loaded} not shown)
          </button>
        )}
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Recent events</h2>
        {events.length === 0 ? (
          <p className="muted">No events yet.</p>
        ) : (
          <ul className="timeline">
            {events.map((e) => (
              <li key={e.n}>
                <strong>{String(e.event)}</strong>{" "}
                <span className="muted">
                  {[e.bounty_id, e.index !== undefined ? `report ${e.index}` : null, e.report !== undefined ? `report ${e.report}` : null, e.round ? `round ${e.round}` : null, e.finding, e.outcome, e.status, e.funding ? `${fmtGen(String(e.funding))} GEN` : null, e.amount ? `${fmtGen(String(e.amount))} GEN` : null]
                    .filter(Boolean)
                    .map(String)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="foot">
        FirstFind on GenLayer Studio Dev (chain {CHAIN_ID}). Reads work without a wallet; writes need MetaMask and test GEN. The demo report pages are files in this
        repository.
      </footer>
    </main>
  );
}

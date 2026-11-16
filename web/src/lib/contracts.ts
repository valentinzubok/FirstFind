import { CONTRACT_ADDRESS } from "./config";
import { type Address, type TxStage, parseJson, readContract, writeAndWait } from "./genlayer";

export type Bounty = {
  bounty_id: string;
  funder: string;
  title: string;
  criteria: string;
  funding: string;
  created_at: number;
  reports_close_at: number;
  final_deadline: number;
  rounds_required: number;
  round_interval: number;
  max_reports: number;
  status: "open" | "final" | "void";
  report_count: number;
  ruled_count: number;
  unique: number[];
  claimed: Record<string, string>;
  paid_out: string;
  refunded: boolean;
  finalized_at: number;
  injection_flags: string[];
};

export type Report = {
  index: number;
  entrant: string;
  url: string;
  note: string;
  text: string;
  content_hash: string;
  total_chars: number;
  submitted_at: number;
  rounds: number;
  last_round_at: number;
  standing: { verdict: string; confirmations: number };
  final_verdict: string;
};

export type RoundRecord = {
  bounty_id: string;
  report: number;
  round: number;
  at: number;
  at_text: string;
  by: string;
  report_hash: string;
  earlier_unique: number[];
  finding: "ruled" | "unclear";
  reason: string;
  verdict: string;
  outcome: "proposed" | "confirmed" | "restarted" | "final" | "no_progress";
  confirmations: number;
  final_verdict: string;
  injection_flags: string[];
};

export type Schedule = {
  bounty_id: string;
  now: number;
  status: string;
  reports_close_at: number;
  final_deadline: number;
  can_submit: boolean;
  can_rule: boolean;
  next_round_at: number;
  can_finalize: boolean;
  can_claim: boolean;
  can_withdraw_funder: boolean;
  reports: number;
  ruled: number;
};
export type Share = { index: number; entrant: string; amount: string; claimed: boolean };
export type Books = { balance: string; held: string; credits: string };
export type EventRow = { event: string; n: number; [key: string]: unknown };
export type PageOf<T> = { total: number; offset: number; items: T[] };

type OnStage = (stage: TxStage, hash: string) => void;
const read = (fn: string, args: (string | number)[] = []) =>
  readContract<string>(CONTRACT_ADDRESS, fn, args as never[]);

export const PAGE_SIZE = 20;

/** One page of [bounty_id, status]. Never the whole registry. */
export async function listBounties(offset: number, limit = PAGE_SIZE): Promise<PageOf<[string, string]>> {
  return parseJson(await read("list_bounties", [offset, limit]), { total: 0, offset, items: [] });
}
export async function getBounty(id: string): Promise<Bounty | null> {
  try {
    const b = parseJson<Bounty>(await read("get_bounty", [id]), {} as Bounty);
    return b.bounty_id ? b : null;
  } catch {
    return null;
  }
}
export async function getReport(id: string, i: number): Promise<Report | null> {
  try {
    const r = parseJson<Report>(await read("get_report", [id, i]), {} as Report);
    return typeof r.index === "number" ? r : null;
  } catch {
    return null;
  }
}
export async function getRound(id: string, i: number, k: number): Promise<RoundRecord | null> {
  try {
    const r = parseJson<RoundRecord>(await read("get_round", [id, i, k]), {} as RoundRecord);
    return r.bounty_id ? r : null;
  } catch {
    return null;
  }
}
export async function getSchedule(id: string): Promise<Schedule | null> {
  const s = parseJson<Schedule>(await read("get_schedule", [id]), {} as Schedule);
  return s.bounty_id ? s : null;
}
export async function getShares(id: string): Promise<Share[]> {
  const s = parseJson<{ shares?: Share[] }>(await read("get_shares", [id]), {});
  return s.shares || [];
}
export async function getBooks(): Promise<Books | null> {
  return parseJson<Books | null>(await read("get_balance"), null);
}
/** The newest events: the last page of the paged event log. */
export async function getRecentEvents(count = 10): Promise<EventRow[]> {
  const head = parseJson<PageOf<EventRow>>(await read("get_events", [0, 1]), { total: 0, offset: 0, items: [] });
  const start = Math.max(0, head.total - count);
  const page = parseJson<PageOf<EventRow>>(await read("get_events", [start, count]), { total: 0, offset: 0, items: [] });
  return page.items.slice().reverse();
}
export async function getCredit(address: string): Promise<bigint> {
  try {
    return BigInt((await read("get_credit", [address])) || "0");
  } catch {
    return BigInt(0);
  }
}

export type NewBounty = {
  id: string;
  title: string;
  criteria: string;
  closeIn: string;
  window: string;
  rounds: string;
  interval: string;
  maxReports: string;
  /** The pot in wei; it travels as the transaction's value. */
  pot: string;
};

export async function openBounty(account: Address, provider: unknown, p: NewBounty, on?: OnStage) {
  return writeAndWait(
    account,
    provider,
    CONTRACT_ADDRESS,
    "open_bounty",
    [p.id, p.title, p.criteria, p.closeIn, p.window, p.rounds, p.interval, p.maxReports],
    on,
    BigInt(p.pot || "0"),
  );
}

const simple = (fn: string) => (account: Address, provider: unknown, id: string, on?: OnStage) =>
  writeAndWait(account, provider, CONTRACT_ADDRESS, fn, [id], on);
export const rule = simple("rule");
export const finalize = simple("finalize");
export const withdrawFunder = simple("withdraw_funder");

export async function submit(account: Address, provider: unknown, id: string, url: string, note: string, on?: OnStage) {
  return writeAndWait(account, provider, CONTRACT_ADDRESS, "submit", [id, url, note], on);
}
export async function claim(account: Address, provider: unknown, id: string, index: number, on?: OnStage) {
  return writeAndWait(account, provider, CONTRACT_ADDRESS, "claim", [id, index], on);
}
export async function withdrawCredit(account: Address, provider: unknown, on?: OnStage) {
  return writeAndWait(account, provider, CONTRACT_ADDRESS, "withdraw_credit", [], on);
}

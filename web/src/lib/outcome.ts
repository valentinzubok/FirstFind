/**
 * A transaction can be accepted by consensus and still not do what the user asked: the
 * contract refuses a bounty in its return value and books the money as a credit (a refused
 * payable call must not revert, or the value would be lost), and a ruling round may produce
 * no verdict. The console therefore never reports success from the receipt alone. It reads the
 * chain after the call and decides with these functions, which are pure so they can be tested.
 */

export type Verdict = "done" | "refused" | "pending";

export type Outcome = {
  verdict: Verdict;
  title: string;
  detail: string;
  /** Wei the user can take back with withdraw_credit, when the call was refused. */
  credit?: string;
};

const ONE = BigInt(10) ** BigInt(18);
const fmt = (wei: bigint) => {
  const whole = wei / ONE;
  const frac = (wei % ONE).toString().padStart(18, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac.slice(0, 6)}` : `${whole}`;
};

export type BountySeen = { funder: string; funding: string } | null;

/** After open_bounty: did a bounty with this id appear, funded by this account? */
export function openOutcome(
  bounty: BountySeen,
  me: string,
  creditBefore: bigint,
  creditAfter: bigint,
  sent: bigint,
): Outcome {
  if (bounty && bounty.funder.toLowerCase() === me.toLowerCase()) {
    return { verdict: "done", title: "Bounty opened", detail: `${fmt(BigInt(bounty.funding))} GEN is escrowed under the criteria you wrote.` };
  }
  if (creditAfter - creditBefore >= sent && sent > BigInt(0)) {
    return {
      verdict: "refused",
      title: "The bounty was NOT opened",
      detail: `The contract refused it and kept your ${fmt(sent)} GEN as a credit. Take it back with "take it back".`,
      credit: (creditAfter - creditBefore).toString(),
    };
  }
  if (bounty) {
    return { verdict: "refused", title: "The bounty was NOT opened", detail: "A bounty with this id already belongs to another account." };
  }
  return {
    verdict: "pending",
    title: "Waiting for the chain",
    detail: "The transaction is accepted but neither the bounty nor a credit is visible yet. Refresh after finalization.",
  };
}

/** After submit: did the report count go up? (A refused report reverts, so this is a read check.) */
export function submitOutcome(before: number, after: number): Outcome {
  return after > before
    ? { verdict: "done", title: "Report frozen", detail: "The page is stored whole on chain, in the order it arrived; rulings read only that text." }
    : { verdict: "pending", title: "Waiting for the chain", detail: "The report is not visible yet. Refresh after finalization." };
}

export type RoundSeen = { finding: string; outcome: string; reason: string; verdict: string; round: number } | null;

const SAY = (v: string) => (v.startsWith("dup:") ? `a repeat of report ${v.slice(4)}` : v);

/** After rule: say what the round did. A round with no verdict is kept as evidence, not an error. */
export function roundOutcome(roundsBefore: number, round: RoundSeen): Outcome {
  if (!round || round.round <= roundsBefore) {
    return { verdict: "pending", title: "Waiting for the chain", detail: "The round is not visible yet. Refresh after finalization." };
  }
  if (round.outcome === "final") {
    return { verdict: "done", title: "Verdict final", detail: `Enough rounds agreed: this report is ${SAY(round.verdict)}.` };
  }
  if (round.outcome === "proposed" || round.outcome === "confirmed" || round.outcome === "restarted") {
    return { verdict: "done", title: "Round counted", detail: `Validators ruled this round ${SAY(round.verdict)}; more agreeing rounds are still needed.` };
  }
  return {
    verdict: "refused",
    title: "The round produced no verdict",
    detail: `Validators could not rule${round.reason ? ` (${round.reason})` : ""}. The round is kept as evidence and moves nothing.`,
  };
}

/** After finalize: the bounty must have left "open". */
export function finalizeOutcome(status: string, uniqueCount: number): Outcome {
  if (status === "final") return { verdict: "done", title: "Bounty FINAL", detail: `The pot is split between ${uniqueCount} unique finding${uniqueCount === 1 ? "" : "s"}; each finder can claim.` };
  if (status === "void") return { verdict: "done", title: "Bounty VOID", detail: "No unique finding was ruled: the funder takes the pot back." };
  return { verdict: "pending", title: "Waiting for the chain", detail: "The bounty is not settled yet. Refresh after finalization." };
}

/** After claim: is the share marked paid? */
export function claimOutcome(claimed: boolean): Outcome {
  return claimed
    ? { verdict: "done", title: "Share paid", detail: "The share is on its way to the finder; it lands when the transaction is finalized." }
    : { verdict: "pending", title: "Waiting for the chain", detail: "The share is not marked paid yet. Refresh after finalization." };
}

/** After withdraw_funder: is the pot marked returned? */
export function refundOutcome(refunded: boolean): Outcome {
  return refunded
    ? { verdict: "done", title: "Pot returned", detail: "The pot is on its way back to the funder; it lands when the transaction is finalized." }
    : { verdict: "pending", title: "Waiting for the chain", detail: "The pot is not marked returned yet. Refresh after finalization." };
}

/** After withdraw_credit: did the credit go to zero? */
export function creditOutcome(creditBefore: bigint, creditAfter: bigint): Outcome {
  if (creditBefore > BigInt(0) && creditAfter === BigInt(0)) {
    return { verdict: "done", title: "Credit withdrawn", detail: `${fmt(creditBefore)} GEN is on its way to your wallet; it lands when the transaction is finalized.` };
  }
  return { verdict: "pending", title: "Waiting for the chain", detail: "The credit is still shown. Refresh after finalization." };
}

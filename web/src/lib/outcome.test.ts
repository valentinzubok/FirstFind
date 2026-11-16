import { describe, expect, it } from "vitest";
import { claimOutcome, creditOutcome, finalizeOutcome, openOutcome, refundOutcome, roundOutcome, submitOutcome } from "./outcome";

const ME = "0xAbC0000000000000000000000000000000000001";
const GEN = BigInt(10) ** BigInt(18);

describe("open_bounty", () => {
  it("reports success only when the bounty exists and is ours", () => {
    const o = openOutcome({ funder: ME.toLowerCase(), funding: (BigInt(4) * GEN).toString() }, ME, BigInt(0), BigInt(0), BigInt(4) * GEN);
    expect(o.verdict).toBe("done");
    expect(o.detail).toContain("4 GEN");
  });
  it("an accepted but refused bounty is reported as refused, with the credit", () => {
    const o = openOutcome(null, ME, BigInt(0), BigInt(4) * GEN, BigInt(4) * GEN);
    expect(o.verdict).toBe("refused");
    expect(o.title).toContain("NOT opened");
    expect(o.credit).toBe((BigInt(4) * GEN).toString());
  });
  it("an id taken by someone else is not a success", () => {
    const o = openOutcome({ funder: "0x0000000000000000000000000000000000000002", funding: "1" }, ME, BigInt(0), BigInt(0), GEN);
    expect(o.verdict).toBe("refused");
    expect(o.detail).toContain("another account");
  });
  it("before finalization nothing is claimed", () => {
    expect(openOutcome(null, ME, BigInt(0), BigInt(0), GEN).verdict).toBe("pending");
  });
  it("a credit that was already there is not mistaken for a new refusal", () => {
    expect(openOutcome(null, ME, GEN, GEN, GEN).verdict).toBe("pending");
  });
});

describe("submit", () => {
  it("counts only when the report count went up", () => {
    expect(submitOutcome(0, 1).verdict).toBe("done");
    expect(submitOutcome(1, 1).verdict).toBe("pending");
  });
});

describe("ruling rounds", () => {
  const r = (outcome: string, verdict = "unique", reason = "") => ({ finding: outcome === "no_progress" ? "unclear" : "ruled", outcome, reason, verdict, round: 2 });
  it("a final round names the verdict", () => {
    expect(roundOutcome(1, r("final")).title).toBe("Verdict final");
    expect(roundOutcome(1, r("final", "dup:0")).detail).toContain("repeat of report 0");
  });
  it("a counted round says more are needed", () => {
    const o = roundOutcome(1, r("confirmed", "invalid"));
    expect(o.verdict).toBe("done");
    expect(o.detail).toContain("more agreeing rounds");
  });
  it("a round without a verdict is reported as such, with the reason", () => {
    const o = roundOutcome(1, r("no_progress", "", "bad_verdict"));
    expect(o.verdict).toBe("refused");
    expect(o.detail).toContain("bad_verdict");
  });
  it("no new round yet is pending", () => {
    expect(roundOutcome(2, r("final")).verdict).toBe("pending");
    expect(roundOutcome(0, null).verdict).toBe("pending");
  });
});

describe("finalize, claim, refund, credit", () => {
  it("names who is owed the pot", () => {
    expect(finalizeOutcome("final", 2).detail).toContain("2 unique findings");
    expect(finalizeOutcome("void", 0).detail).toContain("funder");
    expect(finalizeOutcome("open", 0).verdict).toBe("pending");
  });
  it("a share or pot counts as paid only when the chain marks it", () => {
    expect(claimOutcome(true).verdict).toBe("done");
    expect(claimOutcome(false).verdict).toBe("pending");
    expect(refundOutcome(true).verdict).toBe("done");
    expect(refundOutcome(false).verdict).toBe("pending");
  });
  it("a credit counts as withdrawn only when it went to zero", () => {
    expect(creditOutcome(GEN, BigInt(0)).verdict).toBe("done");
    expect(creditOutcome(GEN, GEN).verdict).toBe("pending");
    expect(creditOutcome(BigInt(0), BigInt(0)).verdict).toBe("pending");
  });
});

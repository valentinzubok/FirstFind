/** Live FirstFind deploy on GenLayer Studio Dev (chain 61997). Override via env. */
export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_FIRSTFIND_ADDRESS ||
  "0xA4fD941728C77cbb8D860a165Ab4B6e7EeCb2A1E") as `0x${string}`;

/** Studio Dev / Studio Next — chain ID 61997. */
export const CHAIN_ID = 61997;
export const RPC_URL =
  process.env.NEXT_PUBLIC_GENLAYER_RPC || "https://studio-dev.genlayer.com/api";
export const EXPLORER_BASE =
  process.env.NEXT_PUBLIC_GENLAYER_EXPLORER || "https://explorer-studio-dev.genlayer.com";
export const EXPLORER = `${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`;
export const txUrl = (hash: string) => `${EXPLORER_BASE}/tx/${hash}`;

export const GITHUB = "https://github.com/valentinzubok/FirstFind";

/** Demo report pages: files in this repository, served by raw.githubusercontent.com. */
const RAW = "https://raw.githubusercontent.com/valentinzubok/FirstFind/main/web/public/fixtures/reports";
export const DEMO_REPORT = RAW + "/report-a.md";
export const DEMO_CRITERIA =
  "A concrete bug in the demo vault: it names the function that fails and says what goes wrong and how to fix it. Vague complaints do not count.";

import { lookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import { Agent } from "node:https";
import { BlockList, isIP } from "node:net";
import { ECDH } from "node:crypto";
import { z } from "zod";

// Only browser push services we support. Never accept an arbitrary user URL.
const PUSH_HOSTS = new Set(["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"]);
export function endpointPushValid(value: string): boolean {
  try {
    const url = new URL(value);
    const windowsPush = /^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname);
    return url.protocol === "https:" && (PUSH_HOSTS.has(url.hostname) || windowsPush) && !url.port &&
      !url.username && !url.password && !url.hash && (url.pathname !== "/" || (windowsPush && !!url.search));
  } catch { return false; } // A malformed URL is an explicit validation failure.
}

const endpoint = z.string().min(1).max(4096).refine(endpointPushValid, "Endpoint push tidak diizinkan");
function keyValid(value: string, bytes: number): boolean {
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(value)) return false;
  const decoded = Buffer.from(value, "base64url");
  if (decoded.length !== bytes) return false;
  if (bytes === 65) {
    try { ECDH.convertKey(decoded, "prime256v1"); }
    catch { return false; } // Invalid curve points are rejected, not sent.
  }
  return true;
}
export const subscriptionSchema = z.object({
  endpoint,
  keys: z.object({
    p256dh: z.string().max(100).refine((v) => keyValid(v, 65), "Key push tidak valid"),
    auth: z.string().max(32).refine((v) => keyValid(v, 16), "Auth push tidak valid"),
  }),
});
// DELETE must also permit removal of legacy subscriptions with invalid URLs.
export const unsubscribeSchema = z.object({ endpoint: z.string().min(1).max(4096) });

const blocked = new BlockList();
for (const [network, prefix] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.168.0.0", 16], ["192.0.0.0", 24], ["192.0.2.0", 24], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4]] as const) blocked.addSubnet(network, prefix, "ipv4");
// Allow globally routed IPv6 only; exclude documentation and mapped IPv4.
const globalV6 = new BlockList(); globalV6.addSubnet("2000::", 3, "ipv6");
blocked.addSubnet("2001:db8::", 32, "ipv6");
export function alamatPushPublik(address: string): boolean {
  const family = isIP(address);
  return family === 4 ? !blocked.check(address, "ipv4") : family === 6 && globalV6.check(address, "ipv6") && !blocked.check(address, "ipv6");
}

export async function agenPushAman(endpoint: string, resolve: (hostname: string, options: { all: true; verbatim: true }) => Promise<LookupAddress[]> = lookup): Promise<Agent> {
  if (!endpointPushValid(endpoint)) throw new Error("Endpoint push tidak diizinkan");
  const hostname = new URL(endpoint).hostname;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let addresses: LookupAddress[];
  try {
    addresses = await Promise.race([
      resolve(hostname, { all: true, verbatim: true }),
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("DNS push melewati batas waktu")), 3000); }),
    ]);
  } finally { clearTimeout(timer); }
  if (!addresses.length || addresses.some(({ address }) => !alamatPushPublik(address))) throw new Error("Alamat push bukan jaringan publik");
  // Pin the validated DNS answer to the connection: a second DNS lookup could rebind.
  return new Agent({ lookup: (host, options, callback) => {
    if (host !== hostname) { callback(new Error("Host push berubah"), []); return; }
    const selected = options.family ? addresses.filter((a) => a.family === options.family) : addresses;
    if (!selected.length) { callback(new Error("Alamat push tidak tersedia"), []); return; }
    if (options.all) callback(null, selected);
    else callback(null, selected[0].address, selected[0].family);
  } });
}

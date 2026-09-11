import { createHash } from "node:crypto";

// Per-process burst protection. Deployment-wide quotas belong at the gateway.
const buckets = new Map<string, { count: number; expires: number }>();
export function allowChatRequest(identity: string, now = Date.now()) {
  for (const [key, bucket] of buckets) if (bucket.expires <= now) buckets.delete(key);
  const key = createHash("sha256").update(identity).digest("hex");
  const bucket = buckets.get(key) ?? { count: 0, expires: now + 60000 };
  if (bucket.count >= 20 || (!buckets.has(key) && buckets.size >= 10000)) return false;
  bucket.count += 1;
  buckets.set(key, bucket);
  return true;
}

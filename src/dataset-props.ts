// TrueNAS 26 (PoolDatasetCreateFilesystem / PoolDatasetUpdate) rejects
// lowercase enum values and boolean atime with a 422 — these fields must be
// uppercase string literals like 'ON', 'OFF', 'LZ4', 'STANDARD', 'INHERIT'.
const ENUM_FIELDS = ["atime", "compression", "sync"] as const;
const BOOLEAN_ON_OFF_FIELDS = ["atime"] as const;

export function normalizeDatasetProps(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    if ((BOOLEAN_ON_OFF_FIELDS as readonly string[]).includes(key) && typeof value === "boolean") {
      out[key] = value ? "ON" : "OFF";
    } else if ((ENUM_FIELDS as readonly string[]).includes(key) && typeof value === "string") {
      out[key] = value.toUpperCase();
    } else {
      out[key] = value;
    }
  }
  return out;
}

// TrueNAS hands an admin API key its credentials in plain text: cloud sync provider keys,
// SSH and TLS private keys, password hashes, bind passwords, alert service tokens. Every
// byte this server returns lands in a model transcript, so all tool and resource output
// passes through here first.
//
// Redaction happens only on the way out. Handlers and the client still see real values,
// so a read-modify-write can never send "[redacted]" back to the NAS.

export const REDACTED = "[redacted]";

// Compared after lowercasing and dropping separators, so `api_key`, `API-Key` and `apiKey`
// are one name.
const SECRET_NAMES = new Set([
  "key", "pass", "pwd", "salt", "community", "bindpw", "monpwd",
  "accesskeyid", "serviceaccountcredentials", "encryptionsalt",
  "keyhash", "unixhash", "smbhash", "nthash", "keytab",
]);
const SECRET_FRAGMENTS = ["password", "passwd", "passphrase", "secret", "token", "privatekey", "privkey", "apikey"];
// Any other name ending in "key" is treated as a secret unless it is public by definition.
const PUBLIC_KEY_NAMES = new Set(["publickey", "pubkey", "sshpubkey", "hostkey", "remotehostkey"]);
// `privatekey_path`, `key_type` and `encryption_key_format` describe a secret without holding it.
const DESCRIPTIVE_SUFFIXES = ["path", "type", "format"];

// A Kerberos keytab arrives base64-encoded under the generic name `file`, which elsewhere
// holds paths and audit objects. Only a long base64 string there is treated as key material.
const BASE64_BLOB = /^[A-Za-z0-9+/\r\n]{64,}={0,2}$/;

const PEM_PRIVATE_KEY = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY-----|$)/g;
const URL_PASSWORD = /([a-z][a-z0-9+.-]*:\/\/[^\s/?#@:]*):([^\s/?#@]+)@/gi;
const QUERY_PARAM = /([?&])([^=&#\s"']+)=([^&#\s"']*)/g;
const DOUBLE_QUOTED_PAIR = /("([^"\\]*)"\s*:\s*)"((?:[^"\\]|\\.)*)"/g;
const SINGLE_QUOTED_PAIR = /('([^'\\]*)'\s*:\s*)'((?:[^'\\]|\\.)*)'/g;

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isSecretKeyName(name: string): boolean {
  const n = normalize(name);
  if (SECRET_NAMES.has(n)) return true;
  if (PUBLIC_KEY_NAMES.has(n) || DESCRIPTIVE_SUFFIXES.some((suffix) => n.endsWith(suffix))) return false;
  return SECRET_FRAGMENTS.some((fragment) => n.includes(fragment)) || n.endsWith("key");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Null, booleans, numbers and empty strings stay visible: they say whether something is
// set, or hold an id (an SFTP credential's `private_key` is a keypair id), and leak nothing.
function holdsSecret(key: string, value: unknown, inB2Provider: boolean): boolean {
  if (typeof value === "string") {
    if (value === "") return false;
  } else if (value === null || typeof value !== "object") {
    return false;
  }
  const n = normalize(key);
  // In a B2 provider `account` is the application key ID, the same half of the pair as an
  // S3 `access_key_id`. On other providers it names a storage account and stays.
  if (n === "account") return inB2Provider;
  if (n === "file") return typeof value === "string" && !value.startsWith("/") && BASE64_BLOB.test(value);
  return isSecretKeyName(key);
}

function redactPair(match: string, prefix: string, name: string, value: string, quote: string): string {
  return value !== "" && isSecretKeyName(name) ? `${prefix}${quote}${REDACTED}${quote}` : match;
}

/** Scrub secrets that hide inside a string: key blocks, URL passwords, query params, embedded pairs. */
function scrubString(text: string): string {
  return text
    .replace(PEM_PRIVATE_KEY, REDACTED)
    .replace(URL_PASSWORD, `$1:${REDACTED}@`)
    .replace(QUERY_PARAM, (match, sep: string, name: string, value: string) =>
      value !== "" && isSecretKeyName(name) ? `${sep}${name}=${REDACTED}` : match)
    .replace(DOUBLE_QUOTED_PAIR, (match, prefix: string, name: string, value: string) =>
      redactPair(match, prefix, name, value, '"'))
    .replace(SINGLE_QUOTED_PAIR, (match, prefix: string, name: string, value: string) =>
      redactPair(match, prefix, name, value, "'"));
}

/** Replace secret values at any depth. Expects JSON data, as parsed from a response. */
export function redactSecrets(value: unknown): unknown {
  if (typeof value === "string") return scrubString(value);
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!isRecord(value)) return value;
  const inB2Provider = typeof value.type === "string" && value.type.toUpperCase() === "B2";
  // fromEntries defines own properties, so a `__proto__` key in a response stays data.
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      holdsSecret(key, child, inB2Provider) ? REDACTED : redactSecrets(child),
    ]),
  );
}

/**
 * Redact a response body. JSON is parsed, redacted and re-serialised with the two-space
 * indent every handler uses, so a body with nothing to hide comes back unchanged. Anything
 * else, such as an error message, gets the string scrub.
 */
export function redactText(text: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return scrubString(text);
  }
  return JSON.stringify(redactSecrets(parsed), null, 2);
}

export interface ToolContent {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface ToolResult {
  content: ToolContent[];
  isError?: boolean;
  [key: string]: unknown;
}

function redactContent(item: ToolContent): ToolContent {
  if (item.type === "text" && typeof item.text === "string") {
    return { ...item, text: redactText(item.text) };
  }
  if (item.type === "resource" && isRecord(item.resource) && typeof item.resource.text === "string") {
    return { ...item, resource: { ...item.resource, text: redactText(item.resource.text) } };
  }
  return item;
}

export function redactToolResult(result: ToolResult): ToolResult {
  const redacted: ToolResult = { ...result, content: result.content.map(redactContent) };
  if ("structuredContent" in result) redacted.structuredContent = redactSecrets(result.structuredContent);
  return redacted;
}

export function redactResourceResult(result: unknown): unknown {
  if (!isRecord(result) || !Array.isArray(result.contents)) return result;
  return {
    ...result,
    contents: result.contents.map((item: unknown) =>
      isRecord(item) && typeof item.text === "string" ? { ...item, text: redactText(item.text) } : item),
  };
}

export interface ResourceServer {
  resource(...args: unknown[]): unknown;
}

/**
 * Wrap a server so every resource registered through it has its output redacted. The
 * handler is always the last argument to `resource()`, whatever overload is used.
 */
export function redactingResourceServer(server: ResourceServer): ResourceServer {
  return {
    resource(...args: unknown[]) {
      const handler = args.at(-1);
      if (typeof handler !== "function") return server.resource(...args);
      const read = handler as (...handlerArgs: unknown[]) => unknown;
      return server.resource(
        ...args.slice(0, -1),
        async (...handlerArgs: unknown[]) => redactResourceResult(await read(...handlerArgs)),
      );
    },
  };
}

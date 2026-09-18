import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  REDACTED,
  isSecretKeyName,
  redactSecrets,
  redactText,
  redactToolResult,
  redactingResourceServer,
} from "../src/redact.ts";
import { runTool } from "../src/run-tool.ts";
import { ToolRegistry } from "../src/registry.ts";
import { register as registerReplication } from "../src/tools/replication.ts";
import { registerResources } from "../src/resources.ts";
import * as fx from "./fixtures/truenas-responses.ts";

/** Round-trip a response the way every handler emits it, then parse what the model would see. */
function seen<T>(data: T): T {
  return JSON.parse(redactText(JSON.stringify(data, null, 2))) as T;
}

function textOf(result: { content: { text?: string }[] }): string {
  const text = result.content[0]?.text;
  assert.equal(typeof text, "string");
  return text as string;
}

function assertNoFakeSecrets(text: string) {
  for (const secret of fx.FAKE_SECRETS) {
    assert.ok(!text.includes(secret), `secret leaked: ${secret.slice(0, 24)}…`);
  }
}

describe("cloud sync", () => {
  it("redacts B2 and S3 provider credentials in a task list and keeps identifiers", () => {
    const [b2, s3] = seen(fx.cloudsyncTasks);

    assert.equal(b2.credentials.provider.key, REDACTED);
    assert.equal(b2.credentials.provider.account, REDACTED);
    assert.equal(s3.credentials.provider.secret_access_key, REDACTED);
    assert.equal(s3.credentials.provider.access_key_id, REDACTED);

    assert.equal(b2.credentials.id, 1);
    assert.equal(b2.credentials.name, "Backblaze");
    assert.equal(b2.credentials.provider.type, "B2");
    assert.equal(s3.credentials.provider.type, "S3");
    assert.equal(s3.credentials.provider.region, "us-east-1");
    assert.equal(s3.credentials.provider.max_upload_parts, 10000);
    assert.equal(b2.attributes.bucket, "example-bucket");
    assert.equal(b2.attributes.folder, "/backups");
    assert.equal(b2.description, "nightly backups");
    assert.deepEqual(b2.schedule, fx.cloudsyncTasks[0].schedule);
    assert.equal(b2.job.state, "SUCCESS");
    assert.equal(b2.job.credentials, null);
  });

  it("redacts a set encryption password and salt but leaves unset ones empty", () => {
    const [b2, s3] = seen(fx.cloudsyncTasks);
    assert.equal(s3.encryption_password, REDACTED);
    assert.equal(s3.encryption_salt, REDACTED);
    assert.equal(b2.encryption_password, "");
    assert.equal(b2.encryption_salt, "");
    assert.equal(s3.encryption, true);
  });

  it("redacts the credentials list and cloud backup passwords", () => {
    const creds = seen(fx.cloudsyncCredentials);
    assert.equal(creds[0].provider.key, REDACTED);
    assert.equal(creds[1].provider.secret_access_key, REDACTED);
    assert.equal(creds[1].name, "S3 archive");

    const [backup] = seen(fx.cloudBackupTasks);
    assert.equal(backup.password, REDACTED);
    assert.equal(backup.credentials.provider.key, REDACTED);
    assert.equal(backup.keep_last, 7);
  });

  it("keeps an account field outside a B2 provider", () => {
    const out = seen({ type: "AZUREBLOB", account: "storageacct", key: "fake-azure-key" });
    assert.equal(out.account, "storageacct");
    assert.equal(out.key, REDACTED);
  });
});

describe("keys and certificates", () => {
  it("redacts an SSH private key and keeps the public key and host details", () => {
    const [pair, creds] = seen(fx.keychainCredentials);
    assert.equal(pair.attributes.private_key, REDACTED);
    assert.equal(pair.attributes.public_key, fx.keychainCredentials[0].attributes.public_key);
    assert.equal(pair.type, "SSH_KEY_PAIR");
    // SSH_CREDENTIALS.private_key is the id of a keypair, not key material.
    assert.equal(creds.attributes.private_key, 3);
    assert.equal(creds.attributes.remote_host_key, fx.keychainCredentials[1].attributes.remote_host_key);
    assert.equal(creds.attributes.username, "replicator");
  });

  it("redacts a certificate private key and keeps the public certificate and paths", () => {
    const [cert] = seen(fx.certificates);
    assert.equal(cert.privatekey, REDACTED);
    assert.equal(cert.certificate, fx.certificates[0].certificate);
    assert.deepEqual(cert.chain_list, fx.certificates[0].chain_list);
    assert.equal(cert.privatekey_path, "/etc/certificates/truenas_default.key");
    assert.equal(cert.key_type, "RSA");
    assert.equal(cert.key_length, 2048);
  });

  it("redacts the UI certificate key nested in the general config", () => {
    const config = seen(fx.generalConfig);
    assert.equal(config.ui_certificate.privatekey, REDACTED);
    assert.equal(config.ui_certificate.name, "truenas_default");
    assert.equal(config.ui_httpsport, 443);
  });

  it("redacts a private key block under a key name it does not recognise", () => {
    const out = seen({ notes: `before\n${fx.FAKE.sshPrivateKey}\nafter` });
    assert.equal(out.notes, `before\n${REDACTED}\nafter`);
  });
});

describe("accounts and services", () => {
  it("redacts API key hashes and a newly created key", () => {
    const [key] = seen(fx.apiKeys);
    assert.equal(key.keyhash, REDACTED);
    assert.equal(key.name, "mcp");
    assert.equal(key.revoked, false);
    assert.equal(seen(fx.apiKeyCreated).key, REDACTED);
  });

  it("redacts user password hashes and keeps flags and the public key", () => {
    const [user] = seen(fx.users);
    assert.equal(user.unixhash, REDACTED);
    assert.equal(user.smbhash, REDACTED);
    assert.equal(user.sshpubkey, fx.users[0].sshpubkey);
    assert.equal(user.password_disabled, false);
    assert.equal(user.ssh_password_enabled, false);
  });

  it("redacts alert service keys and tokens", () => {
    const [pushover, telegram] = seen(fx.alertServices);
    assert.equal(pushover.attributes.user_key, REDACTED);
    assert.equal(pushover.attributes.api_key, REDACTED);
    assert.equal(telegram.attributes.bot_token, REDACTED);
    assert.deepEqual(telegram.attributes.chat_ids, [12345]);
  });

  it("redacts iSCSI CHAP secrets, directory bind passwords and keytabs", () => {
    const [auth] = seen(fx.iscsiAuth);
    assert.equal(auth.secret, REDACTED);
    assert.equal(auth.peersecret, REDACTED);
    assert.equal(auth.user, "initiator");

    const ds = seen(fx.directoryServicesConfig);
    assert.equal(ds.credential.bindpw, REDACTED);
    assert.equal(ds.credential.binddn, "cn=admin,dc=example,dc=net");

    const [keytab] = seen(fx.kerberosKeytabs);
    assert.equal(keytab.file, REDACTED);
    assert.equal(keytab.name, "AD_MACHINE_ACCOUNT");
  });

  it("keeps a file field that is an object or a path", () => {
    const [entry] = seen(fx.auditEntries);
    assert.deepEqual(entry.event_data.file, fx.auditEntries[0].event_data.file);
    assert.equal(seen({ file: "/mnt/tank/file.txt" }).file, "/mnt/tank/file.txt");
  });

  it("redacts VM display passwords, proxy passwords and secret query parameters", () => {
    const [vm] = seen(fx.vms);
    assert.equal(vm.devices[0].attributes.password, REDACTED);
    assert.equal(vm.devices[0].attributes.port, 5900);
    assert.equal(vm.devices[1].attributes.path, "/dev/zvol/tank/debian");

    const net = seen(fx.networkConfig);
    assert.equal(net.httpproxy, `http://proxyuser:${REDACTED}@proxy.example.net:3128`);

    const uri = seen(fx.displayUri).uri;
    assert.ok(uri.endsWith(`&password=${REDACTED}`), uri);
    assert.ok(uri.includes("host=truenas&port=5900"), uri);
  });
});

describe("matching rules", () => {
  it("matches secret names case-insensitively and across separators", () => {
    for (const name of [
      "key", "KEY", "pass", "password", "Password", "encryption_password", "encryption_salt",
      "private_key", "privatekey", "privateKey", "token", "api_key", "API_KEY", "apiKey",
      "secret", "secret_access_key", "SecretAccessKey", "access_key_id", "client_secret",
      "refresh_token", "bindpw", "v3_privpassphrase", "user_key", "service_key",
    ]) {
      assert.equal(isSecretKeyName(name), true, name);
    }
  });

  it("does not match identifiers, paths, public keys or formats", () => {
    for (const name of [
      "id", "name", "type", "provider", "credentials", "credential", "bucket", "folder",
      "endpoint", "region", "account", "username", "public_key", "sshpubkey", "remote_host_key",
      "privatekey_path", "key_type", "key_length", "key_format", "encryption_key_format",
      "keyid", "certificate", "fingerprint",
    ]) {
      assert.equal(isSecretKeyName(name), false, name);
    }
  });

  it("leaves null, booleans, numbers and empty strings alone", () => {
    assert.deepEqual(
      redactSecrets({ password: null, token: false, secret: 0, key: "", private_key: 7 }),
      { password: null, token: false, secret: 0, key: "", private_key: 7 },
    );
  });

  it("redacts a whole object or array held under a secret name", () => {
    assert.deepEqual(redactSecrets({ secret: { a: 1 }, token: ["x"] }), { secret: REDACTED, token: REDACTED });
  });

  it("returns text without secrets byte-for-byte", () => {
    const text = JSON.stringify({ pools: [{ name: "tank", healthy: true, size: 123 }] }, null, 2);
    assert.equal(redactText(text), text);
    assert.equal(redactText("Operation not confirmed. Set confirm to true to proceed."),
      "Operation not confirmed. Set confirm to true to proceed.");
  });

  it("scrubs secret pairs inside non-JSON text", () => {
    const text = `[EINVAL] bad credential {'account': 'x', 'key': '${fx.FAKE.b2AppKey}'} and "password": "${fx.FAKE.bindPassword}"`;
    const out = redactText(text);
    assertNoFakeSecrets(out);
    assert.ok(out.includes(`'key': '${REDACTED}'`), out);
    assert.ok(out.includes(`"password": "${REDACTED}"`), out);
  });

  it("no fake secret survives any fixture", () => {
    const everything = Object.entries(fx).filter(([name]) => name !== "FAKE" && name !== "FAKE_SECRETS");
    assertNoFakeSecrets(redactText(JSON.stringify(Object.fromEntries(everything), null, 2)));
  });
});

describe("tool and resource output", () => {
  function fakeClient(routes: Record<string, unknown>) {
    const answer = async (path: string) => {
      if (path in routes) return routes[path];
      throw new Error(`unexpected path ${path}`);
    };
    return { get: answer, post: answer, put: answer, delete: answer };
  }

  function registry(routes: Record<string, unknown>) {
    const reg = new ToolRegistry();
    registerReplication(reg, fakeClient(routes));
    return reg;
  }

  it("cloudsync_list through the real handler and registry returns redacted text", async () => {
    const result = await runTool(registry({ "/cloudsync": fx.cloudsyncTasks }), "data_protection", "cloudsync_list", {});
    const text = textOf(result);
    assertNoFakeSecrets(text);
    const [b2] = JSON.parse(text) as typeof fx.cloudsyncTasks;
    assert.equal(b2.credentials.provider.key, REDACTED);
    assert.equal(b2.credentials.name, "Backblaze");
  });

  it("covers cloudsync_get, credentials, cloud backup and keychain tools", async () => {
    const reg = registry({
      "/cloudsync/id/6": fx.cloudsyncTasks[1],
      "/cloudsync/credentials": fx.cloudsyncCredentials,
      "/cloud_backup": fx.cloudBackupTasks,
      "/keychaincredential": fx.keychainCredentials,
      "/keychaincredential/generate_ssh_key_pair": { private_key: fx.FAKE.sshPrivateKey, public_key: "ssh-ed25519 AAAA" },
    });
    for (const [action, params] of [
      ["cloudsync_get", { id: 6 }],
      ["cloudsync_credentials_list", {}],
      ["cloud_backup_list", {}],
      ["keychaincredential_list", {}],
      ["keychaincredential_generate_ssh_key", {}],
    ] as const) {
      const result = await runTool(reg, "data_protection", action, params);
      assert.ok(!result.isError, action);
      assertNoFakeSecrets(textOf(result));
      assert.ok(textOf(result).includes(REDACTED), action);
    }
  });

  it("redacts a raw non-content result and an error message", async () => {
    const raw = await runTool({ execute: async () => ({ token: "fake-display-token" }) }, "api", "x", {});
    assert.deepEqual(JSON.parse(textOf(raw)), { token: REDACTED });

    const failed = await runTool(
      { execute: async () => { throw new Error(`rejected {'secret_access_key': '${fx.FAKE.s3Secret}'}`); } },
      "api", "x", {},
    );
    assert.equal(failed.isError, true);
    assert.ok(textOf(failed).startsWith("Error: rejected"));
    assertNoFakeSecrets(textOf(failed));
  });

  it("passes non-text content through untouched", () => {
    const image = { type: "image", data: "aGVsbG8=", mimeType: "image/png" };
    assert.deepEqual(redactToolResult({ content: [image] }), { content: [image] });
  });

  it("resources registered through the wrapper are redacted", async () => {
    type ResourceResult = { contents: { uri: string; text: string }[] };
    const handlers = new Map<string, () => Promise<ResourceResult>>();
    const server = {
      resource: (_name: string, uri: string, _meta: unknown, handler: () => Promise<ResourceResult>) => {
        handlers.set(uri, handler);
      },
    };
    registerResources(redactingResourceServer(server), fakeClient({ "/vm": fx.vms }));

    const result = await handlers.get("truenas://vms")!();
    const text = result.contents[0].text;
    assertNoFakeSecrets(text);
    const [vm] = JSON.parse(text) as typeof fx.vms;
    assert.equal(vm.devices[0].attributes.password, REDACTED);
    assert.equal(result.contents[0].uri, "truenas://vms");
  });
});

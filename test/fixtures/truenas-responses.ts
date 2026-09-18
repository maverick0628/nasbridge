// Shapes mirror real TrueNAS 26 query results. Every secret value is an obvious fake and
// is listed in FAKE_SECRETS, so a test can prove none of them survives redaction.
//
// PEM armour is assembled at runtime so no literal private-key header sits in the repo for
// a secret scanner to trip on.
const pem = (label: string, body: string) =>
  [`-----BEGIN ${label}-----`, body, `-----END ${label}-----`].join("\n");

export const FAKE = {
  b2KeyId: "fake-b2-key-id-000000",
  b2AppKey: "FAKE-B2-APPLICATION-KEY-not-real",
  s3AccessKeyId: "FAKE-S3-ACCESS-KEY-ID",
  s3Secret: "FAKE/S3/SECRET/ACCESS/KEY/not/real",
  encryptionPassword: "fake-encryption-password",
  encryptionSalt: "fake-encryption-salt",
  sshPrivateKey: pem("OPENSSH PRIVATE" + " KEY", "FAKE-SSH-PRIVATE-KEY-BODY-not-real"),
  certPrivateKey: pem("PRIVATE" + " KEY", "FAKE-CERT-PRIVATE-KEY-BODY-not-real"),
  uiCertPrivateKey: pem("EC PRIVATE" + " KEY", "FAKE-UI-CERT-PRIVATE-KEY-not-real"),
  apiKeyValue: "1-FAKEAPIKEYVALUEnotreal",
  apiKeyHash: "$pbkdf2-sha256$fake$hash$not$real",
  unixHash: "$6$fakesalt$fakeunixhashnotreal",
  smbHash: "FAKESMBHASHNOTREAL",
  pushoverUserKey: "fake-pushover-user-key",
  pushoverApiKey: "fake-pushover-api-key",
  telegramBotToken: "fake:telegram-bot-token",
  chapSecret: "fake-chap-secret",
  chapPeerSecret: "fake-chap-peer-secret",
  bindPassword: "fake-bind-password",
  keytab: "RkFLRUtFWVRBQkJMT0JOT1RSRUFMRkFLRUtFWVRBQkJMT0JOT1RSRUFMRkFLRUtFWVRBQkJMT0I=",
  vncPassword: "fakevnc1",
  proxyPassword: "fake-proxy-password",
  displayToken: "fake-display-token",
  cloudBackupPassword: "fake-restic-password",
} as const;

export const FAKE_SECRETS: readonly string[] = Object.values(FAKE);

const publicCert = pem("CERTIFICATE", "FAKE-PUBLIC-CERTIFICATE-BODY");
const sshPublicKey = "ssh-ed25519 AAAAFAKEPUBLICKEY nasbridge-test";

const b2Credential = {
  id: 1,
  name: "Backblaze",
  provider: { type: "B2", account: FAKE.b2KeyId, key: FAKE.b2AppKey },
};

const s3Credential = {
  id: 2,
  name: "S3 archive",
  provider: {
    type: "S3",
    access_key_id: FAKE.s3AccessKeyId,
    secret_access_key: FAKE.s3Secret,
    endpoint: "",
    region: "us-east-1",
    skip_region: false,
    signatures_v2: false,
    max_upload_parts: 10000,
  },
};

const idleJob = {
  id: null,
  method: "cloudsync.sync",
  arguments: [2],
  state: "SUCCESS",
  progress: { percent: 100, description: "", extra: null },
  time_started: { $date: 1789000000000 },
  credentials: null,
};

export const cloudsyncTasks = [
  {
    id: 2,
    description: "nightly backups",
    path: "/mnt/tank/backups",
    credentials: b2Credential,
    attributes: { bucket: "example-bucket", folder: "/backups", fast_list: false, chunk_size: 96 },
    schedule: { minute: "0", hour: "3", dom: "*", month: "*", dow: "0" },
    pre_script: "",
    post_script: "",
    snapshot: false,
    include: [],
    exclude: [],
    args: "",
    enabled: true,
    job: idleJob,
    locked: false,
    bwlimit: [],
    transfers: 4,
    direction: "PUSH",
    transfer_mode: "COPY",
    encryption: false,
    filename_encryption: false,
    encryption_password: "",
    encryption_salt: "",
    create_empty_src_dirs: false,
    follow_symlinks: false,
  },
  {
    id: 6,
    description: "cold archive",
    path: "/mnt/tank/archive",
    credentials: s3Credential,
    attributes: { bucket: "example-archive", folder: "", storage_class: "DEEP_ARCHIVE" },
    schedule: { minute: "0", hour: "0", dom: "*", month: "*", dow: "0" },
    enabled: true,
    job: null,
    direction: "PUSH",
    transfer_mode: "COPY",
    encryption: true,
    filename_encryption: true,
    encryption_password: FAKE.encryptionPassword,
    encryption_salt: FAKE.encryptionSalt,
  },
];

export const cloudsyncCredentials = [b2Credential, s3Credential];

export const cloudBackupTasks = [
  {
    id: 1,
    description: "restic offsite",
    path: "/mnt/tank/docs",
    credentials: b2Credential,
    attributes: { bucket: "example-bucket", folder: "/restic" },
    password: FAKE.cloudBackupPassword,
    keep_last: 7,
    enabled: true,
  },
];

export const keychainCredentials = [
  {
    id: 3,
    name: "replication keypair",
    type: "SSH_KEY_PAIR",
    attributes: { private_key: FAKE.sshPrivateKey, public_key: sshPublicKey },
  },
  {
    id: 4,
    name: "backup host",
    type: "SSH_CREDENTIALS",
    attributes: {
      host: "backup.example.net",
      port: 22,
      username: "replicator",
      private_key: 3,
      remote_host_key: "backup.example.net ssh-ed25519 AAAAFAKEHOSTKEY",
      connect_timeout: 10,
    },
  },
];

export const certificates = [
  {
    id: 1,
    type: 8,
    name: "truenas_default",
    certificate: publicCert,
    privatekey: FAKE.certPrivateKey,
    CSR: null,
    root_path: "/etc/certificates",
    certificate_path: "/etc/certificates/truenas_default.crt",
    privatekey_path: "/etc/certificates/truenas_default.key",
    cert_type: "CERTIFICATE",
    chain_list: [publicCert],
    key_length: 2048,
    key_type: "RSA",
    common: "localhost",
    san: ["DNS:localhost"],
    fingerprint: "AA:BB:CC:DD",
    expired: false,
  },
];

export const generalConfig = {
  id: 1,
  ui_port: 80,
  ui_httpsport: 443,
  ui_certificate: {
    id: 1,
    name: "truenas_default",
    certificate: publicCert,
    privatekey: FAKE.uiCertPrivateKey,
    privatekey_path: "/etc/certificates/truenas_default.key",
  },
  timezone: "UTC",
};

export const apiKeys = [
  {
    id: 1,
    name: "mcp",
    username: "admin",
    user_identifier: 950,
    keyhash: FAKE.apiKeyHash,
    created_at: { $date: 1780000000000 },
    expires_at: null,
    local: true,
    revoked: false,
    revoked_reason: null,
  },
];

export const apiKeyCreated = { ...apiKeys[0], id: 2, name: "new", key: FAKE.apiKeyValue };

export const users = [
  {
    id: 1000,
    username: "alice",
    unixhash: FAKE.unixHash,
    smbhash: FAKE.smbHash,
    sshpubkey: sshPublicKey,
    password_disabled: false,
    ssh_password_enabled: false,
    locked: false,
  },
];

export const alertServices = [
  {
    id: 1,
    name: "Pushover",
    attributes: { type: "PushOver", user_key: FAKE.pushoverUserKey, api_key: FAKE.pushoverApiKey },
    level: "WARNING",
    enabled: true,
  },
  {
    id: 2,
    name: "Telegram",
    attributes: { type: "Telegram", bot_token: FAKE.telegramBotToken, chat_ids: [12345] },
    level: "CRITICAL",
    enabled: true,
  },
];

export const iscsiAuth = [
  { id: 1, tag: 1, user: "initiator", secret: FAKE.chapSecret, peeruser: "target", peersecret: FAKE.chapPeerSecret },
];

export const directoryServicesConfig = {
  service_type: "LDAP",
  enable: true,
  credential: { credential_type: "LDAP_PLAIN", binddn: "cn=admin,dc=example,dc=net", bindpw: FAKE.bindPassword },
};

export const kerberosKeytabs = [{ id: 1, name: "AD_MACHINE_ACCOUNT", file: FAKE.keytab }];

export const auditEntries = [
  { audit_id: "a1", service: "SMB", event: "OPEN", event_data: { file: { path: "/share/report.pdf", stream: "" } } },
];

export const vms = [
  {
    id: 1,
    name: "debian",
    status: { state: "RUNNING" },
    devices: [
      { id: 10, attributes: { dtype: "DISPLAY", type: "SPICE", port: 5900, bind: "0.0.0.0", password: FAKE.vncPassword, web: true } },
      { id: 11, attributes: { dtype: "DISK", path: "/dev/zvol/tank/debian" } },
    ],
  },
];

export const networkConfig = {
  hostname: "truenas",
  httpproxy: `http://proxyuser:${FAKE.proxyPassword}@proxy.example.net:3128`,
  nameserver1: "192.0.2.53",
};

export const displayUri = {
  uri: `https://truenas.example.net/vm/display/1/spice_auto.html?host=truenas&port=5900&password=${FAKE.displayToken}`,
};

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: [new URL("../dist/cli.js", import.meta.url).pathname],
  env: {
    ...process.env,
    TRUENAS_URL: process.env.TRUENAS_URL ?? "https://truenas.local",
    TRUENAS_VERIFY_SSL: "false",
  },
});

const client = new Client({ name: "e2e", version: "1.0.0" });
await client.connect(transport);

async function call(action, params) {
  const res = await client.callTool({
    name: "truenas",
    arguments: { category: "storage", action, params },
  });
  return res.content?.[0]?.text ?? JSON.stringify(res);
}

const step = process.argv[2];
const target = process.argv[3];

if (step === "pools") {
  const text = await call("pool_list", {});
  const parsed = JSON.parse(text);
  console.log(parsed.map((p) => p.name).join("\n"));
} else if (step === "create") {
  const text = await call("dataset_create", {
    name: target,
    compression: "lz4",
    sync: "standard",
    atime: true,
  });
  console.log(text.slice(0, 1500));
} else if (step === "get") {
  const text = await call("dataset_get", { id: target });
  try {
    const ds = JSON.parse(text);
    console.log(JSON.stringify({
      name: ds.name,
      compression: ds.compression?.value ?? ds.compression,
      sync: ds.sync?.value ?? ds.sync,
      atime: ds.atime?.value ?? ds.atime,
    }, null, 2));
  } catch {
    console.log(text.slice(0, 800));
  }
} else if (step === "delete") {
  const text = await call("dataset_delete", { id: target, confirm: true });
  console.log(text.slice(0, 500));
}

await client.close();
process.exit(0);

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface WSCall {
  method: string;
  params: unknown[];
}

const SINGLETON_SERVICES = new Set([
  "system.general",
  "system.advanced",
  "smb",
  "nfs",
  "iscsi.global",
  "ssh",
  "ftp",
  "snmp",
  "ups",
  "mail",
  "docker",
  "update",
  "reporting",
  "directoryservices",
  "kerberos",
  "audit",
  "network.configuration",
]);

const COLLECTION_SERVICES = new Set([
  "pool",
  "pool.dataset",
  "pool.snapshot",
  "pool.snapshottask",
  "sharing.smb",
  "sharing.nfs",
  "iscsi.target",
  "iscsi.extent",
  "iscsi.portal",
  "iscsi.initiator",
  "iscsi.targetextent",
  "interface",
  "staticroute",
  "user",
  "group",
  "disk",
  "vm",
  "vm.device",
  "app",
  "service",
  "alertservice",
  "certificate",
  "acme.dns.authenticator",
  "replication",
  "cloudsync",
  "cloudsync.credentials",
  "cloud_backup",
  "cronjob",
  "rsynctask",
  "initshutdownscript",
  "keychaincredential",
  "bootenv",
  "tunable",
  "privilege",
  "system.ntpserver",
  "api_key",
  "kerberos.realm",
  "kerberos.keytab",
]);

export function restToWS(
  httpMethod: HttpMethod,
  path: string,
  body?: unknown,
  queryParams?: Record<string, string>,
): WSCall {
  const segments = path.replace(/^\//, "").split("/");

  const idIndex = segments.indexOf("id");
  if (idIndex !== -1 && idIndex + 1 < segments.length) {
    return handleInstancePath(httpMethod, segments, idIndex, body);
  }

  return handleServicePath(httpMethod, segments, body, queryParams);
}

function handleInstancePath(
  httpMethod: HttpMethod,
  segments: string[],
  idIndex: number,
  body?: unknown,
): WSCall {
  const servicePath = segments.slice(0, idIndex).join(".");
  const rawId = decodeURIComponent(segments[idIndex + 1]);
  const id: string | number = /^\d+$/.test(rawId) ? Number(rawId) : rawId;
  const subAction = segments.slice(idIndex + 2).join(".");

  if (subAction) {
    const params: unknown[] = [id];
    if (body !== undefined) params.push(body);
    return { method: `${servicePath}.${subAction}`, params };
  }

  switch (httpMethod) {
    case "GET":
      return { method: `${servicePath}.get_instance`, params: [id] };
    case "PUT":
      return { method: `${servicePath}.update`, params: [id, body] };
    case "DELETE": {
      const params: unknown[] = [id];
      if (body !== undefined) params.push(body);
      return { method: `${servicePath}.delete`, params };
    }
    case "POST": {
      const params: unknown[] = [id];
      if (body !== undefined) params.push(body);
      return { method: `${servicePath}.create`, params };
    }
  }
}

function handleServicePath(
  httpMethod: HttpMethod,
  segments: string[],
  body?: unknown,
  queryParams?: Record<string, string>,
): WSCall {
  const dotPath = segments.join(".");

  if (SINGLETON_SERVICES.has(dotPath)) {
    switch (httpMethod) {
      case "GET":
        return { method: `${dotPath}.config`, params: [] };
      case "PUT":
        return { method: `${dotPath}.update`, params: body !== undefined ? [body] : [] };
      case "POST":
        return { method: `${dotPath}.update`, params: body !== undefined ? [body] : [] };
      default:
        return { method: dotPath, params: body !== undefined ? [body] : [] };
    }
  }

  if (COLLECTION_SERVICES.has(dotPath)) {
    switch (httpMethod) {
      case "GET": {
        const params: unknown[] = [];
        if (queryParams && Object.keys(queryParams).length > 0) {
          const opts: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(queryParams)) {
            opts[k] = /^\d+$/.test(v) ? Number(v) : v;
          }
          params.push([], opts);
        }
        return { method: `${dotPath}.query`, params };
      }
      case "POST":
        return { method: `${dotPath}.create`, params: body !== undefined ? [body] : [] };
      default:
        return { method: dotPath, params: body !== undefined ? [body] : [] };
    }
  }

  const params: unknown[] = [];
  if (body !== undefined) params.push(body);
  return { method: dotPath, params };
}

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { restToWS } from "../src/path-translator.ts";

describe("restToWS", () => {
  describe("collection CRUD", () => {
    it("GET /pool → pool.query", () => {
      const r = restToWS("GET", "/pool");
      assert.equal(r.method, "pool.query");
      assert.deepEqual(r.params, []);
    });

    it("GET /pool with query params → pool.query with options", () => {
      const r = restToWS("GET", "/pool/snapshot", undefined, { limit: "10", offset: "0" });
      assert.equal(r.method, "pool.snapshot.query");
      assert.deepEqual(r.params, [[], { limit: 10, offset: 0 }]);
    });

    it("POST /pool (body) → pool.create", () => {
      const body = { name: "tank", topology: {} };
      const r = restToWS("POST", "/pool", body);
      assert.equal(r.method, "pool.create");
      assert.deepEqual(r.params, [body]);
    });

    it("GET /pool/id/1 → pool.get_instance", () => {
      const r = restToWS("GET", "/pool/id/1");
      assert.equal(r.method, "pool.get_instance");
      assert.deepEqual(r.params, [1]);
    });

    it("PUT /pool/id/1 (body) → pool.update", () => {
      const body = { autotrim: true };
      const r = restToWS("PUT", "/pool/id/1", body);
      assert.equal(r.method, "pool.update");
      assert.deepEqual(r.params, [1, body]);
    });

    it("DELETE /pool/id/1 → pool.delete", () => {
      const r = restToWS("DELETE", "/pool/id/1");
      assert.equal(r.method, "pool.delete");
      assert.deepEqual(r.params, [1]);
    });

    it("DELETE /pool/id/1 (body) → pool.delete with options", () => {
      const body = { cascade: true };
      const r = restToWS("DELETE", "/pool/id/1", body);
      assert.equal(r.method, "pool.delete");
      assert.deepEqual(r.params, [1, body]);
    });
  });

  describe("nested service paths", () => {
    it("GET /pool/dataset → pool.dataset.query", () => {
      const r = restToWS("GET", "/pool/dataset");
      assert.equal(r.method, "pool.dataset.query");
      assert.deepEqual(r.params, []);
    });

    it("GET /pool/dataset/id/tank%2Fdata → pool.dataset.get_instance with decoded id", () => {
      const r = restToWS("GET", "/pool/dataset/id/tank%2Fdata");
      assert.equal(r.method, "pool.dataset.get_instance");
      assert.deepEqual(r.params, ["tank/data"]);
    });

    it("POST /pool/dataset/id/tank%2Fdata/permission (body) → pool.dataset.permission", () => {
      const body = { mode: "755" };
      const r = restToWS("POST", "/pool/dataset/id/tank%2Fdata/permission", body);
      assert.equal(r.method, "pool.dataset.permission");
      assert.deepEqual(r.params, ["tank/data", body]);
    });

    it("GET /sharing/smb → sharing.smb.query", () => {
      const r = restToWS("GET", "/sharing/smb");
      assert.equal(r.method, "sharing.smb.query");
      assert.deepEqual(r.params, []);
    });

    it("POST /pool/id/1/scrub (body) → pool.scrub", () => {
      const body = { action: "START" };
      const r = restToWS("POST", "/pool/id/1/scrub", body);
      assert.equal(r.method, "pool.scrub");
      assert.deepEqual(r.params, [1, body]);
    });
  });

  describe("singleton config endpoints", () => {
    it("GET /smb → smb.config", () => {
      const r = restToWS("GET", "/smb");
      assert.equal(r.method, "smb.config");
      assert.deepEqual(r.params, []);
    });

    it("PUT /smb (body) → smb.update", () => {
      const body = { netbiosname: "NAS" };
      const r = restToWS("PUT", "/smb", body);
      assert.equal(r.method, "smb.update");
      assert.deepEqual(r.params, [body]);
    });

    it("GET /system/general → system.general.config", () => {
      const r = restToWS("GET", "/system/general");
      assert.equal(r.method, "system.general.config");
      assert.deepEqual(r.params, []);
    });

    it("PUT /system/general (body) → system.general.update", () => {
      const body = { timezone: "America/New_York" };
      const r = restToWS("PUT", "/system/general", body);
      assert.equal(r.method, "system.general.update");
      assert.deepEqual(r.params, [body]);
    });

    it("GET /docker → docker.config", () => {
      const r = restToWS("GET", "/docker");
      assert.equal(r.method, "docker.config");
      assert.deepEqual(r.params, []);
    });
  });

  describe("direct method calls", () => {
    it("GET /system/info → system.info", () => {
      const r = restToWS("GET", "/system/info");
      assert.equal(r.method, "system.info");
      assert.deepEqual(r.params, []);
    });

    it("POST /system/reboot (body) → system.reboot", () => {
      const body = { delay: 0 };
      const r = restToWS("POST", "/system/reboot", body);
      assert.equal(r.method, "system.reboot");
      assert.deepEqual(r.params, [body]);
    });

    it("POST /service/start (body) → service.start", () => {
      const r = restToWS("POST", "/service/start", "ssh");
      assert.equal(r.method, "service.start");
      assert.deepEqual(r.params, ["ssh"]);
    });

    it("POST /filesystem/stat (body) → filesystem.stat", () => {
      const r = restToWS("POST", "/filesystem/stat", "/mnt/tank");
      assert.equal(r.method, "filesystem.stat");
      assert.deepEqual(r.params, ["/mnt/tank"]);
    });

    it("PUT /alert/dismiss (body) → alert.dismiss", () => {
      const r = restToWS("PUT", "/alert/dismiss", "uuid-123");
      assert.equal(r.method, "alert.dismiss");
      assert.deepEqual(r.params, ["uuid-123"]);
    });

    it("GET /alert/list → alert.list", () => {
      const r = restToWS("GET", "/alert/list");
      assert.equal(r.method, "alert.list");
      assert.deepEqual(r.params, []);
    });

    it("GET /vm/get_available_memory → vm.get_available_memory", () => {
      const r = restToWS("GET", "/vm/get_available_memory");
      assert.equal(r.method, "vm.get_available_memory");
      assert.deepEqual(r.params, []);
    });

    it("GET /nfs/client_count → nfs.client_count", () => {
      const r = restToWS("GET", "/nfs/client_count");
      assert.equal(r.method, "nfs.client_count");
      assert.deepEqual(r.params, []);
    });

    it("GET /boot/get_state → boot.get_state", () => {
      const r = restToWS("GET", "/boot/get_state");
      assert.equal(r.method, "boot.get_state");
      assert.deepEqual(r.params, []);
    });

    it("GET /certificate/acme_server_choices → certificate.acme_server_choices", () => {
      const r = restToWS("GET", "/certificate/acme_server_choices");
      assert.equal(r.method, "certificate.acme_server_choices");
      assert.deepEqual(r.params, []);
    });

    it("GET /user/shell_choices → user.shell_choices", () => {
      const r = restToWS("GET", "/user/shell_choices");
      assert.equal(r.method, "user.shell_choices");
      assert.deepEqual(r.params, []);
    });

    it("POST /update/check_available → update.check_available", () => {
      const r = restToWS("POST", "/update/check_available");
      assert.equal(r.method, "update.check_available");
      assert.deepEqual(r.params, []);
    });
  });

  describe("underscore-separated paths", () => {
    it("GET /cloud_backup → cloud_backup.query", () => {
      const r = restToWS("GET", "/cloud_backup");
      assert.equal(r.method, "cloud_backup.query");
      assert.deepEqual(r.params, []);
    });

    it("GET /api_key → api_key.query", () => {
      const r = restToWS("GET", "/api_key");
      assert.equal(r.method, "api_key.query");
      assert.deepEqual(r.params, []);
    });
  });
});

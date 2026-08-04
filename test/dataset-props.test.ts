import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeDatasetProps } from "../src/dataset-props.ts";

describe("normalizeDatasetProps", () => {
  it("maps boolean atime true → 'ON'", () => {
    assert.deepEqual(normalizeDatasetProps({ atime: true }), { atime: "ON" });
  });

  it("maps boolean atime false → 'OFF'", () => {
    assert.deepEqual(normalizeDatasetProps({ atime: false }), { atime: "OFF" });
  });

  it("uppercases lowercase atime strings", () => {
    assert.deepEqual(normalizeDatasetProps({ atime: "on" }), { atime: "ON" });
  });

  it("uppercases lowercase compression", () => {
    assert.deepEqual(normalizeDatasetProps({ compression: "lz4" }), { compression: "LZ4" });
  });

  it("uppercases lowercase sync", () => {
    assert.deepEqual(normalizeDatasetProps({ sync: "standard" }), { sync: "STANDARD" });
  });

  it("passes through already-uppercase values", () => {
    assert.deepEqual(
      normalizeDatasetProps({ compression: "ZSTD", sync: "ALWAYS", atime: "INHERIT" }),
      { compression: "ZSTD", sync: "ALWAYS", atime: "INHERIT" },
    );
  });

  it("omits undefined fields entirely", () => {
    assert.deepEqual(normalizeDatasetProps({ name: "tank/x", atime: undefined }), { name: "tank/x" });
  });

  it("leaves non-enum fields untouched", () => {
    assert.deepEqual(
      normalizeDatasetProps({ name: "tank/x", quota: 1024, recordsize: "128K" }),
      { name: "tank/x", quota: 1024, recordsize: "128K" },
    );
  });
});

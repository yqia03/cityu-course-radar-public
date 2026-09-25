#!/usr/bin/env node
// Material upload diagnostics. Starting creates a temporary real-time tail session.
// Run from any directory: paths are resolved against this repository root.
// The default output is .sites-runtime/evidence/material-upload-tail-<UTC>.jsonl.
// Only whitelisted upload event fields reach the JSONL file; raw data stays in memory.
// cpuTime/wallTime are milliseconds when supplied by Cloudflare; absent means null.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outcomes = new Set([
  "ok",
  "exception",
  "exceededCpu",
  "exceededMemory",
  "canceled",
  "unknown",
  "responseStreamDisconnected",
  "scriptNotFound",
  "resourcesExceeded",
  "internalError",
  "securityRule",
]);
const numeric = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
function classify(event) {
  if (!event?.event?.request) {
    // Count known wrapper shapes without accepting or disclosing their contents.
    if (
      [event?.data, event?.result, event?.payload, event?.event].some(
        (x) => x?.event?.request,
      )
    )
      return "wrappedRequestObjects";
    return "nonRequestObjects";
  }
  if (event.event.request.method !== "PUT") return "nonPutRequestObjects";
  let pathname;
  try {
    pathname = new URL(event.event.request.url).pathname;
  } catch {
    return "putWithInvalidUrl";
  }
  if (!pathname.startsWith("/api/materials/uploads/")) return "putOtherPaths";
  // The tail service may mask or encode the dynamic segment. Identify only the
  // upload route family; never expose the suffix or infer an individual upload ID.
  if (pathname === "/api/materials/uploads/")
    return "putUploadEmptySuffixPaths";
  return "matchingUploadEvents";
}
function sanitize(event) {
  if (classify(event) !== "matchingUploadEvents") return null;
  const status = event.event.response?.status;
  return {
    path: "/api/materials/uploads/<upload-id>",
    outcome: outcomes.has(event.outcome) ? event.outcome : "unknown",
    status:
      Number.isInteger(status) && status >= 100 && status <= 599
        ? status
        : null,
    eventTimestamp: numeric(event.eventTimestamp),
    cpuTime: numeric(event.cpuTime),
    wallTime: numeric(event.wallTime),
  };
}

// Wrangler JSON output is pretty-printed, not JSONL. Parse complete objects across chunks.
function objectParser(onObject, onError) {
  let buffer = "",
    depth = 0,
    inString = false,
    escaped = false;
  return (chunk) => {
    for (const char of chunk) {
      if (!depth) {
        if (char !== "{") continue;
        buffer = "{";
        depth = 1;
        inString = false;
        escaped = false;
        continue;
      }
      buffer += char;
      if (buffer.length > 2 * 1024 * 1024) {
        buffer = "";
        depth = 0;
        onError("oversized_tail_event");
        return;
      }
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
      } else if (char === '"') inString = true;
      else if (char === "{") depth++;
      else if (char === "}" && --depth === 0) {
        let value;
        try {
          value = JSON.parse(buffer);
        } catch {
          buffer = "";
          onError("invalid_tail_json");
          return;
        }
        buffer = "";
        onObject(value);
      }
    }
  };
}

function selfTest() {
  const event = {
    outcome: "ok",
    eventTimestamp: 12345,
    cpuTime: 8.5,
    wallTime: 500,
    event: {
      request: {
        method: "PUT",
        url: `https://example.invalid/api/materials/uploads/${randomUUID()}?private=yes`,
        headers: { Cookie: "secret" },
      },
      response: { status: 200 },
    },
    logs: [{ message: ['private { \\" }'] }],
  };
  const expected = {
    path: "/api/materials/uploads/<upload-id>",
    outcome: "ok",
    status: 200,
    eventTimestamp: 12345,
    cpuTime: 8.5,
    wallTime: 500,
  };
  assert.deepEqual(sanitize(event), expected);
  assert.equal(classify(event), "matchingUploadEvents");
  assert.equal(classify({ data: event }), "wrappedRequestObjects");
  assert.equal(classify({ unrelated: true }), "nonRequestObjects");
  assert.equal(
    classify({
      ...event,
      event: { request: { method: "PUT", url: "relative" } },
    }),
    "putWithInvalidUrl",
  );
  for (const suffix of ["REDACTED", "%3Cupload-id%3E", ":id", "[redacted]"]) {
    const masked = {
      ...event,
      event: {
        ...event.event,
        request: {
          ...event.event.request,
          url: "https://example.invalid/api/materials/uploads/" + suffix,
        },
      },
    };
    assert.equal(classify(masked), "matchingUploadEvents");
    assert.deepEqual(sanitize(masked), expected);
  }
  assert.equal(
    classify({
      ...event,
      event: {
        request: {
          method: "PUT",
          url: "https://example.invalid/api/materials/uploads/",
        },
      },
    }),
    "putUploadEmptySuffixPaths",
  );
  assert.equal(
    sanitize({
      ...event,
      event: { request: { method: "GET", url: event.event.request.url } },
    }),
    null,
  );
  assert.equal(
    sanitize({
      ...event,
      event: {
        request: { method: "PUT", url: "https://example.invalid/unrelated" },
      },
    }),
    null,
  );
  assert.deepEqual(sanitize({ ...event, cpuTime: undefined, wallTime: null }), {
    ...expected,
    cpuTime: null,
    wallTime: null,
  });
  const parsed = [],
    errors = [];
  const parser = objectParser(
    (x) => parsed.push(sanitize(x)),
    (x) => errors.push(x),
  );
  const stream =
    "non-json banner\n" +
    JSON.stringify(event, null, 4) +
    "\n" +
    JSON.stringify(event);
  for (let i = 0; i < stream.length; i += 7) parser(stream.slice(i, i + 7));
  assert.deepEqual(parsed, [expected, expected]);
  assert.deepEqual(errors, []);
  assert.equal(JSON.stringify(parsed).includes("secret"), false);
  console.log(
    JSON.stringify({ type: "self_test_passed", remoteSessionCreated: false }),
  );
}

function safeNotice(type, extra = {}) {
  process.stderr.write(JSON.stringify({ type, ...extra }) + "\n");
}
function main() {
  const { values } = parseArgs({
    options: {
      output: { type: "string" },
      help: { type: "boolean" },
      "self-test": { type: "boolean" },
    },
  });
  if (values.help) {
    console.log(
      "Usage: node scripts/tail-material-uploads.mjs [--output <JSONL path>]. Relative paths resolve against the repository root. Default output: .sites-runtime/evidence/material-upload-tail-<UTC>.jsonl; existing files are never overwritten. Starts a temporary PUT tail for the Worker configured in wrangler.json, writes sanitized upload events only, and stops after 10 minutes or Ctrl-C. --self-test is entirely offline. Missing CPU/wall time remains null; units are milliseconds. No persistent observability configuration is changed.",
    );
    return;
  }
  if (values["self-test"]) {
    selfTest();
    return;
  }
  const output = path.resolve(
    root,
    values.output ||
      `.sites-runtime/evidence/material-upload-tail-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`,
  );
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const fd = fs.openSync(output, "wx", 0o600);
  let child,
    stopping = false,
    closed = false,
    saved = 0,
    forceTimer,
    killTimer,
    failed = false;
  const counts = {
    stdoutBytes: 0,
    stderrBytes: 0,
    parsedJsonObjects: 0,
    nonRequestObjects: 0,
    wrappedRequestObjects: 0,
    nonPutRequestObjects: 0,
    putWithInvalidUrl: 0,
    putOtherPaths: 0,
    putUploadEmptySuffixPaths: 0,
    matchingUploadEvents: 0,
  };
  // JSON bypasses the log-level gate in Wrangler 4.133. Keep normal logging so
  // connection diagnostics remain detectable; all raw text is still discarded.
  const env = {
    ...process.env,
    WRANGLER_WRITE_LOGS: "false",
    WRANGLER_SEND_METRICS: "false",
    WRANGLER_LOG: "log",
    WRANGLER_LOG_SANITIZE: "true",
    CI: "true",
    NO_COLOR: "1",
  };
  const signalChild = (signal) => {
    if (!child?.pid || closed) return;
    try {
      process.kill(-child.pid, signal);
    } catch {
      safeNotice("tail_signal_unavailable");
    }
  };
  const stop = (type) => {
    if (stopping) return;
    stopping = true;
    safeNotice(type);
    clearTimeout(deadline);
    signalChild("SIGINT");
    // Wrangler handles SIGINT/SIGTERM by closing its socket and deleting the tail session.
    forceTimer = setTimeout(() => {
      safeNotice("tail_cleanup_delayed");
      signalChild("SIGTERM");
    }, 15000);
    killTimer = setTimeout(() => {
      failed = true;
      safeNotice("tail_cleanup_unconfirmed");
      signalChild("SIGKILL");
    }, 30000);
  };
  const deadline = setTimeout(
    () => stop("tail_ten_minute_limit"),
    10 * 60 * 1000,
  );
  const diagnosticTimer = setInterval(
    () =>
      safeNotice("tail_diagnostic_counts", { ...counts, savedEvents: saved }),
    30000,
  );
  const onSignal = () => stop("tail_stop_requested");
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  const consume = objectParser(
    (event) => {
      counts.parsedJsonObjects++;
      counts[classify(event)]++;
      const row = sanitize(event);
      if (!row) return;
      try {
        fs.writeSync(fd, JSON.stringify(row) + "\n");
        saved++;
      } catch {
        failed = true;
        stop("sanitized_output_write_failed");
      }
    },
    (type) => {
      failed = true;
      stop(type);
    },
  );
  try {
    child = spawn(
      process.execPath,
      [
        "--import",
        path.join(root, "scripts/sites-env.mjs"),
        path.join(root, "node_modules/wrangler/bin/wrangler.js"),
        "tail",
        "--method",
        "PUT",
        "--format",
        "json",
        "--config",
        "wrangler.json",
      ],
      { cwd: root, env, detached: true, stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch {
    clearTimeout(deadline);
    clearInterval(diagnosticTimer);
    fs.closeSync(fd);
    process.removeListener("SIGINT", onSignal);
    process.removeListener("SIGTERM", onSignal);
    safeNotice("tail_spawn_failed");
    process.exitCode = 1;
    return;
  }
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    counts.stdoutBytes += Buffer.byteLength(chunk);
    consume(chunk);
  });
  child.stdout.on("error", () => {
    failed = true;
    stop("tail_stdout_error");
  });
  // Never print or persist Wrangler stderr: it may contain URLs, identifiers or credentials.
  let stderrReported = false;
  child.stderr.on("data", (chunk) => {
    counts.stderrBytes += chunk.length;
    if (!stderrReported) {
      stderrReported = true;
      safeNotice("wrangler_diagnostic_redacted");
    }
  });
  child.stderr.on("error", () => {
    failed = true;
    stop("tail_stderr_error");
  });
  child.on("error", () => {
    failed = true;
    safeNotice("tail_process_error");
  });
  child.on("spawn", () =>
    safeNotice("tail_process_started", {
      output,
      durationSeconds: 600,
      connectionConfirmed: false,
    }),
  );
  child.on("close", (code, signal) => {
    closed = true;
    clearTimeout(deadline);
    clearTimeout(forceTimer);
    clearTimeout(killTimer);
    clearInterval(diagnosticTimer);
    process.removeListener("SIGINT", onSignal);
    process.removeListener("SIGTERM", onSignal);
    try {
      fs.closeSync(fd);
    } catch {
      failed = true;
      safeNotice("sanitized_output_close_failed");
    }
    safeNotice("tail_process_closed", {
      ...counts,
      savedEvents: saved,
      exitCode: Number.isInteger(code) ? code : null,
      signal: ["SIGINT", "SIGTERM", "SIGKILL"].includes(signal) ? signal : null,
    });
    process.exitCode = failed || (!stopping && code !== 0) ? 1 : 0;
  });
}
try {
  main();
} catch {
  safeNotice("tail_setup_failed");
  process.exitCode = 1;
}

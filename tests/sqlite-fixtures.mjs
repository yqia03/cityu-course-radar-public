import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { Worker } from "node:worker_threads";

export function database(path = ":memory:") {
  const db = new DatabaseSync(path);
  db.exec(
    "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=10000",
  );
  const dir = new URL("../drizzle/", import.meta.url);
  for (const name of readdirSync(dir)
    .filter((n) => n.endsWith(".sql"))
    .sort())
    db.exec(readFileSync(new URL(name, dir), "utf8"));
  return db;
}
// Independent SQLite connections start together and contend on actual writes;
// this tests the SQL admission boundary, rather than mocking serialized calls.
export async function concurrent(
  path,
  sql,
  params,
  { allowErrors = false } = {},
) {
  const signal = new SharedArrayBuffer(4);
  const workers = params.map(
    (bindings) =>
      new Worker(
        `
    const {parentPort,workerData}=require('node:worker_threads');
    const {DatabaseSync}=require('node:sqlite');
    const db=new DatabaseSync(workerData.path);
    db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000');
    parentPort.postMessage({ready:true});
    Atomics.wait(new Int32Array(workerData.signal),0,0);
    try { const stmt=db.prepare(workerData.sql); const result=Array.isArray(workerData.bindings)?stmt.get(...workerData.bindings):stmt.get(workerData.bindings); parentPort.postMessage({result}); }
    catch(e) { parentPort.postMessage({error:e.message}); }
    db.close();
  `,
        { eval: true, workerData: { path, sql, bindings, signal } },
      ),
  );
  const completions = workers.map(
    (worker) =>
      new Promise((resolve, reject) => {
        worker.on("message", (message) => {
          if (!message.ready) {
            if (message.error && !allowErrors) reject(new Error(message.error));
            else if (message.error) resolve({ error: message.error });
            else resolve(message.result);
          }
        });
        worker.on("error", reject);
      }),
  );
  await Promise.all(
    workers.map(
      (worker) => new Promise((resolve) => worker.once("message", resolve)),
    ),
  );
  Atomics.store(new Int32Array(signal), 0, 1);
  Atomics.notify(new Int32Array(signal), 0);
  try {
    return await Promise.all(completions);
  } finally {
    await Promise.all(workers.map((worker) => worker.terminate()));
  }
}

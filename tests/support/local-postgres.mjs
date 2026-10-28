// A disposable PostgreSQL cluster on loopback for integration tests. It is
// created in a fresh temporary directory and removed on close; it never
// touches any other database.
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { promisify } from "node:util";

const exec = promisify(execFile);

async function freePort() {
  const server = createServer();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address();
  await new Promise((r) => server.close(r));
  return port;
}

export async function localPostgres() {
  const dir = await mkdtemp("/tmp/energia-pg-");
  const data = `${dir}/data`;
  const port = await freePort();
  await exec("initdb", ["-D", data, "-A", "trust", "-U", "energia_test", "--no-locale", "--encoding=UTF8"]);
  await exec("pg_ctl", ["-D", data, "-l", `${dir}/postgres.log`, "-o", `-h 127.0.0.1 -p ${port} -k ${dir}`, "-w", "start"]);
  await exec("createdb", ["-h", "127.0.0.1", "-p", String(port), "-U", "energia_test", "energia_test"]);
  return {
    url: `postgresql://energia_test@127.0.0.1:${port}/energia_test`,
    port,
    async close() {
      try {
        await exec("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  };
}

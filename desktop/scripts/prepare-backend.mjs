// Builds the NestJS backend and stages everything the packaged app needs:
//   src-tauri/backend-bundle/   compiled backend + production node_modules
//   src-tauri/binaries/anitor-node-<target-triple>   the Node.js runtime that runs it
import { execSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  cpSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const desktop = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backend = resolve(desktop, "..", "backend");
const bundle = join(desktop, "src-tauri", "backend-bundle");
const binaries = join(desktop, "src-tauri", "binaries");

const run = (cmd, cwd) => {
  console.log(`\n> ${cmd}   (in ${cwd})`);
  execSync(cmd, { cwd, stdio: "inherit" });
};

// 1. compile the backend
run("npm run build", backend);

// 2. stage the compiled code + package files
rmSync(bundle, { recursive: true, force: true });
mkdirSync(bundle, { recursive: true });
cpSync(join(backend, "dist"), join(bundle, "dist"), { recursive: true });
for (const file of ["package.json", "package-lock.json"]) {
  copyFileSync(join(backend, file), join(bundle, file));
}

// 3. production dependencies only (the lock file keeps versions identical to yours)
run("npm ci --omit=dev --no-audit --no-fund", bundle);

// every .bin folder holds symlinks, which installers dislike and we never use
const modules = join(bundle, "node_modules");
for (const rel of readdirSync(modules, { recursive: true }).filter(
  (p) => basename(p) === ".bin",
)) {
  rmSync(join(modules, rel), { recursive: true, force: true });
}

// 4. the Node.js runtime, named the way Tauri expects sidecars: anitor-node-<target triple>
// (a unique name so it can never collide with the system node in /usr/bin)
const rustc = spawnSync("rustc", ["-vV"], { encoding: "utf8" });
const triple = /^host: (\S+)/m.exec(rustc.stdout ?? "")?.[1];
if (!triple)
  throw new Error(
    "Could not read the target triple from `rustc -vV` – is Rust installed?",
  );
const nodeBin = process.env.ANITOR_NODE_BIN ?? process.execPath;
mkdirSync(binaries, { recursive: true });
const target = join(
  binaries,
  `anitor-node-${triple}${triple.includes("windows") ? ".exe" : ""}`,
);
copyFileSync(nodeBin, target);
chmodSync(target, 0o755);

console.log(`\n✔ backend bundle: ${bundle}`);
console.log(
  `✔ node runtime:   ${target}  (from ${nodeBin}, ${process.version})`,
);

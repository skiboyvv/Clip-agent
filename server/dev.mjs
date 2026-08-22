import { spawn, fork } from "node:child_process";

const processes = [
  // fork() avoids Windows quoting issues when node.exe is under a path such
  // as `C:\\Program Files\\...`.
  fork("./server/index.mjs", { stdio: "inherit" }),
  process.platform === "win32"
    ? spawn(process.execPath, [process.env.npm_execpath, "run", "dev"], { stdio: "inherit" })
    : spawn("npm", ["run", "dev"], { stdio: "inherit" }),
];

let stopping = false;
function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  for (const child of processes) child.kill(signal);
}

for (const child of processes) {
  child.on("exit", (code, signal) => {
    if (!stopping) {
      stop();
      process.exitCode = code ?? (signal ? 1 : 0);
    }
  });
  child.on("error", (error) => {
    console.error(error);
    stop();
    process.exitCode = 1;
  });
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

// API(4318)와 웹(4317)을 함께 띄웁니다. 기본 포트(3000/5173/8080)를 피해 다른 앱과 충돌하지 않게 했습니다.
import { spawn } from "node:child_process";
const run = (cmd) => spawn(cmd, { shell: true, stdio: "inherit" });
const procs = [run("npm run dev:server"), run("npm run dev:web")];
const stop = () => { procs.forEach((p) => p.kill()); process.exit(); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

// dist-html/index.html → dist-html/sijangnote.html (더블클릭으로 여는 단일 파일)
import { renameSync, statSync } from "node:fs";
renameSync("dist-html/index.html", "dist-html/sijangnote.html");
console.log(`dist-html/sijangnote.html ${(statSync("dist-html/sijangnote.html").size / 1024 / 1024).toFixed(1)}MB`);

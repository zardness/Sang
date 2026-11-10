// dist-html/sijangnote.html → 앱 폴더의 sijangnote.html 와 sijangnote_Final_V1106.html (15MB 넘으면 실패)
import { copyFileSync, statSync } from "node:fs";
const size = statSync("dist-html/sijangnote.html").size;
const mb = (size / 1024 / 1024).toFixed(1);
if (size > 15 * 1024 * 1024) {
  console.error(`단일 HTML이 ${mb}MB입니다. 15MB 이하여야 합니다.`);
  process.exit(1);
}
for (const f of ["sijangnote.html", "sijangnote_Final_V1106.html"]) copyFileSync("dist-html/sijangnote.html", f);
console.log(`sijangnote.html, sijangnote_Final_V1106.html ${mb}MB`);

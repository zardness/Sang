// 단일 HTML 빌드: npm run build:html → dist-html/sijangnote.html
// 서버(Hono)·Agent 스냅샷·글꼴까지 HTML 한 파일에 넣어, 서버 없이 더블클릭으로 열 수 있습니다.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath } from "node:url";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  define: {
    "import.meta.env.VITE_STANDALONE": JSON.stringify("1"),
    "import.meta.env.VITE_SHOW_INFERENCE": JSON.stringify("1"),
    "process.env": "{}",
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    alias: [
      { find: /^node:fs$/, replacement: here("./standalone/fs-shim.ts") },
      { find: /^node:path$/, replacement: here("./standalone/path-shim.ts") },
      { find: /^node:zlib$/, replacement: here("./standalone/zlib-shim.ts") },
      // 글꼴 조각 92개 대신 가변 글꼴 한 개만 넣는다
      { find: "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css", replacement: here("./node_modules/pretendard/dist/web/variable/pretendardvariable.css") },
    ],
  },
  build: { outDir: "dist-html", emptyOutDir: true, assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 10_000 },
});

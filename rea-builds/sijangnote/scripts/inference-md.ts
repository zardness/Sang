// server/inference.ts 를 docs/INFERENCE.md 로 내보냅니다: npm run docs:inference
import { writeFileSync } from "node:fs";
import { INFERENCES } from "../server/inference.js";
const rows = INFERENCES.map((i) => `| ${i.id} | ${i.area} | ${i.claim} | ${i.evidence} | ${i.confidence} | ${i.alternative} |`).join("\n");
writeFileSync(
  "docs/INFERENCE.md",
  `# 추론 원장

레퍼런스 화면 6장만으로는 알 수 없어서 **추론해 구현한 서버 로직** 목록입니다. 화면에서 직접 읽은 값은 [관찰], 이 문서의 항목은 [추론]입니다.

추론한 로직은 세 곳에서 확인할 수 있습니다.

- 코드 주석: \`[추론 INF-xxx · 확신도]\` (\`grep -rn "추론 INF-" server src\`)
- API 응답 헤더: \`X-Rea-Inferred: INF-003,INF-004\`
- 개발 모드 화면 하단의 "이 화면의 추론된 로직 n개" 배지, 그리고 화면 곳곳의 점선 \`추론 INF-xxx\` 태그

| ID | 영역 | 추론 내용 | 근거 (레퍼런스 화면) | 확신도 | 대안 가설 |
| --- | --- | --- | --- | --- | --- |
${rows}

이 파일은 \`server/inference.ts\` 에서 자동으로 만듭니다. 내용을 바꾸려면 그 파일을 고친 뒤 \`npm run docs:inference\` 를 실행하세요.
`,
);
console.log(`docs/INFERENCE.md: ${INFERENCES.length}건`);

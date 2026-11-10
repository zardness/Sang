// 단일 HTML용 node:zlib 대체: 브라우저에는 OpenDART 키가 없어 압축 해제를 쓰지 않습니다.
export function inflateRawSync(): Uint8Array {
  throw new Error("단일 HTML에서는 OpenDART를 쓰지 않습니다.");
}
export default { inflateRawSync };

// 단일 HTML용 node:path 대체 (상대 경로만 다룸)
export const join = (...p: string[]) => p.filter(Boolean).join("/").replace(/\/+/g, "/");
export const resolve = (...p: string[]) => join(...p);
export const dirname = (p: string) => p.split("/").slice(0, -1).join("/") || ".";
export default { join, resolve, dirname };

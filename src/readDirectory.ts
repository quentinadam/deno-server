export default function* readDirectory(path: string) {
  try {
    Deno.statSync(path);
  } catch {
    return;
  }
  const queue: string[][] = [[]];
  while (true) {
    const parts = queue.pop();
    if (parts === undefined) {
      break;
    }
    for (const entry of Deno.readDirSync([path, ...parts].join('/'))) {
      if (entry.isFile) {
        yield [path, ...parts, entry.name].join('/');
      }
      if (entry.isDirectory) {
        queue.push([...parts, entry.name]);
      }
    }
  }
}

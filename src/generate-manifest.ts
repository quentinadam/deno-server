import sha256 from '@quentinadam/hash/sha256';
import { readDirectory as _readDirectory } from './readDirectory.ts';

function hash(value: string) {
  return Array.from((sha256(value).slice(0, 12)).toHex()).map((digit) => {
    return String.fromCharCode(97 + parseInt(digit, 16));
  }).join('');
}

function readDirectory(root: string) {
  return Array.from(
    _readDirectory(root).filter((path) => {
      return /\.(ts|tsx|js|jsx)$/.test(path);
    }).map((path) => {
      return { path, hash: hash(path) };
    }),
  );
}

const routes = readDirectory('./routes');
const islands = readDirectory('./islands');

Deno.writeTextFileSync(
  './$manifest.ts',
  [
    '// deno-fmt-ignore-file',
    ...routes.map(({ path, hash }) => {
      return `import ${hash} from '${path}';`;
    }),
    ...islands.map(({ path, hash }) => {
      return `import ${hash} from '${path}';`;
    }),
    '',
    'const manifest = {',
    '  url: import.meta.url,',
    '  routes: [',
    ...routes.map(({ hash, path }) => {
      path = path
        .slice('./routes'.length)
        .replace(/\.(ts|tsx|js|jsx)$/, '')
        .replace(/\/index$/, '/')
        .replace(/(?<=.)\/$/, '');
      return `    { path: ${JSON.stringify(path)}, route: ${hash} },`;
    }),
    '  ],',
    '  islands: [',
    ...islands.map(({ hash, path }) => {
      return `    { filePath: ${JSON.stringify(path)}, island: ${hash}, hash: ${JSON.stringify(hash)} },`;
    }),
    '  ],',
    '};',
    '',
    'export default manifest;',
  ].join('\n'),
);

import { type Attributes, type ComponentChildren, type ComponentType, Fragment, h, options, type VNode } from 'preact';
import { render } from 'preact-render-to-string';
import { ensure } from '@quentinadam/ensure';
import { moduleUrl } from './hydrateIslands.ts';

function Comment(text: string) {
  // @ts-ignore unstable property is not typed
  return h(Fragment, { UNSTABLE_comment: text });
}

function wrapWithMarker(vnode: ComponentChildren, markerText: string) {
  return h(Fragment, null, Comment(markerText), vnode, Comment('/' + markerText));
}

export class PageBuilder {
  readonly #islands;
  readonly #bundledScripts = new Map<string, string>();

  constructor({ basePath, islands }: {
    basePath: string;
    islands: { filePath: string; island: (props: Record<string, unknown>) => VNode | null; hash: string }[];
  }) {
    this.#islands = islands.map(({ filePath, island, hash }) => ({
      path: basePath + filePath,
      id: hash,
      render: island,
    }));
  }

  #generateEntrypoint(islands: { path: string; id: string; props: unknown[] }[]) {
    return [
      `import hydrateIslands from ${JSON.stringify(moduleUrl)};`,
      islands.map(({ path, id }) => {
        return `import ${id} from ${JSON.stringify('file://' + path)};`;
      }).join('\n'),
      'hydrateIslands([',
      islands.map(({ id, props }) => {
        return props.map((_, index) => {
          return [
            '{',
            `id: ${JSON.stringify(`${id}:${index}`)},`,
            `Component: ${id},`,
            `props: ${JSON.stringify(`${id}:${index}:data`)},`,
            '},',
          ].join('\n');
        }).join('\n');
      }).join('\n'),
      ']);',
    ].join('\n');
  }

  async #bundleScript(script: string) {
    const tempFile = await Deno.makeTempFile({ dir: '/tmp', suffix: '.ts' });
    await Deno.writeTextFile(tempFile, script);
    try {
      const result = await Deno.bundle({
        entrypoints: [tempFile],
        platform: 'browser',
        format: 'esm',
        write: false,
        minify: false,
      });
      if (!result.success) {
        console.error(result);
        throw new Error('Failed to bundle islands');
      }
      return ensure(ensure(result.outputFiles)[0]).text();
    } finally {
      await Deno.remove(tempFile);
    }
  }

  async #generateScript(islands: { path: string; id: string; props: unknown[] }[]) {
    if (islands.length === 0) {
      return;
    }
    const script = this.#generateEntrypoint(islands);
    let bundledScript = this.#bundledScripts.get(script);
    if (bundledScript === undefined) {
      bundledScript = await this.#bundleScript(script);
      this.#bundledScripts.set(script, bundledScript);
    }
    for (const island of islands) {
      let index = 0;
      for (const props of island.props) {
        const placeholder = JSON.stringify(`${island.id}:${index++}:data`);
        bundledScript = bundledScript.replace(placeholder, () => JSON.stringify(props));
      }
    }
    return bundledScript;
  }

  async build(App: () => VNode): Promise<string> {
    const islands = new Map<ComponentType, { path: string; id: string; props: unknown[] }>(
      this.#islands.map(({ path, render, id }) => [render, { path, id, props: new Array<unknown>() }]),
    );
    const previousHook = options.vnode;
    let skipNext: ComponentType | undefined = undefined;
    const scriptPlaceholder = `/* ${crypto.randomUUID()} */`;
    options.vnode = (node) => {
      if (typeof node.type !== 'string' && node.type !== skipNext) {
        skipNext = undefined;
        const island = islands.get(node.type);
        if (island !== undefined) {
          const index = island.props.length;
          island.props.push(node.props);
          const originalType = node.type;
          node.type = (props: Attributes) => {
            skipNext = originalType;
            return wrapWithMarker(h(originalType, props), `${island.id}:${index}`);
          };
        }
      } else if (node.type === 'head') {
        if (node.type === 'head') {
          const child = h('script', { type: 'module', dangerouslySetInnerHTML: { __html: scriptPlaceholder } });
          if (Array.isArray(node.props.children)) {
            node.props.children.push(child);
          } else {
            node.props.children = [node.props.children, child];
          }
        }
      }
      return previousHook?.(node);
    };
    let page = render(h(App, null));
    options.vnode = previousHook;
    const script = await this.#generateScript(Array.from(islands.values()).filter(({ props }) => props.length > 0));
    if (script !== undefined) {
      page = page.replace(scriptPlaceholder, () => script);
    }
    return page;
  }
}

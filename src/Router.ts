import assert from '@quentinadam/assert';

type Handler = ({ request, info, params }: {
  request: Request;
  info: Deno.ServeHandlerInfo;
  params: Partial<Record<string, string | string[]>>;
}) => Response | Promise<Response>;

export class RouteNode {
  handler?: Handler;
  readonly staticChildren: Map<string, RouteNode>;
  paramChild?: { name: string; node: RouteNode };
  restChild?: { name: string; handler: Handler };

  constructor({ handler, staticChildren, paramChild, restChild }: {
    handler?: Handler;
    staticChildren?: Map<string, RouteNode>;
    paramChild?: { name: string; node: RouteNode };
    restChild?: { name: string; handler: Handler };
  } = {}) {
    this.handler = handler;
    this.staticChildren = staticChildren ?? new Map();
    this.paramChild = paramChild;
    this.restChild = restChild;
  }
}

function splitPath(path: string): string[] {
  assert(path.startsWith('/'), 'Path must start with /');
  return path === '/' ? [] : path.slice(1).split('/');
}

export default class Router {
  readonly root = new RouteNode();

  addHandler(path: string, handler: Handler) {
    let node = this.root;
    const names = new Set<string>();
    let index = 0;
    const parts = splitPath(path);
    for (const part of parts) {
      if (part.length >= 2 && part[0] === '[' && part[part.length - 1] === ']') {
        if (part.length >= 5 && part.slice(1, 4) === '...') {
          const name = part.slice(4, -1);
          assert(!names.has(name), `Duplicate parameter name ${name} in ${path}`);
          names.add(name);
          assert(node.restChild === undefined, `Duplicate route with rest parameter at position ${index}`);
          node.restChild = { name, handler };
          assert(index === parts.length - 1, 'Rest parameter must be the last part of the path');
          return;
        } else {
          const name = part.slice(1, -1);
          assert(!names.has(name), `Duplicate parameter name ${name} in ${path}`);
          names.add(name);
          if (node.paramChild === undefined) {
            node.paramChild = { name, node: new RouteNode() };
          }
          assert(node.paramChild.name === name, `Duplicate route with conflicting parameter name at position ${index}`);
          node = node.paramChild.node;
        }
      } else {
        let child = node.staticChildren.get(part);
        if (child === undefined) {
          child = new RouteNode();
          node.staticChildren.set(part, child);
        }
        node = child;
      }
      index++;
    }
    node.handler = handler;
  }

  addStaticHandler(path: string, handler: Handler) {
    let node = this.root;
    const parts = splitPath(path);
    for (const part of parts) {
      let child = node.staticChildren.get(part);
      if (child === undefined) {
        child = new RouteNode();
        node.staticChildren.set(part, child);
      }
      node = child;
    }
    node.handler = handler;
  }

  getHandler(path: string) {
    return new Matcher(path).match({ node: this.root, index: 0, params: {} });
  }
}

export class Matcher {
  readonly #parts: string[];

  constructor(path: string) {
    this.#parts = splitPath(path);
  }

  match({ node, index, params }: {
    node: RouteNode;
    index: number;
    params: Partial<Record<string, string>>;
  }): { handler: Handler; params: Partial<Record<string, string | string[]>> } | undefined {
    const part = this.#parts[index];
    if (part !== undefined) {
      const staticChild = node.staticChildren.get(part);
      if (staticChild !== undefined) {
        const result = this.match({ node: staticChild, index: index + 1, params });
        if (result !== undefined) {
          return result;
        }
      }
      if (node.paramChild !== undefined && part !== '') {
        const result = this.match({
          node: node.paramChild.node,
          index: index + 1,
          params: { ...params, [node.paramChild.name]: part },
        });
        if (result !== undefined) {
          return result;
        }
      }
    } else {
      if (node.handler !== undefined) {
        return { handler: node.handler, params };
      }
    }
    if (node.restChild !== undefined) {
      return {
        handler: node.restChild.handler,
        params: { ...params, [node.restChild.name]: this.#parts.slice(index) },
      };
    }
    return undefined;
  }
}

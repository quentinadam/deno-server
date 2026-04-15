import type { VNode } from 'preact';
import type BaseRoute from './BaseRoute.ts';
import type Method from './Method.ts';
import PageBuilder from './PageBuilder.ts';
import Router from './Router.ts';
import readDirectory from './readDirectory.ts';

const methods: Method[] = ['CONNECT', 'DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT', 'TRACE'];

export default class Server<Context> {
  readonly #routers = Object.fromEntries(methods.map((method) => [method, new Router()]));
  readonly #contentTypes = new Map<string | undefined, string>([
    ['.css', 'text/css'],
    ['.gif', 'image/gif'],
    ['.html', 'text/html'],
    ['.ico', 'image/x-icon'],
    ['.jpeg', 'image/jpeg'],
    ['.jpg', 'image/jpeg'],
    ['.js', 'text/javascript'],
    ['.json', 'application/json'],
    ['.png', 'image/png'],
    ['.svg', 'image/svg+xml'],
    ['.txt', 'text/plain'],
    ['.xml', 'text/xml'],
  ]);

  constructor({ manifest, context }: {
    manifest: {
      url: string;
      routes: { path: string; route: BaseRoute<Context> }[];
      islands: { filePath: string; island: (props: Record<string, unknown>) => VNode | null; hash: string }[];
    };
    context: Context;
  }) {
    const { url, routes, islands } = manifest;
    const basePath = new URL('.', url).pathname;
    const pageBuilder = new PageBuilder({ basePath, islands });
    const router = this.#routers.GET;
    if (router !== undefined) {
      for (const path of readDirectory(basePath + './static')) {
        router.addStaticHandler(path, async () => {
          const index = path.lastIndexOf('.');
          const extension = index === -1 ? undefined : path.slice(index);
          const contentType = this.#contentTypes.get(extension) ?? 'application/octet-stream';
          const data = await Deno.readFile(path);
          return new Response(data, { headers: { 'Content-Type': contentType } });
        });
      }
    }
    for (const { path, route } of routes) {
      for (const method of methods) {
        const handler = route[method];
        if (handler !== undefined) {
          const router = this.#routers[method];
          if (router !== undefined) {
            router.addHandler(path, async ({ request, info, params }) => {
              return await handler({ request, info, context, params, pageBuilder });
            });
          }
        }
      }
    }
  }

  async handle(request: Request, info: Deno.ServeHandlerInfo): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const router = this.#routers[method];
    if (router !== undefined) {
      const result = router.getHandler(url.pathname);
      if (result !== undefined) {
        const { handler, params } = result;
        try {
          return await handler({ request, info, params });
        } catch (error) {
          console.error(error);
          return new Response('Internal Server Error', { status: 500 });
        }
      }
    }
    return new Response('Not Found', { status: 404 });
  }

  serve(options?: Deno.ServeTcpOptions) {
    Deno.serve(options ?? {}, async (request, info) => {
      return await this.handle(request, info);
    });
  }
}

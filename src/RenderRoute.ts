import type { VNode } from 'preact';
import type Method from './Method.ts';
import BaseRoute from './BaseRoute.ts';

export type RenderRouteHandler<Context> = ({ request, info, context, params, render }: {
  request: Request;
  info: Deno.ServeHandlerInfo;
  context: Context;
  params: Partial<Record<string, string | string[]>>;
  render: () => Promise<Response>;
}) => Response | Promise<Response>;

export default class RenderRoute<Context> extends BaseRoute<Context> {
  constructor(handlers: { render: () => VNode } & Partial<Record<Method, RenderRouteHandler<Context>>>) {
    super((method) => {
      const handler = handlers[method];
      return handler === undefined ? undefined : async ({ request, info, context, params, pageBuilder }) => {
        return await handler({
          request,
          info,
          context,
          params,
          render: async () => {
            const page = await pageBuilder.build(handlers.render);
            return new Response(page, { headers: { 'Content-Type': 'text/html' } });
          },
        });
      };
    });
  }
}

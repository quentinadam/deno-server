import type { Method } from './Method.ts';
import { BaseRoute } from './BaseRoute.ts';

export type RouteHandler<Context> = ({ request, info, context, params }: {
  request: Request;
  info: Deno.ServeHandlerInfo;
  context: Context;
  params: Partial<Record<string, string | string[]>>;
}) => Response | Promise<Response>;

export class Route<Context> extends BaseRoute<Context> {
  constructor(handlers: Partial<Record<Method, RouteHandler<Context>>>) {
    super((method) => {
      const handler = handlers[method];
      return handler === undefined ? undefined : async ({ request, info, context, params }) => {
        return await handler({ request, info, context, params });
      };
    });
  }
}

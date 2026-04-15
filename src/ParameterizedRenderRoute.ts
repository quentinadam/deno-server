import { Fragment, h, type VNode } from 'preact';
import type { Method } from './Method.ts';
import { BaseRoute } from './BaseRoute.ts';

export type ParameterizedRenderRouteHandler<T extends Record<string, unknown>, Context> = ({
  request,
  info,
  context,
  params,
  render,
}: {
  request: Request;
  info: Deno.ServeHandlerInfo;
  context: Context;
  params: Partial<Record<string, string | string[]>>;
  render: (props: T) => Promise<Response>;
}) => Response | Promise<Response>;

export class ParameterizedRenderRoute<T extends Record<string, unknown>, Context> extends BaseRoute<Context> {
  constructor(
    handlers: { render: (props: T) => VNode } & Partial<Record<Method, ParameterizedRenderRouteHandler<T, Context>>>,
  ) {
    super((method) => {
      const handler = handlers[method];
      return handler === undefined ? undefined : async ({ request, info, context, params, pageBuilder }) => {
        return await handler({
          request,
          info,
          context,
          params,
          render: async (props: T) => {
            const page = await pageBuilder.build(() => h(Fragment, null, h(handlers.render, props)));
            return new Response(page, { headers: { 'Content-Type': 'text/html' } });
          },
        });
      };
    });
  }
}

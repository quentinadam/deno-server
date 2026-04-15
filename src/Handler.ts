import type { PageBuilder } from './PageBuilder.ts';

export type Handler<Context> = ({ request, info, context, params, pageBuilder }: {
  request: Request;
  info: Deno.ServeHandlerInfo;
  context: Context;
  params: Partial<Record<string, string | string[]>>;
  pageBuilder: PageBuilder;
}) => Promise<Response>;

import type Method from './Method.ts';
import type Handler from './Handler.ts';

export default class BaseRoute<Context> {
  CONNECT?: Handler<Context>;
  DELETE?: Handler<Context>;
  GET?: Handler<Context>;
  HEAD?: Handler<Context>;
  OPTIONS?: Handler<Context>;
  PATCH?: Handler<Context>;
  POST?: Handler<Context>;
  PUT?: Handler<Context>;
  TRACE?: Handler<Context>;

  constructor(fn: (method: Method) => Handler<Context> | undefined) {
    this.CONNECT = fn('CONNECT');
    this.DELETE = fn('DELETE');
    this.GET = fn('GET');
    this.HEAD = fn('HEAD');
    this.OPTIONS = fn('OPTIONS');
    this.PATCH = fn('PATCH');
    this.POST = fn('POST');
    this.PUT = fn('PUT');
    this.TRACE = fn('TRACE');
  }
}

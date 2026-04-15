# @quentinadam/server

[![JSR][jsr-image]][jsr-url] [![NPM][npm-image]][npm-url] [![CI][ci-image]][ci-url]

A web server framework inspired by [Deno Fresh](https://fresh.deno.dev/).

## Usage

```ts
import server from '@quentinadam/server';

server(true); // doesn't throw

server(false); // throws an AssertionError

server(false, 'message'); // throws an AssertionError with a custom error message

server(false, new Error('message')); // throws a custom Error

const value: string | undefined = 'hello';
server(value !== undefined); // narrows the type of value to string;
value.toUpperCase(); // works
```

[ci-image]: https://img.shields.io/github/actions/workflow/status/quentinadam/deno-server/ci.yml?branch=main&logo=github&style=flat-square
[ci-url]: https://github.com/quentinadam/deno-server/actions/workflows/ci.yml
[npm-image]: https://img.shields.io/npm/v/@quentinadam/server.svg?style=flat-square
[npm-url]: https://npmjs.org/package/@quentinadam/server
[jsr-image]: https://jsr.io/badges/@quentinadam/server?style=flat-square
[jsr-url]: https://jsr.io/@quentinadam/server

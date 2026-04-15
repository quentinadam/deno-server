import { assert } from '@quentinadam/assert';
import { Matcher, RouteNode, Router } from './Router.ts';

function assertThrows(fn: () => void, message?: string): void {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  assert(threw, message ?? 'Expected function to throw');
}

Deno.test('Router.addHandler - static routes', () => {
  const router = new Router();
  const handler1 = () => new Response();
  const handler2 = () => new Response();

  router.addHandler('/users', handler1);
  router.addHandler('/orders', handler2);

  const result1 = router.getHandler('/users');
  assert(result1 !== undefined);
  assert(result1.handler === handler1);

  const result2 = router.getHandler('/orders');
  assert(result2 !== undefined);
  assert(result2.handler === handler2);
});

Deno.test('Router.addHandler - param routes', () => {
  const router = new Router();
  const handler = () => new Response();

  router.addHandler('/users/[id]', handler);

  const result = router.getHandler('/users/123');
  assert(result !== undefined);
  assert(result.handler === handler);
  assert(result.params.id === '123');
});

Deno.test('Router.addHandler - rest routes', () => {
  const router = new Router();
  const handler = () => new Response();
  router.addHandler('/files/[...path]', handler);
  const result = router.getHandler('/files/a/b/c');
  assert(result !== undefined);
  assert(result.handler === handler);
  assert(Array.isArray(result.params.path));
  assert(result.params.path.join('/') === 'a/b/c');
});

Deno.test('Router.addHandler - duplicate route throws', () => {
  const router = new Router();
  router.addHandler('/users', () => new Response());
  assertThrows(() => router.addHandler('/users', () => new Response()), 'Expected duplicate route to throw');
});

Deno.test('Router.addHandler - duplicate parameter name throws', () => {
  const router = new Router();
  assertThrows(
    () => router.addHandler('/users/[id]/posts/[id]', () => new Response()),
    'Expected duplicate parameter name to throw',
  );
});

Deno.test('Router.addHandler - conflicting parameter name throws', () => {
  const router = new Router();
  router.addHandler('/users/[id]', () => new Response());
  assertThrows(
    () => router.addHandler('/users/[userId]', () => new Response()),
    'Expected conflicting parameter name to throw',
  );
});

Deno.test('Router.addHandler - rest parameter not at end throws', () => {
  const router = new Router();
  assertThrows(
    () => router.addHandler('/files/[...path]/info', () => new Response()),
    'Expected rest parameter not at end to throw',
  );
});

Deno.test('Router.getHandler - returns undefined for non-matching routes', () => {
  const router = new Router();
  router.addHandler('/users', () => new Response());

  assert(router.getHandler('/orders') === undefined);
  assert(router.getHandler('/users/123') === undefined);
});

Deno.test('Router.getHandler - static routes take priority over param routes', () => {
  const router = new Router();
  const handlers = {
    static: () => new Response(),
    param: () => new Response(),
  };

  router.addHandler('/users/[id]', handlers.param);
  router.addHandler('/users/me', handlers.static);

  const result = router.getHandler('/users/me');
  assert(result !== undefined);
  assert(result.handler === handlers.static);

  const result2 = router.getHandler('/users/123');
  assert(result2 !== undefined);
  assert(result2.handler === handlers.param);
});

Deno.test('Router.getHandler - test vectors', () => {
  const router = new Router();

  const handlers = {
    root: () => new Response(),
    users: () => new Response(),
    userById: () => new Response(),
    userPosts: () => new Response(),
    userPostById: () => new Response(),
    files: () => new Response(),
    apiCatchAll: () => new Response(),
  };

  router.addHandler('/', handlers.root);
  router.addHandler('/users', handlers.users);
  router.addHandler('/users/[id]', handlers.userById);
  router.addHandler('/users/[id]/posts', handlers.userPosts);
  router.addHandler('/users/[id]/posts/[postId]', handlers.userPostById);
  router.addHandler('/files/[...path]', handlers.files);
  router.addHandler('/api/[...slug]', handlers.apiCatchAll);

  const vectors = [
    {
      path: '/',
      expectedHandler: handlers.root,
      expectedParams: {},
    },
    {
      path: '/users',
      expectedHandler: handlers.users,
      expectedParams: {},
    },
    {
      path: '/users/123',
      expectedHandler: handlers.userById,
      expectedParams: { id: '123' },
    },
    {
      path: '/users/456/posts',
      expectedHandler: handlers.userPosts,
      expectedParams: { id: '456' },
    },
    {
      path: '/users/789/posts/42',
      expectedHandler: handlers.userPostById,
      expectedParams: { id: '789', postId: '42' },
    },
    {
      path: '/files/documents/report.pdf',
      expectedHandler: handlers.files,
      expectedParams: { path: ['documents', 'report.pdf'] },
    },
    {
      path: '/files/a/b/c/d',
      expectedHandler: handlers.files,
      expectedParams: { path: ['a', 'b', 'c', 'd'] },
    },
    {
      path: '/api/v1/users/list',
      expectedHandler: handlers.apiCatchAll,
      expectedParams: { slug: ['v1', 'users', 'list'] },
    },
    {
      path: '/nonexistent',
      expectedHandler: undefined,
      expectedParams: undefined,
    },
    {
      path: '/users/123/nonexistent',
      expectedHandler: undefined,
      expectedParams: undefined,
    },
  ];

  for (const { path, expectedHandler, expectedParams } of vectors) {
    const result = router.getHandler(path);
    if (expectedHandler === undefined) {
      assert(result === undefined, `Expected undefined for path ${path}`);
    } else {
      assert(result !== undefined, `Expected result for path ${path}`);
      assert(result.handler === expectedHandler, `Handler mismatch for path ${path}`);
      assert(
        JSON.stringify(result.params) === JSON.stringify(expectedParams),
        `Params mismatch for path ${path}: expected ${JSON.stringify(expectedParams)}, got ${
          JSON.stringify(result.params)
        }`,
      );
    }
  }
});

Deno.test('Matcher - test vectors', () => {
  const handlers = {
    users: () => new Response(),
    userById: () => new Response(),
    userPosts: () => new Response(),
    files: () => new Response(),
  };

  // Build tree: /users, /users/[id], /users/[id]/posts, /files/[...path]
  const root = new RouteNode({
    staticChildren: new Map([
      [
        'users',
        new RouteNode({
          handler: handlers.users,
          paramChild: {
            name: 'id',
            node: new RouteNode({
              handler: handlers.userById,
              staticChildren: new Map([
                ['posts', new RouteNode({ handler: handlers.userPosts })],
              ]),
            }),
          },
        }),
      ],
      [
        'files',
        new RouteNode({
          restChild: { name: 'path', handler: handlers.files },
        }),
      ],
    ]),
  });

  const vectors = [
    {
      path: '/users',
      expectedHandler: handlers.users,
      expectedParams: {},
    },
    {
      path: '/users/123',
      expectedHandler: handlers.userById,
      expectedParams: { id: '123' },
    },
    {
      path: '/users/456/posts',
      expectedHandler: handlers.userPosts,
      expectedParams: { id: '456' },
    },
    {
      path: '/files/a/b/c',
      expectedHandler: handlers.files,
      expectedParams: { path: ['a', 'b', 'c'] },
    },
    {
      path: '/files',
      expectedHandler: handlers.files,
      expectedParams: { path: [] },
    },
    {
      path: '/nonexistent',
      expectedHandler: undefined,
      expectedParams: undefined,
    },
  ];

  for (const { path, expectedHandler, expectedParams } of vectors) {
    const matcher = new Matcher(path);
    const result = matcher.match({ node: root, index: 0, params: {} });

    if (expectedHandler === undefined) {
      assert(result === undefined, `Expected undefined for path ${path}`);
    } else {
      assert(result !== undefined, `Expected result for path ${path}`);
      assert(result.handler === expectedHandler, `Handler mismatch for path ${path}`);
      assert(
        JSON.stringify(result.params) === JSON.stringify(expectedParams),
        `Params mismatch for path ${path}: expected ${JSON.stringify(expectedParams)}, got ${
          JSON.stringify(result.params)
        }`,
      );
    }
  }
});

Deno.test('Matcher - prioritizes static over param', () => {
  const handlers = {
    me: () => new Response(),
    byId: () => new Response(),
  };

  const root = new RouteNode({
    staticChildren: new Map([
      [
        'users',
        new RouteNode({
          staticChildren: new Map([
            ['me', new RouteNode({ handler: handlers.me })],
          ]),
          paramChild: { name: 'id', node: new RouteNode({ handler: handlers.byId }) },
        }),
      ],
    ]),
  });

  const matcher1 = new Matcher('/users/me');
  const result1 = matcher1.match({ node: root, index: 0, params: {} });
  assert(result1 !== undefined);
  assert(result1.handler === handlers.me);

  const matcher2 = new Matcher('/users/123');
  const result2 = matcher2.match({ node: root, index: 0, params: {} });
  assert(result2 !== undefined);
  assert(result2.handler === handlers.byId);
  assert(result2.params.id === '123');
});

Deno.test('Matcher - rest parameter captures remaining path', () => {
  const handler = () => new Response();

  const root = new RouteNode({
    staticChildren: new Map([
      [
        'api',
        new RouteNode({
          staticChildren: new Map([
            [
              'v1',
              new RouteNode({
                restChild: { name: 'rest', handler },
              }),
            ],
          ]),
        }),
      ],
    ]),
  });

  const vectors = [
    { path: '/api/v1', expectedParams: { rest: [] } },
    { path: '/api/v1/users', expectedParams: { rest: ['users'] } },
    { path: '/api/v1/users/123/posts', expectedParams: { rest: ['users', '123', 'posts'] } },
  ];

  for (const { path, expectedParams } of vectors) {
    const matcher = new Matcher(path);
    const result = matcher.match({ node: root, index: 0, params: {} });
    assert(result !== undefined, `Expected result for path ${path}`);
    assert(result.handler === handler);
    assert(
      JSON.stringify(result.params) === JSON.stringify(expectedParams),
      `Params mismatch for path ${path}`,
    );
  }
});

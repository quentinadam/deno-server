import Server from './Server.ts';
import manifest from './$manifest.ts';

const server = new Server({ manifest, context: {} });

server.serve();

import { createServer } from 'node:http';
import { createApp } from './app.js';

const app = createApp();
const port = Number(process.env.PORT ?? 3000);

const server = createServer((_request, response) => {
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify(app.health()));
});

server.listen(port, () => {
  console.log(`DevOS API listening on ${port}`);
});

import { Agent, request, type IncomingMessage, type ServerResponse } from 'node:http';
import { connect } from 'node:net';
import type { Duplex } from 'node:stream';

const HOP_BY_HOP = ['connection', 'keep-alive', 'proxy-connection', 'transfer-encoding', 'upgrade', 'te', 'trailer'];

/** Relais HTTP vers une instance locale ; conserve le streaming (SSE, gros fichiers). */
export function createProxy() {
  const agent = new Agent({ keepAlive: true, maxSockets: 256 });

  const forwardHeaders = (req: IncomingMessage) => {
    const headers: Record<string, string | string[] | undefined> = { ...req.headers };
    for (const h of HOP_BY_HOP) delete headers[h];
    const prior = req.headers['x-forwarded-for'];
    headers['x-forwarded-for'] = [prior, req.socket.remoteAddress].filter(Boolean).join(', ');
    headers['x-forwarded-proto'] ??= 'http';
    headers['x-forwarded-host'] ??= req.headers.host;
    return headers;
  };

  return {
    web(req: IncomingMessage, res: ServerResponse, port: number, extraHeaders: Record<string, string> = {}): void {
      const upstream = request(
        { host: '127.0.0.1', port, method: req.method, path: req.url, headers: forwardHeaders(req), agent },
        (up) => {
          const headers = { ...up.headers };
          for (const h of HOP_BY_HOP) delete headers[h];
          res.writeHead(up.statusCode ?? 502, { ...headers, ...extraHeaders });
          // Envoi immédiat de chaque morceau (flux SSE de rechargement en direct).
          res.flushHeaders();
          up.pipe(res);
        },
      );
      upstream.on('error', () => {
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ code: 'UNAVAILABLE', message: 'Application en cours de redémarrage', status: 503 }));
        } else res.destroy();
      });
      res.on('close', () => {
        if (!res.writableFinished) upstream.destroy();
      });
      req.pipe(upstream);
    },

    /** WebSocket et autres connexions « Upgrade ». */
    upgrade(req: IncomingMessage, socket: Duplex, head: Buffer, port: number): void {
      const target = connect(port, '127.0.0.1', () => {
        const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
        for (let i = 0; i < req.rawHeaders.length; i += 2) lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
        target.write(lines.join('\r\n') + '\r\n\r\n');
        if (head.length) target.write(head);
        target.pipe(socket);
        socket.pipe(target);
      });
      const close = () => {
        target.destroy();
        socket.destroy();
      };
      target.on('error', close);
      socket.on('error', close);
    },

    close: () => agent.destroy(),
  };
}

import { request, Agent } from 'https';

import { createServer, IncomingMessage, ServerResponse } from 'http';

import { Server, ListenOptions, Socket } from 'net';

import { sign } from 'aws4';

import { parse } from 'url';

export { EnvCredentials } from './credentials';

import * as AWS from 'aws-sdk';
import { EventEmitter } from 'events';

class Request extends IncomingMessage {
  async readAll() {
    let chunks = Buffer.alloc(0);
    for await (const chunk of this) {
      chunks = Buffer.concat([chunks, chunk]);
    }
    return chunks;
  }
}

class Response extends ServerResponse {
  proxy(req: Request, body: Buffer) {
    const r = request(req, (res) => {
      this.writeHead(res.statusCode || 500, res.headers);
      res.on('data', (chunk) => this.write(chunk));
      res.on('end', () => this.end());
    });
    r.end(body);
  }
}

type Credentials = AWS.Credentials;

interface ProxyOptions {
  service: string;
  credentials: Credentials;
  region: string;
  endpoint?: string;
  endpointHost?: string;
  agent?: Agent;
}

export class Proxy extends EventEmitter {
  service: string;

  region: string;

  endpoint?: string;

  endpointHost?: string;

  server: Server;

  credentials: Credentials;

  agent: Agent;

  constructor({ service, credentials, endpoint, endpointHost, region, agent }: ProxyOptions) {
    super();

    this.service = service;
    this.credentials = credentials;
    this.region = region;
    this.endpoint = endpoint;
    this.endpointHost = endpointHost;
    this.agent = agent || new Agent({ keepAlive: true });

    this.server = createServer({
      IncomingMessage: Request,
      ServerResponse: Response,
    }, (req, res) => this.handleRequest(<Request>req, <Response>res));

    this.server.on('upgrade', (req, socket) => this.handleUpgrade(<Request>req, <Socket>socket));

    this.server.on('error', (err) => this.emit('error', err));
  }

  listen(...args: any) { this.server.listen(...args) }

  async sign(req: Request) {
    await this.credentials.getPromise();
    const url = parse(req.url || '/');
    const { host: oldHost, connection, ...headers } = req.headers;
    const body = await req.readAll();
    const host = this.endpointHost || this.endpoint;
    const signed = sign({
      host,
      service: this.service,
      region: this.region,
      method: req.method,
      path: url.href,
      headers,
      agent: this.agent,
      body,
      checkServerIdentity: (servername: string) => servername === host ? undefined : new Error('Hostname/IP does not match certificate\'s altnames'),
    }, this.credentials);
    return [this.endpointHost ? {
      ...signed,
      host: this.endpoint,
    } : signed, body];
  }

  async handleRequest(req: Request, res: Response) {
    const [signed, body] = await this.sign(req);
    console.log(JSON.stringify({ method: req.method, path: req.url, bodyLength: body.length }))
    res.proxy(signed, body);
  }

  async handleUpgrade(req: Request, socketA: Socket) {
    const [signed] = await this.sign(req);
    const r = request(signed);
    r.on('upgrade', (res, socketB: Socket) => {
      const reply = [`HTTP/${res.httpVersion} ${res.statusCode} ${res.statusMessage}`];
      let pass = [...res.rawHeaders];
      while (pass.length) {
        const [key, value] = pass.splice(0, 2);
        reply.push(`${key}: ${value}`);
      }
      reply.push('', '');
      socketA.write(reply.join('\r\n'));
      socketA.pipe(socketB);
      socketB.pipe(socketA);
    });
    r.end();
  }
}

import { request, Agent } from 'https';

import { createServer, Server, IncomingMessage, ServerResponse } from 'http';

import { ListenOptions, Socket } from 'net';

import { sign } from 'aws4';

import { parse } from 'url';

export { EnvCredentials } from './credentials';

import * as AWS from 'aws-sdk';
import { EventEmitter } from 'events';

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

    this.server = createServer((req, res) => this.handleRequest(<IncomingMessage>req, <ServerResponse>res));
    this.server.setTimeout(0);

    this.server.on('upgrade', (req, socket) => this.handleUpgrade(<IncomingMessage>req, <Socket>socket));

    this.server.on('error', (err) => this.emit('error', err));
  }

  listen(...args: any) { this.server.listen(...args) }

  async sign(req: IncomingMessage) {
    await this.credentials.getPromise();
    const url = parse(req.url || '/');
    const { host: oldHost, connection, ...headers } = req.headers;
    const body = await this.readAll(req);
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

  async handleRequest(req: IncomingMessage, res: ServerResponse) {
    const [signed, body] = await this.sign(req);
    console.log(JSON.stringify({ method: req.method, path: req.url, bodyLength: body.length }))
    this.proxy(res, signed, body);
  }

  async handleUpgrade(req: IncomingMessage, socketA: Socket) {
    const [signed, body] = await this.sign(req);
    console.log(JSON.stringify({ method: req.method, path: req.url, bodyLength: body.length, upgrade: true }))
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

  async readAll(req: IncomingMessage) {
    let chunks = Buffer.alloc(0);
    for await (const chunk of req) {
      chunks = Buffer.concat([chunks, chunk]);
    }
    return chunks;
  }

  proxy(sRes: ServerResponse, req: IncomingMessage, body: Buffer) {
    const r = request(req, (res) => {
      sRes.writeHead(res.statusCode || 500, res.headers);
      res.on('data', (chunk) => sRes.write(chunk));
      res.on('end', () => sRes.end());
    });
    r.end(body);
  }
}

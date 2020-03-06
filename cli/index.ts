#!/usr/bin/env node

import * as yargs from 'yargs';

import { Proxy, EnvCredentials } from '../lib';

const {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_SESSION_TOKEN,
  AWS_DEFAULT_REGION,
} = process.env;

const args = yargs.env('AWS4PROXY').options({
  level: {
    default: 'info',
  },
  host: {
    alias: 'h',
    default: '127.0.0.1',
  },
  port: {
    alias: 'p',
    type: 'number',
    default: 3000,
  },
  endpoint: {
    type: 'string',
  },
  'endpoint-host': {
    type: 'string',
  },
  service: {
    type: 'string',
    required: true,
  },
  region: {
    default: 'AWS_DEFAULT_REGION',
    required: true,
    coerce: (val) => {
      const region = val === 'AWS_DEFAULT_REGION' ? AWS_DEFAULT_REGION : val;
      if (!region) throw new Error('region or AWS_DEFAULT_REGION is not set');
      return region;
    },
  },
}).argv;

async function run() {
  let credentials;

  try {
    const AWS = require('aws-sdk/global');
    credentials = await new AWS.CredentialProviderChain().resolvePromise();
  } catch(e) {
    credentials = new EnvCredentials({
      accessKeyId: <string>AWS_ACCESS_KEY_ID,
      secretAccessKey: <string>AWS_SECRET_ACCESS_KEY,
      sessionToken: <string>AWS_SESSION_TOKEN,
    });
  }


  const proxy = new Proxy({
    service: args.service,
    region: args.region,
    endpoint: args.endpoint,
    endpointHost: args['endpoint-host'],
    credentials,
  });

  proxy.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') console.error(err.toString());
    else throw err;
  });

  proxy.listen(args.port, args.host, function (this: any) {
    console.log(`Listening on http://${this.address().address}:${this.address().port}/`);
  });
}

run();

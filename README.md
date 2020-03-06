![GitHub Workflow Status](https://img.shields.io/github/workflow/status/monken/aws4-proxy/build)
![Apache License](https://img.shields.io/badge/license-Apache--2.0-yellow)
![Dependencies](https://img.shields.io/badge/dependencies-2-blue)

# aws4-proxy

```bash
# Create a signing proxy to S3 and then use the CLI to access without signing
aws4-proxy --service s3 --region us-east-1
aws s3 ls --endpoint http://localhost:3000 --no-sign-request

# Create a proxy to an API Gateway with AWS_IAM authentication and query using curl
aws4-proxy --service execute-api --region eu-west-1 --endpoint api.mycorp.com
curl http://localhost:3000/v1/my-api/

# Create a proxy to an Elasticsearch instance with IAM authentication and open Kibana
aws4-proxy --service es --region us-east-2 --endpoint search-nfvgk3cqs3nk3u.us-east-2.es.amazonaws.com
open http://localhost:3000/_plugin/kibana/
```

**Command line options:**

```
Options:
  --help           Show help                                           [boolean]
  --version        Show version number                                 [boolean]
  --level                                                      [default: "info"]
  --host, -h                                              [default: "127.0.0.1"]
  --port, -p                                            [number] [default: 3000]
  --endpoint                                                            [string]
  --endpoint-host                                                       [string]
  --service                                                  [string] [required]
  --region                            [required] [default: "AWS_DEFAULT_REGION"]
```

## Installation

```bash
npm install --global aws4-proxy

# or without installing
npx aws4-proxy [...]
```

## Authentication

The proxy will check for the availability of the `aws-sdk` package (not installed as part of this package). If available it uses the [`CredentialProviderChain`](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CredentialProviderChain.html) class which will automatically locate and load credentials. If the package is not available, credentials are loaded from environment variables only (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and optionally `AWS_SESSION_TOKEN`).

## Features

* Supports WebSocket (e.g. Neptune, API Gateway)
* No limit on body size
* Efficient and fast
* Few external dependencies
* Supports proxying Kibana for Elasticsearch Service

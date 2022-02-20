dockside
========

[![Build and test status](https://github.com/silverlyra/dockside/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/silverlyra/dockside/actions/workflows/ci.yml?query=branch%3Amain) [![NPM package](https://img.shields.io/npm/v/dockside.svg?style=flat)](https://npm.im/dockside)

Dockside is a client for the [Docker Registry API][api].

[api]: https://docs.docker.com/registry/spec/api/

```ts
import { Client, DockerAuthenticator } from 'dockside';

const client = new Client({ auth: new DockerAuthenticator() });

const manifest = await client.getManifest('debian:bullseye', 'linux/amd64');
```

[📘 **API Documentation**][typedoc]

[typedoc]: https://silverlyra.github.io/dockside/

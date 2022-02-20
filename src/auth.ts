import {readFile} from 'fs/promises'
import {homedir} from 'os'
import * as path from 'path'

import {Registry, defaultRegistryHost} from './ref'
import {Fetch, Request, Response, ResponseError} from './net'

/**
 * An Authenticator provides credentials for a Docker registry.
 */
export interface Authenticator {
  authForRegistry(registry: Registry): Promise<RegistryAuthentication>
}

interface DockerConfig {
  auths?: RegistryAuthentications
}

interface RegistryAuthentications {
  [host: string]: RegistryAuthentication | undefined
}

/**
 * RegistryAuthentication contains credentials to authenticate with a Docker registry.
 */
export interface RegistryAuthentication {
  auth?: string

  username?: string
  password?: string

  identitytoken?: string
  registrytoken?: string
}

/**
 * AnonymousAuthenticator never provides any credentials.
 */
export class AnonymousAuthenticator implements Authenticator {
  async authForRegistry(_registry: Registry): Promise<RegistryAuthentication> {
    return {}
  }
}

/**
 * DockerAuthenticator uses the local `.docker/config.json` to provide
 * credentials to Docker registries. Registries that have been authenticated
 * using `docker login` will be available using this authenticator.
 */
export class DockerAuthenticator implements Authenticator {
  async authForRegistry(registry: Registry): Promise<RegistryAuthentication> {
    const config = await this.readConfig()
    if (config?.auths == null) return {}

    const {auths} = config

    let auth: RegistryAuthentication | undefined = auths[registry.host]

    // `docker login` behavior
    if (auth == null && registry.host === defaultRegistryHost)
      auth = auths[`https://${defaultRegistryHost}/v1/`]

    return auth ?? {}
  }

  private async readConfig(): Promise<DockerConfig | null> {
    const dockerPath = process.env['DOCKER_CONFIG'] || path.join(homedir(), '.docker')

    try {
      const contents = await readFile(path.join(dockerPath, 'config.json'), 'utf-8')
      return JSON.parse(contents)
    } catch (err) {
      return null
    }
  }
}

export class AuthenticatedFetcher {
  private impl: Fetch
  private auth: Authenticator
  private cache: AuthenticationCache

  constructor(impl: Fetch, auth: Authenticator, now: () => number = Date.now) {
    this.impl = impl
    this.auth = auth
    this.cache = new AuthenticationCache(now)
  }

  public async fetch(req: Request, registry: Registry, scopes: string[]): Promise<Response> {
    const credential = this.cache.get(registry, scopes)
    if (credential != null) {
      req.headers.set('Authorization', credential)
    }

    const res = await this.impl(req)

    if (res.status === 401) {
      const challengeValue = res.headers.get('WWW-Authenticate')
      if (!challengeValue)
        throw new ResponseError(
          'Registry sent 401 Unauthorized response with no WWW-Authenticate header',
          res,
        )

      const challenge = AuthenticationChallenge.parse(challengeValue)

      if (challenge.type === 'basic') {
        if (credential != null) return res

        const auth = await this.getAuthentication(registry)
        if (auth == null) return res

        this.cache.put(registry, auth, scopes, undefined)

        return this.fetch(new Request(req), registry, scopes)
      } else if (challenge.type === 'bearer') {
        await this.acquireBearerToken(challenge, registry, scopes)

        return this.fetch(new Request(req), registry, scopes)
      } else {
        throw new ResponseError('Registry sent unknown WWW-Authenticate challenge', res)
      }
    }

    return res
  }

  private async getAuthentication(registry: Registry): Promise<string | null> {
    const auth = await this.auth.authForRegistry(registry)

    if (auth.registrytoken) {
      return `Bearer ${auth.registrytoken}`
    } else if (auth.auth) {
      return `Basic ${auth.auth}`
    } else if (auth.username && auth.password) {
      const digest = Buffer.from(`${auth.username}:${auth.password}`, 'utf-8').toString('base64')
      return `Basic ${digest}`
    }

    return null
  }

  private async acquireBearerToken(
    challenge: AuthenticationChallenge,
    registry: Registry,
    scopes: string[],
  ): Promise<void> {
    const {realm, service} = challenge.params
    if (!realm) throw new Error(`Registry sent a WWW-Authenticate: Bearer response with no realm`)

    const url = new URL(realm)
    url.searchParams.set('scope', scopes.join(' '))
    url.searchParams.set('service', service ?? registry.host)

    const req = new Request(String(url))
    const auth = await this.getAuthentication(registry)
    if (auth != null) {
      req.headers.set('Authorization', auth)
    }

    console.error(req.method, req.url, auth != null)

    const res = await this.impl(req)
    if (res.status !== 200) {
      throw new ResponseError(`Failed to acquire bearer token: HTTP ${res.status}`, res)
    }

    const body = await res.json()
    const token = body.access_token || body.token
    if (!token) throw new Error(`Failed to get access token from ${realm}`)

    const credential = `Bearer ${token}`
    this.cache.put(registry, credential, scopes, body.expires_in)
  }
}

class AuthenticationChallenge {
  public type: string
  public params: Record<string, string>

  constructor(type: string, params: Record<string, string>) {
    this.type = type
    this.params = params
  }

  public static parse(headerValue: string): AuthenticationChallenge {
    const typeMatch = /^(\w+)\s*/.exec(headerValue)
    if (!typeMatch) throw new Error(`Invalid WWW-Authenticate: ${JSON.stringify(headerValue)}`)

    const type = typeMatch[1].toLowerCase()
    const params: Record<string, string> = {}

    let body = headerValue.slice(typeMatch[0].length)
    while (body) {
      const paramMatch = /^(\w+)=(?:(\w+)|("(?:[^"\\]|\\.)*")),?\s*/.exec(body)
      if (!paramMatch) throw new Error(`Invalid WWW-Authenticate: ${JSON.stringify(headerValue)}`)

      const key = paramMatch[1]
      const value = paramMatch[2] ?? JSON.parse(paramMatch[3])
      params[key] = value

      body = body.slice(paramMatch[0].length)
    }

    return new AuthenticationChallenge(type, params)
  }
}

export class AuthenticationCache {
  private registries: Map<string, RegistryAuthenticationCache>
  private now: () => number

  constructor(now: () => number = Date.now) {
    this.registries = new Map()
    this.now = now
  }

  public get(registry: Registry, scopes: string[]): string | null {
    const cache = this.registries.get(registry.host)
    if (cache == null) return null

    this.purgeExpired(cache)

    scopes = normalizeScopes(scopes)

    const match = cache.tokens.find((token) => scopes.every((scope) => token.scopes.has(scope)))
    return match ? match.credential : null
  }

  public put(registry: Registry, credential: string, scopes: string[], ttl: number | undefined) {
    const token: AuthenticationToken = {
      credential,
      scopes: new Set(normalizeScopes(scopes)),
      expires: ttl != null ? this.now() + 1000 * ttl : undefined,
    }

    let cache = this.registries.get(registry.host)
    if (cache == null) {
      cache = {tokens: []}
      this.registries.set(registry.host, cache)
    } else {
      this.purgeExpired(cache)
    }

    cache.tokens.unshift(token)
  }

  private purgeExpired(cache: RegistryAuthenticationCache) {
    const now = this.now()
    let expired: number[] | undefined

    for (let i = 0; i < cache.tokens.length; i++) {
      const token = cache.tokens[i]

      if (token.expires != null && token.expires <= now) {
        if (expired == null) expired = []
        expired.push(i)
      }
    }

    if (expired != null) {
      for (const i of expired.reverse()) {
        cache.tokens.splice(i, 1)
      }
    }
  }
}

const normalizeScopes = (scopes: string[]): string[] => {
  const expand = (scope: string) => {
    const parts = scope.split(':')
    const prefix = parts.slice(0, -1)
    const actions = parts[parts.length - 1].split(',')

    return actions.map((action) => `${prefix}:${action}`)
  }

  return scopes.map(expand).flat()
}

interface RegistryAuthenticationCache {
  tokens: AuthenticationToken[]
}

interface AuthenticationToken {
  scopes: Set<string>
  credential: string
  expires: number | undefined
}

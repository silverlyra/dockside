import {AnonymousAuthenticator, Authenticator, AuthenticatedFetcher} from './auth'
import {fetch, Fetch, FetchInit, Request, Response, ResponseError} from './net'
import {Registry, Reference, Repository, Resource} from './ref'
import {ImageConfig, Manifest, Index, Platform, isManifest} from './types'
import {referenceMediaTypes} from './types/http'

export class Client {
  private net: AuthenticatedFetcher

  private auth: Authenticator

  constructor(opts?: ClientOptions) {
    this.auth = opts?.auth ?? new AnonymousAuthenticator()
    this.net = new AuthenticatedFetcher(opts?.fetch ?? fetch, this.auth, opts?.now)
  }

  private resolve(ref: Reference, scope = 'pull'): Promise<Response> {
    return this.request(ref, [ref.scope(scope)], ref.manifestURL, {
      method: 'GET',
      headers: {Accept: referenceMediaTypes.join(',')},
    })
  }

  public async get(spec: string | Reference): Promise<Manifest | Index> {
    const ref = typeof spec === 'string' ? Reference.parse(spec) : spec
    const res = await this.resolve(ref)
    return res.json()
  }

  public async getManifest(
    spec: string | Reference,
    platform?: string | Platform,
  ): Promise<Manifest> {
    const ref = typeof spec === 'string' ? Reference.parse(spec) : spec

    const result = await this.get(ref)

    if (isManifest(result)) {
      return result
    }

    const descriptor = result.manifests.find(platformMatcher(platform))
    if (descriptor == null)
      throw new Error(`No manifest matched platform ${JSON.stringify(platform)}`)

    return this.getManifest(ref.atDigest(descriptor.digest), platform)
  }

  public async getConfig(
    spec: string | Reference,
    platform?: string | Platform,
  ): Promise<ImageConfig> {
    const ref = typeof spec === 'string' ? Reference.parse(spec) : spec
    const manifest = await this.getManifest(ref, platform)

    const response = await this.getBlob(ref.repository, manifest.config.digest)
    if (response.status !== 200) {
      console.error(await response.text())
      process.exit(1)
    }
    return response.json()
  }

  public async getDigest(spec: string | Reference): Promise<string> {
    const ref = typeof spec === 'string' ? Reference.parse(spec) : spec

    const res = await this.request(ref, [ref.scope('pull')], ref.manifestURL, {
      method: 'HEAD',
      headers: {Accept: referenceMediaTypes.join(',')},
      redirect: 'follow',
    })
    const digest = res.headers.get('Docker-Content-Digest')
    if (!digest) {
      throw new ResponseError(`Failed to get digest for ${ref}`, res)
    }

    return digest
  }

  public async getBlob(spec: string | Repository, digest: string): Promise<Response> {
    const repository = typeof spec === 'string' ? Repository.parse(spec) : spec
    const url = `${repository.url}/blobs/${digest}`

    return this.request(repository, [repository.scope('pull')], url, {redirect: 'follow'})
  }

  /**
   * Copies an image (manifest or index) to another location.
   *
   * **NOTE:** Only supports copying within a repository (i.e., to duplicate a tag).
   * All blobs must already be uploaded to the repository.
   */
  public async copy(src: string | Reference, dest: string | Reference): Promise<void> {
    const srcRef = typeof src === 'string' ? Reference.parse(src) : src
    const destRef = typeof dest === 'string' ? Reference.parse(dest) : dest

    const res = await this.resolve(srcRef, 'pull,push')
    if (res.status !== 200) throw new ResponseError(`Failed to get ${srcRef}`, res)

    const contents = await res.arrayBuffer()

    const copyRes = await this.request(destRef, [destRef.scope('push')], destRef.manifestURL, {
      method: 'PUT',
      headers: {
        'Content-Type': res.headers.get('Content-Type') ?? undefined,
      },
      body: Buffer.from(contents),
    })

    if (copyRes.status !== 200 && copyRes.status !== 201) {
      throw new ResponseError(`Failed to copy ${srcRef} to ${destRef}`, res)
    }
  }

  private request(
    target: Resource,
    scopes: string[],
    url: string,
    init?: FetchInit,
  ): Promise<Response> {
    const registry = target instanceof Registry ? target : target.registry

    const req = new Request(url, init)
    return this.net.fetch(req, registry, scopes)
  }
}

export interface ClientOptions {
  auth?: Authenticator
  fetch?: Fetch
  now?: () => number
}

type PlatformMatcher = (res: {platform: Platform}) => boolean

const platformMatcher = (spec: string | Platform | null | undefined): PlatformMatcher => {
  const target: Platform =
    spec == null
      ? {os: 'linux', architecture: 'amd64'}
      : typeof spec === 'string'
      ? parsePlatform(spec)
      : spec

  return ({platform}) => {
    for (const key in target) {
      const prop = key as keyof Platform
      if (target[prop] !== undefined && platform[prop] !== target[prop]) return false
    }
    return true
  }
}

const parsePlatform = (platform: string): Platform => {
  const parts = platform.split('/')
  if (parts.length < 2) throw new Error(`Invalid platform: ${JSON.stringify(platform)}`)

  return {
    os: parts[0],
    architecture: parts[1],
    variant: parts[2],
  }
}

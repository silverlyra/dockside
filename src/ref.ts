import CIDR from 'ip-cidr'

/**
 * Reference represents a container image or manifest that can be fetched from a
 * {@link Repository | repository}.
 */
export class Reference {
  public readonly repository: Repository
  public readonly identifier: Identifier

  constructor(repository: Repository, identifier: Identifier) {
    this.repository = repository
    this.identifier = identifier
  }

  public static parse(name: string, opts?: ReferenceParseOptions): Reference {
    let base: string
    let identifier: Identifier

    const digestMatch = /@([a-z0-9]+:[0-9a-fA-F]+$)/.exec(name)
    if (digestMatch) {
      const digest = digestMatch[1]
      base = name.slice(0, -digest.length - identifierSeparators.digest.length)
      identifier = {type: 'digest', value: digest}
    } else {
      let tag: string
      const parts = name.split(identifierSeparators.tag)

      if (parts.length > 1 && !parts[parts.length - 1].includes('/')) {
        tag = parts[parts.length - 1]
        base = name.slice(0, -tag.length - identifierSeparators.tag.length)
      } else {
        tag = opts?.defaultTag ?? defaultTag
        base = name
      }

      identifier = {type: 'tag', value: tag}
    }

    const repoParseOptions = opts?.repository ?? {registry: opts?.registry}
    return new Reference(Repository.parse(base, repoParseOptions), identifier)
  }

  get registry(): Registry {
    return this.repository.registry
  }

  get manifestURL(): string {
    return `${this.repository.url}/manifests/${this.identifier.value}`
  }

  public scope(action: string): string {
    return this.repository.scope(action)
  }

  public atDigest(digest: string): Reference {
    return new Reference(this.repository, {type: 'digest', value: digest})
  }

  public toString(): string {
    const sep = identifierSeparators[this.identifier.type]
    return `${this.repository}${sep}${this.identifier.value}`
  }
}

/**
 * Identifier completes an image {@link Reference | reference} with a tag
 * (e.g., `:latest`) or digest (e.g., `@sha256:...`).
 */
export type Identifier = {type: 'tag'; value: string} | {type: 'digest'; value: string}

const identifierSeparators: Record<Identifier['type'], string> = {
  tag: ':',
  digest: '@',
}

export interface ReferenceParseOptions {
  defaultTag?: string
  repository?: RepositoryParseOptions
  registry?: RegistryParseOptions
}

const defaultTag = 'latest'

/**
 * Repository represents a container image repository that manifests and images
 * can be fetched from via a {@link Reference | reference}.
 */
export class Repository {
  public readonly registry: Registry
  public readonly name: string

  constructor(registry: Registry, name: string) {
    this.registry = registry
    this.name = name
  }

  public static parse(name: string, opts?: RepositoryParseOptions): Repository {
    const parts = name.split('/')
    const [registryName, repoName] =
      parts.length >= 2 && (parts[0].includes('.') || parts[0].includes('/'))
        ? [parts[0], parts.slice(1).join('/')]
        : ['', name]

    return new Repository(Registry.parse(registryName, opts?.registry), repoName)
  }

  public get url(): string {
    return `${this.registry.url}/${this.qualifiedName}`
  }

  public get qualifiedName(): string {
    return this.registry.host === defaultRegistryHost && !this.name.includes('/')
      ? `library/${this.name}`
      : this.name
  }

  public scope(action: string): string {
    return `repository:${this.qualifiedName}:${action}`
  }

  public toString(): string {
    return `${this.registry}/${this.name}`
  }
}

export interface RepositoryParseOptions {
  registry?: RegistryParseOptions
}

/**
 * Registry represents a container image registry, where one or more
 * {@link Repository | repositories} are hosted.
 */
export class Registry {
  public readonly host: string
  public readonly insecure: boolean

  constructor(host: string, insecure: boolean) {
    this.host = host
    this.insecure = insecure
  }

  public static parse(name: string, opts?: RegistryParseOptions): Registry {
    if (!name) {
      name = opts?.default ?? defaultRegistry
    }

    const rewrites = opts?.rewrites ? {...defaultRewrites, ...opts.rewrites} : defaultRewrites
    name = rewrites[name] ?? name

    const insecure = opts?.insecure ?? isLocalRegistry(name)
    return new Registry(name, insecure)
  }

  public get scheme(): string {
    return !this.insecure ? 'https' : 'http'
  }

  public get url(): string {
    return `${this.scheme}://${this.host}/v2`
  }

  public toString(): string {
    return this.host
  }
}

export interface RegistryParseOptions {
  default?: string
  rewrites?: Record<string, string>
  insecure?: boolean | null | undefined
}

export const defaultRegistry = 'docker.io'
export const defaultRegistryHost = `index.${defaultRegistry}`
const defaultRewrites: Record<string, string> = {[defaultRegistry]: defaultRegistryHost}

const privateIPRanges = [
  new CIDR('10.0.0.0/8'),
  new CIDR('127.0.0.0/24'),
  new CIDR('172.16.0.0/12'),
  new CIDR('192.168.0.0/16'),
  new CIDR('::1/128'),
  new CIDR('fc00::/7'),
]

const ipv4Pattern = /^((?:\d{1,3}\.){3}\d{1,3})(:\d{1,5})?$/
const ipv6Pattern = /^((::)?(((\d{1,3}\.){3}(\d{1,3}){1})?([0-9a-fA-F]){0,4}:{0,2}){1,8}(::)?)$/

export const isLocalRegistry = (name: string): boolean => {
  if (/^localhost\b|\.localdomain(?::\d{1,5})?$/.test(name)) {
    return true
  }

  // Detect IPv6 with port address like
  if (name.startsWith('[') && /\]:\d+$/.test(name)) {
    const ipv6WithPortMatch = /^\[([^]+)\]:\d+/.exec(name)
    if (!ipv6WithPortMatch) throw new Error(`Invalid registry name ${JSON.stringify(name)}`)
    name = ipv6WithPortMatch[1]
  }

  const ipMatch = [ipv4Pattern.exec(name), ipv6Pattern.exec(name)].find((match) => match != null)

  return ipMatch ? privateIPRanges.some((cidr) => cidr.contains(ipMatch[1])) : false
}

/**
 * A Resource is a resource that can be authenticated against.
 */
export type Resource = Registry | Repository | Reference

import type {MediaType} from './http'

export type Annotations = Record<string, string>

export interface Platform {
  architecture: string
  variant?: string
  features?: string[]

  os: string
  'os.version'?: string
  'os.features'?: string[]
}

export interface Versioned {
  schemaVersion: number
  mediaType: MediaType
}

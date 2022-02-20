import type {Annotations, Platform, Versioned} from './common'

export interface Manifest extends Versioned {
  config: Descriptor
  layers: Descriptor[]
  annotations?: Annotations
}

export interface Descriptor {
  mediaType: string
  size: number
  digest: string

  data?: string
  urls?: string[]
  annotations?: Annotations
  platform?: Platform
}

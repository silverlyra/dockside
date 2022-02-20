import type {Annotations, Platform, Versioned} from './common'
import type {Descriptor} from './manifest'

export interface Index extends Versioned {
  manifests: IndexDescriptor[]
  annotations?: Annotations
}

export interface IndexDescriptor extends Descriptor {
  platform: Platform
}

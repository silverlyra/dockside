import {indexMediaTypes, manifestMediaTypes} from './http'
import type {Manifest} from './manifest'
import type {Index} from './list'

export {Annotations, Platform} from './common'
export * from './config'
export {MediaType} from './http'
export * from './manifest'
export * from './list'

export const isManifest = (resource: Manifest | Index): resource is Manifest =>
  manifestMediaTypes.includes(resource.mediaType)

export const isIndex = (resource: Manifest | Index): resource is Index =>
  indexMediaTypes.includes(resource.mediaType)

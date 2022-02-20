export enum MediaType {
  DOCKER_MANIFEST_V2 = 'application/vnd.docker.distribution.manifest.v2+json',
  DOCKER_MANIFEST_LIST_V2 = 'application/vnd.docker.distribution.manifest.list.v2+json',
  DOCKER_CONFIG_V1 = 'application/vnd.docker.container.image.v1+json',

  OCI_MANIFEST_V1 = 'application/vnd.oci.image.manifest.v1+json',
  OCI_INDEX_V1 = 'application/vnd.oci.image.index.v1+json',
  OCI_CONFIG_V1 = 'application/vnd.oci.image.config.v1+json',
}

export const configMediaTypes = [MediaType.OCI_CONFIG_V1, MediaType.DOCKER_CONFIG_V1]
export const indexMediaTypes = [MediaType.OCI_INDEX_V1, MediaType.DOCKER_MANIFEST_LIST_V2]
export const manifestMediaTypes = [MediaType.OCI_MANIFEST_V1, MediaType.DOCKER_MANIFEST_V2]
export const referenceMediaTypes = [
  MediaType.OCI_INDEX_V1,
  MediaType.DOCKER_MANIFEST_LIST_V2,
  MediaType.OCI_MANIFEST_V1,
  MediaType.DOCKER_MANIFEST_V2,
]

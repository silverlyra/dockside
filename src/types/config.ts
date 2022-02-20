export interface ImageConfig {
  architecture: string
  os: string

  config: ContainerConfig
  rootfs: ImageRoot

  created?: string
  author?: string
  container?: string

  history: ImageHistoryEntry[]
}

// TODO(lyra): complete
export interface ContainerConfig {
  Entrypoint?: string[]
  Cmd?: string[]
  Env?: string[]
  WorkingDir?: string

  Labels?: Record<string, string>
}

export interface ImageRoot {
  type: string
  diff_ids: string[]
}

export interface ImageHistoryEntry {
  created?: string
  created_by?: string
  comment?: string
  empty_layer?: boolean
}

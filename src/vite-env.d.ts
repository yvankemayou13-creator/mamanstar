/// <reference types="vite/client" />

interface ElectronDB {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; affectedRows?: number }>
  exec: (sql: string) => Promise<boolean>
  getPath: () => Promise<string | null>
}

interface Window {
  electronApp?: {
    isElectron: boolean
    platform: string
  }
  electronDB?: ElectronDB
}

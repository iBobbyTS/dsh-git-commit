export function details(error: unknown): {
  code?: unknown
  stderr?: string
  message?: string
} {
  return error !== null && typeof error === 'object'
    ? (error as { code?: unknown; stderr?: string; message?: string })
    : { message: String(error) }
}

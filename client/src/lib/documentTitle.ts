const BRAND = 'Ola Olabinjo Investment'

/** Sets `document.title` to `segment · Ola Olabinjo Investment`. */
export function setDocumentTitle(segment: string) {
  document.title = `${segment} · ${BRAND}`
}

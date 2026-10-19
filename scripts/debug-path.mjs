import path from 'node:path'
import { fileURLToPath } from 'node:url'

console.log('import.meta.url:', import.meta.url)
console.log('.pathname:', new URL(import.meta.url).pathname)
console.log('fileURLToPath:', fileURLToPath(import.meta.url))

const byPathname = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'tools')
const byFileURL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'tools')
console.log('\nby pathname:', byPathname)
console.log('by fileURLToPath:', byFileURL)
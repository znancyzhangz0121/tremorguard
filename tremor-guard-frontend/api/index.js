import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const functionDir = dirname(fileURLToPath(import.meta.url))
const backendBundleDir = join(functionDir, '_backend_bundle')

let expressAppPromise

async function getExpressApp() {
  if (!expressAppPromise) {
    process.chdir(backendBundleDir)
    const { createExpressApp } = require('./_backend_bundle/dist/main.js')
    expressAppPromise = createExpressApp()
  }

  return expressAppPromise
}

export default async function handler(request, response) {
  const app = await getExpressApp()
  return app(request, response)
}

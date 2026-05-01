import { Injectable } from '@nestjs/common'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { MedicalRecordsStore } from './medical-records.types'

@Injectable()
export class MedicalRecordsStoreService {
  private readonly bundledBaseDir = join(process.cwd(), 'data', 'medical-records')
  private readonly runtimeBaseDir = process.env.VERCEL
    ? join(tmpdir(), 'tremor-guard-data', 'medical-records')
    : this.bundledBaseDir
  private readonly storeFilePath = join(this.runtimeBaseDir, 'store.json')
  private readonly uploadsDir = join(this.runtimeBaseDir, 'uploads')
  private readonly reportsDir = join(this.runtimeBaseDir, 'reports')
  private readonly bundledStoreFilePath = join(this.bundledBaseDir, 'store.json')

  async readStore(): Promise<MedicalRecordsStore> {
    try {
      const raw = await readFile(this.storeFilePath, 'utf8')
      return this.parseStore(raw)
    } catch {
      const seededStore = await this.readBundledStore()
      await this.writeStore(seededStore)
      return seededStore
    }
  }

  async writeStore(store: MedicalRecordsStore) {
    await mkdir(dirname(this.storeFilePath), { recursive: true })
    await writeFile(this.storeFilePath, JSON.stringify(store, null, 2), 'utf8')
  }

  async saveUploadFile(storedFileName: string, content: Buffer) {
    const filePath = join(this.uploadsDir, storedFileName)
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, content)
    return filePath
  }

  async savePdfFile(storedFileName: string, content: Buffer) {
    const filePath = join(this.reportsDir, storedFileName)
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, content)
    return filePath
  }

  async saveHtmlFile(storedFileName: string, content: string) {
    const filePath = join(this.reportsDir, storedFileName)
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, content, 'utf8')
    return filePath
  }

  async readPdfFile(relativePath: string) {
    const normalizedRelativePath = relativePath.replace(/^data\/medical-records\//, '')
    return readFile(join(this.runtimeBaseDir, normalizedRelativePath))
  }

  private async readBundledStore() {
    try {
      const raw = await readFile(this.bundledStoreFilePath, 'utf8')
      return this.parseStore(raw)
    } catch {
      return {
        archives: [],
        files: [],
        extractions: [],
        reports: [],
      }
    }
  }

  private parseStore(raw: string): MedicalRecordsStore {
    const parsed = JSON.parse(raw) as Partial<MedicalRecordsStore>

    return {
      archives: Array.isArray(parsed.archives) ? parsed.archives : [],
      files: Array.isArray(parsed.files) ? parsed.files : [],
      extractions: Array.isArray(parsed.extractions) ? parsed.extractions : [],
      reports: Array.isArray(parsed.reports) ? parsed.reports : [],
    }
  }
}

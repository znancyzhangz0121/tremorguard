import { Injectable } from '@nestjs/common'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { MedicalRecordsStore } from './medical-records.types'

@Injectable()
export class MedicalRecordsStoreService {
  private readonly storeFilePath = join(process.cwd(), 'data', 'medical-records', 'store.json')
  private readonly uploadsDir = join(process.cwd(), 'data', 'medical-records', 'uploads')
  private readonly reportsDir = join(process.cwd(), 'data', 'medical-records', 'reports')

  async readStore(): Promise<MedicalRecordsStore> {
    try {
      const raw = await readFile(this.storeFilePath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<MedicalRecordsStore>

      return {
        archives: Array.isArray(parsed.archives) ? parsed.archives : [],
        files: Array.isArray(parsed.files) ? parsed.files : [],
        extractions: Array.isArray(parsed.extractions) ? parsed.extractions : [],
        reports: Array.isArray(parsed.reports) ? parsed.reports : [],
      }
    } catch {
      const initialState: MedicalRecordsStore = {
        archives: [],
        files: [],
        extractions: [],
        reports: [],
      }
      await this.writeStore(initialState)
      return initialState
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
    return readFile(join(process.cwd(), relativePath))
  }
}

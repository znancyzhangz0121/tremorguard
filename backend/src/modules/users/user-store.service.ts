import { Injectable } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

export type StoredUser = {
  id: string;
  name: string;
  email: string;
  age?: number | null;
  passwordHash: string;
  createdAt: string;
};

type UsersFile = {
  users: StoredUser[];
};

@Injectable()
export class UserStoreService {
  private readonly bundledFilePath = join(process.cwd(), 'data', 'users.json');
  private readonly writableFilePath = process.env.VERCEL
    ? join(tmpdir(), 'tremor-guard-data', 'users.json')
    : this.bundledFilePath;

  async findByEmail(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const { users } = await this.readUsersFile();
    return users.find((user) => user.email === normalizedEmail) ?? null;
  }

  async create(user: StoredUser) {
    const file = await this.readUsersFile();
    file.users.push(user);
    await this.writeUsersFile(file);
    return user;
  }

  private async readUsersFile(): Promise<UsersFile> {
    try {
      const raw = await readFile(this.writableFilePath, 'utf8');
      return this.parseUsersFile(raw);
    } catch {
      const seededFile = await this.readBundledUsersFile();
      await this.writeUsersFile(seededFile);
      return seededFile;
    }
  }

  private async writeUsersFile(data: UsersFile) {
    await mkdir(dirname(this.writableFilePath), { recursive: true });
    await writeFile(this.writableFilePath, JSON.stringify(data, null, 2), 'utf8');
  }

  private async readBundledUsersFile(): Promise<UsersFile> {
    try {
      const raw = await readFile(this.bundledFilePath, 'utf8');
      return this.parseUsersFile(raw);
    } catch {
      return { users: [] };
    }
  }

  private parseUsersFile(raw: string): UsersFile {
    const parsed = JSON.parse(raw) as UsersFile;
    return {
      users: Array.isArray(parsed.users)
        ? parsed.users.map((user) => ({
            ...user,
            age: typeof user.age === 'number' ? user.age : null,
          }))
        : [],
    };
  }
}

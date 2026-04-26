import { Injectable } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

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
  private readonly filePath = join(process.cwd(), 'data', 'users.json');

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
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as UsersFile;
      return {
        users: Array.isArray(parsed.users)
          ? parsed.users.map((user) => ({
              ...user,
              age: typeof user.age === 'number' ? user.age : null,
            }))
          : [],
      };
    } catch {
      const initialFile = { users: [] };
      await this.writeUsersFile(initialFile);
      return initialFile;
    }
  }

  private async writeUsersFile(data: UsersFile) {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }
}

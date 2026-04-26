import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UserStoreService } from './user-store.service';

@Injectable()
export class UsersService {
  constructor(
    @Inject(UserStoreService)
    private readonly userStoreService: UserStoreService,
  ) {}

  async getPublicProfile(email: string) {
    const user = await this.userStoreService.findByEmail(email);

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      age: user.age ?? null,
      createdAt: user.createdAt,
    };
  }
}

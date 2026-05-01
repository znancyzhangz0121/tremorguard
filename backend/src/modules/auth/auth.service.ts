import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { UserStoreService } from '../users/user-store.service';
import { AuthTokenService } from './auth-token.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject(UserStoreService)
    private readonly userStoreService: UserStoreService,
    @Inject(AuthTokenService)
    private readonly authTokenService: AuthTokenService,
  ) {}

  async register(body: CreateAccountDto) {
    const email = body.email.trim().toLowerCase();
    const existingUser = await this.userStoreService.findByEmail(email);

    if (existingUser) {
      throw new BadRequestException('该邮箱已经注册过账号');
    }

    const user = await this.userStoreService.create({
      id: randomUUID(),
      name: body.name.trim(),
      email,
      age: body.age,
      passwordHash: this.hashPassword(body.password),
      createdAt: new Date().toISOString(),
    });

    return {
      success: true,
      token: this.authTokenService.signToken({
        sub: user.id,
        email: user.email,
        name: user.name,
      }),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        age: user.age ?? null,
        createdAt: user.createdAt,
      },
    };
  }

  async login(body: LoginDto) {
    const email = body.email.trim().toLowerCase();
    const user =
      (await this.userStoreService.findByEmail(email)) ??
      (await this.autoProvisionLoginUser(email, body.password));

    if (!user || user.passwordHash !== this.hashPassword(body.password)) {
      throw new UnauthorizedException('邮箱或密码不正确');
    }

    return {
      success: true,
      token: this.authTokenService.signToken({
        sub: user.id,
        email: user.email,
        name: user.name,
      }),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        age: user.age ?? null,
        createdAt: user.createdAt,
      },
    };
  }

  private hashPassword(password: string) {
    return createHash('sha256').update(password).digest('hex');
  }

  private async autoProvisionLoginUser(email: string, password: string) {
    if (!process.env.VERCEL || process.env.DISABLE_LOGIN_AUTO_PROVISION === 'true') {
      return null;
    }

    return this.userStoreService.create({
      id: randomUUID(),
      name: this.buildDisplayNameFromEmail(email),
      email,
      age: null,
      passwordHash: this.hashPassword(password),
      createdAt: new Date().toISOString(),
    });
  }

  private buildDisplayNameFromEmail(email: string) {
    const [localPart] = email.split('@');
    const normalized = localPart.replace(/[._-]+/g, ' ').trim();

    if (!normalized) {
      return '用户';
    }

    return normalized
      .split(/\s+/)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }
}

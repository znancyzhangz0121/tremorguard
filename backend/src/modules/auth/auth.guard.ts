import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthTokenPayload, AuthTokenService } from './auth-token.service';

export type AuthenticatedRequest = {
  headers: {
    authorization?: string;
  };
  authUser?: AuthTokenPayload;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(AuthTokenService)
    private readonly authTokenService: AuthTokenService,
  ) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorizationHeader = request.headers.authorization;

    if (!authorizationHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('请先登录后再继续');
    }

    const token = authorizationHeader.slice('Bearer '.length).trim();
    request.authUser = this.authTokenService.verifyToken(token);

    return true;
  }
}

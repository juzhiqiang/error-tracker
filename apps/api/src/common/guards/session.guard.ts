import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { auth } from '../../modules/auth/auth'

@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest()
    const session = await auth.api.getSession({ headers: new Headers(req.headers) })
    if (!session) throw new UnauthorizedException()
    req.session = session
    return true
  }
}

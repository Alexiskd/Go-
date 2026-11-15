import type { IncomingMessage } from 'node:http';
import { UnauthorizedError, defineModule, token } from '@go-/core';
import { ROLE_PERMISSIONS, ROLES, type Permission, type Role, type TokenResponse } from '@go-/contracts';
import type { Principal } from '@go-/runtime';
import { bearerToken, definePolicy, hashPassword, signJwt, verifyJwt, verifyPassword } from '@go-/security';
import { USER_SERVICE, type UserService } from './users.js';

const ISSUER = 'go-playground';

export class AuthService {
  readonly policy = definePolicy<Role, Permission>(ROLE_PERMISSIONS);
  /** Hash factice : la vérification prend le même temps que l'utilisateur existe ou non. */
  private dummyHash: Promise<string> | undefined;

  constructor(
    private readonly users: UserService,
    private readonly secret: string,
    private readonly expiresIn: number,
    private readonly passwordCost: number,
  ) {}

  async login(email: string, password: string): Promise<TokenResponse> {
    const user = await this.users.findByEmail(email);
    const hash = user?.passwordHash ?? (await (this.dummyHash ??= this.makeDummy()));
    const valid = await verifyPassword(password, hash);
    if (!user || !valid) throw new UnauthorizedError('Identifiants invalides');
    const accessToken = signJwt({ role: user.role }, this.secret, { subject: user.id, expiresIn: this.expiresIn, issuer: ISSUER });
    return { accessToken, tokenType: 'Bearer', expiresIn: this.expiresIn };
  }

  async authenticate(req: IncomingMessage): Promise<Principal | undefined> {
    const jwt = bearerToken(req.headers.authorization);
    if (!jwt) return undefined;
    const result = verifyJwt(jwt, this.secret, { issuer: ISSUER });
    if (!result.ok || !result.value.sub) return undefined;
    const user = await this.users.get(result.value.sub);
    return user ? { id: user.id, role: user.role } : undefined;
  }

  authorize(principal: Principal, permission: string): boolean {
    const role = principal.role as Role | undefined;
    return !!role && (ROLES as readonly string[]).includes(role) && this.policy.can(role, permission as Permission);
  }

  private makeDummy() {
    return hashPassword('mot-de-passe-factice', { N: 2 ** this.passwordCost });
  }
}

export const AUTH_SERVICE = token<AuthService>('auth-service');

export const authModule = (options: { secret: string; expiresIn: number; passwordCost: number }) =>
  defineModule({
    name: 'auth',
    dependsOn: ['users'],
    register: ({ container }) => {
      container.factory(AUTH_SERVICE, (c) => new AuthService(c.resolve<UserService>(USER_SERVICE), options.secret, options.expiresIn, options.passwordCost));
    },
  });

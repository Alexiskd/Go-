import { randomUUID } from 'node:crypto';
import { ConflictError, defineModule, token } from '@go-/core';
import type { CreateUserRequest, Role, UserDto } from '@go-/contracts';
import { hashPassword } from '@go-/security';

/** Entité interne : ne quitte jamais le backend (le contrat expose UserDto). */
export interface UserEntity {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  passwordHash: string;
  createdAt: Date;
}

export interface UserRepository {
  findById(id: string): Promise<UserEntity | undefined>;
  findByEmail(email: string): Promise<UserEntity | undefined>;
  list(offset: number, limit: number): Promise<{ items: UserEntity[]; total: number }>;
  insert(user: UserEntity): Promise<void>;
}

/** Dépôt en mémoire : remplaçable par une implémentation PostgreSQL sans toucher aux services. */
export function createMemoryUserRepository(): UserRepository {
  const byId = new Map<string, UserEntity>();
  return {
    findById: async (id) => byId.get(id),
    findByEmail: async (email) => [...byId.values()].find((u) => u.email === email.toLowerCase()),
    list: async (offset, limit) => {
      const all = [...byId.values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      return { items: all.slice(offset, offset + limit), total: all.length };
    },
    insert: async (user) => void byId.set(user.id, user),
  };
}

export const toUserDto = (u: UserEntity): UserDto => ({
  id: u.id,
  email: u.email,
  displayName: u.displayName,
  role: u.role,
  createdAt: u.createdAt.toISOString(),
});

export class UserService {
  constructor(private readonly repo: UserRepository, private readonly passwordCost: number) {}

  async create(input: CreateUserRequest): Promise<UserEntity> {
    const email = input.email.toLowerCase();
    if (await this.repo.findByEmail(email)) throw new ConflictError('Un utilisateur utilise déjà cet e-mail');
    const user: UserEntity = {
      id: randomUUID(),
      email,
      displayName: input.displayName,
      role: input.role,
      passwordHash: await hashPassword(input.password, { N: 2 ** this.passwordCost }),
      createdAt: new Date(),
    };
    await this.repo.insert(user);
    return user;
  }

  get = (id: string) => this.repo.findById(id);
  findByEmail = (email: string) => this.repo.findByEmail(email);
  list = (page: number, pageSize: number) => this.repo.list((page - 1) * pageSize, pageSize);
}

export const USER_REPOSITORY = token<UserRepository>('user-repository');
export const USER_SERVICE = token<UserService>('user-service');

export const usersModule = (options: { passwordCost: number; admin?: { email: string; password: string } }) =>
  defineModule({
    name: 'users',
    register: ({ container }) => {
      if (!container.has(USER_REPOSITORY)) container.value(USER_REPOSITORY, createMemoryUserRepository());
      container.factory(USER_SERVICE, (c) => new UserService(c.resolve(USER_REPOSITORY), options.passwordCost));
    },
    async onInit({ container, logger }) {
      if (!options.admin) return;
      const users = container.resolve(USER_SERVICE);
      if (await users.findByEmail(options.admin.email)) return;
      await users.create({ email: options.admin.email, password: options.admin.password, displayName: 'Administrateur', role: 'admin' });
      logger.info('compte administrateur initial créé', { email: options.admin.email });
    },
  });

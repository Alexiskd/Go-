import { s, type Infer } from '@go-/shared';
import { IdParams, PageMeta, PaginationQuery } from './common.js';
import { defineContract, defineEndpoint } from './endpoint.js';

/* ---------- Rôles et permissions ---------- */

export const ROLES = ['admin', 'editor', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = ['users:read', 'users:write', 'users:delete'] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Politique par défaut ; `*` donne toutes les permissions. */
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly (Permission | '*')[]>> = {
  admin: ['*'],
  editor: ['users:read', 'users:write'],
  viewer: ['users:read'],
};

/* ---------- DTO publics (jamais les entités de base de données) ---------- */

export const HealthResponse = s.object({
  status: s.enum(['ok', 'degraded']),
  version: s.string(),
  uptime: s.number().min(0),
  checks: s.array(s.object({ name: s.string(), ok: s.boolean(), message: s.string().optional() })).default([]),
}).title('HealthResponse');
export type HealthResponse = Infer<typeof HealthResponse>;

export const LoginRequest = s.object({
  email: s.string().email().max(254),
  password: s.string().min(8).max(256),
}).title('LoginRequest');
export type LoginRequest = Infer<typeof LoginRequest>;

export const TokenResponse = s.object({
  accessToken: s.string(),
  tokenType: s.literal('Bearer'),
  expiresIn: s.number().int().positive(),
}).title('TokenResponse');
export type TokenResponse = Infer<typeof TokenResponse>;

export const UserDto = s.object({
  id: s.string().uuid(),
  email: s.string().email(),
  displayName: s.string().min(1).max(100),
  role: s.enum(ROLES),
  createdAt: s.string().datetime(),
}).title('User');
export type UserDto = Infer<typeof UserDto>;

export const CreateUserRequest = s.object({
  email: s.string().email().max(254),
  displayName: s.string().min(1).max(100),
  password: s.string().min(8).max(256),
  role: s.enum(ROLES).default('viewer'),
}).title('CreateUserRequest');
export type CreateUserRequest = Infer<typeof CreateUserRequest>;

export const UserListResponse = s.object({ items: s.array(UserDto), meta: PageMeta }).title('UserList');
export type UserListResponse = Infer<typeof UserListResponse>;

/* ---------- Contrat API v1 ---------- */

export const apiV1 = defineContract({
  name: 'GO- API',
  version: 'v1',
  basePath: '/api/v1',
  endpoints: {
    health: defineEndpoint({ method: 'GET', path: '/health', summary: "État de santé de l'API", tags: ['system'], auth: false, response: HealthResponse }),
    login: defineEndpoint({ method: 'POST', path: '/auth/login', summary: 'Connexion par e-mail et mot de passe', tags: ['auth'], auth: false, body: LoginRequest, response: TokenResponse }),
    me: defineEndpoint({ method: 'GET', path: '/users/me', summary: "Profil de l'utilisateur connecté", tags: ['users'], auth: true, response: UserDto }),
    listUsers: defineEndpoint({ method: 'GET', path: '/users', summary: 'Liste paginée des utilisateurs', tags: ['users'], auth: 'users:read', query: PaginationQuery, response: UserListResponse }),
    getUser: defineEndpoint({ method: 'GET', path: '/users/:id', summary: 'Détail d’un utilisateur', tags: ['users'], auth: 'users:read', params: IdParams, response: UserDto }),
    createUser: defineEndpoint({ method: 'POST', path: '/users', summary: 'Création d’un utilisateur', tags: ['users'], auth: 'users:write', body: CreateUserRequest, response: UserDto, status: 201 }),
  },
});
export type ApiV1 = typeof apiV1;

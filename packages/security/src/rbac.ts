/**
 * Contrôle d'accès par rôles. Permissions au format `ressource:action`,
 * jokers `*` (tout) et `ressource:*` (toutes les actions d'une ressource).
 */
export interface Policy<R extends string, P extends string> {
  readonly roles: readonly R[];
  can(role: R | undefined, permission: P): boolean;
  permissionsOf(role: R): ReadonlySet<P | '*' | `${string}:*`>;
}

export function definePolicy<R extends string, P extends string>(
  grants: Readonly<Record<R, readonly (P | '*' | `${string}:*`)[]>>,
  options: { inherits?: Partial<Record<R, readonly R[]>> } = {},
): Policy<R, P> {
  const resolved = new Map<R, Set<string>>();
  const resolve = (role: R, trail: R[] = []): Set<string> => {
    const cached = resolved.get(role);
    if (cached) return cached;
    if (trail.includes(role)) throw new Error(`Héritage de rôles circulaire : ${[...trail, role].join(' → ')}`);
    if (!(role in grants)) throw new Error(`Rôle inconnu : ${role}`);
    const set = new Set<string>(grants[role]);
    for (const parent of options.inherits?.[role] ?? []) for (const p of resolve(parent, [...trail, role])) set.add(p);
    resolved.set(role, set);
    return set;
  };
  const roles = Object.keys(grants) as R[];
  roles.forEach((r) => resolve(r));

  return {
    roles,
    can(role, permission) {
      if (!role || !resolved.has(role)) return false;
      const set = resolved.get(role)!;
      if (set.has('*') || set.has(permission)) return true;
      const resource = permission.split(':')[0];
      return set.has(`${resource}:*`);
    },
    permissionsOf: (role) => resolve(role) as unknown as ReadonlySet<P | "*" | `${string}:*`>,
  };
}

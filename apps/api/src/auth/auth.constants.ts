import type { Role } from '../users/user.entity.js';

export const ROLES_KEY = 'roles';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

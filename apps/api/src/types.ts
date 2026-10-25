export interface AuthUser {
  id: number;
  organizationId: number | null;
  name: string;
  email: string;
  isPlatformAdmin: boolean;
  roleKeys: string[];
  permissions: string[];
  sessionId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

export {};

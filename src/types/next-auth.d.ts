import type { UserRole } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface User {
    role: UserRole;
    kanzleiId: string | null;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      kanzleiId: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole;
    kanzleiId: string | null;
  }
}

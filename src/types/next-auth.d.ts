import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      publicId: string;
      isAdmin: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    publicId?: string;
    isAdmin?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    pid?: string;
    admin?: boolean;
  }
}

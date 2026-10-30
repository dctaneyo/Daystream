import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authenticateWithPin } from "@/lib/auth-pin";
import { isSixDigits } from "@/lib/pin";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Daystream ID",
      credentials: {
        userId: { label: "ID", type: "text" },
        pin: { label: "PIN", type: "password" },
      },
      authorize: async (credentials) => {
        const publicId = String(credentials?.userId ?? "").trim();
        const pin = String(credentials?.pin ?? "").trim();
        if (!isSixDigits(publicId) || !isSixDigits(pin)) return null;

        const result = await authenticateWithPin(publicId, pin);
        if (!result.ok) return null;

        return {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email ?? undefined,
          publicId: result.user.publicId,
          isAdmin: result.user.isAdmin,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.pid = user.publicId;
        token.admin = user.isAdmin;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.uid === "string" ? token.uid : "";
        session.user.publicId = typeof token.pid === "string" ? token.pid : "";
        session.user.isAdmin = token.admin === true;
      }
      return session;
    },
  },
});

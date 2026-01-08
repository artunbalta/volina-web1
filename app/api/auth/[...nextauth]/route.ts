import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Persist the OAuth access_token to the token right after signin
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
      }
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client
      session.accessToken = token.accessToken as string;
      return session;
    },
    async redirect({ url, baseUrl }) {
      // After Google OAuth, redirect back to calendar page
      if (url.includes("/api/auth/callback/google")) {
        return `${baseUrl}/dashboard/calendar`;
      }
      // If the url is relative, prepend the base url
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }
      // If the url is on the same origin, allow it
      if (url.startsWith(baseUrl)) {
        return url;
      }
      // Default to dashboard/calendar for Google OAuth flow
      return `${baseUrl}/dashboard/calendar`;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login", // Redirect OAuth errors to login page
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

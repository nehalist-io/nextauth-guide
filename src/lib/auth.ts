import { db } from "@/lib/db";
import { sessions, users } from "@/schema";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { compare, genSalt, hash } from "bcrypt";
import { NextAuthOptions } from "next-auth";
import { Adapter } from "next-auth/adapters";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import GitHubProvider from "next-auth/providers/github";
import { cookies } from "next/headers";

async function hashAndSaltPassword(password: string, saltRounds = 10) {
  const salt = await genSalt(saltRounds);
  return hash(password, salt);
}

export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(db) as Adapter, // this cast is required to prevent type errors, see https://github.com/nextauthjs/next-auth/issues/6106
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
    EmailProvider({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials) {
          return null;
        }

        let user = await db.query.users.findFirst({
          where: (users, { eq }) => eq(users.name, credentials.username),
        });
        if (!user) {
          const [newUser] = await db
            .insert(users)
            .values({
              name: credentials.username,
              password: await hashAndSaltPassword(credentials.password),
            } as typeof users.$inferInsert)
            .returning();

          user = newUser;
        }

        if (!user.password) {
          return null;
        }

        const comparison = await compare(credentials.password, user.password);
        if (comparison) {
          return {
            id: user.id,
            name: user.name,
            email: user.email,
          };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // We only want to handle this for credentials provider
      if (account?.provider !== "credentials") {
        return true;
      }

      // Our session/cookie settings
      const tokenName =
        process.env.NODE_ENV === "development"
          ? "next-auth.session-token"
          : "__Secure-next-auth.session-token";
      const expireAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const token = require("crypto").randomBytes(32).toString("hex");

      // Create a session in our database
      await db.insert(sessions).values({
        sessionToken: token,
        userId: user.id,
        expires: expireAt,
      });

      // Set our cookie
      cookies().set(tokenName, token, {
        expires: expireAt,
        secure: process.env.NODE_ENV !== "development",
        sameSite: "strict",
        path: "/",
      });

      // Return to "/" after sign in
      return "/";
    },
  },
  debug: process.env.NODE_ENV === "development",
};

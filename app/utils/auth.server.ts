import { Authenticator } from "remix-auth";
import { sessionStorage } from "./session.server";
import { FormStrategy } from "remix-auth-form";
import { GoogleStrategy } from "remix-auth-google";
import { PrismaClient } from '@prisma/client'
import bcrypt from "bcryptjs";

const prisma = new PrismaClient()

export enum UserRole {
    USER = "USER",
    ADMIN = "ADMIN"
}

type User = {
    name: any;
    id: string;
    email: string;
    role: UserRole;
};

export const authenticator = new Authenticator<User>(sessionStorage);

// Form Strategy for username/password login
authenticator.use(
    new FormStrategy(async ({ form }) => {
        const login = form.get("login") as string; // Bisa email atau username
        if (!login) throw new Error("Email/Username is required");
        const password = form.get("password") as string;

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: login },
                    { username: login }
                ]
            }
        });

        if (!user) throw new Error("User not found");

        // Cek password
        if (user.password) {
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) throw new Error("Invalid password");
        }
        
        return {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role as UserRole,
            verified: user.isVerified
        };
    }),
    "form"
);

// Google Strategy for OAuth
authenticator.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            callbackURL: "http://localhost:5173/auth/google/callback",
        },
        async ({ profile }) => {
            // Generate username from email atau display name
            const baseUsername = profile.displayName
                .toLowerCase()
                .replace(/\s+/g, '')
                .slice(0, 15);

            // Check existing username dan tambahkan random number jika perlu
            let username = baseUsername;
            let counter = 1;

            while (await prisma.user.findUnique({ where: { username } })) {
                username = `${baseUsername}${counter}`;
                counter++;
            }

            const user = await prisma.user.upsert({
                where: { email: profile.emails[0].value },
                update: {},
                create: {
                    email: profile.emails[0].value,
                    username,
                    fullName: profile.displayName,
                    password: "", // No password for OAuth users
                    role: UserRole.USER,
                    province: "", // tambahkan nilai default
                    city: "",
                    district: "",
                    postalCode: "",
                    address: "",
                    phoneNumber: "",
                    isVerified: true
                },
            });

            return {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role as UserRole
            };
        }
    ),
    "google"
);
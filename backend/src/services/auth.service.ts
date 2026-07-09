import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { supabase } from "../config/supabase";
import { LoginInput, RegisterInput } from "../validators/auth.validator";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  created_at: string;
};

type JwtPayload = {
  userId: string;
  email: string;
};

export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

const publicUserColumns = "id, name, email, created_at";

const requireSupabase = () => {
  if (!supabase) {
    throw new AppError("Database is not configured", 500);
  }

  return supabase;
};

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new AppError("JWT secret is not configured", 500);
  }

  return secret;
};

const createToken = (user: AuthUser) => {
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  const options: SignOptions = { expiresIn: expiresIn as SignOptions["expiresIn"] };

  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
    },
    getJwtSecret(),
    options,
  );
};

export const authService = {
  async register(input: RegisterInput) {
    const db = requireSupabase();

    const { data: existingUser, error: existingUserError } = await db
      .from("users")
      .select("id")
      .eq("email", input.email)
      .maybeSingle();

    if (existingUserError) {
      throw new AppError(existingUserError.message, 500);
    }

    if (existingUser) {
      throw new AppError("Email is already registered", 409);
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const { data: user, error } = await db
      .from("users")
      .insert({
        name: input.name,
        email: input.email,
        password_hash: passwordHash,
      })
      .select(publicUserColumns)
      .single();

    if (error || !user) {
      throw new AppError(error?.message || "Could not create user", 500);
    }

    const token = createToken(user);

    return { user, token };
  },

  async login(input: LoginInput) {
    const db = requireSupabase();

    const { data: userWithPassword, error } = await db
      .from("users")
      .select("id, name, email, password_hash, created_at")
      .eq("email", input.email)
      .maybeSingle();

    if (error) {
      throw new AppError(error.message, 500);
    }

    if (!userWithPassword) {
      throw new AppError("Invalid email or password", 401);
    }

    const passwordMatches = await bcrypt.compare(input.password, userWithPassword.password_hash);

    if (!passwordMatches) {
      throw new AppError("Invalid email or password", 401);
    }

    const user: AuthUser = {
      id: userWithPassword.id,
      name: userWithPassword.name,
      email: userWithPassword.email,
      created_at: userWithPassword.created_at,
    };

    const token = createToken(user);

    return { user, token };
  },

  async getUserById(userId: string) {
    const db = requireSupabase();

    const { data: user, error } = await db.from("users").select(publicUserColumns).eq("id", userId).maybeSingle();

    if (error) {
      throw new AppError(error.message, 500);
    }

    if (!user) {
      throw new AppError("User not found", 404);
    }

    return user;
  },

  verifyToken(token: string) {
    try {
      return jwt.verify(token, getJwtSecret()) as JwtPayload;
    } catch {
      throw new AppError("Invalid or expired token", 401);
    }
  },
};

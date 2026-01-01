import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { getCloudflareContext } from '@opennextjs/cloudflare';

const ALG = 'HS256';

const getJwtSecret = () => {
  let secret = 'default-secret-change-me-in-prod';
  try {
    // Try to get from Cloudflare context
    const { env } = getCloudflareContext();
    if (env.JWT_SECRET) {
      secret = env.JWT_SECRET;
    } else if (process.env.JWT_SECRET) {
      secret = process.env.JWT_SECRET;
    }
  } catch (e) {
    // Fallback to process.env if not in Cloudflare context
    if (process.env.JWT_SECRET) {
      secret = process.env.JWT_SECRET;
    }
  }
  return new TextEncoder().encode(secret);
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hashSync(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compareSync(password, hash);
}

export async function signJWT(payload: Record<string, unknown>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getJwtSecret());
}

export async function verifyJWT(token: string) {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload;
  } catch {
    return null;
  }
}

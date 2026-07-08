import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  // Lazily computed once, then reused to burn ~the same CPU as a real verify.
  private dummyHash?: string;

  hash(password: string): Promise<string> {
    return argon2.hash(password);
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  // Run a verify against a throwaway hash so a login attempt for a non-existent
  // email takes ~the same time as one for a real user (defeats user enumeration
  // by timing).
  async verifyDummy(): Promise<void> {
    this.dummyHash ??= await argon2.hash('timing-equalizer');
    await this.verify(this.dummyHash, 'not-the-password');
  }
}

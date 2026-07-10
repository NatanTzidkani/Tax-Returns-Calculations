import { describe, expect, it } from 'vitest';
import { AuthUserSchema } from '../src/auth';

const valid = {
  id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  email: 'owner@example.com',
};

describe('AuthUserSchema', () => {
  it('accepts a valid user shape', () => {
    expect(AuthUserSchema.parse(valid)).toEqual(valid);
  });

  it('rejects a non-uuid id', () => {
    expect(() => AuthUserSchema.parse({ ...valid, id: 'not-a-uuid' })).toThrow();
  });

  it('rejects a malformed email', () => {
    expect(() => AuthUserSchema.parse({ ...valid, email: 'not-an-email' })).toThrow();
  });

  it('rejects a missing field', () => {
    const { email: _omit, ...rest } = valid;
    expect(() => AuthUserSchema.parse(rest)).toThrow();
  });
});

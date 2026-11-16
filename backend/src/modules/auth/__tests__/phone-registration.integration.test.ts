import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../app';
import { prisma } from '../../../config/database';
import { usersRepository } from '../../users/users.repository';
import { captureMail, PASSWORD, resetDatabase, startDatabase, stopDatabase } from '../../../test/integration';

const app = createApp();
captureMail();
beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);
beforeEach(resetDatabase);
const register = (email: string, phone: string) => request(app).post('/api/v1/auth/register').send({ email, phone, fullName: 'Phone Tester', password: PASSWORD });

describe('phone registration', () => {
  it('rejects letters in phone numbers at the API boundary', async () => {
    const response = await register('bad@example.com', 'abc0912345678');
    expect(response.status).toBe(400);
    expect(await prisma.user.count()).toBe(0);
  });

  it('rejects duplicate phones across local and international formatting', async () => {
    await usersRepository.create({ email: 'first@example.com', fullName: 'First', phone: '+84 912 345 678' });
    const response = await register('second@example.com', '0912345678');
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('PHONE_ALREADY_REGISTERED');
    expect(await prisma.user.count()).toBe(1);
  });

  it('keeps one account when concurrent registrations claim the same phone', async () => {
    const responses = await Promise.all([
      register('first@example.com', '0912345678'),
      register('second@example.com', '+84 912 345 678'),
    ]);
    expect(responses.map(r => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.user.count()).toBe(1);
  });

  it('allows the owner to keep their phone but rejects a profile claiming another phone', async () => {
    const a = await usersRepository.create({ email: 'a@example.com', fullName: 'First', phone: '0912345678' });
    const b = await usersRepository.create({ email: 'b@example.com', fullName: 'Second', phone: '0987654321' });
    await expect(usersRepository.updateById(a.id, { phone: '+84 912 345 678' })).resolves.toMatchObject({ id: a.id });
    await expect(usersRepository.updateById(b.id, { phone: '0912345678' })).rejects.toMatchObject({ code: 'PHONE_ALREADY_REGISTERED' });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: b.id } })).phone).toBe('0987654321');
  });
});

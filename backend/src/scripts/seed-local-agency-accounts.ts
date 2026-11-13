import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase, prisma } from '../config/database';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url || new URL(url).hostname !== '127.0.0.1') throw new Error('This seed only accepts a local PostgreSQL URL');
  await connectDatabase(url);
  try {
    const owner = await prisma.user.findUnique({
      where: { email: 'demo.coastal@tripri.local' },
      include: { agencyProfile: true },
    });
    if (!owner?.agencyProfile) throw new Error('Run seed-demo-tours first');
    const passwordHash = await bcrypt.hash('Tripri@123', 10);
    for (const account of [
      { email: 'demo.manager@tripri.local', fullName: 'Demo Manager', role: 'MANAGER' as const },
      { email: 'demo.staff@tripri.local', fullName: 'Demo Staff', role: 'STAFF' as const },
    ]) {
      const user = await prisma.user.upsert({
        where: { email: account.email },
        create: { email: account.email, fullName: account.fullName, role: 'AGENCY', status: 'ACTIVE', emailVerifiedAt: new Date(), passwordHash },
        update: { passwordHash, status: 'ACTIVE', emailVerifiedAt: new Date() },
      });
      await prisma.agencyMember.upsert({
        where: { agencyId_userId: { agencyId: owner.agencyProfile.id, userId: user.id } },
        create: { agencyId: owner.agencyProfile.id, userId: user.id, role: account.role },
        update: { role: account.role, status: 'ACTIVE' },
      });
      console.log(`${account.role}: ${account.email}`);
    }
  } finally { await disconnectDatabase(); }
}

void main().catch(error => { console.error(error); process.exitCode = 1; });

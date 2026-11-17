import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { prisma } from '../../../config/database';
import { startDatabase, stopDatabase, createUser, databaseUrl } from '../../../test/integration';
import { AGENCY_ROLE_PERMISSIONS, effectiveAgencyPermissions } from '../agency.policy';

beforeAll(startDatabase, 120_000);
afterAll(stopDatabase);

// This historical migration predates the wallet permissions. Reproduce its
// untouched templates rather than applying today's defaults to a 14 Nov test.
const legacyDefaults = (kind: 'OWNER' | 'STAFF') => AGENCY_ROLE_PERMISSIONS[kind].filter(p => !p.startsWith('agency:finance-') || ['agency:finance-view','agency:finance-manage'].includes(p));

it('repairs untouched legacy templates once, preserving customized roles and explicit denials', async () => {
  const owner = await createUser('AGENCY', 'role-repair@example.com');
  const staff = await createUser('TRAVELER', 'role-repair-staff@example.com');
  const roles = await prisma.agencyRole.findMany({ where: { agencyId: owner.id } });
  for (const role of roles.filter(r => r.systemRole !== 'ACCOUNTANT')) {
    await prisma.agencyRole.update({ where: { id: role.id }, data: {
      permissions: role.systemRole === 'MANAGER' ? ['agency:context-view'] : legacyDefaults(role.systemRole as 'OWNER' | 'STAFF').filter(p => !p.startsWith('custom-tour:')),
      // Simulate untouched rows inserted by the old database seed function.
      updatedAt: role.systemRole === 'MANAGER' ? new Date(role.createdAt.getTime() + 1) : role.createdAt,
    } });
  }
  const custom = await prisma.agencyRole.create({ data: { agencyId: owner.id, name: 'Custom observer', permissions: ['agency:context-view'] } });
  const editedAgency = await createUser('AGENCY', 'edited-template@example.com');
  const editedRole = await prisma.agencyRole.findFirstOrThrow({ where: { agencyId: editedAgency.id, systemRole: 'STAFF' } });
  const deliberatelyRestricted = editedRole.permissions.filter(p => !p.startsWith('custom-tour:'));
  await prisma.agencyRole.update({ where: { id: editedRole.id }, data: { permissions: deliberatelyRestricted, updatedAt: new Date(editedRole.createdAt.getTime() + 1) } });
  const member = await prisma.agencyMember.create({ data: { agencyId: owner.id, userId: staff.id, role: 'STAFF',
    permissionOverrides: { create: { permission: 'custom-tour:view', effect: 'DENY' } },
  } });
  const version = (await prisma.agencyProfile.findUniqueOrThrow({ where: { id: owner.id } })).permissionVersion;
  const sql = readFileSync(path.resolve('../prisma/migrations/20261114000200_agency_custom_tour_role_defaults/migration.sql'), 'utf8');
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(sql);
    await client.query(sql);
  } finally { await client.end(); }
  const repaired = await prisma.agencyRole.findMany({ where: { agencyId: owner.id } });
  for (const kind of ['OWNER', 'STAFF'] as const)
    expect(repaired.find(r => r.systemRole === kind)!.permissions.sort()).toEqual([...legacyDefaults(kind)].sort());
  expect(repaired.find(r => r.systemRole === 'MANAGER')!.permissions).toEqual(['agency:context-view']);
  expect(repaired.find(r => r.id === custom.id)!.permissions).toEqual(['agency:context-view']);
  expect((await prisma.agencyRole.findUniqueOrThrow({ where: { id: editedRole.id } })).permissions).toEqual(deliberatelyRestricted);
  const updatedMember = await prisma.agencyMember.findUniqueOrThrow({ where: { id: member.id }, include: { assignedRole: true, permissionOverrides: true } });
  expect(effectiveAgencyPermissions(updatedMember)).not.toContain('custom-tour:view');
  expect(effectiveAgencyPermissions(updatedMember)).toContain('custom-tour:respond');
  expect((await prisma.agencyProfile.findUniqueOrThrow({ where: { id: owner.id } })).permissionVersion).toBe(version + 1);
});

it('restores chat:use on templates seeded by the older function that won in production', async () => {
  const sql = (name: string) => readFileSync(path.resolve(`../prisma/migrations/${name}/migration.sql`), 'utf8');
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    // Production applied the custom-tour defaults after the chat migration, so its pre-chat copy of the seed
    // function was the one agencies were created with. Reproduce that, then run the repair migration.
    await client.query(sql('20261114000200_agency_custom_tour_role_defaults'));
    const owner = await createUser('AGENCY', 'role-seed-order@example.com');
    const seeded = await prisma.agencyRole.findFirstOrThrow({ where: { agencyId: owner.id, systemRole: 'OWNER' } });
    expect(seeded.permissions).not.toContain('chat:use');
    await client.query(sql('20261115000100_agency_seed_chat_permissions'));
    const repaired = await prisma.agencyRole.findFirstOrThrow({ where: { agencyId: owner.id, systemRole: 'OWNER' } });
    expect(repaired.permissions).toContain('chat:use');
  } finally { await client.end(); }
});

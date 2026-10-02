import { describe, expect, it, vi } from 'vitest';
import { ROLES } from '@travel-platform/constants';
import { slugify } from '../../../utils/slug';
import { CategoriesService } from '../categories.service';

const admin = { userId: 's1', role: ROLES.SUPER_ADMIN } as const;

function make(seed: Array<{ id: string; name: string; slug: string; isActive: boolean; sortOrder: number }> = []) {
  const db = [...seed];
  const repo = {
    list: vi.fn(async ({ onlyActive }: { onlyActive: boolean }) => db.filter((c) => !onlyActive || c.isActive)),
    findById: vi.fn(async (id: string) => db.find((c) => c.id === id) ?? null),
    findBySlug: vi.fn(async (slug: string) => db.find((c) => c.slug === slug) ?? null),
    findManyByIds: vi.fn(async (ids: string[]) => db.filter((c) => ids.includes(c.id))),
    create: vi.fn(async (data: { name: string; slug: string }) => {
      const doc = { id: `c${db.length + 1}`, isActive: true, sortOrder: 0, ...data };
      db.push(doc);
      return doc;
    }),
    updateById: vi.fn(async (id: string, patch: Record<string, unknown>) => {
      const doc = db.find((c) => c.id === id);
      if (doc) Object.assign(doc, patch);
      return doc ?? null;
    }),
  };
  const audit = { record: vi.fn(async () => undefined) };
  return { service: new CategoriesService(repo as never, audit), repo, audit, db };
}

describe('slugify', () => {
  it('handles Vietnamese diacritics', () => {
    expect(slugify('Đà Nẵng & Hội An!')).toBe('da-nang-hoi-an');
  });
});

describe('CategoriesService', () => {
  it('creates a category with a generated slug and audits it', async () => {
    const { service, audit } = make();
    const created = await service.create(admin, { name: 'Biển đảo' });
    expect(created.slug).toBe('bien-dao');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'category.created' }));
  });

  it('rejects a duplicate name (same slug)', async () => {
    const { service } = make([{ id: 'c1', name: 'Biển', slug: 'bien', isActive: true, sortOrder: 0 }]);
    await expect(service.create(admin, { name: 'BIỂN' })).rejects.toMatchObject({ statusCode: 409, code: 'CATEGORY_EXISTS' });
  });

  it('rejects names that produce an empty slug', async () => {
    await expect(make().service.create(admin, { name: '!!!' })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('renames with slug regeneration and blocks a clash with another category', async () => {
    const { service } = make([
      { id: 'c1', name: 'Núi', slug: 'nui', isActive: true, sortOrder: 0 },
      { id: 'c2', name: 'Biển', slug: 'bien', isActive: true, sortOrder: 0 },
    ]);
    await expect(service.update(admin, 'c1', { name: 'Biển' })).rejects.toMatchObject({ statusCode: 409 });
    const renamed = await service.update(admin, 'c1', { name: 'Núi rừng' });
    expect(renamed.slug).toBe('nui-rung');
  });

  it('"delete" deactivates and the public list hides it', async () => {
    const { service } = make([{ id: 'c1', name: 'Biển', slug: 'bien', isActive: true, sortOrder: 0 }]);
    await service.deactivate(admin, 'c1');
    expect(await service.listPublic()).toHaveLength(0);
    expect(await service.listAll()).toHaveLength(1);
  });

  it('returns 404 for an unknown category', async () => {
    await expect(make().service.update(admin, 'nope', { name: 'X1' })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('assertActiveIds rejects unknown and inactive ids', async () => {
    const { service } = make([
      { id: 'c1', name: 'A1', slug: 'a1', isActive: true, sortOrder: 0 },
      { id: 'c2', name: 'B1', slug: 'b1', isActive: false, sortOrder: 0 },
    ]);
    await expect(service.assertActiveIds(['c1'])).resolves.toBeUndefined();
    await expect(service.assertActiveIds(['c1', 'c2'])).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.assertActiveIds(['zzz'])).rejects.toMatchObject({ statusCode: 400 });
  });
});

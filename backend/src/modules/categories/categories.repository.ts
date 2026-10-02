import { nullIfNotFound, prisma, type Prisma } from '../../config/database';
import type { Category } from '../../generated/prisma/client';

export type CategoryRecord = Category;

export class CategoriesRepository {
  list(filter: { onlyActive: boolean }): Promise<CategoryRecord[]> {
    return prisma.category.findMany({
      where: filter.onlyActive ? { isActive: true } : {},
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  findById(id: string): Promise<CategoryRecord | null> {
    return prisma.category.findUnique({ where: { id } });
  }

  findBySlug(slug: string): Promise<CategoryRecord | null> {
    return prisma.category.findUnique({ where: { slug } });
  }

  findManyByIds(ids: string[]): Promise<CategoryRecord[]> {
    return prisma.category.findMany({ where: { id: { in: ids } } });
  }

  create(data: Prisma.CategoryUncheckedCreateInput): Promise<CategoryRecord> {
    return prisma.category.create({ data });
  }

  updateById(id: string, patch: Prisma.CategoryUncheckedUpdateInput): Promise<CategoryRecord | null> {
    return prisma.category.update({ where: { id }, data: patch }).catch(nullIfNotFound);
  }
}

export const categoriesRepository = new CategoriesRepository();

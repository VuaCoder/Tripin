import type { QueryFilter, UpdateQuery } from 'mongoose';
import { CategoryModel, type CategoryAttributes, type CategoryDocument } from './categories.model';

export class CategoriesRepository {
  list(filter: { onlyActive: boolean }): Promise<CategoryDocument[]> {
    const query: QueryFilter<CategoryAttributes> = filter.onlyActive ? { isActive: true } : {};
    return CategoryModel.find(query).sort({ sortOrder: 1, name: 1 }).exec();
  }

  findById(id: string): Promise<CategoryDocument | null> {
    return CategoryModel.findById(id).exec();
  }

  findBySlug(slug: string): Promise<CategoryDocument | null> {
    return CategoryModel.findOne({ slug }).exec();
  }

  findManyByIds(ids: string[]): Promise<CategoryDocument[]> {
    return CategoryModel.find({ _id: { $in: ids } }).exec();
  }

  create(data: Partial<CategoryAttributes>): Promise<CategoryDocument> {
    return CategoryModel.create(data);
  }

  updateById(id: string, update: UpdateQuery<CategoryAttributes>): Promise<CategoryDocument | null> {
    return CategoryModel.findByIdAndUpdate(id, update, { returnDocument: 'after', runValidators: true }).exec();
  }
}

export const categoriesRepository = new CategoriesRepository();

import type { CategoryDocument } from './categories.model';
import type { CategoryDto } from './categories.types';

export function toCategoryDto(category: CategoryDocument): CategoryDto {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description ?? undefined,
    isActive: category.isActive,
    sortOrder: category.sortOrder,
  };
}

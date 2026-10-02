// Public surface of categories. `tours` validates category ids through `categoriesService.assertActiveIds`.
export { publicCategoriesRouter, adminCategoriesRouter } from './categories.routes';
export { categoriesService, CategoriesService } from './categories.service';
export type { CategoryDto } from './categories.types';
export { categoriesRepository } from './categories.repository';

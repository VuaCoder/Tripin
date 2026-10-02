import { Router } from 'express';
import { PERMISSIONS } from '@travel-platform/constants';
import { requirePermission } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { categoriesController } from './categories.controller';
import { categoryIdParams, createCategoryBody, updateCategoryBody } from './categories.validation';

/** Mounted at /api/v1/categories — public (GUEST). */
export const publicCategoriesRouter = Router();
publicCategoriesRouter.get('/', categoriesController.listPublic);

/** Mounted at /api/v1/admin/categories — SUPER_ADMIN. */
export const adminCategoriesRouter = Router();
adminCategoriesRouter.use(requirePermission(PERMISSIONS.CATEGORY_CONFIGURE));
adminCategoriesRouter.get('/', categoriesController.listAll);
adminCategoriesRouter.post('/', validate({ body: createCategoryBody }), categoriesController.create);
adminCategoriesRouter.patch('/:id', validate({ params: categoryIdParams, body: updateCategoryBody }), categoriesController.update);
adminCategoriesRouter.delete('/:id', validate({ params: categoryIdParams }), categoriesController.remove);

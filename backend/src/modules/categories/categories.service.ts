import type { PersistedRole } from '@travel-platform/constants';
import { AppError } from '../../utils/app-error';
import { slugify } from '../../utils/slug';
import { AUDIT_ACTIONS, auditService, type AuditService } from '../audit';
import { toCategoryDto } from './categories.mapper';
import { categoriesRepository, type CategoriesRepository } from './categories.repository';
import type { CategoryDto, CreateCategoryInput, UpdateCategoryInput } from './categories.types';

type Actor = { userId: string; role: PersistedRole };

export class CategoriesService {
  constructor(
    private readonly categories: Pick<CategoriesRepository, 'list' | 'findById' | 'findBySlug' | 'findManyByIds' | 'create' | 'updateById'> = categoriesRepository,
    private readonly audit: Pick<AuditService, 'record'> = auditService,
  ) {}

  /** Public list (Guests use it to filter tours): active categories only. */
  async listPublic(): Promise<CategoryDto[]> {
    return (await this.categories.list({ onlyActive: true })).map(toCategoryDto);
  }

  /** Admin list includes deactivated categories. */
  async listAll(): Promise<CategoryDto[]> {
    return (await this.categories.list({ onlyActive: false })).map(toCategoryDto);
  }

  /** Use case "Config Tour Categories" — create. */
  async create(actor: Actor, input: CreateCategoryInput): Promise<CategoryDto> {
    const slug = this.slugOrThrow(input.name);
    if (await this.categories.findBySlug(slug)) {
      throw AppError.conflict('A category with this name already exists', 'CATEGORY_EXISTS');
    }
    const created = await this.categories.create({ ...input, slug });
    await this.record(actor, AUDIT_ACTIONS.CATEGORY_CREATED, created.id, { name: created.name });
    return toCategoryDto(created);
  }

  /** Update; renaming regenerates the slug (conflict-checked). `isActive` allows re-activation. */
  async update(actor: Actor, id: string, input: UpdateCategoryInput): Promise<CategoryDto> {
    const current = await this.requireCategory(id);
    const patch: Record<string, unknown> = { ...input };
    if (input.name !== undefined && input.name !== current.name) {
      const slug = this.slugOrThrow(input.name);
      const clash = await this.categories.findBySlug(slug);
      if (clash && clash.id !== id) throw AppError.conflict('A category with this name already exists', 'CATEGORY_EXISTS');
      patch.slug = slug;
    }
    const updated = await this.categories.updateById(id, patch);
    await this.record(actor, AUDIT_ACTIONS.CATEGORY_UPDATED, id, { changes: Object.keys(input) });
    return toCategoryDto(updated ?? current);
  }

  /** "Delete" = deactivate (DECISIONS D-24): tours that already use the category keep a valid reference. */
  async deactivate(actor: Actor, id: string): Promise<void> {
    const current = await this.requireCategory(id);
    if (!current.isActive) return;
    await this.categories.updateById(id, { isActive: false });
    await this.record(actor, AUDIT_ACTIONS.CATEGORY_DELETED, id, { name: current.name });
  }

  // ------------------------------------------------ for other modules

  /** Throws 400 unless every id is an ACTIVE category (used when an agency assigns categories to a tour). */
  async assertActiveIds(ids: string[]): Promise<void> {
    const unique = Array.from(new Set(ids));
    const found = await this.categories.findManyByIds(unique);
    if (found.length !== unique.length || found.some((category) => !category.isActive)) {
      throw AppError.badRequest('One or more categories do not exist or are inactive');
    }
  }

  async getMany(ids: string[]): Promise<CategoryDto[]> {
    if (ids.length === 0) return [];
    return (await this.categories.findManyByIds(Array.from(new Set(ids)))).map(toCategoryDto);
  }

  private slugOrThrow(name: string): string {
    const slug = slugify(name);
    if (!slug) throw AppError.badRequest('Category name must contain letters or digits');
    return slug;
  }

  private async requireCategory(id: string) {
    const category = await this.categories.findById(id);
    if (!category) throw AppError.notFound('Category not found');
    return category;
  }

  private record(actor: Actor, action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS], id: string, metadata: Record<string, unknown>) {
    return this.audit.record({ actorId: actor.userId, actorRole: actor.role, action, targetType: 'category', targetId: id, metadata });
  }
}

export const categoriesService = new CategoriesService();

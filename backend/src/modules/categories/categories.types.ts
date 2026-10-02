export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
}

export interface CreateCategoryInput {
  name: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}

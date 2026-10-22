import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { TourCategoryCombobox } from '../components/TourCategoryCombobox';
import type { TourCategory } from '../types';

afterEach(cleanup);

vi.mock('../api/toursApi', () => ({
  useCreateAgencyCategoryMutation: () => [
    vi.fn().mockImplementation(({ name }: { name: string }) => ({
      unwrap: () => Promise.resolve({ id: 'cat-new', name, slug: 'cat-new', isActive: true, sortOrder: 500 }),
    })),
    { isLoading: false },
  ],
}));

const sampleCategories: TourCategory[] = [
  { id: 'cat-1', name: 'Beach & Islands', slug: 'beach-islands', description: 'Sea and coast', isActive: true, sortOrder: 10 },
  { id: 'cat-2', name: 'Mountains & Trekking', slug: 'mountains-trekking', description: 'Highlands', isActive: true, sortOrder: 20 },
  { id: 'cat-3', name: 'Resort & Wellness', slug: 'resort-wellness', description: 'Spa & Wellness', isActive: true, sortOrder: 30 },
  { id: 'cat-4', name: 'Cruises & Waterways', slug: 'cruises-waterways', description: 'Cruises', isActive: true, sortOrder: 40 },
  { id: 'cat-5', name: 'Photography & Cloud Hunting', slug: 'photography-cloud-hunting', description: 'Clouds', isActive: true, sortOrder: 50 },
];

describe('TourCategoryCombobox', () => {
  it('opens dropdown on focus and toggles category selection', () => {
    const onChange = vi.fn();
    render(
      <TourCategoryCombobox
        selectedIds={['cat-1']}
        onChange={onChange}
        categories={sampleCategories}
      />
    );

    // Selected chip for Beach & Islands is rendered
    expect(screen.getByText('Biển đảo & Nghỉ dưỡng')).toBeDefined();

    // Focus input to open dropdown
    const input = screen.getByPlaceholderText(/Tìm hoặc nhập danh mục/i);
    fireEvent.focus(input);

    // Click on Resort & Wellness from dropdown list
    const wellnessOption = screen.getByText('Nghỉ dưỡng & Sức khỏe (Wellness)');
    fireEvent.click(wellnessOption);
    expect(onChange).toHaveBeenCalledWith(['cat-1', 'cat-3']);
  });

  it('searches categories with accent-insensitive search in Vietnamese', () => {
    const onChange = vi.fn();
    render(
      <TourCategoryCombobox
        selectedIds={[]}
        onChange={onChange}
        categories={sampleCategories}
      />
    );

    const input = screen.getByPlaceholderText(/Tìm hoặc nhập danh mục/i);
    // Search unaccented "san may"
    fireEvent.change(input, { target: { value: 'san may' } });

    // Should find Săn mây & Nhiếp ảnh in matching results
    expect(screen.getAllByText('Săn mây & Nhiếp ảnh').length).toBeGreaterThan(0);
  });

  it('shows custom option to add new category when typing unlisted name', () => {
    const onChange = vi.fn();
    render(
      <TourCategoryCombobox
        selectedIds={[]}
        onChange={onChange}
        categories={sampleCategories}
      />
    );

    const input = screen.getByPlaceholderText(/Tìm hoặc nhập danh mục/i);
    fireEvent.change(input, { target: { value: 'Tour xe máy Hà Giang' } });

    // Should show option to add new category
    expect(screen.getByText(/Thêm danh mục mới:/i)).toBeDefined();
    expect(screen.getByText(/"Tour xe máy Hà Giang"/i)).toBeDefined();
  });

  it('displays selected badges with remove button', () => {
    const onChange = vi.fn();
    render(
      <TourCategoryCombobox
        selectedIds={['cat-1', 'cat-4']}
        onChange={onChange}
        categories={sampleCategories}
      />
    );

    // Should display selected counter
    expect(screen.getByText(/Đã chọn \(2\/10\):/i)).toBeDefined();

    // Click remove button on Cruises & Waterways badge
    const removeBtn = screen.getByTitle(/Bỏ chọn Du thuyền & Sông nước/i);
    fireEvent.click(removeBtn);
    expect(onChange).toHaveBeenCalledWith(['cat-1']);
  });

  it('displays max selection warning when max limit reached', () => {
    const tenCategories: TourCategory[] = Array.from({ length: 10 }, (_, i) => ({
      id: `c-${i + 1}`,
      name: `Category ${i + 1}`,
      slug: `category-${i + 1}`,
      isActive: true,
      sortOrder: i + 1,
    }));

    render(
      <TourCategoryCombobox
        selectedIds={tenCategories.map((c) => c.id)}
        onChange={vi.fn()}
        categories={tenCategories}
        maxSelection={10}
      />
    );

    expect(screen.getByText('Đã đạt tối đa 10 danh mục')).toBeDefined();
  });
});



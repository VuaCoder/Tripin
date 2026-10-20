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
  it('renders popular category pills and toggles selection', () => {
    const onChange = vi.fn();
    render(
      <TourCategoryCombobox
        selectedIds={['cat-1']}
        onChange={onChange}
        categories={sampleCategories}
      />
    );

    // Pill for Beach & Islands should have checkmark as it is selected
    expect(screen.getByRole('button', { name: '✓ Biển đảo & Nghỉ dưỡng' })).toBeDefined();

    // Click on Resort & Wellness pill to select
    const wellnessPill = screen.getByRole('button', { name: 'Nghỉ dưỡng & Sức khỏe (Wellness)' });
    fireEvent.click(wellnessPill);
    expect(onChange).toHaveBeenCalledWith(['cat-1', 'cat-3']);

    // Click on Beach & Islands pill to deselect
    const beachPill = screen.getByRole('button', { name: /✓ Biển đảo & Nghỉ dưỡng/i });
    fireEvent.click(beachPill);
    expect(onChange).toHaveBeenCalledWith([]);
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

  it('limits popular suggestions to 7 items (2-3 lines) by default and allows expand/collapse', () => {
    const manyCategories: TourCategory[] = [
      { id: 'c1', name: 'Beach & Islands', slug: 'beach-islands', isActive: true, sortOrder: 1 },
      { id: 'c2', name: 'Mountains & Trekking', slug: 'mountains-trekking', isActive: true, sortOrder: 2 },
      { id: 'c3', name: 'City & Culture', slug: 'city-culture', isActive: true, sortOrder: 3 },
      { id: 'c4', name: 'Food & Cuisine', slug: 'food-cuisine', isActive: true, sortOrder: 4 },
      { id: 'c5', name: 'Resort & Wellness', slug: 'resort-wellness', isActive: true, sortOrder: 5 },
      { id: 'c6', name: 'Cruises & Waterways', slug: 'cruises-waterways', isActive: true, sortOrder: 6 },
      { id: 'c7', name: 'Photography & Cloud Hunting', slug: 'photography-cloud-hunting', isActive: true, sortOrder: 7 },
      { id: 'c8', name: 'Day Tour', slug: 'day-tour', isActive: true, sortOrder: 8 },
      { id: 'c9', name: 'Adventure', slug: 'adventure', isActive: true, sortOrder: 9 },
      { id: 'c10', name: 'Eco Nature', slug: 'eco-nature', isActive: true, sortOrder: 10 },
    ];

    render(
      <TourCategoryCombobox
        selectedIds={[]}
        onChange={vi.fn()}
        categories={manyCategories}
      />
    );

    // By default, only 7 pills are rendered
    expect(screen.getByRole('button', { name: '+ Xem thêm (3)' })).toBeDefined();
    // 8th item should not be in document initially
    expect(screen.queryByRole('button', { name: 'Tour trong ngày' })).toBeNull();

    // Click "+ Xem thêm"
    fireEvent.click(screen.getByRole('button', { name: '+ Xem thêm (3)' }));
    expect(screen.getByRole('button', { name: 'Thu gọn' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Tour trong ngày' })).toBeDefined();

    // Click "Thu gọn" to collapse back to 7
    fireEvent.click(screen.getByRole('button', { name: 'Thu gọn' }));
    expect(screen.getByRole('button', { name: '+ Xem thêm (3)' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Tour trong ngày' })).toBeNull();
  });
});


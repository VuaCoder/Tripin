import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { TourItemCombobox } from '../components/TourItemCombobox';

afterEach(cleanup);

const sampleSuggestions = [
  'Xe đưa đón đời mới theo lịch trình',
  'Khách sạn tiêu chuẩn 3 - 4 sao',
  'Các bữa ăn theo thực đơn tour',
  'Vé tham quan tất cả các điểm',
  'Bảo hiểm du lịch trọn gói',
];

describe('TourItemCombobox', () => {
  it('renders label, placeholder, and selected item chips', () => {
    const onChange = vi.fn();
    render(
      <TourItemCombobox
        label="Dịch vụ bao gồm"
        placeholder="Tìm kiếm tiện ích..."
        items={['Bảo hiểm du lịch trọn gói']}
        onChange={onChange}
        suggestions={sampleSuggestions}
        tone="positive"
      />
    );

    expect(screen.getByText('Dịch vụ bao gồm')).toBeDefined();
    expect(screen.getByPlaceholderText('Tìm kiếm tiện ích...')).toBeDefined();
    expect(screen.getByText('Bảo hiểm du lịch trọn gói')).toBeDefined();
    expect(screen.getByText('Đã chọn 1 mục')).toBeDefined();
  });

  it('opens dropdown on focus and toggles suggestion item', () => {
    const onChange = vi.fn();
    render(
      <TourItemCombobox
        label="Dịch vụ bao gồm"
        items={['Vé tham quan tất cả các điểm']}
        onChange={onChange}
        suggestions={sampleSuggestions}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    // Dropdown list should show suggestions
    const hotelOption = screen.getByText('Khách sạn tiêu chuẩn 3 - 4 sao');
    expect(hotelOption).toBeDefined();

    fireEvent.click(hotelOption);
    expect(onChange).toHaveBeenCalledWith([
      'Vé tham quan tất cả các điểm',
      'Khách sạn tiêu chuẩn 3 - 4 sao',
    ]);
  });

  it('deselects an already selected item when clicked in dropdown', () => {
    const onChange = vi.fn();
    render(
      <TourItemCombobox
        label="Dịch vụ bao gồm"
        items={['Khách sạn tiêu chuẩn 3 - 4 sao']}
        onChange={onChange}
        suggestions={sampleSuggestions}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    const hotelOption = screen.getAllByText('Khách sạn tiêu chuẩn 3 - 4 sao')[0];
    fireEvent.click(hotelOption);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('filters suggestions with Vietnamese accent-insensitive search', () => {
    const onChange = vi.fn();
    render(
      <TourItemCombobox
        label="Dịch vụ bao gồm"
        items={[]}
        onChange={onChange}
        suggestions={sampleSuggestions}
      />
    );

    const input = screen.getByRole('textbox');
    // Search unaccented "bao hiem"
    fireEvent.change(input, { target: { value: 'bao hiem' } });

    expect(screen.getByText('Bảo hiểm du lịch trọn gói')).toBeDefined();
    expect(screen.queryByText('Khách sạn tiêu chuẩn 3 - 4 sao')).toBeNull();
  });

  it('allows adding a custom item via Enter key', () => {
    const onChange = vi.fn();
    render(
      <TourItemCombobox
        label="Dịch vụ bao gồm"
        items={['Vé tham quan']}
        onChange={onChange}
        suggestions={sampleSuggestions}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Nước suối và khăn lạnh miễn phí' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(onChange).toHaveBeenCalledWith([
      'Vé tham quan',
      'Nước suối và khăn lạnh miễn phí',
    ]);
  });

  it('allows adding a custom item by clicking the "+ Thêm:" button', () => {
    const onChange = vi.fn();
    render(
      <TourItemCombobox
        label="Dịch vụ bao gồm"
        items={[]}
        onChange={onChange}
        suggestions={sampleSuggestions}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Sim 4G du lịch' } });

    const addCustomBtn = screen.getByText(/Sim 4G du lịch/);
    fireEvent.click(addCustomBtn);

    expect(onChange).toHaveBeenCalledWith(['Sim 4G du lịch']);
  });

  it('removes a selected item chip when clicking its delete button', () => {
    const onChange = vi.fn();
    render(
      <TourItemCombobox
        label="Dịch vụ bao gồm"
        items={['Mục 1', 'Mục 2']}
        onChange={onChange}
        suggestions={sampleSuggestions}
      />
    );

    const removeBtn = screen.getByTitle('Xóa Mục 1');
    fireEvent.click(removeBtn);

    expect(onChange).toHaveBeenCalledWith(['Mục 2']);
  });

  it('handles Escape key to close the dropdown', () => {
    render(
      <TourItemCombobox
        label="Dịch vụ bao gồm"
        items={[]}
        onChange={vi.fn()}
        suggestions={sampleSuggestions}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    expect(screen.getByText('Khách sạn tiêu chuẩn 3 - 4 sao')).toBeDefined();

    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByText('Khách sạn tiêu chuẩn 3 - 4 sao')).toBeNull();
  });
});

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FormattedMessage, removeEmojis } from '../components/FormattedMessage';

describe('FormattedMessage Component', () => {
  afterEach(cleanup);

  it('removeEmojis helper strips emojis and pictographs cleanly', () => {
    expect(removeEmojis('Chào bạn! 😊 Chúc bạn vui vẻ ✈️🏖️')).toBe('Chào bạn! Chúc bạn vui vẻ');
    expect(removeEmojis('1️⃣ Điểm đến: Đà Nẵng')).toBe('1 Điểm đến: Đà Nẵng');
    expect(removeEmojis('Văn bản không có emoji')).toBe('Văn bản không có emoji');
  });

  it('renders bold markdown cleanly without asterisks in assistant bubble', () => {
    const content = 'Chào bạn! **Bạn muốn đi đâu?**';
    render(<FormattedMessage content={content} isMine={false} />);

    expect(screen.queryByText(/\*\*/)).toBeNull();
    const strongEl = screen.getByText('Bạn muốn đi đâu?');
    expect(strongEl.tagName).toBe('STRONG');
    expect(strongEl.className).toContain('font-semibold');
  });

  it('renders numbered lists with semantic <ol> and <li> elements', () => {
    const content = `Để mình hỗ trợ bạn tốt nhất, vui lòng cho biết:
1. **Bạn muốn đi đâu?** (Ví dụ: Miền Bắc, Miền Trung)
2. **Bạn dự định đi bao lâu?** (Ví dụ: 3 ngày 2 đêm)
3. Bạn thích loại hình du lịch nào?`;

    const { container } = render(<FormattedMessage content={content} isMine={false} />);

    const ol = container.querySelector('ol');
    expect(ol).toBeTruthy();
    expect(ol?.className).toContain('list-decimal');

    const listItems = container.querySelectorAll('li');
    expect(listItems.length).toBe(3);
    expect(screen.getByText('Bạn muốn đi đâu?').tagName).toBe('STRONG');
    expect(screen.getByText('Bạn dự định đi bao lâu?').tagName).toBe('STRONG');
  });

  it('renders bullet lists with semantic <ul> and <li> elements', () => {
    const content = `- Đặc sản bánh xèo
- Bún chả cá
- Chè sầu Liên`;

    const { container } = render(<FormattedMessage content={content} isMine={false} />);

    const ul = container.querySelector('ul');
    expect(ul).toBeTruthy();
    expect(ul?.className).toContain('list-disc');

    const listItems = container.querySelectorAll('li');
    expect(listItems.length).toBe(3);
  });

  it('renders headings cleanly', () => {
    const content = `### Gợi ý lịch trình Đà Nẵng
Nội dung chi tiết lịch trình...`;

    const { container } = render(<FormattedMessage content={content} isMine={false} />);

    const h5 = container.querySelector('h5');
    expect(h5).toBeTruthy();
    expect(h5?.textContent).toBe('Gợi ý lịch trình Đà Nẵng');
  });

  it('strips any emoji present in the content automatically', () => {
    const content = 'Xin chào 👋! Mình là Trợ lý AI 🤖✨';
    const { container } = render(<FormattedMessage content={content} isMine={false} />);

    expect(container.textContent).toContain('Xin chào ! Mình là Trợ lý AI');
    expect(container.textContent).not.toContain('👋');
    expect(container.textContent).not.toContain('🤖');
    expect(container.textContent).not.toContain('✨');
  });

  it('renders traveler messages (isMine=true) cleanly without breaking whitespace', () => {
    const content = 'Tôi muốn đi Đà Nẵng 3 ngày 2 đêm';
    const { container } = render(<FormattedMessage content={content} isMine={true} />);

    expect(container.textContent).toBe('Tôi muốn đi Đà Nẵng 3 ngày 2 đêm');
  });
});

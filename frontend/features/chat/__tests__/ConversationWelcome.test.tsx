import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('next/link', () => ({ default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a> }));
import { ConversationWelcome } from '../ConversationWelcome';

afterEach(cleanup);

describe('ConversationWelcome', () => {
  it('explains the group-booking thread to an agency', () => {
    render(<ConversationWelcome audience="agency" />);
    expect(screen.getByText('Một yêu cầu đoàn, mở ra lịch trình riêng')).toBeTruthy();
    expect(screen.getByText(/Khi khách gửi yêu cầu booking đoàn/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Khám phá tour' })).toBeNull();
  });

  it('keeps the traveler and guide copy as before', () => {
    render(<ConversationWelcome audience="traveler" />);
    expect(screen.getByText('Một lời chào, mở ra một hành trình')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Khám phá tour' }).getAttribute('href')).toBe('/tours');
    cleanup();
    render(<ConversationWelcome audience="guide" />);
    expect(screen.getByText('Chờ một lời chào, đón hành trình mới')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Khám phá tour' })).toBeNull();
  });
});

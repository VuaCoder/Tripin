import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), decide: vi.fn(), allowed: true }));
vi.mock('../api/reviewTriageApi', () => ({ useReportedReviewsQuery: (...args: unknown[]) => mocks.query(...args), useTriageReviewMutation: () => [mocks.decide, { isLoading: false }] }));
vi.mock('../components/ModerationUi', () => ({ useModerationPermission: () => mocks.allowed, ModerationDenied: () => <p>Không có quyền</p>, moderationErrorMessage: () => 'Reload the changed review' }));
import { ReviewModerationQueue } from '../components/ReviewModerationQueue';
const review = { id: 'review1', tourTitle: 'Tour', rating: 4, comment: 'Review text', contentVersion: 'a'.repeat(64), reportCount: 1, reports: [{ id: 'report1', category: 'OTHER', description: 'Please review the content' }] };
beforeEach(() => { mocks.allowed = true; mocks.query.mockReturnValue({ data: { items: [review], meta: { totalPages: 1 } }, refetch: vi.fn() }); mocks.decide.mockReset(); mocks.decide.mockReturnValue({ unwrap: async () => ({ ok: true }) }); });
afterEach(cleanup);
describe('reported-review triage', () => {
  it('submits only the report snapshot shown in the opened dialog even when the queue refreshes', async () => {
    const view = render(<ReviewModerationQueue />);
    fireEvent.click(screen.getByText('Xem báo cáo và xử lý'));
    mocks.query.mockReturnValue({ data: { items: [{ ...review, reportCount: 2, reports: [...review.reports, { id: 'later', category: 'OTHER', description: 'Later report' }] }], meta: { totalPages: 1 } }, refetch: vi.fn() });
    view.rerender(<ReviewModerationQueue />);
    fireEvent.change(screen.getByLabelText('Lý do quyết định'), { target: { value: 'Review follows the rules' } });
    fireEvent.click(screen.getByText('Giữ lại'));
    await waitFor(() => expect(mocks.decide).toHaveBeenCalledWith({ id: 'review1', contentVersion: review.contentVersion, keep: true, reason: 'Review follows the rules', reportIds: ['report1'] }));
  });
  it('keeps a failed stale decision open and requires a reason before sending', async () => {
    mocks.decide.mockReturnValue({ unwrap: async () => { throw { status: 409 }; } });
    render(<ReviewModerationQueue />); fireEvent.click(screen.getByText('Xem báo cáo và xử lý'));
    fireEvent.click(screen.getByText('Gỡ bỏ')); expect(mocks.decide).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Lý do quyết định'), { target: { value: 'Content violates policy' } });
    fireEvent.click(screen.getByText('Gỡ bỏ'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Reload the changed review'));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});

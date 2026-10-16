import { describe, expect, it } from 'vitest';
import { buildAgencyApprovedMail, buildAgencyRejectedMail } from '../agency-approval.mail';

describe('Agency approval emails', () => {
  it('keeps both outcomes link-free and uses the same Tripri blue-green brand header', () => {
    const approved = buildAgencyApprovedMail('agency@example.com', 'Du lịch Việt');
    const rejected = buildAgencyRejectedMail('agency@example.com', 'Du lịch Việt', 'Bổ sung ảnh giấy phép rõ nét.');
    for (const mail of [approved, rejected]) {
      expect(mail.to).toBe('agency@example.com');
      expect(mail.html).not.toMatch(/<a\b|href\s*=|https?:\/\/|statusUrl|token=/i);
      expect(mail.text).not.toMatch(/https?:\/\/|token=/i);
      expect(mail.html).toMatch(/bgcolor="#087e8b"[^>]*>[\s\S]*?Tripri Partner/);
      expect(mail.html).not.toMatch(/#e11d48|#be123c/);
    }
    expect(approved.text).toContain('đã được phê duyệt');
    expect(rejected.text).toContain('Bổ sung ảnh giấy phép rõ nét.');
    expect(rejected.html).toMatch(/<h1[^>]*text-align:center;[^>]*>Hồ sơ cần chỉnh sửa<\/h1>/);
  });

  it('escapes company names and rejection reasons instead of inserting user-authored HTML or links', () => {
    const company = '<a href="https://example.com">Agency & Co</a>';
    const reason = '<script>alert("x")</script>\nBổ sung giấy phép & mã số thuế';
    const rejected = buildAgencyRejectedMail('agency@example.com', company, reason);
    expect(rejected.html).not.toMatch(/<a\b|<script\b/);
    expect(rejected.html).toContain('&lt;a href=&quot;');
    expect(rejected.html).toContain('Agency &amp; Co');
    expect(rejected.html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;<br>Bổ sung giấy phép &amp; mã số thuế');
    expect(rejected.text).toContain(reason);
    expect(buildAgencyApprovedMail('agency@example.com', company).html).not.toMatch(/<a\b/);
  });
});

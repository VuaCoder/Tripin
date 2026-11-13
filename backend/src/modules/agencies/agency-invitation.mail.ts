/** Notification only: accepting an invitation happens in the authenticated workplace inbox. */
export function buildAgencyInvitationMail(companyName: string, roleName: string, expiresAt: Date) {
  const deadline = new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh',
  }).format(expiresAt);
  return {
    subject: `[Tripri Partner] Lời mời tham gia ${companyName}`,
    text: `Bạn được mời tham gia ${companyName} với vai trò ${roleName}.\n\n` +
      'Đăng nhập Tripri Partner bằng email nhận thư này, mở trang Chọn nơi làm việc → Lời mời của tôi và chấp nhận lời mời.\n\n' +
      'Nếu chưa có tài khoản, hãy đăng ký và xác minh email này trước.\n\n' +
      `Lời mời có hiệu lực đến ${deadline} (giờ Việt Nam, UTC+7). ` +
      'Bạn chưa trở thành thành viên cho đến khi chấp nhận. Nếu không nhận ra lời mời, bạn có thể bỏ qua email này.',
  };
}

'use client';
import { useState } from 'react';
import { Modal } from 'antd';
import { Info } from 'lucide-react';
import s from './Finance.module.css';

export function SettlementTermsButton() {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className={s.termsButton} aria-haspopup="dialog" onClick={() => setOpen(true)}>
      <Info size={15} aria-hidden="true" />Điều kiện quyết toán
    </button>
    <Modal title="Điều kiện quyết toán" open={open} onCancel={() => setOpen(false)} footer={null} width={640} destroyOnClose>
      <div className={`${s.page} ${s.modalBody}`}>
    <p>Tự động cộng vào số dư có thể rút sau <strong>7 ngày</strong> kể từ khi chuyến đi kết thúc và Agency gửi báo cáo hoàn tất.</p>
    <ul className={s.policyRules}>
      <li>Booking đã thanh toán, đối soát khớp và có báo cáo hoàn tất.</li>
      <li>Agency đã xác minh; ngân hàng phải được xác minh trước khi rút tiền.</li>
      <li>Booking đang tranh chấp hoặc còn nghĩa vụ tài chính chưa xử lý sẽ tạm giữ.</li>
      <li>Tiền đủ điều kiện được cộng vào số dư có thể rút, sau khi trừ hoa hồng theo booking.</li>
      <li>Agency gửi yêu cầu rút; Admin chuyển khoản ngoài hệ thống rồi ghi nhận kết quả.</li>
    </ul>
    <p className={s.muted}>Rút từ 100.000đ đến 500 triệu/lần, tối đa 1 tỷ/ngày. Mục tiêu xử lý: 48 giờ.</p>
      </div>
    </Modal>
  </>;
}

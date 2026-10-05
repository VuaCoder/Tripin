import { Suspense } from "react";
import { ForgotPasswordPage } from "@/features/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tripri - Quên mật khẩu",
  description: "Khôi phục mật khẩu tài khoản Tripri của bạn.",
};

export default function ForgotPasswordRoute() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-desk-travel flex items-center justify-center text-slate-500">Đang tải...</div>}>
      <ForgotPasswordPage />
    </Suspense>
  );
}

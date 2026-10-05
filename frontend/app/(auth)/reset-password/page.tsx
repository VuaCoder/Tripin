import { Suspense } from "react";
import { ResetPasswordPage } from "@/features/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tripri - Đặt lại mật khẩu",
  description: "Tạo mật khẩu mới cho tài khoản Tripri của bạn.",
};

function ResetPasswordContent({
  searchParams,
}: {
  searchParams: { email?: string; code?: string };
}) {
  return <ResetPasswordPage email={searchParams.email} code={searchParams.code} />;
}

export default function ResetPasswordRoute({
  searchParams,
}: {
  searchParams: { email?: string; code?: string };
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-desk-travel flex items-center justify-center text-slate-500">Đang tải...</div>}>
      <ResetPasswordContent searchParams={searchParams} />
    </Suspense>
  );
}

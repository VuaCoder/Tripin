import { Suspense } from "react";
import { VerifyOtpPage } from "@/features/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tripri - Xác thực mã OTP",
  description: "Xác thực tài khoản của bạn để trải nghiệm du lịch tuyệt vời cùng Tripri.",
};

function VerifyOtpContent({
  searchParams,
}: {
  searchParams: { email?: string; purpose?: string };
}) {
  return <VerifyOtpPage email={searchParams.email} purpose={searchParams.purpose} />;
}

export default function VerifyOtpRoute({
  searchParams,
}: {
  searchParams: { email?: string; purpose?: string };
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-desk-travel flex items-center justify-center text-slate-500">Đang tải...</div>}>
      <VerifyOtpContent searchParams={searchParams} />
    </Suspense>
  );
}

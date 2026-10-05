import { Suspense } from "react";
import { LoginPage } from "@/features/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tripri - Du lịch theo cách của bạn | Đăng nhập",
  description: "Đăng nhập vào Tripri để đặt phòng khách sạn, vé xe và tour trải nghiệm bản địa chất lượng cao.",
};

export default function LoginRoute() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-desk-travel flex items-center justify-center text-slate-500">Đang tải...</div>}>
      <LoginPage />
    </Suspense>
  );
}

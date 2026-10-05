import { Suspense } from "react";
import { RegisterPage } from "@/features/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tripri - Du lịch theo cách của bạn | Đăng ký Traveler",
  description: "Tạo tài khoản Traveler trên Tripri để khám phá các chuyến du lịch tuyệt vời và trải nghiệm bản địa độc đáo.",
};

export default function RegisterTravelerRoute() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-desk-travel flex items-center justify-center text-slate-500">Đang tải...</div>}>
      <RegisterPage />
    </Suspense>
  );
}

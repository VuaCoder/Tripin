import { RegisterPage } from "@/features/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tripri - Du lịch theo cách của bạn | Đăng ký Traveler",
  description: "Tạo tài khoản Traveler trên Tripri để khám phá các chuyến du lịch tuyệt vời và trải nghiệm bản địa độc đáo.",
};

export default function RegisterRoute() {
  return <RegisterPage />;
}

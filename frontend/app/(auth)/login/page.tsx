import { LoginPage } from "@/features/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tripri - Du lịch theo cách của bạn | Đăng nhập",
  description: "Đăng nhập vào Tripri để đặt phòng khách sạn, vé xe và tour trải nghiệm bản địa chất lượng cao.",
};

export default function LoginRoute() {
  return <LoginPage />;
}

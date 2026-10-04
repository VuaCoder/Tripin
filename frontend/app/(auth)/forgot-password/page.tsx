import { ForgotPasswordPage } from "@/features/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tripri - Quên mật khẩu",
  description: "Khôi phục mật khẩu tài khoản Tripri của bạn.",
};

export default function ForgotPasswordRoute() {
  return <ForgotPasswordPage />;
}

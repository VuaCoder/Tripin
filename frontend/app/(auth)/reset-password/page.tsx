import { ResetPasswordPage } from "@/features/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tripri - Đặt lại mật khẩu",
  description: "Tạo mật khẩu mới cho tài khoản Tripri của bạn.",
};

export default function ResetPasswordRoute({
  searchParams,
}: {
  searchParams: { email?: string; code?: string };
}) {
  return <ResetPasswordPage email={searchParams.email} code={searchParams.code} />;
}

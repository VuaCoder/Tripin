import { VerifyOtpPage } from "@/features/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tripri - Xác thực mã OTP",
  description: "Xác thực tài khoản của bạn để trải nghiệm du lịch tuyệt vời cùng Tripri.",
};

export default function VerifyOtpRoute({
  searchParams,
}: {
  searchParams: { email?: string; purpose?: string };
}) {
  return <VerifyOtpPage email={searchParams.email} purpose={searchParams.purpose} />;
}

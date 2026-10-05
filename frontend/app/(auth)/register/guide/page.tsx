import { RegisterPage } from "@/features/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tripri - Du lịch theo cách của bạn | Đăng ký Hướng dẫn viên",
  description:
    "Trở thành Hướng dẫn viên trên Tripri để chia sẻ trải nghiệm bản địa, dẫn tour và đón nhận khách du lịch từ khắp nơi.",
};

export default function RegisterGuideRoute() {
  return <RegisterPage role="TOUR_GUIDE" />;
}

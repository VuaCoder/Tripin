import { redirect } from "next/navigation";

export default function RegisterRoute({ searchParams }: { searchParams?: { next?: string } }) {
  redirect('/register/traveler' + (searchParams?.next ? '?next=' + encodeURIComponent(searchParams.next) : ''));
}

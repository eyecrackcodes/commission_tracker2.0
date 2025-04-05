import { auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import DashboardContent from "@/components/DashboardContent";

export default async function DashboardPage() {
  const { userId } = auth();

  if (!userId) {
    redirect("/");
  }

  return <DashboardContent />;
}

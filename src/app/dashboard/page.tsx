import { auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import PolicyTable from "@/components/PolicyTable";
import AddPolicyButton from "@/components/AddPolicyButton";

export default async function DashboardPage() {
  const { userId } = auth();

  if (!userId) {
    redirect("/");
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Commission Dashboard
        </h1>
        <AddPolicyButton />
      </div>
      <PolicyTable />
    </div>
  );
}

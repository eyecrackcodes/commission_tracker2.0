import Navigation from "@/components/Navigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="py-6">{children}</div>
    </div>
  );
}

import { Dashboard } from "@/components/dashboard/dashboard";
import { getDashboard } from "@/lib/dashboard";

export default async function HomePage() {
  const now = new Date();
  return <Dashboard view={await getDashboard(now)} now={now} />;
}

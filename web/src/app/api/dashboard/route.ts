import { withOwner } from "@/lib/auth";
import { getDashboard } from "@/lib/dashboard";

export const GET = withOwner(async () => Response.json(await getDashboard()));

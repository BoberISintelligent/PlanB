import { createPlanHandler } from "@/lib/plan-handler";
import { serverExaKey } from "@/lib/server-env";

export const POST = createPlanHandler(serverExaKey);

import { createFileRoute } from "@tanstack/react-router";
import { runMonthlyRent } from "@/lib/custom-bases-rent";
import { publishBaseBoard } from "@/lib/custom-bases-discord";

export const Route = createFileRoute("/api/cron/base-rent")({
  server: {
    handlers: {
      GET: async () => {
        const rent = await runMonthlyRent(false);
        await publishBaseBoard();
        return Response.json(rent);
      },
      POST: async () => {
        const rent = await runMonthlyRent(true);
        await publishBaseBoard();
        return Response.json(rent);
      },
    },
  },
});

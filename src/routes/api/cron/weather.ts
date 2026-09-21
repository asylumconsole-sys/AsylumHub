import { createFileRoute } from "@tanstack/react-router";
import { applyWeatherToNitrado } from "@/lib/dayz/weather-schedule";

export const Route = createFileRoute("/api/cron/weather")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return Response.json(await applyWeatherToNitrado());
        } catch (err) {
          return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
        }
      },
    },
  },
});

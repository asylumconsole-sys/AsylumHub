import { createFileRoute } from "@tanstack/react-router";
import { UavBuyContent } from "@/routes/_app/tools/uav";

export const Route = createFileRoute("/_app/tools/all-utms")({
  component: function AllUtmsUav() {
    return <AllUtmsContent />;
  },
});

export function AllUtmsContent({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  return <UavBuyContent hideHeader={hideHeader} />;
}

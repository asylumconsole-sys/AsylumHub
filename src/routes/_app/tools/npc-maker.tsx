import { createFileRoute } from "@tanstack/react-router";
import { NpcBuilder } from "@/components/tools/NpcBuilder";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_app/tools/npc-maker")({
  component: NpcMakerPage,
  head: () => ({ meta: [{ title: `NPC Maker — ${BRAND.name}` }] }),
});

function NpcMakerPage() {
  return (
    <div className="min-h-[calc(100vh-3rem)] bg-[#050505] px-3 py-6 sm:px-5">
      <div className="mx-auto max-w-6xl">
        <NpcBuilder />
      </div>
    </div>
  );
}

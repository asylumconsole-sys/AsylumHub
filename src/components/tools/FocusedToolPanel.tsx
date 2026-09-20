import { motion, AnimatePresence } from "framer-motion";
import type { FocusedTool } from "./focused-tools";

interface FocusedToolPanelProps {
  tool: FocusedTool | null;
  onClose: () => void;
}

export function FocusedToolPanel({ tool }: FocusedToolPanelProps) {
  return (
    <AnimatePresence>
      {tool && (
        <motion.aside
          key="focused-tool-shell"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="focused-tool-aside relative z-10 flex min-h-0 w-full min-w-0 flex-1 flex-col"
          style={{ ["--hex-hue" as string]: tool.hue }}
          aria-label={`${tool.title} panel`}
          role="region"
        >
          <div className="focused-tool-scope relative z-10 mx-auto flex min-h-0 w-full max-w-[1480px] flex-1 flex-col px-5 pb-16 pt-2 sm:px-7 md:px-9">
            <tool.Component hideHeader hideSummary={!!tool.Summary} />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

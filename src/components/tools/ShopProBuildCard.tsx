import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";

export function ShopProBuildCard() {
  const navigate = useNavigate();
  return (
    <section className="shop-directory-wrap" aria-label="Pro Build">
      <div className="shop-directory-shell">
        <div className="shop-directory-grid">
          <motion.button
            type="button"
            onClick={() => navigate({ to: "/tools", search: { focus: "pro-build" } })}
            className="shop-card group shop-card-shine"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -3 }}
          >
            <span className="shop-card-art" aria-hidden>
              <span className="inline-flex size-full items-center justify-center" style={{ background: "oklch(0.28 0.12 42 / 0.55)", color: "oklch(0.9 0.12 42)" }} />
            </span>
            <span className="shop-card-content">
              <span className="shop-card-title shop-medieval-title">Pro Build</span>
              <span className="shop-card-meta">1 service · 200k builder crate on your confirmed base</span>
              <span className="shop-card-pills">
                <span className="shop-card-pill">Pro Build</span>
                <span className="shop-card-pill">PRO Builder kit</span>
              </span>
            </span>
          </motion.button>
        </div>
      </div>
    </section>
  );
}

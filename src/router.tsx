import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import "./page-transitions.css";

let clientRouter: ReturnType<typeof createAppRouter> | undefined;

function createAppRouter() {
  const queryClient = new QueryClient();

  return createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "render",
    defaultPreloadStaleTime: 0,
    defaultPendingMs: 1500,
    defaultPendingMinMs: 0,
    defaultViewTransition: true,
  });
}

export const getRouter = () => {
  if (typeof window !== "undefined" && clientRouter) return clientRouter;
  const router = createAppRouter();
  if (typeof window !== "undefined") clientRouter = router;
  return router;
};

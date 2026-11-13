import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import legacyCss from "@/game/legacy.css?url";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Diplomatic Sandbox" },
      { name: "description", content: "Design and play East Asian diplomacy games for HIST 1550 / EALC 1711. No sign-in: a link, a code and a nickname." },
      { property: "og:title", content: "The Diplomatic Sandbox" },
      { property: "og:description", content: "Design and play East Asian diplomacy games for HIST 1550 / EALC 1711. No sign-in: a link, a code and a nickname." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "stylesheet", href: legacyCss }],
  }),
  component: Index,
});

/* The game screens are the prototype's string-rendered UI, mounted client-side (checkpoint option 1). */
function Index() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    void Promise.all([import("@/game/legacy"), import("@/game/api")]).then(([ui, data]) => {
      if (!cancelled && ref.current) cleanup = ui.mountApp(ref.current, data.api);
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);
  return (
    <div ref={ref} className="tt-root">
      <p style={{ padding: 24, fontFamily: "Helvetica, Arial, sans-serif" }}>Loading The Diplomatic Sandbox…</p>
    </div>
  );
}

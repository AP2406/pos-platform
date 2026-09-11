import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Surge",
    short_name: "Surge",
    description: "Point of sale, payments, and reports — run the whole counter from one app.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    // The kit's ink (#101318), matching the app tile's own square and the
    // viewport themeColor in app/layout.tsx.
    background_color: "#101318",
    theme_color: "#101318",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        // A DIFFERENT FILE FROM THE TILE ABOVE, on purpose. Android masks a
        // maskable icon to a circle or squircle and only guarantees the centre
        // 80%; the kit's app tile fills 77% of its square edge to edge, so its
        // corners — the mark's own outline — are exactly what a round mask
        // eats. This one is the same mark inset to 56%, which survives the
        // worst mask the platform can apply.
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
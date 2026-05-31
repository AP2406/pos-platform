import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Surge",
    short_name: "Surge",
    description: "Your bookings, customers, and dispatch in one place.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#0b0e14",
    theme_color: "#0b0e14",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
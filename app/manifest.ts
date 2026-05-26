import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SplitShift",
    short_name: "SplitShift",
    description: "Track work hours, TFN salary, and ABN invoices",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#1a1a1a",
    theme_color: "#d97706",
    icons: [
      { src: "/icon",       sizes: "192x192", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}

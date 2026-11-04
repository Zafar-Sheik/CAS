import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CAS ERP — Caveman Architectural Studios",
    short_name: "CAS",
    description: "Run the studio from your phone: invoices, debtors, creditors and stock.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#171715",
    theme_color: "#171715",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "New invoice", url: "/invoices/new" },
      { name: "Receive payment", url: "/debtors/receive" },
      { name: "Stock", url: "/inventory" },
    ],
  };
}

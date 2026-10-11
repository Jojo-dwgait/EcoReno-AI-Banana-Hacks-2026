import type { Metadata } from "next";
import { Barlow_Semi_Condensed, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

// Type system (deliberate, see PLAN.md §3.2):
// - Barlow Semi Condensed for headings and markup labels: lettering modeled on California highway
//   signage and plates, the infrastructure/survey-sheet register; condensed so labels and long city names fit.
// - IBM Plex Sans for body copy: drawn for engineering documentation, reads as a field report.
// - IBM Plex Mono for every number: climate readings look like instrument output and align in tables.
const display = Barlow_Semi_Condensed({ variable: "--font-display-face", subsets: ["latin"], weight: ["500", "600", "700"] });
const body = IBM_Plex_Sans({ variable: "--font-body-face", subsets: ["latin"] });
const data = IBM_Plex_Mono({ variable: "--font-data-face", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "EcoReno AI",
  description: "See your house redesigned for your climate: the same photo, edited, with the climate evidence behind every change.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${data.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}

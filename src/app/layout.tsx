import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";

const cormorant = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Da Vinci Immersive — Uma experiência imersiva",
  description:
    "Uma jornada imersiva pelas obras-primas de Leonardo da Vinci — da geometria ao gesto final.",
  openGraph: {
    title: "Da Vinci Immersive — Uma experiência imersiva",
    description:
      "Uma jornada imersiva pelas obras-primas de Leonardo da Vinci — da geometria ao gesto final.",
    images: ["/assets/salvator-mundi.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/assets/salvator-mundi.jpg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${cormorant.variable} ${inter.variable}`}>
      <body>
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}

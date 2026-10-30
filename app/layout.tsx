import type React from "react"
import type { Metadata, Viewport } from "next"
import { Figtree } from "next/font/google"
import { Toaster } from "sonner"
import "./globals.css"

const figtree = Figtree({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-figtree",
})

export const metadata: Metadata = {
  title: "Vinheria Full · Monitoramento em tempo real",
  description: "Controle e monitoramento de lâmpadas inteligentes e sensores de luminosidade com ESP32, MQTT e FIWARE.",
  generator: "v0.app",
}

export const viewport: Viewport = {
  themeColor: "#0b0f1a",
  colorScheme: "dark",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`${figtree.variable} dark bg-neutral-950 antialiased`}>
      <body className="font-sans">
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            className: "!rounded-2xl !border-white/15 !bg-neutral-900/70 !backdrop-blur-xl !text-white",
          }}
        />
      </body>
    </html>
  )
}

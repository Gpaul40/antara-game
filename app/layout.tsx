import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "The Edit - Antara International",
  description: "A memory challenge. Beat it. Win 50% off.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}

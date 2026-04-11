import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Coda Studio',
  description: 'AI Cinematic Video Studio — RTX 5070 optimized dual export (16:9 / 9:16)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-[#edeae3] text-[#1a1a16] antialiased">
        {children}
      </body>
    </html>
  );
}

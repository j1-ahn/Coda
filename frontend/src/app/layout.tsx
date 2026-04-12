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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;1,300;1,400&family=Space+Grotesk:wght@300;400;600;700&family=Oswald:wght@600;700&family=Dancing+Script:wght@600;700&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body className="min-h-screen bg-[#edeae3] text-[#1a1a16] antialiased">
        {children}
      </body>
    </html>
  );
}

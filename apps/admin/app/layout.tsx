import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { Space_Grotesk, Inter, IBM_Plex_Mono } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = { title: 'Measured Admin' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-dvh bg-paper font-body text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

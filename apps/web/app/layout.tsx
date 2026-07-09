import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { Space_Grotesk, Inter, IBM_Plex_Mono } from 'next/font/google';
import { Providers } from './providers';
import { SiteHeader } from './_components/site-header';
import './globals.css';

const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Measured — everyday tech', template: '%s · Measured' },
  description: 'Precisely chosen everyday tech and accessories.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-dvh bg-paper font-body text-ink antialiased">
        <Providers>
          <SiteHeader />
          {children}
          <footer className="mt-16 border-t border-hairline">
            <div className="mx-auto max-w-6xl px-4 py-8 font-mono text-xs uppercase tracking-widest text-graphite">
              Measured — a portfolio storefront
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}

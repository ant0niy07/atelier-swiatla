import type { Metadata } from 'next';
import './globals.css';
import './luxury.css';
import { Cart, Footer, Header } from '@/components/site';
import { LocaleProvider } from '@/components/locale';

export const metadata: Metadata = {
  title: 'ATELIER ŚWIEC | Kolekcja Świąteczna',
  description: 'Planowana kolekcja ręcznie tworzonych świec na Boże Narodzenie 2026.',
  applicationName: 'ATELIER ŚWIEC',
  openGraph: {
    title: 'ATELIER ŚWIEC | Kolekcja Świąteczna',
    description: 'Ręcznie tworzone świece na chwile, które zostają z nami na dłużej.',
    locale: 'pl_PL',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl">
      <body><LocaleProvider>
        <Header />
        <main>{children}</main>
        <Footer />
        <Cart /></LocaleProvider>
      </body>
    </html>
  );
}

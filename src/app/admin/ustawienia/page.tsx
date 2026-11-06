import { requireAdmin } from '@/lib/admin-auth';
export default async function Settings(){await requireAdmin();return <main className="wrap product-page-dark"><span className="eyebrow">ATELIER ŚWIEC</span><h1 className="serif">Ustawienia</h1><p>Publiczne dane kontaktowe, płatności i powiadomienia są przechowywane w ustawieniach sklepu.</p></main>}

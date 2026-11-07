import './globals.css';
import { DEFAULT_LOCALE, translate } from '../lib/i18n';
import { LanguageProvider } from '../components/language-provider';
export const metadata = {title:'Creator HQ',description:translate(DEFAULT_LOCALE,'metadata.description')};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang={DEFAULT_LOCALE}><body><LanguageProvider>{children}</LanguageProvider></body></html>}

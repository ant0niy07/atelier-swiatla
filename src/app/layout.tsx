import type {Metadata} from 'next'; import './globals.css'; import './luxury.css'; import {Header,Footer,Cart} from '@/components/site';
export const metadata:Metadata={title:'ATELIER ŚWIEC | Kolekcja Świąteczna',description:'Planowana kolekcja ręcznie tworzonych świec na Boże Narodzenie 2026.',robots:{index:true,follow:true}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pl"><body><Header/><main>{children}</main><Footer/><Cart/></body></html>}

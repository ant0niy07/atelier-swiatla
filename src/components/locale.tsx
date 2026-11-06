'use client';
import { createContext,useContext,useEffect,useState } from 'react';
export type Locale='pl'|'ru'; const C=createContext<{locale:Locale;setLocale:(x:Locale)=>void}>({locale:'pl',setLocale:()=>{}}); export const useLocale=()=>useContext(C);
export function LocaleProvider({children}:{children:React.ReactNode}){const [locale,setLocale]=useState<Locale>('pl');useEffect(()=>{const x=localStorage.getItem('atelier-locale') as Locale|null;if(x==='ru'||x==='pl')queueMicrotask(()=>setLocale(x))},[]);useEffect(()=>{document.documentElement.lang=locale;localStorage.setItem('atelier-locale',locale)},[locale]);return <C.Provider value={{locale,setLocale}}>{children}</C.Provider>}
export function LanguageSwitch(){const {locale,setLocale}=useLocale();return <span className="language-switch"><button onClick={()=>setLocale('pl')} aria-pressed={locale==='pl'}>PL 🇵🇱</button><button onClick={()=>setLocale('ru')} aria-pressed={locale==='ru'}>RU 🇷🇺</button></span>}

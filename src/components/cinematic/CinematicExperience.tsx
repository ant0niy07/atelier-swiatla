'use client';

import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { InteractiveCandleFlame } from './InteractiveCandleFlame';
import { useLocale } from '@/components/locale';

type Scene = {
  kicker: string;
  title: string;
  copy: string;
  asset: string;
  href?: string;
  ambient: 'snow' | 'petals' | 'glow' | 'sparkles';
  flame?: boolean;
  flamePosition?: string;
  smoke?: boolean;
};

const scenes: Scene[] = [
  { kicker: 'ATELIER ŚWIEC', title: 'Każda chwila zasługuje na swoje światło.', copy: 'Pierwsze światło Winter Amber rozgrzewa zimowy wieczór.', asset: 'first-light', href: '/sklep', ambient: 'glow', flame: true, flamePosition: 'first-light' },
  { kicker: '6 GRUDNIA · MIKOŁAJKI', title: 'Zapach piernika, któremu nie oprze się nawet Święty Mikołaj.', copy: 'Świąteczna opowieść o małych prezentach i wielkiej radości.', asset: 'mikolajki', href: '/produkt/piernikowy-ludzik', ambient: 'snow' },
  { kicker: '24 GRUDNIA · WIGILIA', title: 'Światło, które łączy przy jednym stole.', copy: 'Ciepłe światło świec towarzyszy najważniejszym rozmowom.', asset: 'wigilia', ambient: 'snow' },
  { kicker: '25–26 GRUDNIA · BOŻE NARODZENIE', title: 'Najpiękniejsze chwile mają własne światło.', copy: 'Poranek pachnący choinką, prezentami i spokojem.', asset: 'christmas-morning', ambient: 'snow' },
  { kicker: '14 LUTEGO · WALENTYNKI', title: 'Miłość ma swój własny blask.', copy: 'Koncepcja przyszłej kolekcji dla chwil, które chce się zatrzymać.', asset: 'valentines', ambient: 'petals' },
  { kicker: '8 MARCA · DZIEŃ KOBIET', title: 'Zapach, który mówi więcej niż tysiąc słów.', copy: 'Kwiaty, światło i gest pamiętany na długo.', asset: 'womens-day', ambient: 'petals' },
  { kicker: 'KOLEKCJA ŚWIĄTECZNA', title: 'Świeca Choinka 3D', copy: 'Ręcznie formowana dekoracja dla zimowych rytuałów.', asset: 'product-tree', href: '/produkt/swieca-choinka-3d', ambient: 'snow', flame: true, flamePosition: 'tree' },
  { kicker: 'KOLEKCJA ŚWIĄTECZNA', title: 'Piernikowy Ludzik', copy: 'Świąteczny detal pełen ciepła i miękkiego światła.', asset: 'product-ginger', href: '/produkt/piernikowy-ludzik', ambient: 'sparkles' },
  { kicker: 'WINTER AMBER', title: 'Ciepło zamknięte w bursztynowym szkle.', copy: 'Koncept świecy sojowej na długie zimowe wieczory.', asset: 'product-amber', href: '/produkt/winter-amber', ambient: 'glow', flame: true, flamePosition: 'amber' },
  { kicker: 'ATELIER ŚWIEC', title: 'Zatrzymaj światło na dłużej.', copy: 'Ręcznie tworzone świece na chwile, które zostają z nami.', asset: 'final-light', href: '/sklep', ambient: 'glow', flame: true, flamePosition: 'final', smoke: true },
];
const ruScenes: Array<Pick<Scene,'kicker'|'title'|'copy'>> = [
{kicker:'ATELIER ŚWIEC',title:'Каждое мгновение заслуживает своего света.',copy:'Первый свет Winter Amber согревает зимний вечер.'},{kicker:'6 ДЕКАБРЯ · МИКОЛАЙКИ',title:'Аромат пряников, перед которым не устоит даже Святой Николай.',copy:'Праздничная история о маленьких подарках и большой радости.'},{kicker:'24 ДЕКАБРЯ · СОЧЕЛЬНИК',title:'Свет, который объединяет за одним столом.',copy:'Тёплый свет свечей сопровождает самые важные разговоры.'},{kicker:'25–26 ДЕКАБРЯ · РОЖДЕСТВО',title:'У самых красивых мгновений есть свой свет.',copy:'Утро с ароматом ёлки, подарков и спокойствия.'},{kicker:'14 ФЕВРАЛЯ · ДЕНЬ ВЛЮБЛЁННЫХ',title:'У любви есть собственное сияние.',copy:'Концепция будущей коллекции для мгновений, которые хочется сохранить.'},{kicker:'8 МАРТА · ЖЕНСКИЙ ДЕНЬ',title:'Аромат, который говорит больше тысячи слов.',copy:'Цветы, свет и жест, который помнят долго.'},{kicker:'РОЖДЕСТВЕНСКАЯ КОЛЛЕКЦИЯ',title:'Свеча Ёлка 3D',copy:'Декоративная форма для зимних ритуалов.'},{kicker:'РОЖДЕСТВЕНСКАЯ КОЛЛЕКЦИЯ',title:'Пряничный человечек',copy:'Праздничная деталь, наполненная теплом и мягким светом.'},{kicker:'WINTER AMBER',title:'Тепло, заключённое в янтарное стекло.',copy:'Концепт соевой свечи для долгих зимних вечеров.'},{kicker:'ATELIER ŚWIEC',title:'Сохраните свет надолго.',copy:'Свечи ручной работы для мгновений, которые остаются с нами.'}];

export default function CinematicExperience() {
  const {locale}=useLocale();
  const [sceneIndex, setSceneIndex] = useState(0);
  const wheelSum = useRef(0);
  const isTransitioning = useRef(false);
  const touchStart = useRef<number | null>(null);
  const reducedMotion = useReducedMotion();

  const go = useCallback((direction: number) => {
    if (isTransitioning.current) return;
    setSceneIndex((current) => {
      const next = Math.max(0, Math.min(scenes.length - 1, current + direction));
      if (next === current) return current;
      isTransitioning.current = true;
      window.setTimeout(() => { isTransitioning.current = false; }, reducedMotion ? 80 : 900);
      return next;
    });
  }, [reducedMotion]);

  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      wheelSum.current += Math.max(-36, Math.min(36, event.deltaY));
      if (Math.abs(wheelSum.current) < 52) return;
      go(wheelSum.current > 0 ? 1 : -1);
      wheelSum.current = 0;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (['ArrowDown', 'PageDown', ' '].includes(event.key)) { event.preventDefault(); go(1); }
      if (['ArrowUp', 'PageUp'].includes(event.key)) { event.preventDefault(); go(-1); }
      if (event.key === 'Home') { event.preventDefault(); setSceneIndex(0); }
      if (event.key === 'End') { event.preventDefault(); setSceneIndex(scenes.length - 1); }
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    return () => { window.removeEventListener('wheel', onWheel); window.removeEventListener('keydown', onKeyDown); };
  }, [go]);

  const scene = {...scenes[sceneIndex],...(locale==='ru'?ruScenes[sceneIndex]:{})};
  return (
    <section
      className={`film film--${scene.ambient}`}
      onTouchEnd={(event) => {
        if (touchStart.current === null) return;
        const distance = event.changedTouches[0].clientY - touchStart.current;
        if (Math.abs(distance) > 42) go(distance < 0 ? 1 : -1);
        touchStart.current = null;
      }}
      onTouchStart={(event) => { touchStart.current = event.changedTouches[0].clientY; }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          animate={{ opacity: 1, scale: 1 }}
          className={`film-image film-image--${scene.asset}`}
          exit={{ opacity: 0, scale: 1.03 }}
          initial={{ opacity: 0, scale: 1.06 }}
          key={scene.asset}
          style={{ backgroundImage: `url(/cinematic/${scene.asset}.png)` }}
          transition={{ duration: reducedMotion ? 0 : 0.85, ease: 'easeOut' }}
        />
      </AnimatePresence>
      <div className="film-atmosphere" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
      {scene.flame && <InteractiveCandleFlame className={`film-flame film-flame--${scene.flamePosition}`} size={82} reducedMotion={Boolean(reducedMotion)} />}
      {scene.smoke && <div className="fragrance-wisps" aria-hidden="true"><i /><i /><i /></div>}
      <button className="film-skip" type="button" onClick={() => setSceneIndex(scenes.length - 1)}>{locale==='ru'?'Пропустить историю':'Pomiń opowieść'}</button>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="film-copy"
        initial={{ opacity: 0, y: 22 }}
        key={`copy-${scene.asset}`}
        transition={{ delay: reducedMotion ? 0 : 0.22, duration: reducedMotion ? 0 : 0.55 }}
      >
        <span className="eyebrow">{scene.kicker}</span>
        <h1>{scene.title}</h1>
        <p>{scene.copy}</p>
        {scene.href && <Link href={scene.href}>{sceneIndex === 0 || sceneIndex === scenes.length - 1 ? (locale==='ru'?'ОТКРЫТЬ КОЛЛЕКЦИЮ':'ODKRYJ KOLEKCJĘ') : (locale==='ru'?'СМОТРЕТЬ ТОВАР':'ZOBACZ PRODUKT')} <span aria-hidden="true">↗</span></Link>}
      </motion.div>
      <div className="film-nav" aria-label="Sterowanie opowieścią">
        <button aria-label="Poprzednia scena" disabled={sceneIndex === 0} onClick={() => go(-1)} type="button">←</button>
        <i>{String(sceneIndex + 1).padStart(2, '0')} / {scenes.length}</i>
        <button aria-label="Następna scena" disabled={sceneIndex === scenes.length - 1} onClick={() => go(1)} type="button">→</button>
      </div>
    </section>
  );
}

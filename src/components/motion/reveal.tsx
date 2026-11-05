'use client';
import {motion,useReducedMotion} from 'motion/react';
export function Reveal({children,delay=0,className}:{children:React.ReactNode;delay?:number;className?:string}){const r=useReducedMotion();return <motion.div className={className} initial={r?false:{opacity:0,y:22}} animate={{opacity:1,y:0}} transition={{duration:.85,delay,ease:[.16,1,.3,1]}}>{children}</motion.div>}

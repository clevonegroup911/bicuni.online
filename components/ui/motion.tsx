"use client";
import{motion,useReducedMotion}from"framer-motion";import type{ReactNode}from"react";
export function Reveal({children,className,delay=0}:{children:ReactNode;className?:string;delay?:number}){const reduced=useReducedMotion();return <motion.div className={className} initial={reduced?false:{opacity:0,y:20}} whileInView={reduced?undefined:{opacity:1,y:0}} viewport={{once:true,margin:"-60px"}} transition={{duration:.5,delay,ease:[.22,1,.36,1]}}>{children}</motion.div>}

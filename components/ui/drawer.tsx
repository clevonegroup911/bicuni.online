"use client";
import{X}from"lucide-react";import type{ReactNode}from"react";
export function Drawer({open,onClose,title,children}:{open:boolean;onClose:()=>void;title:string;children:ReactNode}){if(!open)return null;return <><button aria-label="Fermer le panneau" className="modal-backdrop" onClick={onClose}/><aside className="drawer" role="dialog" aria-modal="true" aria-label={title}><div className="document-card-top"><h2>{title}</h2><button className="icon-button" onClick={onClose}><X size={18}/></button></div>{children}</aside></>}

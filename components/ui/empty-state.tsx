import type{LucideIcon}from"lucide-react";import type{ReactNode}from"react";
export function EmptyState({icon:Icon,title,description,action}:{icon:LucideIcon;title:string;description:string;action?:ReactNode}){return <section className="glass card empty-state"><Icon size={32} color="#718cff"/><h2>{title}</h2><p>{description}</p>{action}</section>}

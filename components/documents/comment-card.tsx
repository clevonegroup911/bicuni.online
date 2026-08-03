import{MessageSquare}from"lucide-react";
export function CommentCard({name,body,date}:{name:string;body:string;date:Date}){return <article className="glass card comment-card"><div className="entity-icon"><MessageSquare size={17}/></div><div><strong>{name}</strong><p>{body}</p><small>{new Intl.DateTimeFormat("fr-FR",{dateStyle:"medium"}).format(date)}</small></div></article>}

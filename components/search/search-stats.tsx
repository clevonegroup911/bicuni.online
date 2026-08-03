import{Clock3,Database,Users}from"lucide-react";
export function SearchStats({documents,directory,time}:{documents:number;directory:number;time:number}){return <div className="search-stats"><span><Database size={14}/>{documents} publication{documents>1?"s":""}</span><span><Users size={14}/>{directory} entrée{directory>1?"s":""} d’annuaire</span><span><Clock3 size={14}/>{time} ms</span></div>}

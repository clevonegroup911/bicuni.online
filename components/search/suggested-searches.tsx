import{Sparkles}from"lucide-react";
export function SuggestedSearches({items,onSelect}:{items:string[];onSelect:(query:string)=>void}){if(!items.length)return null;return <section className="search-memory"><span className="eyebrow"><Sparkles size={13}/>Recherches populaires</span><div>{items.map(item=><button key={item} onClick={()=>onSelect(item)}>{item}</button>)}</div></section>}

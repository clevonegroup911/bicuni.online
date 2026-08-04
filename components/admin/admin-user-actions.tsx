"use client";

import type { Role, UserStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const roles:Role[]=["USER","STUDENT","RESEARCHER","MODERATOR","INSTITUTION_ADMIN","UNIVERSITY_ADMIN","ADMIN","GOVERNMENT","SUPER_ADMIN"];
export function AdminUserActions({id,role,status,disabled}:{id:string;role:Role;status:UserStatus;disabled:boolean}){const router=useRouter();const[message,setMessage]=useState("");async function patch(body:unknown,confirmation:string){if(!window.confirm(confirmation))return;setMessage("Mise à jour…");const response=await fetch(`/api/admin/users/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const result=await response.json()as{error?:string};setMessage(response.ok?"Enregistré":result.error??"Action refusée");if(response.ok)router.refresh()}return <div className="admin-user-actions">{disabled?<small>Compte courant</small>:<><select className="input" value={role} aria-label="Rôle" onChange={event=>patch({action:"role",role:event.target.value},"Confirmer ce changement de rôle ?")}>{roles.map(value=><option key={value}>{value}</option>)}</select><button className="button secondary" onClick={()=>patch({action:"status",status:status==="SUSPENDED"?"ACTIVE":"SUSPENDED"},status==="SUSPENDED"?"Réactiver ce compte ?":"Suspendre immédiatement ce compte ?")}>{status==="SUSPENDED"?"Réactiver":"Suspendre"}</button></>}{message&&<small role="status">{message}</small>}</div>}

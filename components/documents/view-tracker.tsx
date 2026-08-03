"use client";
import { useEffect } from "react";
export function ViewTracker({documentId}:{documentId:string}){useEffect(()=>{const key=`bicuni:view:${documentId}`;if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,"1");fetch(`/api/documents/${documentId}/views`,{method:"POST"});},[documentId]);return null;}

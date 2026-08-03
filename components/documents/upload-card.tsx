"use client";
import{FileUp}from"lucide-react";import{UploadZone}from"@/components/documents/upload-zone";
export function UploadCard({onFile}:{onFile:(file:File)=>void}){return <section className="upload-card"><div className="upload-card-title"><FileUp/><div><strong>Fichier principal</strong><p>PDF ou DOCX, stocké de manière privée.</p></div></div><UploadZone onFile={onFile}/></section>}

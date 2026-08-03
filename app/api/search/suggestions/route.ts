import{NextResponse}from"next/server";import{SearchService}from"@/lib/search/search-service";
export async function GET(request:Request){const query=new URL(request.url).searchParams.get("q")??"";if(query.length>300)return NextResponse.json({error:"Requête trop longue."},{status:400});return NextResponse.json({suggestions:await new SearchService().suggestions(query)})}

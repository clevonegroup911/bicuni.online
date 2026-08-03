import{db}from"../lib/db/client";import{closeSearchCache}from"../lib/search/cache";import{SearchIndexer}from"../lib/search/indexer";
async function main(){try{console.info(await new SearchIndexer().fullReindex())}finally{await Promise.all([db.$disconnect(),closeSearchCache()])}}main().catch(error=>{console.error(error);process.exitCode=1});

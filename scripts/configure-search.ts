import{configureSearchIndexes}from"../lib/search/client";
async function main(){await configureSearchIndexes();console.info("Index Meilisearch configurés.")}main().catch(error=>{console.error(error);process.exitCode=1});

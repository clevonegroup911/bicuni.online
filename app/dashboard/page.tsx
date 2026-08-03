import { DashboardShell } from "@/components/dashboard-shell";
import { requireActiveSubscriber } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";

export default async function Dashboard() {
  const user=await requireActiveSubscriber();
  const [documentCount,publishedCount,pendingCount,recent,aggregate]=await Promise.all([db.document.count({where:{authorId:user.id,status:{not:"DELETED"}}}),db.document.count({where:{authorId:user.id,status:{in:["APPROVED","PUBLISHED"]}}}),db.document.count({where:{authorId:user.id,status:"PENDING_REVIEW"}}),db.document.findMany({where:{authorId:user.id,status:{not:"DELETED"}},select:{id:true,title:true,status:true,updatedAt:true},orderBy:{updatedAt:"desc"},take:6}),db.document.aggregate({where:{authorId:user.id},_sum:{viewCount:true,downloadCount:true,favoriteCount:true}})]);
  const secondaryCount=(aggregate._sum.viewCount??0)+(aggregate._sum.downloadCount??0)+(aggregate._sum.favoriteCount??0);
  return <DashboardShell data={{documentCount,publishedCount,pendingCount,secondaryCount,recent}}/>;
}

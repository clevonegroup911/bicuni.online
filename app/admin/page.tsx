import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";

export default async function Admin() {
  await requireRole(["SUPER_ADMIN"]);
  const [documentCount,secondaryCount,publishedCount,pendingCount,recent]=await Promise.all([db.document.count({where:{status:{not:"DELETED"}}}),db.user.count(),db.document.count({where:{status:{in:["APPROVED","PUBLISHED"]}}}),db.document.count({where:{status:"PENDING_REVIEW"}}),db.document.findMany({where:{status:{not:"DELETED"}},select:{id:true,title:true,status:true,updatedAt:true},orderBy:{updatedAt:"desc"},take:6})]);
  return <DashboardShell variant="admin" data={{documentCount,secondaryCount,publishedCount,pendingCount,recent}}/>;
}

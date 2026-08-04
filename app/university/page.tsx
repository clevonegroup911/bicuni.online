import { DashboardShell } from "@/components/dashboard-shell";
import { requireActiveSubscriber, requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";

export default async function University() {
  const user=await requireRole(["INSTITUTION_ADMIN", "UNIVERSITY_ADMIN", "SUPER_ADMIN"]);
  await requireActiveSubscriber();
  const ids=user.role==="SUPER_ADMIN"?undefined:(await db.university.findMany({where:{admins:{some:{id:user.id}}},select:{id:true}})).map(item=>item.id);const scope=ids?{universityId:{in:ids}}:{};
  const [documentCount,secondaryCount,publishedCount,pendingCount,recent]=await Promise.all([db.document.count({where:{...scope,status:{not:"DELETED"}}}),db.user.count({where:{profile:{universityId:{in:ids}}}}),db.document.count({where:{...scope,status:{in:["APPROVED","PUBLISHED"]}}}),db.document.count({where:{...scope,status:"PENDING_REVIEW"}}),db.document.findMany({where:{...scope,status:{not:"DELETED"}},select:{id:true,title:true,status:true,updatedAt:true},orderBy:{updatedAt:"desc"},take:6})]);
  return <DashboardShell variant="university" data={{documentCount,secondaryCount,publishedCount,pendingCount,recent}}/>;
}

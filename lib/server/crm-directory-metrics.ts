import type {PoolClient} from "pg";

export type CrmDirectoryCount={total:number;unique_emails:number;with_email:number;with_phone:number;with_website:number;missing_email:number;reviewed:number;contacted:number;confirmed_email:number;confirmed_24h:number;pending_contact:number};

// The filter is composed only of allowlisted SQL expressions and bound parameters
// by the directory route. Each prospect is counted once, regardless of messages.
export async function crmDirectoryCount(c:PoolClient,filter:string,args:unknown[]):Promise<CrmDirectoryCount>{
 const result=await c.query<CrmDirectoryCount>(
  "WITH filtered AS (SELECT email,public_email,phone,website,contact_review,status FROM public.crm_prospects"+filter+"), "+
  "delivered AS (SELECT correspondent,max(occurred_at) AS last_sent FROM public.crm_mail_history WHERE direction='outbound' AND delivery_status='delivered' GROUP BY correspondent), "+
  "activity AS (SELECT f.*,GREATEST(a.last_sent,b.last_sent) AS last_sent FROM filtered f LEFT JOIN delivered a ON a.correspondent=lower(trim(f.email)) LEFT JOIN delivered b ON b.correspondent=lower(trim(f.public_email))) "+
  "SELECT count(*)::int AS total,count(DISTINCT lower(COALESCE(email,public_email)))::int AS unique_emails,"+
  "count(*) FILTER (WHERE email IS NOT NULL OR public_email IS NOT NULL)::int AS with_email,"+
  "count(*) FILTER (WHERE email IS NULL AND public_email IS NULL)::int AS missing_email,"+
  "count(*) FILTER (WHERE NULLIF(trim(phone),'') IS NOT NULL)::int AS with_phone,"+
  "count(*) FILTER (WHERE NULLIF(trim(website),'') IS NOT NULL)::int AS with_website,"+
  "count(*) FILTER (WHERE contact_review<>'pending')::int AS reviewed,"+
  "count(*) FILTER (WHERE last_sent IS NOT NULL OR status IN ('contacted','interested','trial','converted'))::int AS contacted,"+
  "count(*) FILTER (WHERE last_sent IS NOT NULL)::int AS confirmed_email,"+
  "count(*) FILTER (WHERE last_sent>now()-interval '24 hours')::int AS confirmed_24h,"+
  "count(*) FILTER (WHERE last_sent IS NULL AND status IN ('pending_review','qualified') AND (NULLIF(trim(email),'') IS NOT NULL OR NULLIF(trim(public_email),'') IS NOT NULL))::int AS pending_contact "+
  "FROM activity",args);
 return result.rows[0];
}

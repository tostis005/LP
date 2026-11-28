import {authPool} from "@/lib/server/db";
import {pushConfigured,sendWebPush} from "@/lib/server/web-push";
import {transactionPushCopy,type TransactionNotice} from "@/lib/transaction-push-copy";
type Receipt=TransactionNotice&{delivery_id:string;endpoint:string;p256dh:string;auth:string;membership_id:string;business_name:string};
export async function dispatchTransactionPush(id:string|null=null,limit=1){
 if(!pushConfigured())return 0;
 let processed=0;
 for(let i=0;i<limit;i++){
  const item=(await authPool.query<Receipt>("SELECT * FROM public.claim_transaction_push($1::uuid)",[id])).rows[0];
  if(!item)break;
  let success=false,expired=false,retry=false;
  try{await sendWebPush({...item,...transactionPushCopy(item),offer_id:null});success=true;}
  catch(e){const status=(e as {statusCode?:number}).statusCode;expired=status===404||status===410;retry=!status||status===429||status>=500;}
  await authPool.query("SELECT public.finish_transaction_push($1::uuid,$2::boolean,$3::boolean,$4::boolean)",[item.delivery_id,success,expired,retry]);
  processed++;
 }
 return processed;
}

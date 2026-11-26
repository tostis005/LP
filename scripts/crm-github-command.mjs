// Invoked only by the authorized GitHub SSH workflow inside the existing worker.
import {createHmac} from "node:crypto";
const [command,orderId,...extra]=process.argv.slice(2);
if(!["preview","send30"].includes(command)||!/^[0-9]{1,20}$/.test(orderId||"")||extra.length||process.env.PGUSER!=="lp_auth"||!process.env.PGPASSWORD)process.exit(2);
try{
 const body=JSON.stringify({command,orderId}),time=String(Date.now());
 const signature=createHmac("sha256",process.env.PGPASSWORD).update("crm-github-command-v1:"+time+":"+body).digest("hex");
 const response=await fetch("http://web:3000/api/local/admin/crm/campaigns/puebla",{method:"POST",headers:{"Content-Type":"application/json","x-crm-github-time":time,"x-crm-github-signature":signature},body,redirect:"error",signal:AbortSignal.timeout(900000)});
 if(!response.ok)throw Error("HTTP");
 const j=await response.json();
 const states=["enabled","disabled","not_ready","completed","stopped","already_processed","unauthorized","invalid","error"];
 const queued=Number(j.queued),eligible=Number(j.eligible??0);
 if(!states.includes(j.state)||!Number.isInteger(queued)||queued<0||queued>30||!Number.isInteger(eligible)||eligible<0||eligible>30)throw Error("response");
 console.log("CRM_RESULT "+j.state+" "+queued+" "+eligible);
 if(["unauthorized","invalid","error","not_ready","stopped"].includes(j.state)||command==="send30"&&j.state==="disabled")process.exitCode=1;
}catch{console.log("CRM_RESULT error 0 0");process.exitCode=1;}

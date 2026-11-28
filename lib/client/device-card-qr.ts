export async function devicePushSubscription(){
 if(typeof window==="undefined"||!window.isSecureContext||!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window)||Notification.permission!=="granted")return null;
 const reg=await navigator.serviceWorker.getRegistration();
 return reg?reg.pushManager.getSubscription():null;
}
export async function deviceCardRequest(body:Record<string,unknown>){
 const res=await fetch("/api/local/push/card-device",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
 if(!res.ok)throw Error("No se pudo guardar la preferencia del dispositivo.");
 return res.json() as Promise<{token?:string|null;enabled?:boolean|null}>;
}
export async function deviceCardQr(membership:string){
 const sub=await devicePushSubscription();if(!sub)return null;
 // Re-register in the current authenticated account before issuing the alias.
 const res=await fetch("/api/local/push/preferences",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"subscribe",endpoint:sub.endpoint,keys:sub.toJSON().keys})});
 if(!res.ok)return null;
 return (await deviceCardRequest({action:"qr",membership,endpoint:sub.endpoint})).token||null;
}

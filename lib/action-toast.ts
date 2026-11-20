"use client";
export type ToastTone="success"|"error";
export const actionToastEvent="loyally:action-toast";
export function showActionToast(message:string,tone:ToastTone="success"){
 if(typeof window==="undefined")return;
 window.dispatchEvent(new CustomEvent(actionToastEvent,{detail:{message,tone}}));
}

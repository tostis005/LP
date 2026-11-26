import {NextResponse} from "next/server";
// The root is now the customer landing; /presentacion remains a legacy business URL.
export function middleware(){return NextResponse.next();}
export const config={matcher:["/"]};

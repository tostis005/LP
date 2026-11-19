import {NextRequest, NextResponse} from "next/server";

// La raíz siempre muestra la presentación y conserva ?lang=en o ?lang=es.
export function middleware(request:NextRequest){
 const destination=request.nextUrl.clone();
 destination.pathname="/presentacion";
 return NextResponse.rewrite(destination);
}
export const config={matcher:["/"]};

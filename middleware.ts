import {NextRequest, NextResponse} from "next/server";

// La ruta pública / nunca debe ejecutar el distribuidor de sesiones /entrar.
// La reescritura mantiene la URL visible y sirve la presentación real.
export function middleware(request:NextRequest){
  return NextResponse.rewrite(new URL("/presentacion",request.url));
}
export const config={matcher:["/"]};

import type {Metadata} from "next";
import CustomerHome from "../page";
export const dynamic="force-dynamic";
export const metadata:Metadata={alternates:{canonical:"https://kreyvi.com/"}};
// Separate compiled route, used by the internal root rewrite. Never enters auth.
export default function CustomerPresentation(){return <CustomerHome/>;}

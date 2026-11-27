import type {Metadata} from "next";
import CustomerHome from "../page";
export const dynamic="force-dynamic";
export const metadata:Metadata={alternates:{canonical:"https://kreyvi.com/"}};
export default function CustomerPresentation({searchParams}:{searchParams:Promise<{lang?:string|string[]}>}){return <CustomerHome searchParams={searchParams}/>;}

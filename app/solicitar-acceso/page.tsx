// Preserve old onboarding links and open the same contact form with business access selected.
import ContactPage,{metadata} from "../contacto/page";
export {metadata};
export default function RequestAccess({searchParams}:{searchParams:Promise<{lang?:string|string[]}>}){
 return <ContactPage searchParams={searchParams.then(params=>({...params,topic:"business_access"}))}/>;
}

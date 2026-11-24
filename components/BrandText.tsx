/** Keep the name's spelling and logo colors in public-facing copy. */
export function BrandText({value}:{value:string}){
 return <span>{value.split(/(Kreyvi)/gi).map((part,i)=>part.toLowerCase()==="kreyvi"?<span className="loi-brand-word" key={i}>Kr<span>ey</span>vi</span>:part)}</span>;
}

export const CURRENCIES = [
 {code:"USD",label:"Dólar estadounidense"},
 {code:"EUR",label:"Euro"},
 {code:"MXN",label:"Peso mexicano"}
] as const;
export type CurrencyCode=(typeof CURRENCIES)[number]["code"];
export function displayCurrency(code:string|null|undefined):CurrencyCode {
 return CURRENCIES.find(c=>c.code===code)?.code||"MXN";
}
export function money(cents:number,code:string|null|undefined):string {
 const currency=displayCurrency(code);
 return new Intl.NumberFormat(currency==="EUR"?"es-ES":currency==="USD"?"en-US":"es-MX",
  {style:"currency",currency}).format(cents/100);
}

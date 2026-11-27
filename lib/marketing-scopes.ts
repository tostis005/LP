export const scopeKeys=["country_code","state_code","municipality_code","locality_code","neighborhood"] as const;
export type MarketingScope=Record<(typeof scopeKeys)[number],string>;
export const emptyScope:MarketingScope={country_code:"",state_code:"",municipality_code:"",locality_code:"",neighborhood:""};
export function scopeKey(scope:MarketingScope){return JSON.stringify(scopeKeys.map(key=>scope[key]||""));}
export function appendScope(scopes:MarketingScope[],scope:MarketingScope){return scopes.some(s=>scopeKey(s)===scopeKey(scope))?scopes:[...scopes,{...scope}];}
export function scopesForSave(scopes:MarketingScope[],draft:MarketingScope){return scopeKeys.some(k=>!!draft[k])?appendScope(scopes,draft):scopes;}

"""Recreate the approved Venezuela CSV from the exact public OSM snapshot.
No network, database access or communications here. The caller verifies both hashes.
Data: © OpenStreetMap contributors (ODbL), https://www.openstreetmap.org/copyright.
"""
import sys, warnings, re, unicodedata, json
from collections import defaultdict
from math import cos, radians
import pandas as pd
import geopandas as gpd
import pyogrio
import numpy as np
warnings.filterwarnings("ignore")
source, output = sys.argv[1:3]
p=pyogrio.read_dataframe(source,layer="points",where="other_tags LIKE '%\"amenity\"=>%' OR other_tags LIKE '%\"shop\"=>%' OR other_tags LIKE '%\"craft\"=>%'")
a=pyogrio.read_dataframe(source,layer="multipolygons",where="amenity IS NOT NULL OR shop IS NOT NULL OR craft IS NOT NULL OR (boundary = 'administrative' AND admin_level IN ('4','6','8'))")
pat=re.compile(r'"((?:\\.|[^"\\])*)"=>"((?:\\.|[^"\\])*)"')
def tags(s):
 return {k.replace('\\"','"'):v.replace('\\"','"').replace('\\\\','\\') for k,v in pat.findall(str(s))}
core={'restaurant':'Restaurante','fast_food':'Comida rápida','cafe':'Cafetería','ice_cream':'Heladería','bar':'Bar','pub':'Pub','food_court':'Zona de comida','bakery':'Panadería','pastry':'Pastelería','confectionery':'Dulcería','coffee':'Tienda de café','deli':'Delicatessen','tea':'Tienda de té','chocolate':'Chocolatería','juice_bar':'Jugos','caterer':'Catering'}
extra={'hairdresser':'Peluquería / barbería','beauty':'Estética','massage':'Masajes','nails':'Manicura','cosmetics':'Cosmética','perfumery':'Perfumería','pet':'Mascotas','veterinary':'Veterinaria','car_wash':'Lavado de autos','florist':'Floristería','clothes':'Ropa','shoes':'Calzado','laundry':'Lavandería','dry_cleaning':'Tintorería','convenience':'Tienda de conveniencia','supermarket':'Supermercado','greengrocer':'Frutería','butcher':'Carnicería','seafood':'Pescadería','beverages':'Bebidas','alcohol':'Licorería','optician':'Óptica','pharmacy':'Farmacia','books':'Librería','stationery':'Papelería','gift':'Regalos','sports':'Deportes','bicycle':'Bicicletas','nutrition_supplements':'Suplementos','nightclub':'Discoteca','cinema':'Cine'}
rows=[]
for layer,d in [('node',p),('area',a)]:
 for r in d.itertuples(index=False):
  t=tags(r.other_tags)
  for key in ('amenity','shop','craft'):
   v=getattr(r,key,None)
   if isinstance(v,str) and v:t[key]=v
  cats=[(k,t[k]) for k in ('amenity','shop','craft') if t.get(k) in core or t.get(k) in extra]
  if not cats:continue
  if any(t.get(k) in ('yes','true') for k in ('disused','abandoned','demolished','closed')):continue
  name=r.name or t.get('brand') or t.get('operator') or ''
  if not isinstance(name,str) or not name.strip():continue
  if r.geometry is None or r.geometry.is_empty:continue
  key,cat=next((i for i in cats if i[1] in core),cats[0]);g=r.geometry if layer=='node' else r.geometry.representative_point()
  way=getattr(r,'osm_way_id',None); osm_type='node' if layer=='node' else ('way' if isinstance(way,str) and way else 'relation'); oid=way if osm_type=='way' else r.osm_id
  def val(*ks):return next((t[k].strip() for k in ks if t.get(k,'').strip()),'')
  street=' '.join(x for x in [val('addr:street'),val('addr:housenumber')] if x); addr=val('addr:full') or street or (getattr(r,'address',None) or '')
  rows.append(dict(nombre=name.strip(),categoria=(core|extra)[cat],segmento='Principal' if cat in core else 'Complementario',etiqueta_osm=key+'='+cat,pais='Venezuela',estado=val('addr:state'),municipio=val('addr:municipality'),ciudad=val('addr:city','addr:town','addr:village'),direccion=addr,barrio=val('addr:suburb','addr:neighbourhood'),telefono=val('contact:phone','phone','contact:mobile','mobile'),whatsapp=val('contact:whatsapp','whatsapp'),email=val('contact:email','email'),web=val('contact:website','website','url'),instagram=val('contact:instagram','instagram'),facebook=val('contact:facebook','facebook'),latitud=round(g.y,7),longitud=round(g.x,7),osm_tipo=osm_type,osm_id=str(oid),fuente='OpenStreetMap',fecha_extracto='2026-11-26',url_osm=f'https://www.openstreetmap.org/{osm_type}/{oid}'))
df=pd.DataFrame(rows)
pts=gpd.GeoDataFrame(df,geometry=gpd.points_from_xy(df.longitud,df.latitud),crs='EPSG:4326')
for lvl,col in [('4','estado'),('6','municipio')]:
 b=a[(a['boundary']=='administrative') & (a.admin_level==lvl) & a.name.notna()][['name','geometry']].copy();b.geometry=b.geometry.make_valid();b['area']=b.geometry.area
 j=gpd.sjoin(pts[['geometry']],b,how='left',predicate='intersects').sort_values('area').groupby(level=0).first();matched=j['name'].reindex(df.index).fillna('');df.loc[matched.ne(''),col]=matched[matched.ne('')]
def norm(s):return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',s.lower()).encode('ascii','ignore').decode())
contacts=['telefono','whatsapp','email','web','instagram','facebook']
df['_score']=sum(df[k].ne('').astype(int) for k in contacts);df=df.sort_values('_score',ascending=False,kind='stable');kept=[];buckets=defaultdict(list)
for i,r in df.iterrows():
 k=(norm(r.nombre),r.categoria);dup=None
 for ix in buckets[k]:
  o=df.loc[ix];dist=((r.latitud-o.latitud)**2+((r.longitud-o.longitud)*cos(radians(r.latitud)))**2)**.5*111195
  if dist<=35:dup=ix;break
 if dup is not None:
  for c in contacts+['estado','municipio','ciudad','direccion','barrio']:
   if not df.at[dup,c] and r[c]:df.at[dup,c]=r[c]
 else:kept.append(i);buckets[k].append(i)
df=df.loc[kept].copy();df['contacto_disponible']=df[contacts].ne('').any(axis=1).map({True:'Sí',False:'No'});df['email_formato_valido']=df.email.map(lambda s:'Sí' if re.fullmatch(r'[^\s@;]+@[^\s@;]+\.[^\s@;]+',s) else ('Revisar' if s else ''));df['prioridad']=np.select([(df.segmento=='Principal') & df[['email','telefono','whatsapp']].ne('').any(axis=1),(df.segmento=='Principal') & df.contacto_disponible.eq('Sí'),df.segmento=='Principal',df.contacto_disponible.eq('Sí')],['1 - Principal con contacto directo','2 - Principal con canal digital','3 - Principal sin contacto','4 - Complementario con contacto'],default='5 - Complementario sin contacto');df['estado_verificacion']='Sin verificación externa';df=df.drop(columns='_score').sort_values(['prioridad','estado','municipio','nombre'])
# Reproduce the original CSV serialization before enrichment.
from io import StringIO
x=pd.read_csv(StringIO(df.to_csv(index=False)),dtype=str,keep_default_na=False)
x=x[x.estado.ne('') & x.municipio.ne('')].copy()
ids=set(zip(x.osm_tipo,x.osm_id));found={}
fields={'codigo_postal':['addr:postcode'],'horario':['opening_hours'],'cocina':['cuisine'],'marca':['brand'],'sucursal':['branch'],'operador':['operator'],'twitter':['contact:twitter','twitter','contact:x'],'youtube':['contact:youtube','youtube'],'linkedin':['contact:linkedin','linkedin'],'tiktok':['contact:tiktok','tiktok'],'telegram':['contact:telegram','telegram'],'menu':['website:menu','contact:menu','menu'],'delivery':['delivery'],'takeaway':['takeaway'],'movil':['contact:mobile','mobile'],'fecha_comprobacion_osm':['check_date','check_date:opening_hours'],'telefono_operador':['operator:phone'],'marca_web':['brand:website'],'marca_email':['brand:email'],'descripcion':['description'],'accesibilidad':['wheelchair'],'capacidad':['capacity'],'nombre_alternativo':['alt_name'],'fecha_apertura':['start_date'],'distrito':['addr:district'],'edificio':['addr:housename'],'piso':['addr:floor','level'],'reservas':['reservation'],'desayuno':['breakfast'],'terraza':['outdoor_seating'],'wifi':['internet_access'],'mascotas_permitidas':['pets_allowed'],'servicio_auto':['drive_through'],'forma_pago':[],'monedas':[]}
for l,d in [('points',p),('multipolygons',a)]:
 for r in d.itertuples(index=False):
  w=getattr(r,'osm_way_id',None);typ='node' if l=='points' else ('way' if isinstance(w,str) and w else 'relation');id=w if typ=='way' else r.osm_id
  if (typ,str(id)) not in ids:continue
  t=tags(r.other_tags);row={k:next((t[s].strip() for s in vals if t.get(s,'').strip()),'') for k,vals in fields.items()};row['forma_pago']='; '.join(k.split(':',1)[1]+': '+v for k,v in sorted(t.items()) if k.startswith('payment:') and v);row['monedas']='; '.join(k.split(':',1)[1]+': '+v for k,v in sorted(t.items()) if k.startswith('currency:') and v);found[(typ,str(id))]=row
for k in fields:x[k]=[found.get((typ,id),{}).get(k,'') for typ,id in zip(x.osm_tipo,x.osm_id)]
assert len(x)==13035 and len(ids)==len(x) and len(found)==len(x), "Unexpected number of establishments"
x.to_csv(output,index=False,encoding='utf-8-sig')
print("Prepared 13,035 establishments, no communications sent.")

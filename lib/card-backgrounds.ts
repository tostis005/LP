// Independent background catalog: selecting a background never changes the stamp.
export const CARD_BACKGROUNDS = [
  {
    "id": "atardecer",
    "label": "Atardecer",
    "group": "Ondas",
    "color": "#43204d",
    "url": "/brand/card-designs/gallery-atardecer.svg"
  },
  {
    "id": "oceano",
    "label": "Océano",
    "group": "Ondas",
    "color": "#11375d",
    "url": "/brand/card-designs/gallery-oceano.svg"
  },
  {
    "id": "pitaya",
    "label": "Pitaya",
    "group": "Ondas",
    "color": "#651b54",
    "url": "/brand/card-designs/gallery-pitaya.svg"
  },
  {
    "id": "selva",
    "label": "Selva",
    "group": "Ondas",
    "color": "#123e38",
    "url": "/brand/card-designs/gallery-selva.svg"
  },
  {
    "id": "bauhaus",
    "label": "Bauhaus",
    "group": "Geométricos",
    "color": "#273044",
    "url": "/brand/card-designs/gallery-bauhaus.svg"
  },
  {
    "id": "cobalto",
    "label": "Cobalto",
    "group": "Geométricos",
    "color": "#162b71",
    "url": "/brand/card-designs/gallery-cobalto.svg"
  },
  {
    "id": "terracota",
    "label": "Terracota",
    "group": "Geométricos",
    "color": "#5a302d",
    "url": "/brand/card-designs/gallery-terracota.svg"
  },
  {
    "id": "menta",
    "label": "Menta",
    "group": "Geométricos",
    "color": "#174b4a",
    "url": "/brand/card-designs/gallery-menta.svg"
  },
  {
    "id": "jardin",
    "label": "Jardín",
    "group": "Orgánicos",
    "color": "#264636",
    "url": "/brand/card-designs/gallery-jardin.svg"
  },
  {
    "id": "coral",
    "label": "Coral",
    "group": "Orgánicos",
    "color": "#71384d",
    "url": "/brand/card-designs/gallery-coral.svg"
  },
  {
    "id": "lila",
    "label": "Lila",
    "group": "Orgánicos",
    "color": "#41335e",
    "url": "/brand/card-designs/gallery-lila.svg"
  },
  {
    "id": "arena",
    "label": "Arena",
    "group": "Orgánicos",
    "color": "#564033",
    "url": "/brand/card-designs/gallery-arena.svg"
  },
  {
    "id": "aurora",
    "label": "Aurora",
    "group": "Luz y color",
    "color": "#182c4b",
    "url": "/brand/card-designs/gallery-aurora.svg"
  },
  {
    "id": "neon",
    "label": "Neón",
    "group": "Luz y color",
    "color": "#291d53",
    "url": "/brand/card-designs/gallery-neon.svg"
  },
  {
    "id": "mango",
    "label": "Mango",
    "group": "Luz y color",
    "color": "#603224",
    "url": "/brand/card-designs/gallery-mango.svg"
  },
  {
    "id": "laguna",
    "label": "Laguna",
    "group": "Luz y color",
    "color": "#173c59",
    "url": "/brand/card-designs/gallery-laguna.svg"
  },
  {
    "id": "champagne",
    "label": "Champagne",
    "group": "Elegantes",
    "color": "#34282b",
    "url": "/brand/card-designs/gallery-champagne.svg"
  },
  {
    "id": "esmeralda",
    "label": "Esmeralda",
    "group": "Elegantes",
    "color": "#123d35",
    "url": "/brand/card-designs/gallery-esmeralda.svg"
  },
  {
    "id": "medianoche",
    "label": "Medianoche",
    "group": "Elegantes",
    "color": "#182138",
    "url": "/brand/card-designs/gallery-medianoche.svg"
  },
  {
    "id": "borgona",
    "label": "Borgoña",
    "group": "Elegantes",
    "color": "#461c35",
    "url": "/brand/card-designs/gallery-borgona.svg"
  },
  {
    "id": "disco",
    "label": "Disco",
    "group": "Retro y pop",
    "color": "#45235b",
    "url": "/brand/card-designs/gallery-disco.svg"
  },
  {
    "id": "verano",
    "label": "Verano",
    "group": "Retro y pop",
    "color": "#285065",
    "url": "/brand/card-designs/gallery-verano.svg"
  },
  {
    "id": "terrazzo",
    "label": "Terrazzo",
    "group": "Retro y pop",
    "color": "#47404d",
    "url": "/brand/card-designs/gallery-terrazzo.svg"
  },
  {
    "id": "confeti",
    "label": "Confeti",
    "group": "Retro y pop",
    "color": "#34305d",
    "url": "/brand/card-designs/gallery-confeti.svg"
  },
  {
    "id": "coffee",
    "label": "Café de especialidad",
    "group": "Temáticos",
    "color": "#573325",
    "url": "/brand/card-designs/coffee.svg"
  },
  {
    "id": "icecream",
    "label": "Heladería artesanal",
    "group": "Temáticos",
    "color": "#a54b69",
    "url": "/brand/card-designs/icecream.svg"
  }
] as const;
export const CARD_BACKGROUND_GROUPS=["Todos",...new Set(CARD_BACKGROUNDS.map(d=>d.group))];

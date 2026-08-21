# backend

PocketBase instance. Verzovaná je jen `pb_migrations/` — `pb_data/`, binárka
i zbundlovaný `pb_hooks/engine.js` jsou v `.gitignore`.

## Migrace

`1787270400_init_schema.js` zakládá všech 11 kolekcí. Pořadí uvnitř migrace je
dané závislostmi relací — relační pole potřebuje `collectionId` cíle, takže cíl
musí existovat dřív.

Jedna výjimka: `slots.source_fixture` → `fixtures` a `fixtures.home_slot` →
`slots` tvoří cyklus. Řeší se dvoufázově — `slots` vznikne bez `source_fixture`,
po `fixtures` se pole doplní přes `collection.fields.add(new RelationField(...))`.

## Zálohy

Zapni automatické zálohy do S3 v admin UI hned první den, ne až po prvním
turnaji. SQLite je jeden soubor a jeden stroj.

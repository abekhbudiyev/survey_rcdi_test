# RCDI KID Modern

Bu loyiha eski `Опросник RCDI KID` ilovasining zamonaviy web varianti.

## Nima bor

- Bolalar ro'yxati (qo'shish/tahrirlash/qidirish)
- KID va CDI testini o'tkazish
- 0/1/2/3 javoblar bilan navigatsiya (klaviatura ham ishlaydi)
- Domen bo'yicha avtomatik hisob-kitob
- KID uchun to'liq shkala va sigma
- Natijalarni `localStorage`da saqlash
- JSON eksport
- Eski `kids.mdb`dan eksport qilingan ma'lumotlardan dastlabki migratsiya

## Ishga tushirish

1. Terminalda loyihaga kiring:

```powershell
cd C:\Test
```

2. Lokal server ishga tushiring:

```powershell
python -m http.server 4173
```

3. Brauzerda oching:

- [http://localhost:4173](http://localhost:4173)

## Eslatma

- Ilova statik web ko'rinishida yozilgan.
- Ma'lumotlar brauzer ichida saqlanadi (`localStorage`).
- `data/` papkasidagi JSONlar `rus.mdb` va `kids.mdb`dan olingan.

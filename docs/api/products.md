# GET /api/products

Lists product scores and performance metrics for the selected date range.

## Query params
- `range` (optional): `7d | 14d | 30d | 90d` (default `30d`)
- `start` (optional): `YYYY-MM-DD` (use with `end` for custom range)
- `end` (optional): `YYYY-MM-DD` (use with `start` for custom range)
- `limit` (optional): 1-100 (default 20)
- `cursorId` (optional): last item id from previous response (cursor pagination)
- `sortBy` (optional): `score | roas | ctr | margin | velocity | spend | revenue | title`
- `sortDir` (optional): `asc | desc` (default `desc`)
- `q` (optional): search by title or SKU
- `category` (optional): `SCALE | TEST | KILL | RISK`
- `metaCurrency` (optional): ISO code from Meta Ads account
- `storeCurrency` (optional): ISO code from Shopify/WooCommerce

## Currency priority
1. `metaCurrency`
2. `storeCurrency`
3. `USD`

## Example
```http
GET /api/products?range=30d&sortBy=roas&sortDir=desc&limit=20&cursorId=prod_2&metaCurrency=USD&storeCurrency=NGN
```

## Response shape
```json
{
  "updatedAt": "2026-02-16T10:34:00.000Z",
  "currency": "USD",
  "currencySource": "meta_ads",
  "range": "30d",
  "start": "2026-01-18",
  "end": "2026-02-16",
  "sortBy": "roas",
  "sortDir": "desc",
  "limit": 20,
  "cursorId": "prod_2",
  "nextCursorId": "prod_5",
  "total": 1200,
  "products": [
    {
      "id": "prod_1",
      "title": "Aurora Throw Pillow",
      "sku": "MF-1021",
      "score": 91,
      "roas": 8.4,
      "ctr": 3.1,
      "margin": 42,
      "velocity": 6.2,
      "category": "SCALE",
      "spend": 1240,
      "revenue": 10416,
      "imageUrl": "https://...",
      "productUrl": "https://..."
    }
  ]
}
```

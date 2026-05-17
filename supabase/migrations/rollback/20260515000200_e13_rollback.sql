-- Rollback for 20260515000200_e13_seed_universe.sql (THS-37).
-- Deletes only the seeded tickers; preserves any names added later by hand.

BEGIN;

DELETE FROM public.universe WHERE ticker IN (
  'NVDA','AVGO','AMD','TSM','ASML','AMAT','LRCX','KLAC','MRVL','ARM','SNPS','CDNS','MU',
  'MSFT','GOOGL','AMZN','META','ORCL','IBM','CRM',
  'PLTR','SNOW','ANET','CRWD','S','DDOG','MDB','NET','ESTC','AI',
  'VST','CEG','GEV','ETR','NRG','TLN','NEE','AES','ETN','PWR','BE','EQIX','DLR','VRT',
  'ADBE','NOW','INTU','WDAY','ZS','SAP'
);

COMMIT;

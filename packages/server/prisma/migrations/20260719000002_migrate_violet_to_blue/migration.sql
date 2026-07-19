UPDATE "Round" SET "poolBlue" = "poolViolet";
UPDATE "Bet" SET "color" = 'BLUE' WHERE "color" = 'VIOLET';
UPDATE "Round" SET "result" = 'BLUE' WHERE "result" = 'VIOLET';

ALTER TABLE "Round" DROP COLUMN "poolViolet";

CREATE TYPE "Color_new" AS ENUM ('RED', 'BLUE', 'GREEN');
ALTER TABLE "Round" ALTER COLUMN "result" TYPE "Color_new" USING ("result"::text::"Color_new");
ALTER TABLE "Bet" ALTER COLUMN "color" TYPE "Color_new" USING ("color"::text::"Color_new");
DROP TYPE "Color";
ALTER TYPE "Color_new" RENAME TO "Color";

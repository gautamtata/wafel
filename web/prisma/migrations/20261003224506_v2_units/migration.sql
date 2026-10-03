-- CreateEnum
CREATE TYPE "Dialect" AS ENUM ('MX', 'ES', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'MASTERED');

-- CreateEnum
CREATE TYPE "TargetKind" AS ENUM ('WORD', 'PATTERN');

-- AlterTable
ALTER TABLE "Learner" ADD COLUMN     "dialect" "Dialect" NOT NULL DEFAULT 'MX';

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "unitId" TEXT;

-- AlterTable
ALTER TABLE "VocabItem" ADD COLUMN     "unitId" TEXT;

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "dialect" "Dialect" NOT NULL,
    "level" "Cefr" NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "canDo" TEXT NOT NULL,
    "pattern" JSONB NOT NULL,
    "targetWords" JSONB NOT NULL,
    "modelSentences" JSONB NOT NULL,
    "scenarioHint" TEXT,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitProgress" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "status" "UnitStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "wordScores" JSONB NOT NULL,
    "patternScore" INTEGER NOT NULL DEFAULT 0,
    "sessionsCount" INTEGER NOT NULL DEFAULT 0,
    "masteredAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Unit_language_dialect_level_order_key" ON "Unit"("language", "dialect", "level", "order");

-- CreateIndex
CREATE UNIQUE INDEX "UnitProgress_learnerId_unitId_key" ON "UnitProgress"("learnerId", "unitId");

-- AddForeignKey
ALTER TABLE "UnitProgress" ADD CONSTRAINT "UnitProgress_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitProgress" ADD CONSTRAINT "UnitProgress_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

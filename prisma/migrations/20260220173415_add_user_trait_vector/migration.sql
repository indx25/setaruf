-- AlterTable
ALTER TABLE "User" ADD COLUMN     "traitUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "traitVector" JSONB,
ADD COLUMN     "traitVersion" INTEGER;

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "compatibilityScore" DOUBLE PRECISION,
ADD COLUMN     "conflictRiskScore" DOUBLE PRECISION,
ADD COLUMN     "emotionalStabilityScore" DOUBLE PRECISION,
ADD COLUMN     "lifeAlignmentScore" DOUBLE PRECISION;

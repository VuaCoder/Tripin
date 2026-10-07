-- CreateTable
CREATE TABLE "CartItem" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tourId" UUID NOT NULL,
    "departureId" UUID NOT NULL,
    "participants" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CartItem_userId_createdAt_id_idx" ON "CartItem"("userId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_userId_departureId_key" ON "CartItem"("userId", "departureId");

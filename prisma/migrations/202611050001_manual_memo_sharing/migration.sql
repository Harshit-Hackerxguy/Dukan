-- Preserve historical orders, PDFs and delivery records while retiring the API.
-- Stop all old delivery workers before applying this migration and deploying.
ALTER TABLE "CashMemo" ALTER COLUMN "recipientPhone" DROP NOT NULL;
ALTER TABLE "CashMemo" ALTER COLUMN "deliveryStatus" DROP NOT NULL;
ALTER TABLE "CashMemo" ALTER COLUMN "deliveryStatus" DROP DEFAULT;
ALTER TABLE "StoreSettings" ALTER COLUMN "whatsappRecipient" DROP NOT NULL;

-- Prevent pending automatic sends from surviving the switch to manual sharing.
UPDATE "OutboxJob"
SET "status" = 'FAILED', "lockedAt" = NULL,
    "lastError" = 'Automatic WhatsApp delivery retired; share the memo manually',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "status" IN ('PENDING', 'RUNNING');

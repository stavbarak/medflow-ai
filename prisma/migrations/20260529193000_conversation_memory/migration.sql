-- Short-term per-sender conversation memory for WhatsApp follow-ups (ephemeral, pruned aggressively).
CREATE TABLE "ConversationTurn" (
    "id" TEXT NOT NULL,
    "senderWaId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationTurn_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConversationTurn_senderWaId_createdAt_idx" ON "ConversationTurn"("senderWaId", "createdAt");

-- A destructive action (e.g. cancel) awaiting the sender's confirmation. One per sender.
CREATE TABLE "PendingAction" (
    "id" TEXT NOT NULL,
    "senderWaId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingAction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PendingAction_senderWaId_key" ON "PendingAction"("senderWaId");

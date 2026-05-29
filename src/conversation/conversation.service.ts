import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

export type ConversationRole = 'user' | 'assistant';

export type ConversationTurnDto = {
  role: ConversationRole;
  text: string;
};

export type PendingActionDto = {
  kind: 'cancel';
  appointmentId: string;
  summary: string;
};

/** Defaults tuned for a small family bot: short-lived working memory, bounded per sender. */
const DEFAULT_TURN_TTL_MINUTES = 60;
const DEFAULT_TURN_LIMIT = 20;
const DEFAULT_PENDING_TTL_MINUTES = 5;

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Recent turns for a sender within the TTL, oldest-first, capped to `limit`. */
  async getRecentTurns(
    senderWaId: string,
    opts?: { ttlMinutes?: number; limit?: number },
  ): Promise<ConversationTurnDto[]> {
    const ttlMinutes = opts?.ttlMinutes ?? DEFAULT_TURN_TTL_MINUTES;
    const limit = opts?.limit ?? 6;
    const cutoff = new Date(Date.now() - ttlMinutes * 60 * 1000);
    const rows = await this.prisma.conversationTurn.findMany({
      where: { senderWaId, createdAt: { gte: cutoff } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows
      .reverse()
      .map((r) => ({ role: r.role as ConversationRole, text: r.text }));
  }

  /** Append a turn, then prune this sender's history (TTL + keep last N). */
  async appendTurn(
    senderWaId: string,
    role: ConversationRole,
    text: string,
  ): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    await this.prisma.conversationTurn.create({
      data: { senderWaId, role, text: trimmed },
    });
    await this.pruneSender(senderWaId);
  }

  private async pruneSender(senderWaId: string): Promise<void> {
    const cutoff = new Date(Date.now() - DEFAULT_TURN_TTL_MINUTES * 60 * 1000);
    await this.prisma.conversationTurn.deleteMany({
      where: { senderWaId, createdAt: { lt: cutoff } },
    });
    const stale = await this.prisma.conversationTurn.findMany({
      where: { senderWaId },
      orderBy: { createdAt: 'desc' },
      skip: DEFAULT_TURN_LIMIT,
      select: { id: true },
    });
    if (stale.length > 0) {
      await this.prisma.conversationTurn.deleteMany({
        where: { id: { in: stale.map((s) => s.id) } },
      });
    }
  }

  async setPendingAction(
    senderWaId: string,
    action: PendingActionDto,
    ttlMinutes = DEFAULT_PENDING_TTL_MINUTES,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    await this.prisma.pendingAction.upsert({
      where: { senderWaId },
      create: {
        senderWaId,
        kind: action.kind,
        appointmentId: action.appointmentId,
        summary: action.summary,
        expiresAt,
      },
      update: {
        kind: action.kind,
        appointmentId: action.appointmentId,
        summary: action.summary,
        expiresAt,
        createdAt: new Date(),
      },
    });
  }

  /** Return + clear an unexpired pending action for this sender, or null. */
  async consumePendingAction(
    senderWaId: string,
  ): Promise<PendingActionDto | null> {
    const row = await this.prisma.pendingAction.findUnique({
      where: { senderWaId },
    });
    if (!row) {
      return null;
    }
    await this.prisma.pendingAction.delete({ where: { senderWaId } });
    if (row.expiresAt.getTime() < Date.now()) {
      return null;
    }
    return {
      kind: row.kind as 'cancel',
      appointmentId: row.appointmentId,
      summary: row.summary,
    };
  }

  async clearPendingAction(senderWaId: string): Promise<void> {
    await this.prisma.pendingAction
      .delete({ where: { senderWaId } })
      .catch(() => undefined);
  }

  /** Belt-and-suspenders daily cleanup for anything prune-on-write missed. */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async sweepOldData(): Promise<void> {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const turns = await this.prisma.conversationTurn.deleteMany({
      where: { createdAt: { lt: dayAgo } },
    });
    const pending = await this.prisma.pendingAction.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    if (turns.count || pending.count) {
      this.logger.debug(
        `Conversation sweep: removed ${turns.count} turns, ${pending.count} pending actions`,
      );
    }
  }
}

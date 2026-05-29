import { Test, TestingModule } from '@nestjs/testing';
import { ConversationService } from './conversation.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ConversationService', () => {
  let service: ConversationService;

  const conversationTurn = {
    create: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  };
  const pendingAction = {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  };

  const prismaMock = { conversationTurn, pendingAction };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(ConversationService);
    jest.clearAllMocks();
    conversationTurn.findMany.mockResolvedValue([]);
    conversationTurn.deleteMany.mockResolvedValue({ count: 0 });
  });

  it('returns recent turns oldest-first', async () => {
    conversationTurn.findMany.mockResolvedValueOnce([
      { role: 'assistant', text: 'ב2', createdAt: new Date(2) },
      { role: 'user', text: 'ב1', createdAt: new Date(1) },
    ]);
    const turns = await service.getRecentTurns('972500000000');
    expect(turns).toEqual([
      { role: 'user', text: 'ב1' },
      { role: 'assistant', text: 'ב2' },
    ]);
  });

  it('appends a turn then prunes the sender history', async () => {
    conversationTurn.create.mockResolvedValue({});
    await service.appendTurn('972500000000', 'user', 'שלום');
    expect(conversationTurn.create).toHaveBeenCalledWith({
      data: { senderWaId: '972500000000', role: 'user', text: 'שלום' },
    });
    // prune: delete-older-than-ttl + skip-last-N lookup
    expect(conversationTurn.deleteMany).toHaveBeenCalled();
    expect(conversationTurn.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20 }),
    );
  });

  it('does not store empty turns', async () => {
    await service.appendTurn('972500000000', 'user', '   ');
    expect(conversationTurn.create).not.toHaveBeenCalled();
  });

  it('consumes an unexpired pending action and clears it', async () => {
    pendingAction.findUnique.mockResolvedValue({
      senderWaId: '972500000000',
      kind: 'cancel',
      appointmentId: 'ap1',
      summary: 'אונקולוג',
      expiresAt: new Date(Date.now() + 60_000),
    });
    pendingAction.delete.mockResolvedValue({});
    const action = await service.consumePendingAction('972500000000');
    expect(action).toEqual({
      kind: 'cancel',
      appointmentId: 'ap1',
      summary: 'אונקולוג',
    });
    expect(pendingAction.delete).toHaveBeenCalled();
  });

  it('discards an expired pending action', async () => {
    pendingAction.findUnique.mockResolvedValue({
      senderWaId: '972500000000',
      kind: 'cancel',
      appointmentId: 'ap1',
      summary: '',
      expiresAt: new Date(Date.now() - 60_000),
    });
    pendingAction.delete.mockResolvedValue({});
    const action = await service.consumePendingAction('972500000000');
    expect(action).toBeNull();
  });
});

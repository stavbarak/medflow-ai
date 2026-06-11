import { WhatsappService } from './whatsapp.service';

/**
 * Focused tests for the wake-word gating, cancel-confirmation guard, and conversation
 * memory wiring. External I/O (sending) is stubbed via safeSend.
 */
describe('WhatsappService dispatch', () => {
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const ai = {};
  const appointments = {
    remove: jest.fn(),
    findOnCalendarDay: jest.fn(),
    findAll: jest.fn(),
  };
  const requirements = {};
  const query = {
    answerWakeWord: jest.fn().mockResolvedValue('תשובה'),
    formatFactsDumpHebrew: jest.fn().mockResolvedValue('רשימה'),
    buildUpcomingFactsPayload: jest.fn().mockResolvedValue({}),
  };
  const familyMembers = {
    isAllowed: jest.fn().mockResolvedValue(true),
    findByPhone: jest
      .fn()
      .mockResolvedValue({ displayName: 'שירי', gender: 'female' }),
  };
  const familyPersonas = { getPersonas: jest.fn().mockResolvedValue([]) };
  const conversation = {
    consumePendingAction: jest.fn().mockResolvedValue(null),
    getRecentTurns: jest.fn().mockResolvedValue([]),
    appendTurn: jest.fn().mockResolvedValue(undefined),
    setPendingAction: jest.fn().mockResolvedValue(undefined),
  };
  const contacts = {
    findByName: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
  };

  let service: WhatsappService;
  let sent: string[];

  beforeEach(() => {
    jest.clearAllMocks();
    conversation.consumePendingAction.mockResolvedValue(null);
    service = new WhatsappService(
      config as any,
      ai as any,
      appointments as any,
      requirements as any,
      query as any,
      familyMembers as any,
      familyPersonas as any,
      conversation as any,
      contacts as any,
    );
    sent = [];
    jest
      .spyOn(service as any, 'safeSend')
      .mockImplementation(async (_t: any, msg: any) => {
        sent.push(msg as string);
      });
  });

  const dispatch = (msg: {
    text: string;
    senderWaId: string;
    replyTo: any;
  }) => (service as any).dispatchMessage(msg);

  it('ignores group messages without the wake word', async () => {
    await dispatch({
      text: 'מה שלומך',
      senderWaId: '972500000000',
      replyTo: { type: 'group', groupId: 'g1' },
    });
    expect(sent).toHaveLength(0);
    expect(query.answerWakeWord).not.toHaveBeenCalled();
  });

  it('answers 1:1 messages without a wake word', async () => {
    await dispatch({
      text: 'מתי התור הבא?',
      senderWaId: '972500000000',
      replyTo: { type: 'individual', phone: '972500000000' },
    });
    expect(query.answerWakeWord).toHaveBeenCalledTimes(1);
    expect(sent).toEqual(['תשובה']);
    // user + assistant turns recorded
    expect(conversation.appendTurn).toHaveBeenCalledTimes(2);
  });

  it('asks for confirmation before cancelling in a DM (no wake word)', async () => {
    appointments.findAll.mockResolvedValue([
      {
        id: 'ap1',
        title: 'אונקולוג',
        location: '',
        notes: '',
        transportNotes: '',
        createdAt: new Date(),
        dateTime: new Date('2026-08-05T09:00:00.000Z'),
      },
    ]);
    await dispatch({
      text: 'תבטל את האונקולוג',
      senderWaId: '972500000000',
      replyTo: { type: 'individual', phone: '972500000000' },
    });
    expect(appointments.remove).not.toHaveBeenCalled();
    expect(conversation.setPendingAction).toHaveBeenCalledWith(
      '972500000000',
      expect.objectContaining({ kind: 'cancel', appointmentId: 'ap1' }),
    );
    expect(sent[0]).toContain('האם לבטל');
    expect(sent[0]).toContain('שירי,');
  });

  it('saves a useful number from a DM message', async () => {
    await dispatch({
      text: 'תשמור את המספר של ד"ר לוי: 03-1234567',
      senderWaId: '972500000000',
      replyTo: { type: 'individual', phone: '972500000000' },
    });
    expect(contacts.create).toHaveBeenCalledWith({
      name: 'ד"ר לוי',
      value: '03-1234567',
    });
    expect(sent[0]).toContain('שמרתי את המספר');
  });

  it('updates an existing contact instead of duplicating it', async () => {
    contacts.findByName.mockResolvedValue({ id: 'c1', name: 'ד"ר לוי' });
    await dispatch({
      text: 'תשמור את המספר של ד"ר לוי: 03-7654321',
      senderWaId: '972500000000',
      replyTo: { type: 'individual', phone: '972500000000' },
    });
    expect(contacts.update).toHaveBeenCalledWith('c1', {
      value: '03-7654321',
    });
    expect(contacts.create).not.toHaveBeenCalled();
    expect(sent[0]).toContain('עדכנתי את המספר');
  });

  it('executes the pending cancel after an affirmation', async () => {
    conversation.consumePendingAction.mockResolvedValue({
      kind: 'cancel',
      appointmentId: 'ap1',
      summary: 'אונקולוג',
    });
    appointments.remove.mockResolvedValue({
      id: 'ap1',
      title: 'אונקולוג',
      dateTime: new Date('2026-08-05T09:00:00.000Z'),
    });
    await dispatch({
      text: 'כן',
      senderWaId: '972500000000',
      replyTo: { type: 'individual', phone: '972500000000' },
    });
    expect(appointments.remove).toHaveBeenCalledWith('ap1');
    expect(sent[0]).toContain('ביטלתי');
  });
});

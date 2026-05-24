import { extractInboundWhatsappMessages } from './whatsapp-inbound';

describe('extractInboundWhatsappMessages', () => {
  it('parses group messages with group_id', () => {
    const messages = extractInboundWhatsappMessages({
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: '972521234567',
                    group_id: 'Y2FwaV9ncm91cDoxMjM',
                    type: 'text',
                    text: { body: 'חנטריש מה התורים?' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(messages).toHaveLength(1);
    expect(messages[0].replyTo).toEqual({
      type: 'group',
      groupId: 'Y2FwaV9ncm91cDoxMjM',
    });
    expect(messages[0].senderWaId).toBe('972521234567');
  });

  it('parses 1:1 messages without group_id', () => {
    const messages = extractInboundWhatsappMessages({
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: '972529876543',
                    type: 'text',
                    text: { body: 'חנטריש' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(messages[0].replyTo).toEqual({
      type: 'individual',
      phone: '972529876543',
    });
  });
});

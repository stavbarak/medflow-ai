import {
  extractGroupWebhookEvents,
  formatGroupWebhookEvent,
} from './whatsapp-group-webhook';

describe('extractGroupWebhookEvents', () => {
  it('parses group_create with invite_link', () => {
    const events = extractGroupWebhookEvents({
      entry: [
        {
          changes: [
            {
              field: 'group_lifecycle_update',
              value: {
                groups: [
                  {
                    type: 'group_create',
                    group_id: 'Y2FwaV9ncm91cDoxMjM',
                    subject: 'חנטריש תורים',
                    invite_link: 'https://chat.whatsapp.com/AbCdEf',
                    request_id: 'req-1',
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'group_create',
      groupId: 'Y2FwaV9ncm91cDoxMjM',
      inviteLink: 'https://chat.whatsapp.com/AbCdEf',
    });
    expect(formatGroupWebhookEvent(events[0])).toContain('invite_link=');
  });
});

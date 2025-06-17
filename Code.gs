function declineEventsWithoutAttachments() {
  const calendarId = "primary";
  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

  const events = Calendar.Events.list(calendarId, {
    timeMin: now.toISOString(),
    timeMax: oneHourLater.toISOString(),
    singleEvents: true,
    maxResults: 50,
    orderBy: "startTime"
  });

  if (!events.items || events.items.length === 0) {
    Logger.log("No events found.");
    return;
  }

  for (const event of events.items) {
    try {
      const hasAttachments = event.attachments && event.attachments.length > 0;

      const attendees = event.attendees || [];
      const self = attendees.find(a => a.self);

      if (!hasAttachments && self && self.responseStatus !== "declined") {
        Logger.log(`Declining event: "${event.summary}"`);

        Calendar.Events.patch({
          attendees: [{
            email: self.email,
            responseStatus: "declined"
          }]
        }, calendarId, event.id);

        // Notify the organizer (if different from self)
        if (event.organizer && event.organizer.email !== self.email) {
          GmailApp.sendEmail(event.organizer.email,
            `Declined: ${event.summary}`,
            `Hi,\n\nI'm declining the event "${event.summary}" scheduled at ${event.start.dateTime || event.start.date} because it has no attachments.\n\nRegards,\nAshutosh Auto-Calendar Assistant`);
        }
      }

    } catch (e) {
      Logger.log(`Failed to process event "${event.summary}": ${e}`);
    }
  }
}
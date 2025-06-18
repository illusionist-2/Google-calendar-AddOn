function declineEventsWithoutAttachments() {
  const calendarId = "primary";
  const orgDomains = ["wiom.in", "i2e1.com"]; // <-- Replace with your domain
  const excludeKeywords = ["lunch", "dinner", "1:1", "1 on 1", "one on one", "townhall"];
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
      const title = (event.summary || "").toLowerCase();

      // ❌ Skip if title contains excluded keyword
      if (excludeKeywords.some(keyword => title.includes(keyword))) {
        Logger.log(`Skipping "${event.summary}" due to keyword.`);
        continue;
      }

      const attendees = event.attendees || [];
      const self = attendees.find(a => a.self);

      // ❌ Skip if no self invite or already declined
      if (!self || self.responseStatus === "declined") continue;

      // ❌ Skip if fewer than 3 participants
      if (attendees.length < 3) {
        Logger.log(`Skipping "${event.summary}" due to only ${attendees.length} participant(s).`);
        continue;
      }

      const organizerEmail = event.organizer?.email || "";
      let isInternalOrganizer = false;
      for(let i=0;i<orgDomains.length;++i){
        isInternalOrganizer = organizerEmail.endsWith("@" + orgDomains[i]);

        if(isInternalOrganizer)
          break;
      }

      // Only act on events from internal organizers
      if (!isInternalOrganizer) continue;

      const hasAttachments = (event.attachments || []).length > 0;
      const hasDescription = (event.description || "").trim().length > 0;

      // Decline if no attachments AND no description
      if (!hasAttachments && !hasDescription) {

        Logger.log(`Declining event: "${event.summary}"`);

        // Decline event
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
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
      const isInternalOrganizer = orgDomains.some(domain => organizerEmail.endsWith("@" + domain));

      // ❌ Skip if organizer is external
      if (!isInternalOrganizer) {
        Logger.log(`Skipping "${event.summary}" due to external organizer: ${organizerEmail}`);
        continue;
      }

      // ✅ Check event duration (ignore if ≤ 15 minutes)
      const start = new Date(event.start.dateTime || event.start.date);
      const end = new Date(event.end.dateTime || event.end.date);
      const durationMinutes = (end - start) / (1000 * 60);
      if (durationMinutes <= 15) {
        Logger.log(`Skipping "${event.summary}" due to short duration: ${durationMinutes} minutes.`);
        continue;
      }

      const hasAttachments = (event.attachments || []).length > 0;
      const hasDescription = (event.description || "").replace(/<[^>]*>/g, "").trim().length > 0;

      // Decline if no attachments AND no description
      if (!hasAttachments && !hasDescription) {
        

        // Notify organizer
        if (organizerEmail !== self.email) {

          Logger.log(`Declining "${event.summary}" due to no attachments or description.`);

          // Decline
          Calendar.Events.patch({
            attendees: [{
              email: self.email,
              responseStatus: "declined"
            }]
          }, calendarId, event.id);

          const assistantName = `${getFirstNameFromEmail()}'s Assistant`;
          GmailApp.sendEmail(
            organizerEmail,
            `Declined: ${event.summary}`,
            `Hi,\n\nI'm declining the event "${event.summary}" because it has no description or pre-read attached.\nPlease attach a pre-read and resend the invite if needed.\n\nRegards,\n${assistantName}`
          );
        }
      }

    } catch (e) {
      Logger.log(`Error processing "${event.summary}": ${e.message}`);
    }
    Utilities.sleep(500);
  }
}

function getFirstNameFromEmail() {
  const email = Session.getActiveUser().getEmail();
  const localPart = email.split('@')[0];
  const firstName = localPart.split('.')[0];
  return capitalize(firstName);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
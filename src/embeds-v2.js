const {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    LabelBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    ModalBuilder,
    MessageFlags,
    SeparatorBuilder,
    TextDisplayBuilder,
    TextInputBuilder,
    TextInputStyle
} = require("discord.js");
const path = require("node:path");
const config = require("./config");

const season = Object.freeze({
    pumpkin: 0xC67537,
    forest: 0x68764B,
    harvest: 0xC09A48,
    berry: 0x844553,
    midnight: 0x4B4058
});

function formatDuration(durationMs) {
    const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

function serverInfoBlock() {
    return [
        `**Server:** ${config.serverName}`,
        `**Mode:** ${config.serverMode}`,
        `**In-game code:** ${config.inGameCode}`,
        `**Server owner:** ${config.serverOwner}`,
        `**Session ID:** ${config.sessionId}`
    ].join("\n");
}

function createButton(customId, label, style, emoji) {
    const button = new ButtonBuilder()
        .setCustomId(customId)
        .setLabel(label)
        .setStyle(style);
    if (emoji) button.setEmoji(emoji);
    return button;
}

function createSupportButton() {
    return createButton("ticket:create", "Submit a request", ButtonStyle.Primary);
}

function createTicketCloseButton() {
    return createButton("ticket:close", "Resolve ticket", ButtonStyle.Secondary, "🍁");
}

function createTicketClaimButton(claimedById = null) {
    const button = createButton(
        "ticket:claim",
        claimedById ? "Ticket claimed" : "Claim ticket",
        claimedById ? ButtonStyle.Secondary : ButtonStyle.Primary,
        null
    );
    if (claimedById) button.setDisabled(true);
    return button;
}

function createSessionButtons() {
    return [
        new ButtonBuilder()
            .setLabel("Enter server")
            .setEmoji("🎃")
            .setStyle(ButtonStyle.Link)
            .setURL(config.joinServerUrl),
        createButton("session:toggle-notifications", "Session alerts", ButtonStyle.Secondary, "🔔")
    ];
}

function createPanel(title, description, options = {}) {
    const {
        accentColor = config.embedColor,
        eyebrow = `🍂 AUTUMN EDITION • ${config.brandName.toUpperCase()}`,
        sections = [],
        footer = null,
        timestamp = null,
        buttons = [],
        allowedMentions = { parse: [] },
        seasonal = true,
        leadMedia = null,
        bottomMedia = null,
        files = []
    } = options;
    const seasonalEyebrow = eyebrow && /^(🍂|🍁|🎃|🌒|🕯️|🗝️)/u.test(eyebrow)
        ? eyebrow
        : `🍂 ${eyebrow}`;
    const displayEyebrow = seasonal ? seasonalEyebrow : eyebrow;
    const header = [displayEyebrow ? `-# ${displayEyebrow}` : null, `# ${title}`, description]
        .filter(Boolean)
        .join("\n");
    const container = new ContainerBuilder()
        .setAccentColor(accentColor)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(header));

    if (leadMedia) {
        container.addMediaGalleryComponents(leadMedia);
    }

    sections.forEach((section, index) => {
        if (index > 0 || (index === 0 && leadMedia)) {
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        }
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${section.title}\n${section.content}`)
        );
    });

    if (buttons.length > 0) {
        container
            .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
            .addActionRowComponents(new ActionRowBuilder().addComponents(...buttons));
    }

    if (footer || timestamp) {
        const footerParts = [footer ? `${seasonal ? "🍁 " : ""}${footer}` : null, timestamp ? `<t:${Math.floor(timestamp / 1000)}:f>` : null]
            .filter(Boolean);
        container
            .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`-# ${footerParts.join(" • ")}`)
            );
    }

    if (bottomMedia) {
        container
            .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
            .addMediaGalleryComponents(bottomMedia);
    }

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container],
        allowedMentions,
        ...(files.length ? { files } : {})
    };
}

function createSupportPanelPayload() {
    const boardImage = new AttachmentBuilder(
        path.join(__dirname, "..", "assets", "image-1791494487631.png"),
        { name: "support-board.png" }
    );
    const bannerImage = new AttachmentBuilder(
        path.join(__dirname, "..", "assets", "image-1791494438170.png"),
        { name: "support-banner.png" }
    );

    return createPanel(
        "Contact Support",
        "Submit a request and our support team will follow up with you in a private channel.",
        {
            eyebrow: "SUPPORT CENTER",
            accentColor: season.forest,
            sections: [
                {
                    title: "Before you submit",
                    content: "Choose a clear subject and describe the issue with the relevant details. You can attach screenshots in your ticket."
                },
                {
                    title: "Privacy",
                    content: "Your request is visible only to you and support staff. Do not include passwords or other sensitive account information. A transcript is saved when the ticket closes."
                }
            ],
            buttons: [createSupportButton()],
            seasonal: false,
            leadMedia: new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL("attachment://support-board.png")
            ),
            bottomMedia: new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL("attachment://support-banner.png")
            ),
            files: [boardImage, bannerImage]
        }
    );
}

function createTicketWelcomePayload(userId, claimedById = null) {
    return createPanel(
        "Request received",
        `<@${userId}> <@&${config.ticketStaffRoleId}>\nYour request is in the support queue. A team member will respond here.`,
        {
            eyebrow: "SUPPORT TICKET",
            accentColor: season.forest,
            sections: [{
                title: "Next steps",
                content: "Keep any follow-up information in this channel. When the issue is resolved, use Close ticket to save the transcript and close the request."
            }],
            footer: "Private support",
            buttons: [createTicketClaimButton(claimedById), createTicketCloseButton()],
            allowedMentions: { users: [userId], roles: [config.ticketStaffRoleId] },
            seasonal: false
        }
    );
}

function createTicketRequestPayload(subject, details) {
    return createPanel(
        "Submitted request",
        "The following information was provided when this ticket was opened.",
        {
            eyebrow: "REQUEST DETAILS",
            accentColor: season.midnight,
            sections: [
                { title: "Subject", content: subject },
                { title: "Description", content: details }
            ],
            footer: "Submitted through the support form",
            seasonal: false
        }
    );
}

function createTicketIntakeModal() {
    const subjectInput = new TextInputBuilder()
        .setCustomId("ticket:subject")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("A brief summary of your request")
        .setMinLength(5)
        .setMaxLength(100)
        .setRequired(true);
    const detailsInput = new TextInputBuilder()
        .setCustomId("ticket:details")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Explain what happened and include any relevant context")
        .setMinLength(20)
        .setMaxLength(1000)
        .setRequired(true);

    return new ModalBuilder()
        .setCustomId("ticket:submit")
        .setTitle("Submit a support request")
        .addLabelComponents(
            new LabelBuilder()
                .setLabel("Subject")
                .setTextInputComponent(subjectInput),
            new LabelBuilder()
                .setLabel("Request details")
                .setTextInputComponent(detailsInput)
        );
}

function createTicketClaimGreetingPayload(ownerId, claimedById) {
    return createPanel(
        "Your request is being handled",
        `*Hello <@${ownerId}>, I have reviewed your request and will assist you here. Please add any relevant information in this channel.*\n\n*Kind regards,*\n*<@${claimedById}>*`,
        {
            eyebrow: "SUPPORT • ASSIGNED",
            accentColor: season.forest,
            allowedMentions: { users: [...new Set([ownerId, claimedById])] },
            seasonal: false
        }
    );
}

function createTicketTranscriptPayload(channel, ownerId, closedById, transcript, transcriptName) {
    const payload = createPanel(
        "Case closed",
        `**#${channel.name}**\nOpened by <@${ownerId}> · closed by <@${closedById}>.`,
        {
            eyebrow: "🗝️ THE ARCHIVE",
            accentColor: season.midnight,
            sections: [{
                title: "Transcript",
                content: `Conversation history attached as \`${transcriptName}\`.`
            }],
            footer: config.brandName,
            timestamp: Date.now(),
            allowedMentions: { parse: [] }
        }
    );
    payload.files = [new AttachmentBuilder(transcript, { name: transcriptName })];
    return payload;
}

function createPunishmentPayload(infraction, changedBy = null) {
    const changed = Boolean(changedBy || infraction.updatedBy);
    return createPanel(
        changed ? "Record amended" : "Official notice",
        `Action recorded for <@${infraction.memberId}>.`,
        {
            eyebrow: "🌒 NIGHT WATCH • DISCIPLINE",
            accentColor: season.berry,
            sections: [
                {
                    title: "Action",
                    content: `**${infraction.punishment}**\nInfraction ID: \`${infraction.id}\``
                },
                {
                    title: changed ? "Updated by" : "Issued by",
                    content: `<@${changedBy || infraction.updatedBy || infraction.issuedBy}>\n\n**Reason**\n${infraction.reason}`
                }
            ],
            footer: `${config.brandName} • ${infraction.id}`,
            timestamp: infraction.updatedAt || infraction.issuedAt,
            allowedMentions: { parse: [] }
        }
    );
}

function createPromotionPayload(promotion, changedBy = null, pingMember = false) {
    const changed = Boolean(changedBy || promotion.updatedBy);
    const rankChange = promotion.previousRank
        ? `**${promotion.previousRank}** → **${promotion.rank}**`
        : `**${promotion.rank}**`;
    const appointmentDetails = [
        `**Rank path**  ${rankChange}`,
        promotion.department ? `**Department**  ${promotion.department}` : null,
        promotion.effectiveDate ? `**Effective**  ${promotion.effectiveDate}` : null
    ].filter(Boolean).join("\n");
    const recognitionDetails = [
        `**Promotion rationale**\n${promotion.reason}`,
        promotion.achievement ? `**Recognized contribution**\n${promotion.achievement}` : null
    ].filter(Boolean).join("\n\n");
    const responsibilities = promotion.responsibilities
        || `As ${promotion.rank}, they are trusted to set a strong example, communicate clearly, and support the continued success of ${promotion.department || "the team"}.`;
    const endorsement = promotion.endorsement
        || "This advancement reflects the confidence of leadership in their judgment, consistency, and continued contribution.";
    return createPanel(
        "A new chapter begins",
        `By the light of the harvest moon, join us in celebrating <@${promotion.memberId}>.`,
        {
            eyebrow: "🍁 AUTUMN PROMOTION • STAFF ANNOUNCEMENT",
            accentColor: season.harvest,
            sections: [
                {
                    title: "🍂 The appointment",
                    content: appointmentDetails
                },
                {
                    title: "✨ What brought them here",
                    content: recognitionDetails
                },
                {
                    title: "🧭 The road ahead",
                    content: `${responsibilities}\n\nWe look forward to seeing the care and initiative they bring to this next chapter.`
                },
                {
                    title: "🕯️ A note from leadership",
                    content: `${endorsement}\n\n**${changed ? "Updated by" : "Approved by"}**  <@${changedBy || promotion.updatedBy || promotion.issuedBy}>`
                }
            ],
            footer: `${config.brandName} • Promotion ID ${promotion.id}`,
            timestamp: promotion.updatedAt || promotion.issuedAt,
            allowedMentions: pingMember
                ? { parse: [], users: [promotion.memberId] }
                : { parse: [] }
        }
    );
}

function createRecordHistoryPayload(kind, memberId, records) {
    const isPromotion = kind === "promotion";
    const title = isPromotion ? "Promotion history" : "Disciplinary history";
    const color = isPromotion ? season.harvest : season.berry;
    const entries = records.length
        ? records.slice(0, 6).map((record) => {
            const date = Math.floor((record.issuedAt || Date.now()) / 1000);
            const action = isPromotion
                ? `${record.previousRank ? `${record.previousRank} → ` : ""}${record.rank}`
                : record.punishment;
            const safeAction = String(action).slice(0, 120);
            const reason = String(record.reason || "").slice(0, 140);
            return `**${safeAction}** · \`${record.id}\` · <t:${date}:d>\n${reason}${record.reason?.length > 180 ? "..." : ""}`;
        }).join("\n\n")
        : "No records were found for this member.";

    return createPanel(title, `<@${memberId}> · newest first`, {
        eyebrow: isPromotion ? "🍁 PROMOTION ARCHIVE" : "🌒 NIGHT WATCH ARCHIVE",
        accentColor: color,
        sections: [{ title: "Recent entries", content: entries }],
        footer: `${config.brandName} • ${isPromotion ? "Promotions" : "Discipline"}`,
        allowedMentions: { parse: [] }
    });
}

function createAnnouncement(type, session) {
    const isStart = type === "start";
    const details = isStart
        ? serverInfoBlock()
        : [
            session.lastDurationMs != null ? `**Duration:** ${formatDuration(session.lastDurationMs)}` : null,
            session.lastEndedBy ? `**Closed by:** <@${session.lastEndedBy}>` : null,
            `**Server:** ${config.serverName}`
        ].filter(Boolean).join("\n");
    const mentionText = isStart ? `<@&${config.startMentionRoleId}>\n\n` : "";
    const intro = isStart
        ? "The gates are open. Gather your crew, step into the scene, and keep it realistic."
        : "The night is winding down. Thanks for joining us; watch for the next gathering.";
    const payload = createPanel(
        isStart ? "🎃 Session is open" : "🌙 Session has ended",
        `${mentionText}${intro}`,
        {
            eyebrow: isStart ? "🎃 HARVEST NIGHT • SESSION CONTROL" : "🍂 LAST LIGHT • SESSION CONTROL",
            accentColor: isStart ? season.pumpkin : season.forest,
            sections: [{ title: isStart ? "Server details" : "Session summary", content: details }],
            footer: `${config.serverName} • Autumn session`,
            timestamp: isStart ? session.startedAt : session.lastEndedAt,
            buttons: isStart ? createSessionButtons() : [createSupportButton()],
            allowedMentions: isStart
                ? { parse: [], roles: [config.startMentionRoleId] }
                : { parse: [] }
        }
    );
    return payload;
}

function createHelpPayload() {
    return createPanel(
        "🧭 The Autumn Field Guide",
        "Your map to sessions, support, and staff tools.",
        {
            eyebrow: "🍂 SOUTH CAROLINA AUTOMATION",
            accentColor: season.midnight,
            sections: [
                {
                    title: "🎃 Session",
                    content: "`/session start` · `/session end`\n`/session status` · `/session history`\n`/session subscribe` · `/session unsubscribe`"
                },
                {
                    title: "🕯️ Support & server",
                    content: "Use the support panel button to open a private ticket. Claim and close tickets with their channel buttons.\n`/serverinfo` · `/ping`"
                },
                {
                    title: "🍁 Promotions",
                    content: "`/promotion` · `/promotionchange` · `/promotionhistory`"
                },
                {
                    title: "🌒 Discipline",
                    content: "`/punishment` · `/punishmentchange` · `/punishmenthistory`"
                }
            ],
            footer: `${config.brandName} • Keep this guide close`
        }
    );
}

function createPingPayload(apiLatency, uptimeMs) {
    return createPanel(
        "🦇 Signal check: clear",
        "The bot is online and the signal is strong.",
        {
            eyebrow: "SYSTEM STATUS",
            accentColor: season.harvest,
            sections: [{
                title: "Live metrics",
                content: `**Gateway**  ${Math.max(0, Math.round(apiLatency))} ms\n**Uptime**  ${formatDuration(uptimeMs)}\n**Status**  Online`
            }],
            footer: config.brandName
        }
    );
}

function createServerInfoPayload(sessionActive) {
    return createPanel(
        `🎃 ${config.serverName}`,
        "Your autumn field briefing and session status.",
        {
            eyebrow: "SERVER BRIEF",
            accentColor: season.pumpkin,
            sections: [
                { title: "Details", content: serverInfoBlock() },
                { title: "Session", content: sessionActive ? "**LIVE** · Join now" : "**STANDBY** · Await the next announcement" }
            ],
            footer: config.brandName,
            buttons: createSessionButtons()
        }
    );
}

function createStatusPayload(session) {
    const description = session.active
        ? `Opened <t:${Math.floor(session.startedAt / 1000)}:R> by <@${session.startedBy}>.`
        : "There is no active session right now.";
    const sections = [{ title: "Server", content: `**${config.serverName}**\n${config.serverMode} · ${config.inGameCode}` }];
    if (session.active) {
        sections.unshift({
            title: "Live now",
            content: `**Elapsed**  ${formatDuration(Date.now() - session.startedAt)}\n**Started**  <t:${Math.floor(session.startedAt / 1000)}:t>`
        });
    }
    return createPanel(session.active ? "🌕 Session live" : "🍂 Session standby", description, {
        eyebrow: "SESSION STATUS",
        accentColor: session.active ? season.forest : season.midnight,
        sections,
        footer: config.brandName
    });
}

function createSessionHistoryPayload(session) {
    const hasHistory = session.lastEndedAt != null;
    const sections = [{ title: "Server details", content: serverInfoBlock() }];
    if (hasHistory) {
        sections.unshift({
            title: "Most recent",
            content: `**Ended**  <t:${Math.floor(session.lastEndedAt / 1000)}:R>\n**Duration**  ${formatDuration(session.lastDurationMs || 0)}\n**Closed by**  ${session.lastEndedBy ? `<@${session.lastEndedBy}>` : "Not recorded"}`
        });
    }
    return createPanel(
        "📜 Session history",
        hasHistory ? "The latest completed session, tucked into the archive." : "The archive is waiting for its first completed session.",
        { eyebrow: "🍂 THE AUTUMN ARCHIVE", accentColor: season.midnight, sections, footer: config.brandName }
    );
}

module.exports = {
    createAnnouncement,
    createHelpPayload,
    createPingPayload,
    createPromotionPayload,
    createPunishmentPayload,
    createRecordHistoryPayload,
    createServerInfoPayload,
    createSessionHistoryPayload,
    createStatusPayload,
    createSupportPanelPayload,
    createTicketCloseButton,
    createTicketClaimGreetingPayload,
    createTicketIntakeModal,
    createTicketRequestPayload,
    createTicketTranscriptPayload,
    createTicketWelcomePayload,
    formatDuration
};
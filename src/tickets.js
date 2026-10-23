const {
    ChannelType,
    PermissionFlagsBits
} = require("discord.js");
const config = require("./config");
const {
    createTicketClaimGreetingPayload,
    createTicketRequestPayload,
    createTicketTranscriptPayload,
    createTicketWelcomePayload
} = require("./embeds-v2");

const ticketLocks = new Map();

async function withTicketLock(channelId, operation) {
    const previous = ticketLocks.get(channelId) || Promise.resolve();
    let release;
    const current = new Promise((resolve) => { release = resolve; });
    ticketLocks.set(channelId, current);
    await previous;

    try {
        return await operation();
    } finally {
        release();
        if (ticketLocks.get(channelId) === current) ticketLocks.delete(channelId);
    }
}

function isSupportStaff(member) {
    const permissions = member.permissions;
    const isAdministrator = typeof permissions?.has === "function"
        ? permissions.has(PermissionFlagsBits.Administrator)
        : (BigInt(permissions || 0) & PermissionFlagsBits.Administrator) === PermissionFlagsBits.Administrator;
    const roles = member.roles;
    const hasStaffRole = Array.isArray(roles)
        ? roles.includes(config.ticketStaffRoleId)
        : Boolean(roles?.cache?.has(config.ticketStaffRoleId));

    return isAdministrator || hasStaffRole;
}

function isTicketChannel(channel) {
    return Boolean(parseTicketTopic(channel?.topic));
}

function parseTicketTopic(topic) {
    if (typeof topic !== "string") return null;
    const parts = topic.split(":");
    if (parts[0] !== "support-ticket" || !parts[1] || !["open", "closed"].includes(parts[2])) return null;
    return {
        ownerId: parts[1],
        status: parts[2],
        claimedById: parts[3] === "claimed" ? parts[4] || null : null
    };
}

function getTicketOwnerId(channel) {
    return parseTicketTopic(channel?.topic)?.ownerId || null;
}

async function findOpenTicket(guild, userId) {
    const channels = await guild.channels.fetch();
    return channels.find((channel) =>
        channel.parentId === config.ticketCategoryId
        && parseTicketTopic(channel.topic)?.ownerId === userId
        && parseTicketTopic(channel.topic)?.status === "open"
    ) || null;
}

async function createTicket(guild, user, request) {
    const existing = await findOpenTicket(guild, user.id);
    if (existing) return { channel: existing, created: false };

    const category = await guild.channels.fetch(config.ticketCategoryId);
    if (!category || category.type !== ChannelType.GuildCategory || category.guildId !== guild.id) {
        throw new Error("The configured support category is unavailable in this server.");
    }

    const safeName = user.username
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40) || "member";

    const channel = await guild.channels.create({
        name: `ticket-${safeName}`,
        type: ChannelType.GuildText,
        parent: category.id,
        topic: `support-ticket:${user.id}:open`,
        permissionOverwrites: [
            {
                id: guild.roles.everyone.id,
                deny: [PermissionFlagsBits.ViewChannel]
            },
            {
                id: user.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.EmbedLinks
                ]
            },
            ...(guild.members.me ? [{
                id: guild.members.me.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.ManageChannels,
                    PermissionFlagsBits.ManageMessages,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.EmbedLinks
                ]
            }] : []),
            {
                id: config.ticketStaffRoleId,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.ManageMessages
                ]
            }
        ],
        reason: `Support ticket opened by ${user.tag}`
    });

    await channel.send(createTicketWelcomePayload(user.id));
    await channel.send(createTicketRequestPayload(request.subject, request.details));

    return { channel, created: true };
}

async function claimTicket(channel, claimedByMember) {
    return withTicketLock(channel.id, async () => {
        const ticket = parseTicketTopic(channel.topic);
        if (!ticket || ticket.status !== "open") {
            return { claimed: false, reason: "This channel is not an open support ticket." };
        }
        if (!isSupportStaff(claimedByMember)) {
            return { claimed: false, reason: "Only support staff can claim this ticket." };
        }
        if (ticket.claimedById) {
            return {
                claimed: false,
                reason: `This ticket has already been claimed by <@${ticket.claimedById}>.`
            };
        }

        await channel.setTopic(
            `support-ticket:${ticket.ownerId}:open:claimed:${claimedByMember.id}`,
            `Ticket claimed by ${claimedByMember.user?.tag || claimedByMember.id}`
        );

        try {
            await channel.send(createTicketClaimGreetingPayload(ticket.ownerId, claimedByMember.id));
        } catch (error) {
            await channel.setTopic(`support-ticket:${ticket.ownerId}:open`).catch(() => {});
            throw error;
        }

        return { claimed: true, ownerId: ticket.ownerId, claimedById: claimedByMember.id };
    });
}

async function createTranscript(channel) {
    const messages = [];
    let before;

    while (messages.length < 1000) {
        const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
        if (batch.size === 0) break;
        messages.push(...batch.values());
        before = batch.last().id;
        if (batch.size < 100) break;
    }

    messages.sort((left, right) => left.createdTimestamp - right.createdTimestamp);
    const lines = messages.map((message) => {
        const timestamp = new Date(message.createdTimestamp).toISOString();
        const body = message.content || "[no text content]";
        const attachmentUrls = [...message.attachments.values()].map((file) => file.url);
        const embedInfo = message.embeds.map((embed) =>
            `[embed] ${embed.title || ""} ${embed.description || ""}`.trim()
        );
        return [
            `[${timestamp}] ${message.author.tag}: ${body}`,
            ...attachmentUrls.map((url) => `  attachment: ${url}`),
            ...embedInfo.map((text) => `  ${text}`)
        ].join("\n");
    });

    return Buffer.from(
        `Transcript for #${channel.name} (${channel.id})\nExported: ${new Date().toISOString()}\n\n${lines.join("\n\n")}\n`,
        "utf8"
    );
}

async function closeTicket(channel, closedByMember) {
    return withTicketLock(channel.id, async () => {
        const ticket = parseTicketTopic(channel.topic);
        if (!ticket || ticket.status !== "open") {
            return { closed: false, reason: "This channel is not an open support ticket." };
        }

        const ownerId = ticket.ownerId;
        const isOwner = closedByMember.id === ownerId;
        const isStaff = isSupportStaff(closedByMember);
        if (!isOwner && !isStaff) {
            return { closed: false, reason: "Only the ticket opener or support staff can close this ticket." };
        }

        const logChannel = await channel.guild.channels.fetch(config.ticketLogChannelId);
        if (!logChannel || !logChannel.isTextBased() || logChannel.guildId !== channel.guildId) {
            throw new Error("The configured ticket transcript channel is unavailable in this server.");
        }

        const transcript = await createTranscript(channel);
        const transcriptName = `${channel.name}-${Date.now()}.txt`;
        await logChannel.send(createTicketTranscriptPayload(
            channel,
            ownerId,
            closedByMember.id,
            transcript,
            transcriptName
        ));

        await channel.delete(`Ticket closed by ${closedByMember.user?.tag || closedByMember.user?.username || closedByMember.id}; transcript saved to ${logChannel.name}.`);

        return { closed: true, ownerId, transcriptName, deleted: true };
    });
}

module.exports = {
    claimTicket,
    closeTicket,
    createTicket,
    isTicketChannel,
    isSupportStaff
};

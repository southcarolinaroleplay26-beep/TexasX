require("dotenv").config();

const discord = require("discord.js");
const lockfile = require("proper-lockfile");
const config = require("./src/config");
const sessionStore = require("./src/session-store");
const commandData = require("./src/commands");
const punishmentStore = require("./src/punishment-store");
const promotionStore = require("./src/promotion-store");
const {
    createAnnouncement,
    createHelpPayload,
    createPingPayload,
    createPromotionPayload,
    createPunishmentPayload,
    createRecordHistoryPayload,
    createServerInfoPayload,
    createSupportPanelPayload,
    createSessionHistoryPayload,
    createStatusPayload,
    createTicketIntakeModal,
    createTicketWelcomePayload
} = require("./src/embeds-v2");
const tickets = require("./src/tickets");

const client = new discord.Client({
    intents: [discord.GatewayIntentBits.Guilds]
});

let releaseLock;
let shutdownPromise;

function memberCanManageSessions(interaction) {
    if (interaction.memberPermissions?.has(discord.PermissionFlagsBits.Administrator)) {
        return true;
    }

    const roles = interaction.member?.roles;
    if (Array.isArray(roles)) {
        return roles.includes(config.moderatorRoleId);
    }
    return Boolean(roles?.cache?.has(config.moderatorRoleId));
}

async function replyPrivately(interaction, content) {
    const payload = { content, flags: discord.MessageFlags.Ephemeral };
    if (interaction.deferred && !interaction.replied) {
        await interaction.editReply({ content });
    } else if (interaction.replied) {
        await interaction.followUp(payload);
    } else {
        await interaction.reply(payload);
    }
}

async function getAnnouncementChannel() {
    const channel = await client.channels.fetch(config.announcementChannelId);
    if (!channel || !channel.isTextBased() || channel.guildId !== config.guildId) {
        throw new Error("The configured session announcement channel is unavailable or is not a text channel in this server.");
    }
    return channel;
}

async function getRecordChannel(interaction, channelId, settingName, recordType) {
    if (!channelId) {
        await interaction.editReply(`${settingName} is not configured. Set it to the ${recordType} channel ID in .env.`);
        return null;
    }
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased() || channel.guildId !== config.guildId) {
        throw new Error(`The configured ${recordType} channel is unavailable or is not a text channel in this server.`);
    }
    return channel;
}

async function updateNotificationSubscription(guild, userId, desiredState = null) {
    const role = await guild.roles.fetch(config.startMentionRoleId);
    if (!role) throw new Error("The session notification role is not available.");

    const member = await guild.members.fetch(userId);
    const alreadySubscribed = member.roles.cache.has(role.id);
    const shouldSubscribe = desiredState ?? !alreadySubscribed;

    if (shouldSubscribe && !alreadySubscribed) {
        await member.roles.add(role, "User opted in to session notifications.");
        return "You’re subscribed to session-start notifications.";
    }

    if (!shouldSubscribe && alreadySubscribed) {
        await member.roles.remove(role, "User opted out of session notifications.");
        return "You’re unsubscribed from session-start notifications.";
    }

    return shouldSubscribe
        ? "You’re already subscribed to session-start notifications."
        : "You’re already unsubscribed from session-start notifications.";
}

async function handleUtilityCommand(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const commandName = interaction.commandName;
    if (!["help", "ping", "serverinfo"].includes(commandName)) return;

    await interaction.deferReply({ flags: discord.MessageFlags.Ephemeral });
    if (!interaction.inGuild() || interaction.guildId !== config.guildId) {
        await replyPrivately(interaction, "This command is available in the configured server.");
        return;
    }

    if (commandName === "help") {
        await interaction.editReply(createHelpPayload());
    } else if (commandName === "ping") {
        await interaction.editReply(createPingPayload(client.ws.ping, process.uptime() * 1000));
    } else {
        await interaction.editReply(
            createServerInfoPayload(sessionStore.loadSession().active)
        );
    }
}

async function handlePunishmentCommand(interaction) {
    if (!interaction.isChatInputCommand()
        || !["punishment", "punishmentchange", "punishmenthistory"].includes(interaction.commandName)) return;

    await interaction.deferReply({ flags: discord.MessageFlags.Ephemeral });
    if (!interaction.inGuild() || interaction.guildId !== config.guildId) {
        await replyPrivately(interaction, "Punishment commands are only available in the configured server.");
        return;
    }

    if (!interaction.memberPermissions?.has(discord.PermissionFlagsBits.Administrator)) {
        await replyPrivately(interaction, "Only administrators can issue or change punishments.");
        return;
    }

    if (interaction.commandName === "punishmenthistory") {
        const user = interaction.options.getUser("member", true);
        await interaction.editReply(createRecordHistoryPayload(
            "punishment",
            user.id,
            punishmentStore.listInfractionsForMember(user.id)
        ));
        return;
    }

    if (interaction.commandName === "punishment") {
        const member = interaction.options.getMember("member");
        const user = interaction.options.getUser("member");
        const punishment = interaction.options.getString("punishment", true).trim();
        const reason = interaction.options.getString("reason", true).trim();
        if (!punishment || !reason) {
            await interaction.editReply("Punishment and reason must contain non-space text.");
            return;
        }

        const channel = await getRecordChannel(
            interaction,
            config.punishmentChannelId,
            "PUNISHMENT_CHANNEL_ID",
            "punishment"
        );
        if (!channel) return;
        const record = punishmentStore.createInfraction({
            memberId: user.id,
            memberName: member?.displayName || user.username,
            punishment,
            reason,
            issuedBy: interaction.user.id,
            issuedAt: Date.now(),
            channelId: interaction.channelId,
            messageId: null
        });

        let message;
        try {
            message = await channel.send(createPunishmentPayload(record));
            punishmentStore.updateInfraction(record.id, { messageId: message.id });
        } catch (error) {
            if (message) await message.delete().catch(() => {});
            punishmentStore.deleteInfraction(record.id);
            throw error;
        }
        await interaction.editReply(`Punishment issued for <@${user.id}>. Infraction ID: \`${record.id}\`.`);
        return;
    }

    const id = interaction.options.getString("infraction_id", true);
    const current = punishmentStore.getInfraction(id);
    if (!current) {
        await interaction.editReply(`No punishment was found for infraction ID \`${id.trim()}\`.`);
        return;
    }

    const punishment = interaction.options.getString("punishment", true).trim();
    if (!punishment) {
        await interaction.editReply("The replacement punishment must contain non-space text.");
        return;
    }

    const updated = {
        ...current,
        punishment,
        updatedAt: Date.now(),
        updatedBy: interaction.user.id
    };
    const channel = await client.channels.fetch(current.channelId);
    const message = current.messageId ? await channel?.messages.fetch(current.messageId) : null;
    if (!channel?.isTextBased() || !message) {
        await interaction.editReply("The original punishment post could not be found, so the record was not changed.");
        return;
    }

    await message.edit(createPunishmentPayload(updated, interaction.user.id));
    punishmentStore.updateInfraction(current.id, {
        punishment: updated.punishment,
        updatedAt: updated.updatedAt,
        updatedBy: updated.updatedBy
    });
    await interaction.editReply(`Punishment updated. Infraction ID: \`${current.id}\`.`);
}

function readOptionalPromotionDetails(interaction) {
    const options = [
        ["previous_rank", "previousRank"],
        ["department", "department"],
        ["effective_date", "effectiveDate"],
        ["achievement", "achievement"],
        ["responsibilities", "responsibilities"],
        ["endorsement", "endorsement"]
    ];
    const details = {};
    for (const [optionName, fieldName] of options) {
        const value = interaction.options.getString(optionName)?.trim();
        if (value) details[fieldName] = value;
    }
    return details;
}

async function handlePromotionCommand(interaction) {
    if (!interaction.isChatInputCommand()
        || !["promotion", "promotionchange", "promotionhistory"].includes(interaction.commandName)) return;

    await interaction.deferReply({ flags: discord.MessageFlags.Ephemeral });
    if (!interaction.inGuild() || interaction.guildId !== config.guildId) {
        await replyPrivately(interaction, "Promotion commands are only available in the configured server.");
        return;
    }

    if (!interaction.memberPermissions?.has(discord.PermissionFlagsBits.Administrator)) {
        await replyPrivately(interaction, "Only administrators can issue or change promotions.");
        return;
    }

    if (interaction.commandName === "promotionhistory") {
        const user = interaction.options.getUser("member", true);
        await interaction.editReply(createRecordHistoryPayload(
            "promotion",
            user.id,
            promotionStore.listPromotionsForMember(user.id)
        ));
        return;
    }

    if (interaction.commandName === "promotion") {
        const member = interaction.options.getUser("member", true);
        const rank = interaction.options.getString("rank", true).trim();
        const reason = interaction.options.getString("reason", true).trim();
        if (!rank || !reason) {
            await interaction.editReply("Rank and reason must contain non-space text.");
            return;
        }
        const details = readOptionalPromotionDetails(interaction);

        const channel = await getRecordChannel(
            interaction,
            config.promotionChannelId,
            "PROMOTION_CHANNEL_ID",
            "promotion"
        );
        if (!channel) return;
        const record = promotionStore.createPromotion({
            memberId: member.id,
            memberName: member.username,
            rank,
            previousRank: details.previousRank || null,
            reason,
            department: details.department || null,
            effectiveDate: details.effectiveDate || null,
            achievement: details.achievement || null,
            responsibilities: details.responsibilities || null,
            endorsement: details.endorsement || null,
            issuedBy: interaction.user.id,
            issuedAt: Date.now(),
            channelId: channel.id,
            messageId: null
        });

        let message;
        try {
            message = await channel.send(createPromotionPayload(record, null, true));
            promotionStore.updatePromotion(record.id, { messageId: message.id });
        } catch (error) {
            if (message) await message.delete().catch(() => {});
            promotionStore.deletePromotion(record.id);
            throw error;
        }
        await interaction.editReply(`Promotion recorded for <@${member.id}>. Promotion ID: \`${record.id}\`.`);
        return;
    }

    const id = interaction.options.getString("promotion_id", true);
    const current = promotionStore.getPromotion(id);
    if (!current) {
        await interaction.editReply(`No promotion was found for ID \`${id.trim()}\`.`);
        return;
    }

    const rank = interaction.options.getString("rank", true).trim();
    const reasonInput = interaction.options.getString("reason");
    const reason = reasonInput?.trim();
    if (!rank || (reasonInput !== null && !reason)) {
        await interaction.editReply("Rank and any supplied reason must contain non-space text.");
        return;
    }
    const details = readOptionalPromotionDetails(interaction);

    const updated = {
        ...current,
        rank,
        ...(reason ? { reason } : {}),
        ...details,
        updatedAt: Date.now(),
        updatedBy: interaction.user.id
    };
    const channel = await client.channels.fetch(current.channelId);
    const message = current.messageId ? await channel?.messages.fetch(current.messageId) : null;
    if (!channel?.isTextBased() || !message) {
        await interaction.editReply("The original promotion post could not be found, so the record was not changed.");
        return;
    }

    await message.edit(createPromotionPayload(updated, interaction.user.id));
    promotionStore.updatePromotion(current.id, {
        rank: updated.rank,
        reason: updated.reason,
        ...details,
        updatedAt: updated.updatedAt,
        updatedBy: updated.updatedBy
    });
    await interaction.editReply(`Promotion updated. ID: \`${current.id}\`.`);
}

async function handleSessionCommand(interaction) {
    if (!interaction.isChatInputCommand() || interaction.commandName !== "session") return;

    await interaction.deferReply({ flags: discord.MessageFlags.Ephemeral });

    if (!interaction.inGuild() || interaction.guildId !== config.guildId) {
        await replyPrivately(interaction, "Session commands are only available in the configured server.");
        return;
    }

    const action = interaction.options.getSubcommand();
    const currentState = sessionStore.loadSession();
    console.log(`Received /session ${action}`);

    if (action === "status") {
        await interaction.editReply(createStatusPayload(currentState));
        return;
    }

    if (action === "history") {
        await interaction.editReply(createSessionHistoryPayload(currentState));
        return;
    }

    if (action === "subscribe" || action === "unsubscribe") {
        const response = await updateNotificationSubscription(
            interaction.guild,
            interaction.user.id,
            action === "subscribe"
        );
        await replyPrivately(interaction, response);
        return;
    }

    if ((action === "start" || action === "end") && !memberCanManageSessions(interaction)) {
        await replyPrivately(interaction, "Starting and ending sessions requires Administrator permission or the configured moderator role.");
        return;
    }

    if (action === "start") {
        if (currentState.active) {
            await replyPrivately(interaction, "A session is already live. Use `/session status` to view its details.");
            return;
        }

        const channel = await getAnnouncementChannel();

        const nextState = {
            ...currentState,
            active: true,
            startedAt: Date.now(),
            startedBy: interaction.user.id
        };
        sessionStore.saveSession(nextState);

        try {
            const payload = createAnnouncement("start", nextState);
            await channel.send(payload);
        } catch (error) {
            sessionStore.saveSession(currentState);
            throw error;
        }
        await interaction.editReply(`Session-start announcement posted in <#${config.announcementChannelId}>.`);
        return;
    }

    if (action === "end") {
        if (!currentState.active) {
            await replyPrivately(interaction, "There isn’t an active session to close. Use `/session status` for current details.");
            return;
        }

        const channel = await getAnnouncementChannel();

        const endedAt = Date.now();
        const nextState = {
            ...currentState,
            active: false,
            lastEndedAt: endedAt,
            lastEndedBy: interaction.user.id,
            lastDurationMs: endedAt - currentState.startedAt,
            startedAt: null,
            startedBy: null
        };
        sessionStore.saveSession(nextState);

        try {
            await channel.send(createAnnouncement("end", nextState));
        } catch (error) {
            sessionStore.saveSession(currentState);
            throw error;
        }
        await interaction.editReply(`Session-end announcement posted in <#${config.announcementChannelId}>.`);
    }
}

async function handleNotificationButton(interaction) {
    if (!interaction.isButton() || interaction.customId !== "session:toggle-notifications") return;

    await interaction.deferReply({ flags: discord.MessageFlags.Ephemeral });

    if (!interaction.inGuild() || interaction.guildId !== config.guildId) {
        await interaction.editReply({ content: "This notification button is only available in the configured server." });
        return;
    }

    const response = await updateNotificationSubscription(interaction.guild, interaction.user.id);
    await interaction.editReply({ content: response });
}

function hasTicketCreateButton(component) {
    if (component.customId === "ticket:create" || component.custom_id === "ticket:create") return true;
    return (component.components || []).some(hasTicketCreateButton)
        || Boolean(component.accessory && hasTicketCreateButton(component.accessory));
}

async function ensureTicketPanel(readyClient) {
    const channel = await readyClient.channels.fetch(config.ticketPanelChannelId);
    if (!channel || !channel.isTextBased() || channel.guildId !== config.guildId) {
        throw new Error("The configured ticket panel channel is unavailable or is not a text channel in this server.");
    }

    const recentMessages = await channel.messages.fetch({ limit: 100 });
    const existingPanel = recentMessages.find((message) =>
        message.author.id === readyClient.user.id
        && message.components.some(hasTicketCreateButton)
    );
    if (existingPanel) {
        const panelComponents = existingPanel.components
            .map((component) => JSON.stringify(component.toJSON()));
        const hasCurrentArtwork = ["support-board.png", "support-banner.png"]
            .every((name) => panelComponents.some((component) => component.includes(name)));
        if (hasCurrentArtwork) {
            console.log(`Ticket panel already exists in #${channel.name}`);
            return;
        }

        await existingPanel.edit(createSupportPanelPayload());
        console.log(`Ticket panel artwork updated in #${channel.name}`);
        return;
    }

    await channel.send(createSupportPanelPayload());
    console.log(`Ticket panel posted in #${channel.name}`);
}

async function handleTicketModal(interaction) {
    await interaction.deferReply({ flags: discord.MessageFlags.Ephemeral });
    if (!interaction.inGuild() || interaction.guildId !== config.guildId) {
        await interaction.editReply({ content: "Support tickets are only available in the configured server." });
        return;
    }

    const subject = interaction.fields.getTextInputValue("ticket:subject").trim();
    const details = interaction.fields.getTextInputValue("ticket:details").trim();
    if (subject.length < 5 || details.length < 20) {
        await interaction.editReply({ content: "Please provide a subject of at least 5 characters and details of at least 20 characters." });
        return;
    }

    const result = await tickets.createTicket(interaction.guild, interaction.user, { subject, details });
    const response = result.created
        ? `Your support request is ready: <#${result.channel.id}>.`
        : `You already have an open support request: <#${result.channel.id}>.`;
    await interaction.editReply({ content: response });
}

async function handleTicketButton(interaction) {
    if (!interaction.isButton() || !interaction.customId.startsWith("ticket:")) return;

    if (!interaction.inGuild() || interaction.guildId !== config.guildId) {
        await interaction.reply({
            content: "Support tickets are only available in the configured server.",
            flags: discord.MessageFlags.Ephemeral
        });
        return;
    }

    if (interaction.customId === "ticket:create") {
        await interaction.showModal(createTicketIntakeModal());
        return;
    }

    await interaction.deferReply({ flags: discord.MessageFlags.Ephemeral });

    if (interaction.customId === "ticket:claim") {
        const result = await tickets.claimTicket(interaction.channel, interaction.member);
        if (!result.claimed) {
            await interaction.editReply({ content: result.reason });
            return;
        }

        await interaction.message.edit(
            createTicketWelcomePayload(result.ownerId, result.claimedById)
        ).catch((error) => console.error("Could not update the claimed ticket panel:", error));
        await interaction.editReply({ content: "You claimed this ticket. The opener has been notified." });
        return;
    }

    if (interaction.customId === "ticket:close") {
        const result = await tickets.closeTicket(interaction.channel, interaction.member);
        await interaction.editReply({
            content: result.closed
                ? "Ticket deleted. Its transcript has been delivered to the staff log."
                : result.reason
        });
    }
}

client.on("interactionCreate", (interaction) => {
    let handler;
    if (interaction.isModalSubmit() && interaction.customId === "ticket:submit") {
        handler = handleTicketModal(interaction);
    } else if (interaction.isButton()) {
        handler = interaction.customId.startsWith("ticket:")
            ? handleTicketButton(interaction)
            : handleNotificationButton(interaction);
    } else if (interaction.isChatInputCommand() && interaction.commandName === "session") {
        handler = handleSessionCommand(interaction);
    } else if (interaction.isChatInputCommand()
        && ["punishment", "punishmentchange", "punishmenthistory"].includes(interaction.commandName)) {
        handler = handlePunishmentCommand(interaction);
    } else if (interaction.isChatInputCommand()
        && ["promotion", "promotionchange", "promotionhistory"].includes(interaction.commandName)) {
        handler = handlePromotionCommand(interaction);
    } else {
        handler = handleUtilityCommand(interaction);
    }

    handler.catch(async (error) => {
        console.error("Failed to handle interaction:", error);
        if (interaction.isRepliable()) {
            try {
                await replyPrivately(interaction, "The command failed. Check the bot log for details.");
            } catch (replyError) {
                console.error("Could not send the command error response:", replyError);
            }
        }
    });
});

client.on("error", (error) => {
    console.error("Discord client error:", error);
});

async function shutdown() {
    if (!shutdownPromise) {
        shutdownPromise = (async () => {
            client.destroy();
            if (releaseLock) {
                const unlock = releaseLock;
                releaseLock = undefined;
                await unlock();
            }
        })();
    }
    return shutdownPromise;
}

async function startBot() {
    if (!config.token) {
        throw new Error("BOT_TOKEN is missing. Add it to the .env file.");
    }

    sessionStore.loadSession();

    try {
        releaseLock = await lockfile.lock(__filename, { retries: 0 });
    } catch (error) {
        if (error.code === "ELOCKED") {
            throw new Error("Another instance of this bot is already running.");
        }
        throw error;
    }

    process.once("SIGINT", () => {
        shutdown().catch((error) => console.error("Shutdown failed:", error));
    });
    process.once("SIGTERM", () => {
        shutdown().catch((error) => console.error("Shutdown failed:", error));
    });

    client.once("clientReady", async (readyClient) => {
        console.log(`Connected as ${readyClient.user.tag}`);
        readyClient.user.setPresence({
            activities: [
                {
                    name: "South Carolina Automation",
                    type: discord.ActivityType.Playing
                }
            ],
            status: "online"
        });
        console.log("Activity set to Playing South Carolina Automation");

        try {
            await readyClient.application.commands.set(commandData, config.guildId);
            console.log(`Registered application commands in guild ${config.guildId}`);
        } catch (error) {
            console.error("Could not register guild slash commands:", error);
        }

        try {
            await ensureTicketPanel(readyClient);
        } catch (error) {
            console.error("Could not ensure the ticket panel is posted:", error);
        }
    });

    try {
        await client.login(config.token);
    } catch (error) {
        await shutdown();
        throw error;
    }
}

startBot().catch((error) => {
    console.error("Bot startup failed:", error);
    process.exitCode = 1;
});

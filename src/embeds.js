const {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
    SeparatorBuilder,
    StringSelectMenuBuilder,
    TextDisplayBuilder
} = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");
const config = require("./config");
const assetDirectory = path.join(__dirname, "..", "assets");

const colors = Object.freeze({
    gold: 0xC67537,
    red: 0xA63D40,
    green: 0x527A56,
    blue: 0x526C8C,
    gray: 0x60646C
});

function panelPayload(title, description, options = {}) {
    const {
        accentColor = colors.gold,
        sections = [],
        footer = config.serverName,
        timestamp = Date.now(),
        buttons = [],
        extraComponents = [],
        allowedMentions = { parse: [] },
        files = [],
        includeBrandFooter = true,
        headerAsset = null,
        footerAsset = "footer-banner.png",
        showTitle = true
    } = options;
    const attachedFiles = [...files];
    const addAsset = (filename) => {
        const filePath = path.join(assetDirectory, filename);
        if (!fs.existsSync(filePath)) return false;
        if (!attachedFiles.some((attachment) => attachment.name === filename)) {
            attachedFiles.push(new AttachmentBuilder(filePath, { name: filename }));
        }
        return true;
    };
    const hasHeaderAsset = headerAsset ? addAsset(headerAsset) : false;
    const hasFooterAsset = includeBrandFooter && footerAsset ? addAsset(footerAsset) : false;
    const container = new ContainerBuilder()
        .setAccentColor(accentColor);
    if (hasHeaderAsset) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(`attachment://${headerAsset}`).setDescription(title)
            )
        ).addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    }
    const heading = showTitle || (headerAsset && !hasHeaderAsset) ? `# ${title}\n` : "";
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${heading}${description}`));

    for (const section of sections) {
        container
            .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## ${section.title}\n${section.content}`)
            );
    }

    if (buttons.length) {
        container
            .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
            .addActionRowComponents(new ActionRowBuilder().addComponents(...buttons));
    }
    if (extraComponents.length) {
        container
            .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
            .addActionRowComponents(...extraComponents);
    }

    if (footer || timestamp) {
        const footerText = [footer, timestamp ? `<t:${Math.floor(timestamp / 1000)}:f>` : null]
            .filter(Boolean)
            .join(" • ");
        container
            .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${footerText}`));
    }
    if (hasFooterAsset) {
        container
            .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
            .addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL(`attachment://${footerAsset}`).setDescription(`${config.serverName} banner`)
                )
            );
    }

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container],
        allowedMentions,
        ...(attachedFiles.length ? { files: attachedFiles } : {})
    };
}

function sessionPanel(type, session, kind = "regular") {
    const started = type === "start";
    const low = type === "low";
    const whitelist = kind === "whitelist";
    const title = low
        ? "LOW-PLAYER SESSION"
        : whitelist
            ? started ? "WHITELIST SESSION" : "WHITELIST SESSION ENDED"
            : started ? "SESSIONS" : "SESSIONS";
    const description = low
        ? "There are currently fewer players online. Join the server and help bring the roleplay to life."
        : started
            ? `A **${config.serverName}** session is now starting! Join for realistic scenes, active departments, and quality roleplay.`
            : `A **${config.serverName}** session has now ended! Thank you to **everyone** who joined, created realistic scenes, and made today’s **roleplay enjoyable!**`;
    const sections = [];
    if (started) {
        sections.push({
            title: "Server Information",
            content: `**Server:** ${config.serverName}\n**In-Game Code:** ${config.inGameCode}\n**Server Owner:** ${config.serverOwner}`
        });
        if (session?.startedAt) {
            sections.push({
                title: "Session Started",
                content: `<t:${Math.floor(session.startedAt / 1000)}:R>`
            });
        }
    } else if (!low) {
        sections.push({
            title: "Server Status",
            content: `**The server is now closed.** We hope you **enjoyed the session!** Stay tuned for the next session startup!`
        });
    }
    const buttons = [];
    if (type === "start" && config.joinServerUrl) {
        buttons.push(new ButtonBuilder()
            .setLabel("Join Server")
            .setStyle(ButtonStyle.Link)
            .setURL(config.joinServerUrl));
    }
    if ((type === "start" || type === "end") && config.sessionNotificationRoleId) {
        buttons.push(new ButtonBuilder()
            .setCustomId("session:notifications")
            .setLabel("Get Session Notification!")
            .setStyle(ButtonStyle.Secondary));
    }
    const roleMention = type === "start" && config.sessionNotificationRoleId
        ? `<@&${config.sessionNotificationRoleId}>\n\n`
        : "";
    return panelPayload(title, `${roleMention}${description}`, {
        accentColor: started || low ? colors.gold : colors.gray,
        sections,
        buttons,
        headerAsset: "session-header.png",
        showTitle: low || whitelist,
        allowedMentions: roleMention
            ? { roles: [config.sessionNotificationRoleId] }
            : { parse: [] }
    });
}

function punishmentPanel(record, { pingTarget = false } = {}) {
    const active = !record.voided;
    const sections = [
        {
            title: "Staff Information",
            content: `**Target:** <@${record.memberId}>\n**Issuer:** <@${record.issuedBy}>\n**Date Issued:** <t:${Math.floor(record.issuedAt / 1000)}:F>`
        },
        {
            title: "Punishment Details",
            content: `**Type:** ${record.type}\n**Reason:** ${record.reason}\n**Expiration Date:** ${record.expiration || "Never"}`
        }
    ];
    if (record.voided && record.voidReason) {
        sections.push({ title: "Void Reason", content: record.voidReason });
    }
    if (record.appeals?.length) {
        const appeal = record.appeals[record.appeals.length - 1];
        sections.push({
            title: "Latest Appeal",
            content: `${appeal.status}: ${String(appeal.reason).slice(0, 900)}`
        });
    }
    return panelPayload("INFRACTIONS", `## Punishment ${active ? "issued" : "voided"}\n**Infraction ID:** ${record.id}\n**Status:** ${active ? "Active" : "Void"}`, {
        accentColor: active ? colors.red : colors.gray,
        sections,
        timestamp: record.updatedAt || record.issuedAt,
        allowedMentions: pingTarget
            ? { users: [record.memberId] }
            : { parse: [] }
    });
}

function recordsPanel(title, memberId, records) {
    const body = records.length
        ? records.slice(0, 10).map((record) => {
            const status = record.voided ? "Void" : "Active";
            const reason = String(record.reason || "").slice(0, 180);
            return `**${record.type}** · \`${record.id}\` · ${status}\n${reason}`;
        }).join("\n\n")
        : "No punishment records found.";
    return panelPayload(title, memberId ? `<@${memberId}>` : "Punishment records", {
        accentColor: colors.red,
        sections: [{ title: "Recent Records", content: body }],
        footer: `${config.serverName} • newest first`
    });
}

function ticketPanelPayload(ticketTypes = config.ticketTypes) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket:type")
        .setPlaceholder("Choose a ticket type")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(Object.entries(ticketTypes).map(([value, type]) => ({
            label: type.label,
            description: type.description,
            value
        })));
    return panelPayload(
        "Assistance Center",
        "Welcome to Texas State Roleplay assistance. Choose an option below to find answers or contact the right team.",
        {
            sections: [{
                title: "How can we help?",
                content: "Browse the FAQ or choose a ticket type below to open a private ticket with the right team."
            }],
            headerAsset: "assistance-header.png",
            extraComponents: [new ActionRowBuilder().addComponents(menu)],
            buttons: [
                new ButtonBuilder()
                    .setCustomId("ticket:faq")
                    .setLabel("FAQ")
                    .setStyle(ButtonStyle.Secondary),
            ]
        }
    );
}

function ticketFaqPayload() {
    return panelPayload(
        "Assistance FAQ",
        "Quick answers to common assistance questions.",
        {
            timestamp: null,
            includeBrandFooter: false,
            sections: [
                {
                    title: "How do I contact support?",
                    content: "Choose General Support, Community Support, Staff Report, or Partnership from the ticket menu on the Assistance Center panel."
                },
                {
                    title: "Who can see my ticket?",
                    content: "Only you, the team assigned to your ticket, and server moderators can view it."
                },
                {
                    title: "How long will a response take?",
                    content: "Response times vary depending on staff availability. Please keep your ticket open and avoid creating duplicate requests."
                },
                {
                    title: "Can I add information later?",
                    content: "Yes. Send messages or attach relevant screenshots in your ticket. Never share passwords or other account credentials."
                },
                {
                    title: "How do I close my ticket?",
                    content: "Ask the assigned team to close it, or use `/close` if you are the ticket owner. A transcript is saved for staff."
                }
            ]
        }
    );
}

function ticketWelcomePayload(ownerId, ticketType, claimedBy = null) {
    const roleMentions = ticketType.roleIds.map((roleId) => `<@&${roleId}>`).join(" ");
    return panelPayload(
        `${ticketType.label} Ticket`,
        `${roleMentions}\n<@${ownerId}> please describe what you need help with. Do not share passwords or other account credentials.${claimedBy ? `\n\n**Claimed by:** <@${claimedBy}>` : ""}`,
        {
            sections: [{
                title: "What Happens Next",
                content: `Your request has been sent to the ${ticketType.label} team. Staff will reply here. You can use \`/close\` when your request is resolved.`
            }],
            buttons: [
                new ButtonBuilder()
                    .setCustomId("ticket:claim")
                    .setLabel(claimedBy ? "Ticket Claimed" : "Claim Ticket")
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(Boolean(claimedBy))
            ],
            allowedMentions: claimedBy
                ? { parse: [] }
                : { users: [ownerId], roles: ticketType.roleIds }
        }
    );
}

function reducedActivityRequestPanel(request) {
    const pending = request.status === "pending";
    return panelPayload(
        `Reduced Activity Request • ${request.id}`,
        `**Member:** <@${request.memberId}>\n**Requested:** <t:${Math.floor(request.requestedAt / 1000)}:F>`,
        {
            accentColor: pending ? colors.gold : request.status === "accepted" ? colors.green : colors.red,
            sections: [
                { title: "Reason", content: request.reason },
                ...(request.until ? [{ title: "Expected Return", content: request.until }] : []),
                {
                    title: "Decision",
                    content: pending
                        ? "Awaiting staff review."
                        : `**${request.status.toUpperCase()}** by <@${request.decidedBy}> • <t:${Math.floor(request.decidedAt / 1000)}:F>`
                }
            ],
            buttons: pending ? [
                new ButtonBuilder()
                    .setCustomId(`ra-review:accept:${request.id}`)
                    .setLabel("Accept")
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`ra-review:deny:${request.id}`)
                    .setLabel("Deny")
                    .setStyle(ButtonStyle.Danger)
            ] : [],
            allowedMentions: { parse: [] }
        }
    );
}

function hiringAnnouncementPanel() {
    return panelPayload(
        "We’re Hiring Staff!",
        `**${config.serverName}** is currently hiring staff members. If you’re responsible, active, and ready to help our community, we’d love to hear from you.`,
        {
            accentColor: colors.gold,
            headerAsset: "applications-header.png",
            sections: [{
                title: "Apply Now",
                content: "Open an application and tell us why you’d be a great fit for the team."
            }],
            buttons: [
                new ButtonBuilder()
                    .setLabel("Staff Applications")
                    .setStyle(ButtonStyle.Link)
                    .setURL(config.applicationsChannelUrl)
            ],
            allowedMentions: { parse: [] }
        }
    );
}

function staffApplicationUpdatePanel(serverName, reason) {
    return panelPayload(
        "Staff Application Update",
        `Your application for ${serverName} was not accepted at this time.`,
        {
            headerAsset: "applications-header.png",
            sections: [{ title: "Feedback", content: reason }]
        }
    );
}

function departmentRoleAssignedPanel(userId, roleId) {
    return panelPayload(
        "Department Role Assigned",
        `<@${userId}> was assigned <@&${roleId}>.`,
        {
            headerAsset: "departments-header.png",
            allowedMentions: { parse: [], users: [userId], roles: [roleId] }
        }
    );
}

function shopPanelPayload(shopUrl) {
    return panelPayload(
        "Server Shop",
        "Visit the official Texas State Roleplay shop.",
        {
            headerAsset: "marketplace-header.png",
            buttons: [
                new ButtonBuilder().setLabel("Visit Shop").setStyle(ButtonStyle.Link).setURL(shopUrl)
            ]
        }
    );
}

function selfRolePanelPayload(roles) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId("self-roles:select")
        .setPlaceholder("Choose roles to toggle")
        .setMinValues(1)
        .setMaxValues(Math.min(roles.length, 25))
        .addOptions(roles.map((entry) => ({ label: entry.label, value: entry.id })));
    return panelPayload(
        "Choose Your Roles",
        "Select or deselect roles from the menu. Selecting a role you already have removes it.",
        {
            accentColor: colors.blue,
            headerAsset: "role-request-header.png",
            extraComponents: [new ActionRowBuilder().addComponents(menu)]
        }
    );
}

const dashboardPages = Object.freeze({
    home: {
        label: "Dashboard",
        description: "TexasX server dashboard",
        content: "Welcome to **TexasX | Texas State Roleplay**. Choose a menu below to read the rules and law enforcement reference, or manage your notification roles."
    },
    ingame: {
        label: "In-Game Rules",
        description: "Read the TexasX roleplay rules",
        content: [
            "**R1. Realistic Roleplay** — Keep actions realistic. Ignoring injuries, unrealistic escapes, producing uncarried weapons, or ignoring consequences is Fail Roleplay (FRP). Staff may address other unrealistic behavior.",
            "**R2. Random Deathmatch (RDM)** — Attacking or killing players without a valid in-character reason is prohibited.",
            "**R3. Vehicle Deathmatch (VDM)** — Intentionally using vehicles to strike or kill players without valid roleplay justification is prohibited.",
            "**R4. Powergaming** — Do not force actions on others, abuse mechanics, ignore injuries, perform impossible stunts, or escape consequences unrealistically.",
            "**R5. Metagaming** — Using out-of-character information in roleplay is prohibited, including stream sniping, Discord information, or sharing knowledge between characters.",
            "**R6. New Life Rule** — After dying, do not return to or interfere with the active scene until it concludes.",
            "**R7. Vehicle Roleplay** — Roleplay accidents unless caused by desync. Follow traffic laws and avoid unrealistic speeds, excessive off-roading, or unsuitable terrain.",
            "**R8. Value of Life** — Characters must value their lives and realistically comply when facing overwhelming threats.",
            "**R9. Breaking Character** — Remain in character during scenes. Keep out-of-character conversations from disrupting roleplay.",
            "**R10. Quality Roleplay** — Players must contribute meaningful scenarios. Repeated disruption or intentionally poor roleplay may result in moderation.",
            "**R11. Priority System** — Major incidents, including robberies, hostages, barricades, and attacks on first responders, require priority approval when applicable. Do not start unapproved priorities or initiate competing major incidents during an active priority.",
            "**R12. Hostages & Major Scenarios** — Fire, EMS, and DOT personnel may not be kidnapped unless priority rules permit it. Participants must remain in approved scenarios unless reasonably excused.",
            "**R13. Cop Baiting** — Provoking officers solely to trigger pursuits or police responses is prohibited.",
            "**R14. Arrest Procedures** — Arrests must be realistic. Officers should indicate detention when practical, restrain suspects appropriately, and transport them to jail when reasonable.",
            "**R15. Combat Logging** — Leaving to avoid roleplay, arrest, death, investigation, or moderation is prohibited.",
            "**R16. Scene Interference** — Do not interrupt or disrupt scenes you have no valid reason to join.",
            "**R17. Safe Zones** — Criminal activity is prohibited in designated safe zones, including spawn locations and emergency service stations.",
            "**R18. Avatar Standards** — Characters must look realistic. Fantasy avatars and unrealistic morphs are prohibited outside approved events. Full tactical gear is restricted to authorized units.",
            "**R19. Character Restrictions** — Child characters may not drive, carry weapons, or engage in unrealistic activities. Do not impersonate nonexistent agencies or perform private security work while on duty.",
            "**R20. Hitman Roleplay** — Only certified civilians may conduct hitman scenarios. Contracts require valid roleplay justification and supporting evidence when requested.",
            "**R21. Group Limits** — Civilian groups are limited to 5 players; certified civilian factions may have 6. Jewelry robberies require at least 2 participants; bank robberies require 3. Larger groups need approval.",
            "**R22. Vehicle & Equipment Restrictions** — Use only authorized vehicles, weapons, uniforms, and equipment. Restricted items require permission or eligible donor benefits.",
            "**R23. Uniforms & Liveries** — Emergency personnel must use approved TexasX uniforms and liveries. Default ER:LC designs and unauthorized unmarked or slick-top vehicles are prohibited.",
            "**R24. Utility & Off-Road Vehicles** — Use lawnmowers in residential areas, tractors on farms, construction equipment at worksites, and ATVs or Canyon Descenders on designated trails."
        ].join("\n\n")
    },
    discord: {
        label: "Discord Rules",
        description: "Read the Texas State Roleplay Discord rules",
        content: [
            "**R1. Respect & Inclusion** — Treat all members with courtesy, regardless of background, identity, beliefs, or opinions. Harassment, bullying, discrimination, and hateful slurs are prohibited.",
            "**R2. Discord Nickname Requirements** — During roleplay, your nickname must match your Roblox username and follow your role format. Outside roleplay, appropriate alternatives are permitted. Unapproved symbols, misleading labels, and terms such as “CIV” or “Robber” are prohibited except approved designations such as “Bank Security.” Formats: `Roblox Username | Civilian Name` or `Callsign | Roblox Username`.",
            "**R3. Staff Disputes** — Respect staff decisions and remain civil. Do not argue with staff publicly or disrupt the community; use a staff report or appeal process instead.",
            "**R4. NSFW & Hateful Content** — Pornography, graphic violence, gore, sexually explicit material, and hateful content are prohibited, including content posted as a joke or to provoke.",
            "**R5. Advertising & Promotion** — Unauthorized promotion of other Discord or Roblox servers, social media accounts, or outside services is prohibited, including promotional links in images or messages.",
            "**R6. Staff Mentions** — Do not repeatedly mention staff or contact them through unnecessary pings. Use the appropriate channels when possible.",
            "**R7. English Language** — English is required in text and voice channels so members can understand conversations and staff can moderate effectively.",
            "**R8. Spam & Channel Organization** — Do not flood channels, repeat messages, or post excessive copy-pasted content. Use each channel for its intended purpose.",
            "**R9. Outside Server Drama** — Do not bring unrelated arguments or drama from other communities into Texas State Roleplay or encourage hostility here.",
            "**R10. Threats & Intimidation** — Threatening, intimidating, or encouraging harm toward members is prohibited. Report threats to staff and, when appropriate, to Discord.",
            "**R11. Alternate Accounts** — Alternate accounts may not be used to participate, evade punishments, bypass restrictions, or gain an unfair advantage.",
            "**R12. Voice Channel Conduct** — Be respectful in voice channels. Excessive background noise, disruptive microphone sounds, shouting, soundboard abuse, and disruptive join/leave behavior are not allowed.",
            "**R13. Encouraging Rule Violations** — Do not encourage, assist, or pressure others into breaking the rules. Everyone is responsible for helping maintain a positive community.",
            "**R14. Moderation Complaints & Appeals** — Do not publicly argue about warnings, mutes, kicks, or bans. Use the appropriate appeal process; report staff conduct through the designated system.",
            "**R15. Punishment Evasion** — Leaving to escape moderation or bypassing a mute or other restriction is prohibited. Using another account to evade discipline may lead to further consequences."
        ].join("\n\n")
    },
    "leo-ten-codes": {
        label: "LEO 10-Codes",
        description: "Law enforcement 10-codes",
        content: [
            "10-0 Disappeared · 10-1 Frequency Change · 10-2 Negative · 10-3 Stop Transmitting · 10-4 Affirmative · 10-5 Stakeout · 10-6 Busy · 10-7 Out of Service · 10-8 In Service · 10-9 Repeat",
            "10-10 Fight in Progress · 10-11 Traffic Stop · 10-12 Active Ride Along · 10-13 Shots Fired · 10-14 Bomb Threat · 10-15 Subject in Custody, Enroute to Station · 10-16 Stolen Vehicle · 10-17 Suspicious Person",
            "10-20 Give Current Location · 10-21 Update Location · 10-22 Disregard · 10-23 Arrived on Scene · 10-24 Leaving Scene · 10-25 Domestic Dispute · 10-26 ETA · 10-27 Drivers License Check for Validation · 10-28 Vehicle License Plate Check · 10-29 NCIC Warrant Check · 10-30 Wanted · 10-31 Not Wanted / No Warrants",
            "10-32 Request Backup (Code 1-2-3) · 10-37 Continue · 10-38 Withdraw · 10-39 Signal Report · 10-41 Beginning Tour of Duty · 10-42 Ending Tour of Duty · 10-50 Major Accident · 10-51 Requesting Towing Service · 10-52 Requesting Medical · 10-53 Requesting Fire Brigade · 10-54 Escort · 10-55 Intoxicated Driver · 10-56 Intoxicated Pedestrian",
            "10-57 Protest · 10-58 Armed Protest · 10-59 Armed with a Bomb · 10-60 Armed with a Gun · 10-61 Armed with a Knife · 10-62 Kidnapping · 10-63 Officer Kidnapping · 10-64 Assault · 10-66 Reckless Driving · 10-67 Reported Fire · 10-68 Armed Robbery · 10-70 Foot Pursuit · 10-71 Requesting Supervisor at Scene",
            "10-72 Requesting Coroner · 10-73 Advise Status · 10-74 Status Affirm · 10-79 Hostage Situation · 10-80 Vehicle Pursuit · 10-81 Advise Pit · 10-82 Begin Pit Timer · 10-84 Report to Station · 10-85 All Units Report to Station · 10-86 Supervisors, Report to Station · 10-95 Staff Member Needed · 10-97 In Route (Call) · 10-98 In Route (Hospital) · 10-99 Officer In Distress; Extreme Emergency Only · 10-100 Officer Down"
        ].join("\n\n")
    },
    "leo-radio": {
        label: "LEO Radio Codes",
        description: "Radio codes and signals",
        content: "**Radio Codes**\nCode 0 Game Crash · Code 1 No Lights, No Siren · Code 2 Lights, No Siren · Code 3 Lights AND Siren · Code 4 Situation Under Control · Code 5 Felony / High-Risk Stop · Code 9 All Units Report In · Code 10 Requesting SWAT Response · Code 11 Requesting AIR Support · Code 200 Prison Break\n\n**Radio Signals**\nSignal 1 Dispatch Available · Signal 2 Dispatch Unavailable · Signal 3 Supervisors Available · Signal 4 Supervisors Unavailable · Signal 5 Bolo Report · Signal 6 Bolo Status / Update · Signal 7 Warrant Report · Signal 8 Warrant Status / Update · Signal 11 Running Radar · Signal 100 Cease All but Emergency Traffic"
    },
    "leo-reference": {
        label: "LEO Quick Reference",
        description: "Phonetic alphabet and Miranda rights",
        content: "**Phonetic Alphabet**\nA — Adam · B — Boy · C — Charlie · D — David · E — Edward · F — Frank · G — George · H — Henry · I — Ida · J — John · K — King · L — Lincoln · M — Mary · N — Nora · O — Ocean · P — Paul · Q — Queen · R — Robert · S — Sam · T — Tom · U — Union · V — Victor · W — William · X — X-ray · Y — Young · Z — Zebra\n\n**Miranda Rights**\nYou have the right to remain silent. Anything you say can and will be used against you in a court of law. You have the right to an attorney. If you cannot afford an attorney, one will be appointed for you by the State of Texas."
    }
});

function dashboardPanelPayload(page = "home", roles = config.selfRoles) {
    const selectedPage = dashboardPages[page];
    if (!selectedPage) throw new Error(`Unknown TexasX dashboard page: ${page}`);
    if (roles.length > 25) throw new Error("SELF_ROLES can contain no more than 25 roles.");
    const pageMenu = new StringSelectMenuBuilder()
        .setCustomId("dashboard:page")
        .setPlaceholder("Choose rules or a reference")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(Object.entries(dashboardPages).map(([value, entry]) => ({
            label: entry.label,
            description: entry.description,
            value,
            default: value === page
        })));
    const extraComponents = [new ActionRowBuilder().addComponents(pageMenu)];
    if (roles.length) {
        const roleMenu = new StringSelectMenuBuilder()
            .setCustomId("self-roles:select")
            .setPlaceholder("Choose notification roles")
            .setMinValues(1)
            .setMaxValues(Math.min(roles.length, 25))
            .addOptions(roles.map((entry) => ({ label: entry.label, value: entry.id })));
        extraComponents.push(new ActionRowBuilder().addComponents(roleMenu));
    }
    const description = selectedPage.label === "Dashboard"
        ? `Welcome to **TexasX | Texas State Roleplay**.\n\n**Quick Access**\nUse the first dropdown to read the in-game rules, Discord rules, or law enforcement guide. Use the second dropdown to toggle notification roles.\n\n${selectedPage.content}`
        : `## ${selectedPage.label}\n${selectedPage.content}`;
    return panelPayload("TexasX Dashboard", description, {
        accentColor: colors.gold,
        headerAsset: "texasx-logo.png",
        extraComponents
    });
}

function ephemeral(content) {
    return panelPayload("TexasX", content, {
        footer: config.serverName,
        timestamp: null,
        includeBrandFooter: false
    });
}

module.exports = {
    colors,
    dashboardPages,
    dashboardPanelPayload,
    departmentRoleAssignedPanel,
    ephemeral,
    hiringAnnouncementPanel,
    panelPayload,
    punishmentPanel,
    reducedActivityRequestPanel,
    recordsPanel,
    selfRolePanelPayload,
    shopPanelPayload,
    staffApplicationUpdatePanel,
    sessionPanel,
    ticketPanelPayload,
    ticketFaqPayload,
    ticketWelcomePayload
};

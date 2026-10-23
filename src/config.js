const recordChannelId = process.env.RECORD_CHANNEL_ID
    || process.env.ANNOUNCEMENT_CHANNEL_ID
    || "1553619403902550089";

const config = Object.freeze({
    token: process.env.BOT_TOKEN,
    guildId: process.env.DISCORD_GUILD_ID || "1553619403344711780",
    sessionId: process.env.SESSION_ID || "1553639022159724615",
    moderatorRoleId: process.env.MODERATOR_ROLE_ID || "1553639045014360084",
    startMentionRoleId: process.env.SESSION_START_ROLE_ID || "1553639022159724615",
    announcementChannelId: process.env.ANNOUNCEMENT_CHANNEL_ID || recordChannelId,
    ticketCategoryId: process.env.TICKET_CATEGORY_ID || "1553646186064384050",
    ticketStaffRoleId: process.env.TICKET_STAFF_ROLE_ID || "1553639045014360084",
    ticketLogChannelId: process.env.TICKET_LOG_CHANNEL_ID || "1553646268172210307",
    ticketPanelChannelId: process.env.TICKET_PANEL_CHANNEL_ID || "1553619403902550089",
    promotionChannelId: process.env.PROMOTION_CHANNEL_ID || recordChannelId,
    punishmentChannelId: process.env.PUNISHMENT_CHANNEL_ID || recordChannelId,
    joinServerUrl: process.env.JOIN_SERVER_URL || "https://www.roblox.com/games/2534724415/Emergency-Response-Liberty-County",
    supportGuildId: process.env.SUPPORT_GUILD_ID || "1530706479349502003",
    supportChannelId: process.env.SUPPORT_CHANNEL_ID || "1530781988280078661",
    embedColor: 0xC67537,
    brandName: "South Carolina Management",
    serverName: "South Carolina State Roleplay",
    serverMode: "VC Required",
    inGameCode: "Richland SC",
    serverOwner: "boogs0522"
});

module.exports = config;

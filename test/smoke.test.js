const assert = require("node:assert/strict");
const test = require("node:test");

const config = require("../src/config");
const commands = require("../src/commands");
const {
    dashboardPages,
    dashboardPanelPayload,
    dashboardSelectionReplyPayload,
    departmentRoleAssignedPanel,
    ephemeral,
    hiringAnnouncementPanel,
    panelPayload,
    punishmentPanel,
    reducedActivityRequestPanel,
    recordsPanel,
    selfRolePanelPayload,
    sessionPanel,
    ticketPanelPayload,
    ticketFaqPayload,
    ticketWelcomePayload,
    shopPanelPayload,
    staffApplicationUpdatePanel
} = require("../src/embeds");
const { MessageFlags } = require("discord.js");
const { sendPunishmentNotice } = require("../src/notifications");

const expectedCommands = [
    "add", "appeal", "ban", "claim", "close", "interview-pass", "my-punishments",
    "punish", "punishment-edit", "punishment-history", "punishment-void", "queue-add",
    "queue-remove", "ra", "ra-admin", "reinstate", "remove", "request-ra", "resign",
    "dashboard", "say", "self-roles", "session-end", "session-low", "session-start", "shop",
    "staff-accept", "staff-deny", "suspension-view", "ticket-panel", "tweet", "twitter",
    "unban", "wl-session-end", "wl-session-start"
];

test("all requested slash commands serialize with unique names", () => {
    const names = commands.map((entry) => entry.name);
    assert.equal(new Set(names).size, names.length);
    for (const name of expectedCommands) assert.ok(names.includes(name), `Missing /${name}`);
    assert.ok(names.length <= 100);
});

test("server configuration matches Texas State Roleplay", () => {
    assert.equal(config.serverName, "Texas State Roleplay | TexasX");
    assert.equal(config.serverMode, "TexasX");
    assert.equal(config.inGameCode, "TexasX");
    assert.deepEqual(config.selfRoles, [
        { id: "1551093861831680041", label: "Session Notification" },
        { id: "1555042915221512232", label: "Update Notification" },
        { id: "1551093906605740095", label: "Announcements Notification" }
    ]);
    assert.equal(config.sessionNotificationRoleId, "1551093861831680041");
    assert.equal(config.serverOwner, "boogs0522");
    assert.equal(config.punishmentChannelId, process.env.PUNISHMENT_CHANNEL_ID || "1562252468220592209");
    assert.equal(config.dashboardChannelId, process.env.DASHBOARD_CHANNEL_ID || "1562249568840712212");
    assert.equal(config.assistanceChannelId, process.env.ASSISTANCE_CHANNEL_ID || "1562249683806457886");
    assert.equal(
        config.reducedActivityChannelId,
        process.env.RA_REQUEST_CHANNEL_ID || "1561239693344120893"
    );
    assert.equal(
        config.reducedActivityRoleId,
        process.env.RA_ROLE_ID || "1561239853944012861"
    );
    assert.deepEqual(
        Object.fromEntries(Object.entries(config.ticketTypes)
            .map(([key, value]) => [key, { categoryId: value.categoryId, roleIds: value.roleIds }])),
        {
            "general-support": {
                categoryId: process.env.TICKET_GENERAL_SUPPORT_CATEGORY_ID
                    || process.env.TICKET_CATEGORY_ID
                    || "1532112428324884731",
                roleIds: ["1532111365370806333"]
            },
            "community-support": {
                categoryId: process.env.TICKET_COMMUNITY_SUPPORT_CATEGORY_ID || "1532112366202912839",
                roleIds: ["1551098535427047455", "1551098623696306206"]
            },
            "staff-report": {
                categoryId: process.env.TICKET_STAFF_REPORT_CATEGORY_ID || "1532112504929648843",
                roleIds: ["1530786131292197004"]
            },
            partnership: {
                categoryId: process.env.TICKET_PARTNERSHIP_CATEGORY_ID || "1532112647607029970",
                roleIds: ["1551098535427047455"]
            }
        }
    );
});

function componentText(payload) {
    return payload.components[0].toJSON().components
        .filter((component) => component.type === 10)
        .map((component) => component.content)
        .join("\n");
}

function assertComponentsV2(payload) {
    assert.ok(payload.flags & MessageFlags.IsComponentsV2);
    assert.equal(payload.embeds, undefined);
    assert.equal(payload.content, undefined);
    assert.equal(payload.components.length, 1);
    assert.equal(payload.components[0].toJSON().type, 17);
    assert.ok(payload.components[0].toJSON().components.some((component) => component.type === 14));
}

test("session start uses Components V2, separators, and the configured server identity", () => {
    const payload = sessionPanel("start", { active: true, startedAt: 1_800_000_000_000 });
    assertComponentsV2(payload);
    const container = payload.components[0].toJSON();
    const text = componentText(payload);
    assert.equal(container.components[0].type, 12);
    assert.equal(container.components[0].items[0].media.url, "attachment://session-header.png");
    assert.doesNotMatch(text, /^# SESSION/m);
    assert.match(text, new RegExp(config.serverName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(text, /TexasX/);
    assert.match(text, /boogs0522/);
    assert.ok(payload.files.some((file) => file.name === "session-header.png"));
    assert.ok(payload.files.some((file) => file.name === "footer-banner.png"));
});

test("whitelist sessions use a distinct announcement heading", () => {
    const payload = sessionPanel("start", { active: true, startedAt: 1_800_000_000_000 }, "whitelist");
    assertComponentsV2(payload);
    assert.match(componentText(payload), /# WHITELIST SESSION/);
});

test("session end matches the closed-session copy and includes the notification button", () => {
    const payload = sessionPanel("end", { active: false, durationMs: 3_600_000 });
    assertComponentsV2(payload);
    const container = payload.components[0].toJSON();
    const text = componentText(payload);
    assert.equal(container.components[0].items[0].media.url, "attachment://session-header.png");
    assert.doesNotMatch(text, /^# SESSIONS/m);
    assert.match(text, /Texas State Roleplay \| TexasX/);
    assert.match(text, /session has now ended/);
    assert.match(text, /The server is now closed/);
    assert.match(text, /Stay tuned for the next session startup/);
    assert.ok(container.components.some((component) => component.type === 1
        && component.components.some((button) => button.custom_id === "session:notifications"
            && button.label === "Get Session Notification!")));
    assert.equal(container.components.at(-1).type, 12);
    assert.equal(container.components.at(-1).items[0].media.url, "attachment://footer-banner.png");
    assert.ok(payload.files.some((file) => file.name === "session-header.png"));
    assert.ok(payload.files.some((file) => file.name === "footer-banner.png"));
});

test("punishment panel uses Components V2 separators and the infraction layout", () => {
    const payload = punishmentPanel({
        id: "SC-TEST1234",
        memberId: "100000000000000001",
        issuedBy: "100000000000000002",
        issuedAt: 1_800_000_000_000,
        type: "Strike",
        reason: "Test reason",
        expiration: "Never",
        voided: false
    });
    assertComponentsV2(payload);
    const text = componentText(payload);
    assert.match(text, /# INFRACTIONS/);
    assert.match(text, /Infraction ID/);
    assert.match(text, /## Staff Information/);
    assert.match(text, /## Punishment Details/);
    const container = payload.components[0].toJSON();
    assert.equal(container.components[0].items[0].media.url, "attachment://departments-header.png");
    assert.equal(container.components.at(-1).items[0].media.url, "attachment://footer-banner.png");
    assert.ok(payload.files.some((file) => file.name === "departments-header.png"));
    assert.ok(payload.files.some((file) => file.name === "footer-banner.png"));
    assert.deepEqual(payload.allowedMentions, { parse: [] });
    const issuedPayload = punishmentPanel({
        id: "SC-TEST1234",
        memberId: "100000000000000001",
        issuedBy: "100000000000000002",
        issuedAt: 1_800_000_000_000,
        type: "Strike",
        reason: "Test reason",
        expiration: "Never",
        voided: false
    }, { pingTarget: true });
    assert.deepEqual(issuedPayload.allowedMentions, { users: ["100000000000000001"] });
});

test("punishment notice is DMed and failed DMs are reported without throwing", async () => {
    const payload = punishmentPanel({
        id: "SC-TEST1234",
        memberId: "100000000000000001",
        issuedBy: "100000000000000002",
        issuedAt: 1_800_000_000_000,
        type: "Strike",
        reason: "Test reason",
        expiration: "Never",
        voided: false
    });
    let received;
    const success = await sendPunishmentNotice({
        id: "100000000000000001",
        send: async (message) => { received = message; }
    }, payload);
    assert.deepEqual(success, { sent: true });
    assert.equal(received, payload);

    const closed = await sendPunishmentNotice({
        id: "100000000000000001",
        send: async () => { throw Object.assign(new Error("DMs closed"), { code: 50007 }); }
    }, payload);
    assert.deepEqual(closed, { sent: false, reason: "closed" });
});

test("all reusable message panel payloads use Components V2", () => {
    const payloads = [
        ephemeral("Done."),
        dashboardPanelPayload(),
        panelPayload("Panel", "Text", { sections: [{ title: "Details", content: "More" }] }),
        recordsPanel("History", "100000000000000001", []),
        selfRolePanelPayload([{ id: "100000000000000001", label: "Member" }]),
        ticketPanelPayload(),
        ticketFaqPayload(),
        ticketWelcomePayload("100000000000000001", config.ticketTypes["general-support"])
    ];
    for (const payload of payloads) assertComponentsV2(payload);
});

test("the role-request panel uses the role-request artwork", () => {
    const payload = selfRolePanelPayload([{ id: "100000000000000001", label: "Member" }]);
    const container = payload.components[0].toJSON();
    assert.equal(container.components[0].items[0].media.url, "attachment://role-request-header.png");
    assert.ok(payload.files.some((file) => file.name === "role-request-header.png"));
});

test("the hiring panel uses applications artwork and keeps its action in the V2 container", () => {
    const payload = hiringAnnouncementPanel();
    const container = payload.components[0].toJSON();
    assert.equal(container.components[0].items[0].media.url, "attachment://applications-header.png");
    assert.ok(payload.files.some((file) => file.name === "applications-header.png"));
    assert.ok(container.components.some((component) => component.type === 1
        && component.components.some((button) => button.label === "Staff Applications")));
});

test("staff role, application update, and shop panels use their matching artwork", () => {
    const panels = [
        [departmentRoleAssignedPanel("100000000000000001", "100000000000000002"), "departments-header.png"],
        [staffApplicationUpdatePanel("TexasX", "Try again next round."), "applications-header.png"],
        [shopPanelPayload("https://example.com/shop"), "marketplace-header.png"]
    ];
    for (const [payload, filename] of panels) {
        assertComponentsV2(payload);
        const container = payload.components[0].toJSON();
        assert.equal(container.components[0].items[0].media.url, `attachment://${filename}`);
        assert.ok(payload.files.some((file) => file.name === filename));
    }
    const shop = shopPanelPayload("https://example.com/shop");
    const linkButton = shop.components[0].toJSON().components
        .flatMap((component) => component.components || [])
        .find((component) => component.type === 2);
    assert.equal(linkButton.url, "https://example.com/shop");
});

test("TexasX dashboard pages render all rules and LEO references inside V2 dropdown panels", () => {
    const home = dashboardPanelPayload();
    assertComponentsV2(home);
    const container = home.components[0].toJSON();
    const menus = container.components
        .filter((component) => component.type === 1)
        .map((row) => row.components[0]);
    assert.equal(container.components[0].items[0].media.url, "attachment://dashboard-header.png");
    assert.ok(home.files.some((file) => file.name === "dashboard-header.png"));
    assert.deepEqual(menus.map((menu) => menu.custom_id), ["dashboard:page", "self-roles:select"]);
    assert.deepEqual(menus[0].options.map((option) => option.value), Object.keys(dashboardPages));
    assert.deepEqual(menus[1].options.map((option) => option.value), [
        "1551093861831680041",
        "1555042915221512232",
        "1551093906605740095"
    ]);
    for (const [page, details] of Object.entries(dashboardPages)) {
        const payload = dashboardPanelPayload(page);
        assertComponentsV2(payload);
        assert.ok(details.content.length < 4000, `${page} exceeds the V2 text component limit`);
        assert.match(componentText(payload), new RegExp(details.label === "Dashboard" ? "Quick Access" : details.label));
        assert.ok(payload.components[0].toJSON().components.some((component) => component.type === 1));
        assert.ok(payload.components[0].toJSON().components.length <= 10);
        for (const component of payload.components[0].toJSON().components) {
            if (component.type === 10) assert.ok(component.content.length <= 4000);
        }
    }
    const gameplayRules = componentText(dashboardPanelPayload("ingame"));
    for (let rule = 1; rule <= 24; rule++) {
        assert.ok(gameplayRules.includes(`**R${rule}.`), `Missing in-game rule ${rule}`);
    }
    const discordRules = componentText(dashboardPanelPayload("discord"));
    for (let rule = 1; rule <= 15; rule++) {
        assert.ok(discordRules.includes(`**R${rule}.`), `Missing Discord rule ${rule}`);
    }
    const leoCodes = componentText(dashboardPanelPayload("leo-ten-codes"));
    assert.match(leoCodes, /10-0 Disappeared/);
    assert.match(leoCodes, /10-100 Officer Down/);
    assert.match(componentText(dashboardPanelPayload("leo-radio")), /Signal 100 Cease All but Emergency Traffic/);
    assert.match(componentText(dashboardPanelPayload("leo-reference")), /State of Texas/);
});

test("dashboard dropdown choices reply privately with the selected section", () => {
    for (const [page, details] of Object.entries(dashboardPages)) {
        const payload = dashboardSelectionReplyPayload(page);
        assertComponentsV2(payload);
        assert.ok(payload.flags & MessageFlags.Ephemeral);
        assert.match(componentText(payload), new RegExp(details.label === "Dashboard" ? "Quick Access" : details.label));
        if (page !== "home") assert.ok(componentText(payload).includes(details.content));
        assert.ok(payload.components[0].toJSON().components
            .some((component) => component.type === 1
                && component.components[0].custom_id === "dashboard:page"));
    }
});

test("ticket panel includes supplied header/footer artwork and both actions", () => {
    const payload = ticketPanelPayload();
    const container = payload.components[0].toJSON();
    assertComponentsV2(payload);
    assert.equal(container.components[0].items[0].media.url, "attachment://assistance-header.png");
    assert.equal(container.components.at(-1).items[0].media.url, "attachment://footer-banner.png");
    assert.ok(payload.files.some((file) => file.name === "assistance-header.png"));
    assert.ok(payload.files.some((file) => file.name === "footer-banner.png"));
    const buttons = container.components.find((component) => component.type === 1).components;
    const menu = container.components.find((component) => component.type === 1
        && component.components[0].type === 3).components[0];
    assert.deepEqual(buttons.map((button) => button.custom_id), ["ticket:faq"]);
    assert.equal(menu.custom_id, "ticket:type");
    assert.deepEqual(menu.options.map((option) => option.value), Object.keys(config.ticketTypes));
});

test("ticket FAQ, embedded selector, and pings are sent only as Components V2 content", () => {
    const faq = ticketFaqPayload();
    const panel = ticketPanelPayload();
    const welcome = ticketWelcomePayload(
        "100000000000000001",
        config.ticketTypes["community-support"]
    );
    assertComponentsV2(faq);
    assert.match(componentText(faq), /FAQ/);
    assertComponentsV2(panel);
    const selectorMenu = panel.components[0].toJSON().components
        .find((component) => component.type === 1 && component.components[0].type === 3)
        .components[0];
    assert.deepEqual(selectorMenu.options.map((option) => option.value), Object.keys(config.ticketTypes));
    assertComponentsV2(welcome);
    assert.equal(welcome.content, undefined);
    assert.match(componentText(welcome), /<@&1551098535427047455>/);
    assert.match(componentText(welcome), /<@&1551098623696306206>/);
    assert.deepEqual(welcome.allowedMentions, {
        users: ["100000000000000001"],
        roles: ["1551098535427047455", "1551098623696306206"]
    });
    const claimed = ticketWelcomePayload(
        "100000000000000001",
        config.ticketTypes["community-support"],
        "100000000000000099"
    );
    assertComponentsV2(claimed);
    assert.deepEqual(claimed.allowedMentions, { parse: [] });
    assert.match(componentText(claimed), /Claimed by/);
    const claimButton = claimed.components[0].toJSON().components
        .find((component) => component.type === 1).components[0];
    assert.equal(claimButton.custom_id, "ticket:claim");
    assert.equal(claimButton.disabled, true);
});

test("Reduced Activity requests post a review panel with decision buttons", () => {
    const payload = reducedActivityRequestPanel({
        id: "RA-ABCDEF12",
        memberId: "100000000000000001",
        reason: "Exams this week",
        until: "2026-11-01",
        requestedAt: 1_800_000_000_000,
        status: "pending"
    });

    test("hiring panel links to the supplied applications channel", () => {
        const payload = hiringAnnouncementPanel();
        assertComponentsV2(payload);
        assert.match(componentText(payload), /currently hiring staff/i);
        const button = payload.components[0].toJSON().components
            .flatMap((component) => component.components || [])
            .find((component) => component.type === 2);
        assert.equal(button.label, "Staff Applications");
        assert.equal(button.url, config.applicationsChannelUrl);
    });
    assertComponentsV2(payload);
    assert.match(componentText(payload), /RA-ABCDEF12/);
    assert.match(componentText(payload), /Exams this week/);
    const buttons = payload.components[0].toJSON().components
        .flatMap((component) => component.components || [])
        .filter((component) => component.type === 2);
    assert.deepEqual(buttons.map((button) => button.custom_id), [
        "ra-review:accept:RA-ABCDEF12",
        "ra-review:deny:RA-ABCDEF12"
    ]);
});

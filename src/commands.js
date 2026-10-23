const { PermissionFlagsBits, SlashCommandBuilder } = require("discord.js");

const sessionCommand = new SlashCommandBuilder()
    .setName("session")
    .setDescription("Manage server sessions.")
    .addSubcommand((subcommand) =>
        subcommand
            .setName("start")
            .setDescription("Announce that a server session has started.")
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("end")
            .setDescription("Announce that the current server session has ended.")
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("status")
            .setDescription("View the current session status.")
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("history")
            .setDescription("View details about the most recent session.")
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("subscribe")
            .setDescription("Opt in to session-start notifications.")
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName("unsubscribe")
            .setDescription("Opt out of session-start notifications.")
    );

const helpCommand = new SlashCommandBuilder()
    .setName("help")
    .setDescription("View bot commands and how to use them.");

const pingCommand = new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check the bot and Discord connection status.");

const serverInfoCommand = new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("View server details and session information.");

const punishmentCommand = new SlashCommandBuilder()
    .setName("punishment")
    .setDescription("Issue a punishment and record its infraction ID.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((option) =>
        option
            .setName("member")
            .setDescription("The member receiving the punishment.")
            .setRequired(true)
    )
    .addStringOption((option) =>
        option
            .setName("punishment")
            .setDescription("The punishment being issued.")
            .setMaxLength(500)
            .setRequired(true)
    )
    .addStringOption((option) =>
        option
            .setName("reason")
            .setDescription("Why the punishment is being issued.")
            .setMaxLength(1000)
            .setRequired(true)
    );

const punishmentChangeCommand = new SlashCommandBuilder()
    .setName("punishmentchange")
    .setDescription("Change the punishment attached to an infraction ID.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
        option
            .setName("infraction_id")
            .setDescription("The ID shown on the punishment record.")
            .setRequired(true)
    )
    .addStringOption((option) =>
        option
            .setName("punishment")
            .setDescription("The replacement punishment.")
            .setMaxLength(500)
            .setRequired(true)
    );

const punishmentHistoryCommand = new SlashCommandBuilder()
    .setName("punishmenthistory")
    .setDescription("View a member's recent punishment records.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((option) =>
        option
            .setName("member")
            .setDescription("The member whose record history should be shown.")
            .setRequired(true)
    );

const promotionCommand = new SlashCommandBuilder()
    .setName("promotion")
    .setDescription("Record a member promotion in the promotions channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((option) =>
        option
            .setName("member")
            .setDescription("The member being promoted.")
            .setRequired(true)
    )
    .addStringOption((option) =>
        option
            .setName("rank")
            .setDescription("The member's new rank.")
            .setMaxLength(100)
            .setRequired(true)
    )
    .addStringOption((option) =>
        option
            .setName("reason")
            .setDescription("Why the member is being promoted.")
            .setMaxLength(1000)
            .setRequired(true)
    )
    .addStringOption((option) =>
        option
            .setName("previous_rank")
            .setDescription("The member's previous rank, if known.")
            .setMaxLength(100)
    );

function addPromotionDetailsOptions(command) {
    return command
        .addStringOption((option) =>
            option
                .setName("department")
                .setDescription("The department or team recognizing this promotion.")
                .setMaxLength(100)
        )
        .addStringOption((option) =>
            option
                .setName("effective_date")
                .setDescription("When the new rank takes effect.")
                .setMaxLength(100)
        )
        .addStringOption((option) =>
            option
                .setName("achievement")
                .setDescription("A specific contribution or achievement being recognized.")
                .setMaxLength(1000)
        )
        .addStringOption((option) =>
            option
                .setName("responsibilities")
                .setDescription("What the new role is expected to take on.")
                .setMaxLength(1000)
        )
        .addStringOption((option) =>
            option
                .setName("endorsement")
                .setDescription("A note from leadership for the announcement.")
                .setMaxLength(1000)
        );
}

addPromotionDetailsOptions(promotionCommand);

const promotionChangeCommand = new SlashCommandBuilder()
    .setName("promotionchange")
    .setDescription("Update a promotion record by its ID.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
        option
            .setName("promotion_id")
            .setDescription("The ID shown on the promotion record.")
            .setRequired(true)
    )
    .addStringOption((option) =>
        option
            .setName("rank")
            .setDescription("The corrected new rank.")
            .setMaxLength(100)
            .setRequired(true)
    )
    .addStringOption((option) =>
        option
            .setName("reason")
            .setDescription("The corrected promotion reason.")
            .setMaxLength(1000)
    );

addPromotionDetailsOptions(promotionChangeCommand);

const promotionHistoryCommand = new SlashCommandBuilder()
    .setName("promotionhistory")
    .setDescription("View a member's recent promotion records.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((option) =>
        option
            .setName("member")
            .setDescription("The member whose promotion history should be shown.")
            .setRequired(true)
    );

module.exports = [
    helpCommand.toJSON(),
    pingCommand.toJSON(),
    serverInfoCommand.toJSON(),
    sessionCommand.toJSON(),
    punishmentCommand.toJSON(),
    punishmentChangeCommand.toJSON(),
    punishmentHistoryCommand.toJSON(),
    promotionCommand.toJSON(),
    promotionChangeCommand.toJSON(),
    promotionHistoryCommand.toJSON()
];

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  AttachmentBuilder,
  GuildMember,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import path from "path";
import fs from "fs";
import { isAdministrator } from "../../security/auth";
import { fetchGuildData } from "../../discord/fetcher";
import { restoreGuildData, RestoreProgressState } from "../../discord/restorer";
import { serializeBackup, deserializeBackup } from "../../storage/serializer";
import { createSecureTempDir, cleanupTempDir, sanitizeFileName } from "../../utils/temp";
import { Config } from "../../config";

const funnyResponses = [
  "bro tried to command me lol",
  "gg wp zero restore errors",
  "zynren supreme mode activated",
  "system operational bro",
  "why did you click this command lol",
];

const activeOperations = new Set<string>();

export const commands = [
  new SlashCommandBuilder()
    .setName("zynren")
    .setDescription("zenryn discord server backup utility")
    .addSubcommand((sub) =>
      sub.setName("export").setDescription("export server backup")
    )
    .addSubcommand((sub) =>
      sub
        .setName("import")
        .setDescription("import server backup")
        .addAttachmentOption((opt) =>
          opt
            .setName("backup")
            .setDescription(".zynren backup file")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("funnycommand").setDescription("harmless funny command")
    ),
];

export async function handleInteraction(
  interaction: ChatInputCommandInteraction,
  config: Config
): Promise<void> {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "funnycommand") {
    try {
      await interaction.deferReply({ ephemeral: false });
      const randomMsg =
        funnyResponses[Math.floor(Math.random() * funnyResponses.length)];
      await interaction.editReply({ content: randomMsg });
    } catch {}
    return;
  }

  const member = interaction.member as GuildMember | null;
  if (!isAdministrator(member)) {
    await interaction.reply({
      content: "discord said nah on that one",
      ephemeral: true,
    });
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({
      content: "discord said nah on that one",
      ephemeral: true,
    });
    return;
  }

  if (activeOperations.has(guild.id)) {
    await interaction.reply({
      content: "discord said nah on that one",
      ephemeral: true,
    });
    return;
  }

  activeOperations.add(guild.id);

  try {
    if (subcommand === "export") {
      await interaction.deferReply({ ephemeral: false });

      const tempDir = createSecureTempDir(config.tempDir);
      try {
        const data = await fetchGuildData(guild, async (state: ProgressState) => {
          const now = Date.now();
          const elapsedSec = Math.floor((now - state.startTime) / 1000);
          
          let estRemainingSec = 0;
          if (state.completedStepsCount > 0) {
            const timePerStep = (now - state.startTime) / state.completedStepsCount;
            const stepsLeft = state.totalStepsEstimated - state.completedStepsCount;
            estRemainingSec = Math.max(0, Math.ceil((timePerStep * stepsLeft) / 1000));
          } else {
            estRemainingSec = 10;
          }

          const lines = ["exporting backup progress:"];
          for (const item of state.items) {
            let symbol = "[ ]";
            if (item.status === "in_progress") symbol = "[>]";
            if (item.status === "done") symbol = "[x]";
            
            const detailStr = item.details ? ` (${item.details})` : "";
            lines.push(`${symbol} ${item.step}${detailStr}`);
          }

          lines.push(`elapsed time: ${elapsedSec}s | expected finish: ~${estRemainingSec}s remaining`);

          try {
            await interaction.editReply({ content: lines.join("\n") });
          } catch {}
        });

        const serialized = serializeBackup(data);

        const fileName = `${sanitizeFileName(guild.name)}.zynren`;
        const filePath = path.join(tempDir, fileName);

        fs.writeFileSync(filePath, serialized, { mode: 0o600 });

        const attachment = new AttachmentBuilder(filePath, { name: fileName });

        let sentDm = false;
        try {
          const user = interaction.user;
          const dmChannel = await user.createDM();
          await dmChannel.send({
            content: "backup saved i've attached the file below, use /zynren import to import it",
            files: [attachment],
          });
          sentDm = true;
        } catch {}

        const finalLines = [
          "exporting backup progress:",
          "[x] guild info",
          `[x] roles (${data.roles.length} roles)`,
          `[x] channels (${data.channels.length} channels)`,
          `[x] emojis (${data.emojis.length} emojis)`,
          `[x] stickers (${data.stickers.length} stickers)`,
          `[x] webhooks (${data.webhooks.length} webhooks)`,
          `[x] automod rules (${data.autoModRules.length} automod rules)`,
          sentDm ? "status: backup complete! sent to your dms." : "status: backup complete! attached below."
        ];

        if (sentDm) {
          await interaction.editReply({
            content: finalLines.join("\n"),
          });
        } else {
          await interaction.editReply({
            content: finalLines.join("\n"),
            files: [attachment],
          });
        }
      } catch {
        await interaction.editReply({ content: "discord said nah on that one" });
      } finally {
        cleanupTempDir(tempDir);
      }
    } else if (subcommand === "import") {
      const attachmentOption = interaction.options.getAttachment("backup", true);

      if (!attachmentOption.name.endsWith(".zynren")) {
        await interaction.reply({
          content: "backup is invalid bro",
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: false });

      let backupBuffer: Buffer;
      try {
        const response = await fetch(attachmentOption.url);
        const arrayBuf = await response.arrayBuffer();
        backupBuffer = Buffer.from(arrayBuf);
      } catch {
        await interaction.editReply({ content: "backup is invalid bro" });
        return;
      }

      let parsedData;
      try {
        parsedData = deserializeBackup(backupBuffer, config.maxBackupSizeBytes);
      } catch {
        await interaction.editReply({ content: "backup is invalid bro" });
        return;
      }

      const confirmCustomId = `clear_yes_${interaction.id}`;
      const cancelCustomId = `clear_no_${interaction.id}`;

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(confirmCustomId)
          .setLabel("yes, clear server")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(cancelCustomId)
          .setLabel("no, keep existing")
          .setStyle(ButtonStyle.Secondary)
      );

      const promptMsg = await interaction.editReply({
        content: "do you want to clear existing channels and roles before importing backup? (command channel will not be deleted)",
        components: [row],
      });

      let clearServer = false;
      try {
        const buttonInteraction = await promptMsg.awaitMessageComponent({
          componentType: ComponentType.Button,
          filter: (i) => i.user.id === interaction.user.id && (i.customId === confirmCustomId || i.customId === cancelCustomId),
          time: 60000,
        });

        clearServer = buttonInteraction.customId === confirmCustomId;
        await buttonInteraction.deferUpdate();
      } catch {
        clearServer = false;
      }

      await interaction.editReply({
        content: "ok wait loading backup...",
        components: [],
      });

      try {
        const result = await restoreGuildData(
          guild,
          parsedData,
          clearServer,
          interaction.channelId,
          async (state: RestoreProgressState) => {
            const now = Date.now();
            const elapsedSec = Math.floor((now - state.startTime) / 1000);
            
            let estRemainingSec = 0;
            if (state.completedStepsCount > 0) {
              const timePerStep = (now - state.startTime) / state.completedStepsCount;
              const stepsLeft = state.totalStepsEstimated - state.completedStepsCount;
              estRemainingSec = Math.max(0, Math.ceil((timePerStep * stepsLeft) / 1000));
            } else {
              estRemainingSec = 15;
            }

            const lines = ["importing backup progress:"];
            for (const item of state.items) {
              let symbol = "[ ]";
              if (item.status === "in_progress") symbol = "[>]";
              if (item.status === "done") symbol = "[x]";
              
              const detailStr = item.details ? ` (${item.details})` : "";
              lines.push(`${symbol} ${item.step}${detailStr}`);
            }

            lines.push(`elapsed time: ${elapsedSec}s | expected finish: ~${estRemainingSec}s remaining`);

            try {
              await interaction.editReply({ content: lines.join("\n"), components: [] });
            } catch {}
          }
        );

        const finalLines = [
          "importing backup progress:",
          `[x] clear server (${clearServer ? "cleared, command channel preserved" : "skipped"})`,
          "[x] guild info (restored)",
          `[x] roles (${result.rolesCount} restored)`,
          `[x] categories (${result.categoriesCount} restored)`,
          `[x] channels (${result.channelsCount} restored)`,
          `[x] emojis (${result.emojisCount} restored)`,
          `[x] stickers (${result.stickersCount} restored)`,
          `[x] webhooks (${result.webhooksCount} restored)`,
          `[x] automod rules (${result.autoModRulesCount} restored)`,
          "status: backup restored successfully!"
        ];

        await interaction.editReply({ content: finalLines.join("\n"), components: [] });
      } catch {
        await interaction.editReply({ content: "discord said nah on that one", components: [] });
      }
    }
  } finally {
    activeOperations.delete(guild.id);
  }
}

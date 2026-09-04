import { Guild, ChannelType, PermissionsBitField } from "discord.js";
import { ZenRynBackupData } from "../storage/format";

export interface RestorationResult {
  rolesCount: number;
  categoriesCount: number;
  channelsCount: number;
  emojisCount: number;
  stickersCount: number;
  webhooksCount: number;
  autoModRulesCount: number;
}

export interface RestoreProgressItem {
  step: string;
  status: "pending" | "in_progress" | "done";
  details?: string;
}

export interface RestoreProgressState {
  items: RestoreProgressItem[];
  startTime: number;
  totalStepsEstimated: number;
  completedStepsCount: number;
}

export async function restoreGuildData(
  guild: Guild,
  data: ZenRynBackupData,
  clearServer: boolean,
  commandChannelId: string,
  onProgress?: (state: RestoreProgressState) => Promise<void>
): Promise<RestorationResult> {
  const startTime = Date.now();
  const state: RestoreProgressState = {
    items: [
      { step: clearServer ? "clearing existing server structure" : "skipping server clear", status: "pending" },
      { step: "guild info", status: "pending" },
      { step: "roles", status: "pending" },
      { step: "categories", status: "pending" },
      { step: "channels", status: "pending" },
      { step: "emojis", status: "pending" },
      { step: "stickers", status: "pending" },
      { step: "webhooks", status: "pending" },
      { step: "automod rules", status: "pending" },
    ],
    startTime,
    totalStepsEstimated: 9,
    completedStepsCount: 0,
  };

  const update = async () => {
    if (onProgress) {
      await onProgress(state);
    }
  };

  const idMap = new Map<string, string>();
  let rolesCount = 0;
  let categoriesCount = 0;
  let channelsCount = 0;
  let emojisCount = 0;
  let stickersCount = 0;
  let webhooksCount = 0;
  let autoModRulesCount = 0;

  if (clearServer) {
    state.items[0].status = "in_progress";
    await update();

    try {
      const existingChannels = await guild.channels.fetch();
      for (const ch of existingChannels.values()) {
        if (ch && ch.id !== commandChannelId) {
          try {
            await ch.delete();
          } catch {}
        }
      }
    } catch {}

    try {
      const existingRoles = await guild.roles.fetch();
      for (const r of existingRoles.values()) {
        if (!r.managed && r.name !== "@everyone") {
          try {
            await r.delete();
          } catch {}
        }
      }
    } catch {}

    state.items[0].status = "done";
    state.items[0].details = "server cleared (command channel preserved)";
  } else {
    state.items[0].status = "done";
    state.items[0].details = "skipped";
  }
  state.completedStepsCount++;
  await update();

  state.items[1].status = "in_progress";
  state.items[1].details = "server name";
  await update();
  try {
    const editPayload: any = {};
    if (data.guildName) editPayload.name = data.guildName;
    if (data.description !== undefined) editPayload.description = data.description;
    if (data.iconBase64) {
      state.items[1].details = "server pfp";
      await update();
      editPayload.icon = Buffer.from(data.iconBase64, "base64");
    }
    if (data.bannerBase64) {
      state.items[1].details = "server banner";
      await update();
      editPayload.banner = Buffer.from(data.bannerBase64, "base64");
    }
    if (data.splashBase64) {
      state.items[1].details = "server splash";
      await update();
      editPayload.splash = Buffer.from(data.splashBase64, "base64");
    }

    if (data.settings) {
      if (data.settings.verificationLevel !== undefined) editPayload.verificationLevel = data.settings.verificationLevel;
      if (data.settings.defaultMessageNotifications !== undefined) editPayload.defaultMessageNotifications = data.settings.defaultMessageNotifications;
      if (data.settings.explicitContentFilter !== undefined) editPayload.explicitContentFilter = data.settings.explicitContentFilter;
      if (data.settings.afkTimeout !== undefined) editPayload.afkTimeout = data.settings.afkTimeout;
      if (data.settings.preferredLocale) editPayload.preferredLocale = data.settings.preferredLocale;
    }

    await guild.edit(editPayload);
    state.items[1].status = "done";
    state.items[1].details = undefined;
  } catch {
    state.items[1].status = "done";
    state.items[1].details = undefined;
  }
  state.completedStepsCount++;
  await update();

  state.items[2].status = "in_progress";
  state.items[2].details = "restoring roles (0/0)...";
  await update();
  const sortedRoles = [...data.roles].sort((a, b) => a.position - b.position);
  let processedRoles = 0;
  for (const r of sortedRoles) {
    if (r.managed || r.name === "@everyone") {
      const existingEveryone = guild.roles.everyone;
      if (r.name === "@everyone" && existingEveryone) {
        idMap.set(r.id, existingEveryone.id);
      }
      continue;
    }
    try {
      const createdRole = await guild.roles.create({
        name: r.name,
        color: r.color,
        hoist: r.hoist,
        permissions: BigInt(r.permissions),
        mentionable: r.mentionable,
      });
      idMap.set(r.id, createdRole.id);
      rolesCount++;
    } catch {}
    processedRoles++;
    if (processedRoles % 5 === 0 || processedRoles === sortedRoles.length) {
      state.items[2].details = `${rolesCount}/${sortedRoles.length} roles`;
      await update();
    }
  }
  state.items[2].status = "done";
  state.items[2].details = `${rolesCount} roles restored`;
  state.completedStepsCount++;
  await update();

  state.items[3].status = "in_progress";
  await update();
  const categoryChannels = data.channels.filter((c) => c.type === ChannelType.GuildCategory);
  for (const cat of categoryChannels) {
    try {
      const createdCategory = await guild.channels.create({
        name: cat.name,
        type: ChannelType.GuildCategory,
        position: cat.position,
      });
      idMap.set(cat.id, createdCategory.id);
      categoriesCount++;
    } catch {}
  }
  state.items[3].status = "done";
  state.items[3].details = `${categoriesCount} categories restored`;
  state.completedStepsCount++;
  await update();

  state.items[4].status = "in_progress";
  await update();
  const nonCategoryChannels = data.channels.filter((c) => c.type !== ChannelType.GuildCategory);
  let processedChannels = 0;
  for (const ch of nonCategoryChannels) {
    try {
      const parentId = ch.parentId ? idMap.get(ch.parentId) || null : null;
      const overwrites = ch.permissionOverwrites.map((o) => ({
        id: idMap.get(o.id) || o.id,
        type: o.type,
        allow: BigInt(o.allow),
        deny: BigInt(o.deny),
      }));

      const createdChannel = await guild.channels.create({
        name: ch.name,
        type: ch.type as any,
        position: ch.position,
        parent: parentId || undefined,
        topic: ch.topic || undefined,
        nsfw: ch.nsfw,
        bitrate: ch.bitrate || undefined,
        userLimit: ch.userLimit || undefined,
        rateLimitPerUser: ch.rateLimitPerUser || undefined,
        permissionOverwrites: overwrites,
      });
      idMap.set(ch.id, createdChannel.id);
      channelsCount++;
    } catch {}
    processedChannels++;
    if (processedChannels % 5 === 0 || processedChannels === nonCategoryChannels.length) {
      state.items[4].details = `${channelsCount}/${nonCategoryChannels.length} channels`;
      await update();
    }
  }
  state.items[4].status = "done";
  state.items[4].details = `${channelsCount} channels restored`;
  state.completedStepsCount++;
  await update();

  state.items[5].status = "in_progress";
  await update();
  for (const emoji of data.emojis) {
    try {
      const buffer = Buffer.from(emoji.dataBase64, "base64");
      await guild.emojis.create({
        attachment: buffer,
        name: emoji.name,
      });
      emojisCount++;
    } catch {}
  }
  state.items[5].status = "done";
  state.items[5].details = `${emojisCount} emojis restored`;
  state.completedStepsCount++;
  await update();

  state.items[6].status = "in_progress";
  await update();
  for (const sticker of data.stickers) {
    try {
      const buffer = Buffer.from(sticker.dataBase64, "base64");
      await guild.stickers.create({
        file: buffer,
        name: sticker.name,
        description: sticker.description,
        tags: sticker.tags,
      });
      stickersCount++;
    } catch {}
  }
  state.items[6].status = "done";
  state.items[6].details = `${stickersCount} stickers restored`;
  state.completedStepsCount++;
  await update();

  state.items[7].status = "in_progress";
  await update();
  if (data.webhooks) {
    for (const wh of data.webhooks) {
      try {
        const targetChannelId = idMap.get(wh.channelId) || wh.channelId;
        const channel = await guild.channels.fetch(targetChannelId);
        if (channel && "createWebhook" in channel) {
          const avatar = wh.avatarBase64 ? Buffer.from(wh.avatarBase64, "base64") : undefined;
          await (channel as any).createWebhook({
            name: wh.name,
            avatar,
          });
          webhooksCount++;
        }
      } catch {}
    }
  }
  state.items[7].status = "done";
  state.items[7].details = `${webhooksCount} webhooks restored`;
  state.completedStepsCount++;
  await update();

  state.items[8].status = "in_progress";
  await update();
  for (const rule of data.autoModRules) {
    try {
      await guild.autoModerationRules.create({
        name: rule.name,
        eventType: rule.eventType,
        triggerType: rule.triggerType,
        triggerMetadata: rule.triggerMetadata,
        actions: rule.actions,
        enabled: rule.enabled,
      });
      autoModRulesCount++;
    } catch {}
  }
  state.items[8].status = "done";
  state.items[8].details = `${autoModRulesCount} automod rules restored`;
  state.completedStepsCount++;
  await update();

  return {
    rolesCount,
    categoriesCount,
    channelsCount,
    emojisCount,
    stickersCount,
    webhooksCount,
    autoModRulesCount,
  };
}

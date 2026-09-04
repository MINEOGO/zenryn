import { Guild } from "discord.js";
import { ZenRynBackupData, BackupRole, BackupChannel, BackupEmoji, BackupSticker, BackupAutoModRule, BackupWebhook } from "../storage/format";

export interface ProgressItem {
  step: string;
  status: "pending" | "in_progress" | "done";
  details?: string;
}

export interface ProgressState {
  items: ProgressItem[];
  startTime: number;
  totalStepsEstimated: number;
  completedStepsCount: number;
}

async function runConcurrent<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item)).then((res) => {
      results.push(res);
    });
    executing.push(p);
    if (executing.length >= limit) {
      await Promise.race(executing);
      for (let i = executing.length - 1; i >= 0; i--) {
        if (await Promise.race([executing[i].then(() => true), Promise.resolve(false)])) {
          executing.splice(i, 1);
        }
      }
    }
  }

  await Promise.all(executing);
  return results;
}

export async function fetchGuildData(
  guild: Guild,
  onProgress?: (state: ProgressState) => Promise<void>
): Promise<Omit<ZenRynBackupData, "integrity">> {
  const startTime = Date.now();
  const state: ProgressState = {
    items: [
      { step: "guild info", status: "pending" },
      { step: "roles", status: "pending" },
      { step: "channels", status: "pending" },
      { step: "emojis", status: "pending" },
      { step: "stickers", status: "pending" },
      { step: "webhooks", status: "pending" },
      { step: "automod rules", status: "pending" },
    ],
    startTime,
    totalStepsEstimated: 7,
    completedStepsCount: 0,
  };

  const update = async () => {
    if (onProgress) {
      await onProgress(state);
    }
  };

  await guild.fetch();
  state.items[0].status = "in_progress";
  state.items[0].details = "server name";
  await update();
  
  let iconBase64: string | null = null;
  let bannerBase64: string | null = null;
  let splashBase64: string | null = null;

  if (guild.iconURL({ extension: "png", size: 1024 })) {
    state.items[0].details = "server pfp";
    await update();
    try {
      const res = await fetch(guild.iconURL({ extension: "png", size: 1024 })!);
      const ab = await res.arrayBuffer();
      iconBase64 = Buffer.from(ab).toString("base64");
    } catch {}
  }

  if (guild.bannerURL({ extension: "png", size: 1024 })) {
    state.items[0].details = "server banner";
    await update();
    try {
      const res = await fetch(guild.bannerURL({ extension: "png", size: 1024 })!);
      const ab = await res.arrayBuffer();
      bannerBase64 = Buffer.from(ab).toString("base64");
    } catch {}
  }

  if (guild.splashURL({ extension: "png", size: 1024 })) {
    state.items[0].details = "server splash";
    await update();
    try {
      const res = await fetch(guild.splashURL({ extension: "png", size: 1024 })!);
      const ab = await res.arrayBuffer();
      splashBase64 = Buffer.from(ab).toString("base64");
    } catch {}
  }

  const vanityURLCode = guild.vanityURLCode || null;
  const settings = {
    name: guild.name,
    description: guild.description,
    verificationLevel: guild.verificationLevel,
    defaultMessageNotifications: guild.defaultMessageNotifications,
    explicitContentFilter: guild.explicitContentFilter,
    afkTimeout: guild.afkTimeout,
    preferredLocale: guild.preferredLocale,
    afkChannelId: guild.afkChannelId,
    systemChannelId: guild.systemChannelId,
  };

  state.items[0].status = "done";
  state.items[0].details = undefined;
  state.completedStepsCount++;
  await update();

  state.items[1].status = "in_progress";
  state.items[1].details = "fetching roles...";
  await update();
  const fetchedRoles = await guild.roles.fetch();
  const roleArray = Array.from(fetchedRoles.values());
  const roles: BackupRole[] = [];
  let roleCount = 0;
  for (const r of roleArray) {
    roles.push({
      id: r.id,
      name: r.name,
      color: r.color,
      hoist: r.hoist,
      position: r.position,
      permissions: r.permissions.bitfield.toString(),
      managed: r.managed,
      mentionable: r.mentionable,
    });
    roleCount++;
    if (roleCount % 10 === 0 || roleCount === roleArray.length) {
      state.items[1].details = `${roleCount}/${roleArray.length} roles`;
      await update();
    }
  }
  state.items[1].status = "done";
  state.items[1].details = `${roles.length} roles`;
  state.completedStepsCount++;
  await update();

  state.items[2].status = "in_progress";
  await update();
  const fetchedChannels = await guild.channels.fetch();
  const channels: BackupChannel[] = Array.from(fetchedChannels.values())
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      position: c.position,
      parentId: c.parentId,
      topic: "topic" in c ? (c.topic as string | null) : null,
      nsfw: "nsfw" in c ? (c.nsfw as boolean) : false,
      bitrate: "bitrate" in c ? (c.bitrate as number) : null,
      userLimit: "userLimit" in c ? (c.userLimit as number) : null,
      rateLimitPerUser: "rateLimitPerUser" in c ? (c.rateLimitPerUser as number) : null,
      permissionOverwrites: Array.from(c.permissionOverwrites.cache.values()).map((o) => ({
        id: o.id,
        type: o.type,
        allow: o.allow.bitfield.toString(),
        deny: o.deny.bitfield.toString(),
      })),
    }));
  state.items[2].status = "done";
  state.items[2].details = `${channels.length} channels`;
  state.completedStepsCount++;
  await update();

  state.items[3].status = "in_progress";
  await update();
  const fetchedEmojis = await guild.emojis.fetch();
  const emojiList = Array.from(fetchedEmojis.values());
  let processedEmojis = 0;

  const emojis = await runConcurrent(emojiList, 8, async (emoji) => {
    try {
      const url = emoji.imageURL();
      if (url) {
        const res = await fetch(url);
        const arr = await res.arrayBuffer();
        processedEmojis++;
        state.items[3].details = `${processedEmojis}/${fetchedEmojis.size} emojis`;
        if (processedEmojis % 5 === 0) {
          await update();
        }
        return {
          id: emoji.id,
          name: emoji.name || "emoji",
          animated: emoji.animated || false,
          dataBase64: Buffer.from(arr).toString("base64"),
        };
      }
    } catch {}
    return null;
  });

  const validEmojis = emojis.filter((e): e is BackupEmoji => e !== null);
  state.items[3].status = "done";
  state.items[3].details = `${validEmojis.length} emojis`;
  state.completedStepsCount++;
  await update();

  state.items[4].status = "in_progress";
  await update();
  const fetchedStickers = await guild.stickers.fetch();
  const stickerList = Array.from(fetchedStickers.values());
  let processedStickers = 0;

  const stickers = await runConcurrent(stickerList, 8, async (sticker) => {
    try {
      const url = sticker.url;
      if (url) {
        const res = await fetch(url);
        const arr = await res.arrayBuffer();
        processedStickers++;
        state.items[4].details = `${processedStickers}/${fetchedStickers.size} stickers`;
        await update();
        return {
          id: sticker.id,
          name: sticker.name,
          description: sticker.description || "",
          tags: sticker.tags || "",
          dataBase64: Buffer.from(arr).toString("base64"),
        };
      }
    } catch {}
    return null;
  });

  const validStickers = stickers.filter((s): s is BackupSticker => s !== null);
  state.items[4].status = "done";
  state.items[4].details = `${validStickers.length} stickers`;
  state.completedStepsCount++;
  await update();

  state.items[5].status = "in_progress";
  await update();
  let webhooks: BackupWebhook[] = [];
  try {
    const fetchedWebhooks = await guild.fetchWebhooks();
    const webhookList = Array.from(fetchedWebhooks.values());
    const processedWebhooks = await runConcurrent(webhookList, 5, async (wh) => {
      let avatarBase64: string | null = null;
      if (wh.avatarURL()) {
        try {
          const res = await fetch(wh.avatarURL({ extension: "png", size: 512 })!);
          const arr = await res.arrayBuffer();
          avatarBase64 = Buffer.from(arr).toString("base64");
        } catch {}
      }
      return {
        id: wh.id,
        name: wh.name,
        avatarBase64,
        channelId: wh.channelId,
      };
    });
    webhooks = processedWebhooks;
  } catch {}
  state.items[5].status = "done";
  state.items[5].details = `${webhooks.length} webhooks`;
  state.completedStepsCount++;
  await update();

  state.items[6].status = "in_progress";
  await update();
  let autoModRules: BackupAutoModRule[] = [];
  try {
    const fetchedRules = await guild.autoModerationRules.fetch();
    autoModRules = Array.from(fetchedRules.values()).map((r) => ({
      id: r.id,
      name: r.name,
      eventType: r.eventType,
      triggerType: r.triggerType,
      triggerMetadata: r.triggerMetadata,
      actions: r.actions,
      enabled: r.enabled,
    }));
  } catch {}
  state.items[6].status = "done";
  state.items[6].details = `${autoModRules.length} automod rules`;
  state.completedStepsCount++;
  await update();

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    guildId: guild.id,
    guildName: guild.name,
    description: guild.description,
    vanityURLCode,
    iconBase64,
    bannerBase64,
    splashBase64,
    settings,
    roles,
    channels,
    emojis: validEmojis,
    stickers: validStickers,
    webhooks,
    autoModRules,
  };
}

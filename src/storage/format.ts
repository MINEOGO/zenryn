export interface BackupRole {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  position: number;
  permissions: string;
  managed: boolean;
  mentionable: boolean;
}

export interface BackupOverwrite {
  id: string;
  type: number;
  allow: string;
  deny: string;
}

export interface BackupChannel {
  id: string;
  name: string;
  type: number;
  position: number;
  parentId: string | null;
  topic: string | null;
  nsfw: boolean;
  bitrate: number | null;
  userLimit: number | null;
  rateLimitPerUser: number | null;
  permissionOverwrites: BackupOverwrite[];
}

export interface BackupEmoji {
  id: string;
  name: string;
  animated: boolean;
  dataBase64: string;
}

export interface BackupSticker {
  id: string;
  name: string;
  description: string;
  tags: string;
  dataBase64: string;
}

export interface BackupAutoModRule {
  id: string;
  name: string;
  eventType: number;
  triggerType: number;
  triggerMetadata: any;
  actions: any[];
  enabled: boolean;
}

export interface BackupWebhook {
  id: string;
  name: string;
  avatarBase64: string | null;
  channelId: string;
}

export interface BackupGuildSettings {
  name: string;
  description: string | null;
  verificationLevel: number;
  defaultMessageNotifications: number;
  explicitContentFilter: number;
  afkTimeout: number;
  preferredLocale: string | null;
  afkChannelId: string | null;
  systemChannelId: string | null;
}

export interface ZenRynBackupData {
  version: number;
  createdAt: string;
  guildId: string;
  guildName: string;
  description: string | null;
  vanityURLCode: string | null;
  iconBase64: string | null;
  bannerBase64: string | null;
  splashBase64: string | null;
  settings?: BackupGuildSettings;
  roles: BackupRole[];
  channels: BackupChannel[];
  emojis: BackupEmoji[];
  stickers: BackupSticker[];
  webhooks: BackupWebhook[];
  autoModRules: BackupAutoModRule[];
  integrity: {
    algorithm: string;
    hash: string;
  };
}

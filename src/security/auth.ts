import { GuildMember, PermissionsBitField } from "discord.js";

export function isAdministrator(member: GuildMember | null): boolean {
  if (!member) {
    return false;
  }
  return member.permissions.has(PermissionsBitField.Flags.Administrator);
}

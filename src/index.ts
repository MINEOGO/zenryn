import { Client, GatewayIntentBits, REST, Routes } from "discord.js";
import { loadConfig } from "./config";
import { commands, handleInteraction } from "./bot/commands/zynren";

async function main() {
  const config = await loadConfig();

  if (!config.token) {
    console.error("error: no discord token provided");
    process.exit(1);
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildEmojisAndStickers,
    ],
  });

  client.once("ready", async () => {
    if (!client.user) return;
    console.log(`zenryn bot logged in as ${client.user.tag}`);
    const rest = new REST({ version: "10" }).setToken(config.token);
    try {
      await rest.put(Routes.applicationCommands(client.user.id), {
        body: commands,
      });
      console.log("slash commands registered successfully");
    } catch (err: any) {
      console.error(`failed to register slash commands: ${err.message || err}`);
    }
  });

  client.on("error", (err) => {
    console.error(`discord client error: ${err.message || err}`);
  });

  client.on("interactionCreate", async (interaction) => {
    if (interaction.isChatInputCommand()) {
      try {
        await handleInteraction(interaction, config);
      } catch (err: any) {
        console.error(`interaction error: ${err.message || err}`);
      }
    }
  });

  const shutdown = () => {
    console.log("zenryn shutting down...");
    client.destroy();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log("connecting to discord...");
  await client.login(config.token);
}

main().catch((err) => {
  console.error(`fatal error: ${err.message || err}`);
  process.exit(1);
});


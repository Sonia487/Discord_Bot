require("dotenv").config();
const fs = require("fs");
const { Client, GatewayIntentBits, SlashCommandBuilder, Routes } = require("discord.js");
const { REST } = require("@discordjs/rest");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

const DATA_FILE = "data.json";
let userData = {};

// 安全讀取 data.json
try {
  if (fs.existsSync(DATA_FILE)) {
    userData = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } else {
    userData = {};
  }
} catch (err) {
  console.error("⚠️ 讀取 data.json 失敗，自動建立空資料。");
  userData = {};
}

// 暫存使用者語音進入時間
const activeSessions = {};

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(userData, null, 2));
}

// 上線提示
client.once("ready", () => {
  console.log(`✅ Bot 已上線：${client.user.tag}`);
  registerCommands(); // 註冊 slash 指令
});

// 語音狀態監聽
client.on("voiceStateUpdate", (oldState, newState) => {
  const userId = newState.id;
  const now = Date.now();

  // 進入語音
  if (!oldState.channel && newState.channel) {
    activeSessions[userId] = now;
  }

  // 離開語音
  else if (oldState.channel && !newState.channel) {
    const joinedAt = activeSessions[userId];
    if (joinedAt) {
      const seconds = Math.floor((now - joinedAt) / 1000);

      if (!userData[userId]) userData[userId] = { totalSeconds: 0 };
      userData[userId].totalSeconds += seconds;

      delete activeSessions[userId];
      saveData();
    }
  }
});

// 🧠 秒數轉時間格式
function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

// 指令回覆處理
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === "liverank") {
    // 排序最多的前10名
    const rank = Object.entries(userData)
      .sort((a, b) => b[1].totalSeconds - a[1].totalSeconds)
      .slice(0, 10);

    if (rank.length === 0) {
      return interaction.reply("尚未有任何語音記錄。");
    }

    const lines = await Promise.all(
      rank.map(async ([userId, data], index) => {
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        const name = member?.displayName || `(ID: ${userId})`;
        return `${index + 1}. ${name}：${formatDuration(data.totalSeconds)}`;
      })
    );

    interaction.reply({ content: `🎖️ 語音排行榜：\n` + lines.join("\n") });
  }

  if (commandName === "livetime") {
    const user = interaction.options.getUser("user");
    const id = user.id;
    const seconds = userData[id]?.totalSeconds || 0;

    interaction.reply({
      content: `🎧 ${user.username} 的語音時數為：${formatDuration(seconds)}`,
    });
  }
});

// ✅ 註冊 slash 指令
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("liverank")
      .setDescription("顯示語音時數排行榜"),
    new SlashCommandBuilder()
      .setName("livetime")
      .setDescription("查詢指定用戶的語音時數")
      .addUserOption((option) =>
        option.setName("user").setDescription("要查詢的用戶").setRequired(true)
      ),
  ].map((command) => command.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log("📡 正在註冊 Slash 指令...");
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log("✅ Slash 指令註冊完成");
  } catch (error) {
    console.error("❌ 註冊指令失敗", error);
  }
}

client.login(process.env.DISCORD_TOKEN);

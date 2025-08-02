require("dotenv").config();
const fs = require("fs");
const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

// 儲存暫時進入語音的時間（不寫入檔案）
const activeSessions = {};

// 資料檔案路徑
const DATA_FILE = "data.json";

// 讀取舊資料（若不存在就建立空白）
let userData = {};
if (fs.existsSync(DATA_FILE)) {
  userData = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

// 儲存資料到 data.json
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(userData, null, 2));
}

// Bot 上線時
client.once("ready", () => {
  console.log(`✅ Sonia Bot 已上線：${client.user.tag}`);
});

// 語音狀態變更事件
client.on("voiceStateUpdate", (oldState, newState) => {
  const userId = newState.id;

  const now = Date.now();

  // 使用者進入語音頻道
  if (!oldState.channel && newState.channel) {
    activeSessions[userId] = now;
    console.log(`🎤 ${userId} 加入語音頻道`);
  }

  // 使用者離開語音頻道
  else if (oldState.channel && !newState.channel) {
    const joinedAt = activeSessions[userId];

    if (joinedAt) {
      const seconds = Math.floor((now - joinedAt) / 1000);
      const hours = seconds / 3600;

      // 初始化使用者資料
      if (!userData[userId]) {
        userData[userId] = {
          totalSeconds: 0,
        };
      }

      userData[userId].totalSeconds += seconds;
      delete activeSessions[userId];

      console.log(
        `👋 ${userId} 離開語音，共 ${seconds} 秒，已累計 ${
          userData[userId].totalSeconds
        } 秒`
      );
      saveData();
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

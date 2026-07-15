require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fetch   = require('node-fetch');
const FormData = require('form-data');

const {
  DISCORD_TOKEN,
  DISCORD_CHANNEL_ID,
  SS_API_URL,
  SS_API_KEY,
  SS_USERNAME,
} = process.env;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', () => {
  console.log(`✅ SS同期ボット起動: ${client.user.tag}`);
  console.log(`📷 監視チャンネル: ${DISCORD_CHANNEL_ID}`);
});

client.on('messageCreate', async message => {
  // 対象チャンネル以外・ボット自身は無視
  if (message.channelId !== DISCORD_CHANNEL_ID) return;
  if (message.author.bot) return;

  // 画像添付ファイルのみ処理
  const images = [...message.attachments.values()].filter(a =>
    a.contentType && a.contentType.startsWith('image/')
  );
  if (images.length === 0) return;

  console.log(`[SS Sync] ${message.author.username}: ${images.length}枚を検出 (${new Date().toLocaleString('ja-JP')})`);

  const fd = new FormData();
  fd.append('api_key',  SS_API_KEY);
  fd.append('username', SS_USERNAME);

  let added = 0;
  for (const att of images.slice(0, 10)) {
    try {
      const res = await fetch(att.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.buffer();
      const ext = (att.contentType.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      fd.append('images[]', buf, {
        filename:    `ss_${Date.now()}_${added}.${ext}`,
        contentType: att.contentType,
      });
      added++;
    } catch (e) {
      console.error(`  画像DL失敗: ${att.url}`, e.message);
    }
  }

  if (added === 0) return;

  try {
    const res  = await fetch(SS_API_URL, { method: 'POST', body: fd, headers: fd.getHeaders() });
    const json = await res.json();
    if (json.success) {
      console.log(`  ✅ 投稿完了 ID:${json.id} (${added}枚)`);
      await message.react('📷').catch(() => {});
    } else {
      console.error('  ❌ 投稿失敗:', json.error);
    }
  } catch (e) {
    console.error('  ❌ API呼び出し失敗:', e.message);
  }
});

client.login(DISCORD_TOKEN);

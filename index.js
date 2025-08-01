const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const path = require("path");
const qrcode = require("qrcode");
let qrImageData = null; 
let isReconnecting = false;

const ultimasMensagensMinhas = new Map();

const numerosBloqueados = [
  "553493007502@s.whatsapp.net",
  "553496830188@s.whatsapp.net",
  "553499006476@s.whatsapp.net",
  "553491176892@s.whatsapp.net",
  "553499215444@s.whatsapp.net",
  "553498819966@s.whatsapp.net",
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function enviarMensagemSeparada(client, from, mensagens) {
  for (const texto of mensagens) {
    await client.sendMessage(from, { text: texto });
    await delay(1500);
  }
}

function estaDentroDoHorarioDeAtendimento() {
  const agora = new Date();
  const dia = agora.getDay();
  const hora = agora.getHours();
  const minutos = agora.getMinutes();
  const horarioAtual = hora * 60 + minutos;

  if (dia === 1) return horarioAtual >= 12 * 60 && horarioAtual < 18 * 60;
  if (dia >= 2 && dia <= 5)
    return horarioAtual >= 10 * 60 && horarioAtual < 18 * 60;
  if (dia === 6) return horarioAtual >= 10 * 60 && horarioAtual < 17 * 60 + 30;

  return false;
}

async function createWhatsAppClient(instanceId = "default") {
  const storePath = path.join(__dirname, `auth_info_${instanceId}`);
  const { state, saveCreds } = await useMultiFileAuthState(storePath);

  const client = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });

  client.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        qrImageData = await qrcode.toDataURL(qr); // gera imagem base64
        console.log(
          "📲 Acesse o link e escaneie o QR Code: http://localhost:3000",
        );
      } catch (err) {
        console.error("❌ Erro ao gerar QR Code como imagem:", err);
      }
    }

    if (connection === "open") {
      console.log(`✅ Wpp ${instanceId} conectado com sucesso!`);
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;

      if (shouldReconnect && !isReconnecting) {
        isReconnecting = true;
        console.log(`🔄 Reconectando ${instanceId}...`);
        setTimeout(() => {
          createWhatsAppClient(instanceId);
          isReconnecting = false;
        }, 2000);
      } else {
        console.log(
          `⚠️ Usuário deslogado da ${instanceId}. Escaneie o QR Code novamente.`,
        );
      }
    }
  });

  client.ev.on("creds.update", saveCreds);

  client.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) {
      if (msg.key.fromMe) {
        const to = msg.key.remoteJid;
        ultimasMensagensMinhas.set(to, new Date());
      }
      return;
    }

    const from = msg.key.remoteJid;
    if (from.includes("@g.us") || numerosBloqueados.includes(from)) return;

    const agora = new Date();
    const ultimaMsgMinha = ultimasMensagensMinhas.get(from);

    if (ultimaMsgMinha && agora - ultimaMsgMinha < 2 * 60 * 60 * 1000) {
      return;
    }

    const mensagensAtendimento = [
      `Olá! Seja bem-vindo(a) à Kantine 😊
Recebemos muitas mensagens, então pedimos um pouquinho de paciência — *já já respondemos você!*
Enquanto isso, pode nos contar aqui o que você precisa?`,
      `*Cardápios:*  
🎂 *Bolos e sobremesas*: https://drive.google.com/file/d/1XkH3CPugY1E1xPsGm3J3i6xZY-z4iF8P/view

🛵 *Delivery ou retirada:*  
pedido.takeat.app/kantinegastronomia  
_(aqui também mostra os produtos que temos na loja hoje 😉)_

*Para pagamento antecipado, é só fazer o pedido normalmente e, assim que receber nossa mensagem de confirmação, nos avisar que deseja antecipar o pagamento.* 💳✨

📦 *Encomendas de bolos e sobremesas devem ser feitas com 48h de antecedência.*  
👩🏻‍🍳 Caso seja feita dentro disso, iremos verificar com a cozinha se conseguimos atender você. 

🛍️ Retiradas são exclusivamente na loja da Getúlio.`,
      `📱 *Horários de Funcionamento de Delivery e Atendimento no Whatsapp:*  
• Seg: 12h às 18h  
• Ter a Sex: 10h às 18h  
• Sáb: 10h às 17h30  
• Domingo estamos fechados

🕒 *Horários de Funcionamento das Lojas*  
📍 *Loja Vinhedos e Getúlio*  
• Seg: 12h – 19h  
• Ter a Sex: 09h – 19h  
• Sáb: 09h – 18h  
• Domingo estamos fechados`,
    ];

    const mensagensForaHorario = [
      `Olá! Seja bem-vindo(a) à Kantine 😊
      *ESSA É UMA MENSAGEM AUTOMÁTICA*

Estamos fora do horário de atendimento, mas assim que alguém estiver disponível responderemos sua mensagem. *Enquanto isso, me diga como posso ajudar você*`,
      `*Cardápios:*  
🎂 *Bolos e sobremesas*: https://drive.google.com/file/d/1XkH3CPugY1E1xPsGm3J3i6xZY-z4iF8P/view

🛵 *Delivery ou retirada:*  
pedido.takeat.app/kantinegastronomia  
_(aqui também mostra os produtos que temos na loja hoje 😉)_

*Para pagamento antecipado, é só fazer o pedido normalmente e, assim que receber nossa mensagem de confirmação, nos avisar que deseja antecipar o pagamento.* 💳✨

📦 *Encomendas de bolos e sobremesas devem ser feitas com 48h de antecedência.*  
👩🏻‍🍳 Caso seja feita dentro disso, iremos verificar com a cozinha se conseguimos atender você. 

🛍️ Retiradas são exclusivamente na loja da Getúlio.`,
      `📱 *Horários de Funcionamento de Delivery e Atendimento no Whatsapp:*  
• Seg: 12h às 18h  
• Ter a Sex: 10h às 18h  
• Sáb: 10h às 17h30  
• Domingo estamos fechados

🕒 *Horários de Funcionamento das Lojas*  
📍 *Loja Vinhedos e Getúlio*  
• Seg: 12h – 19h  
• Ter a Sex: 09h – 19h  
• Sáb: 09h – 18h  
• Domingo estamos fechados`,
    ];

    const mensagensParaEnviar = estaDentroDoHorarioDeAtendimento()
      ? mensagensAtendimento
      : mensagensForaHorario;

    await enviarMensagemSeparada(client, from, mensagensParaEnviar);

    ultimasMensagensMinhas.set(from, new Date());
  });

  return client;
}

createWhatsAppClient("kantine");

setInterval(() => {
  console.log("Bot rodando...");
}, 60000);

const express = require("express");
const app = express();

app.get("/", (req, res) => {
  if (qrImageData) {
    res.send(`
      <html>
        <body style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;">
          <h2>📲 Escaneie o QR Code</h2>
          <img src="${qrImageData}" style="width:200px;height:200px;" />
        </body>
      </html>
    `);
  } else {
    res.send("✅ Bot já autenticado. QR não disponível.");
  }
});

app.listen(3000, () => console.log("Ping server ativo na porta 3000"));

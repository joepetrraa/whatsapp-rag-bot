require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const { Client, LocalAuth } = require('whatsapp-web.js');

const qrcode = require('qrcode-terminal');

const Groq = require('groq-sdk');

const RAGEngine = require('./lib/rag');
const DatasetManager = require('./lib/dataset');

const app = express();

const PORT = process.env.PORT || 3001;

app.use(cors());

app.use(bodyParser.json());

app.use(
  bodyParser.urlencoded({
    extended: true
  })
);

// PUBLIC FOLDER
app.use(
  express.static(
    path.join(__dirname, 'public')
  )
);

// GROQ
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// RAG
const ragEngine = new RAGEngine();

// DATASET
const datasetManager =
  new DatasetManager();

// BOT STATUS
let client = null;

let qrCodeData = null;

let isReady = false;

// KNOWLEDGE FILE
const knowledgeFile =
  path.join(
    __dirname,
    'knowledge.json'
  );

// AUTO CREATE KNOWLEDGE
if (!fs.existsSync(knowledgeFile)) {

  fs.writeFileSync(
    knowledgeFile,
    JSON.stringify({
      responses: {}
    }, null, 2)
  );
}

// LOAD KNOWLEDGE
function loadKnowledge() {

  try {

    const data =
      fs.readFileSync(
        knowledgeFile,
        'utf8'
      );

    return JSON.parse(data);

  } catch (error) {

    console.log(error);

    return {
      responses: {}
    };
  }
}

// AI RESPONSE
async function getAIResponse(
  message,
  contextItems = []
) {

  // JIKA TIDAK ADA CONTEXT
  if (!contextItems.length) {

    return 'Maaf, data tidak ditemukan.';
  }

  // BUILD CONTEXT
  const contextBlock =
    contextItems
      .map((item, index) => {

        return `
[Konteks ${index + 1}]
${item.text}
`;
      })
      .join('\n');

  // GROQ COMPLETION
  const completion =
    await groq.chat.completions.create({

      messages: [

        {
          role: 'system',
          content:
            'Jawab hanya berdasarkan konteks yang diberikan.'
        },

        {
          role: 'user',
          content:
            `
Konteks:
${contextBlock}

Pertanyaan:
${message}
`
        }
      ],

      model:
        process.env.GROQ_MODEL ||
        'llama-3.1-8b-instant',

      max_tokens: 200,

      temperature: 0.1
    });

  return completion
    .choices[0]
    .message
    .content;
}

// INIT CLIENT
function initializeClient() {

  // CEGAH DOUBLE CLIENT
  if (client) {
    return;
  }

  client = new Client({

    authStrategy:
      new LocalAuth({
        clientId: 'whatsapp-bot'
      }),

    puppeteer: {

      headless: false,

      args: [

        '--no-sandbox',

        '--disable-setuid-sandbox'
      ]
    }
  });

  // QR EVENT
  client.on('qr', (qr) => {

    console.log(
      '\n===== SCAN QR =====\n'
    );

    qrCodeData = qr;

    qrcode.generate(qr, {
      small: true
    });
  });

  // READY EVENT
  client.on('ready', () => {

    console.log('BOT READY!');

    isReady = true;
  });

  // AUTHENTICATED
  client.on(
    'authenticated',
    () => {

      console.log(
        'WhatsApp Authenticated'
      );
    }
  );

  // DISCONNECTED
  client.on(
    'disconnected',
    (reason) => {

      console.log(
        'Disconnected:',
        reason
      );

      client = null;

      isReady = false;
    }
  );

  // MESSAGE EVENT
  client.on(
    'message',
    async (msg) => {

      try {

        // IGNORE SELF
        if (msg.fromMe) {
          return;
        }

        console.log(
          'Pesan:',
          msg.body
        );

        // LOAD FAQ
        const knowledge =
          loadKnowledge();

        const keyword =
          msg.body
            .toLowerCase()
            .trim();

        // FAQ RESPONSE
        if (
          knowledge.responses[keyword]
        ) {

          await msg.reply(
            knowledge.responses[keyword]
          );

          return;
        }

        // LOAD DATASET
        const documents =
          datasetManager
            .getAllDocuments();

        // RAG SEARCH
        const contexts =
          ragEngine.retrieveContext(
            msg.body,
            documents,
            3
          );

        // AI RESPONSE
        const response =
          await getAIResponse(
            msg.body,
            contexts
          );

        // SEND REPLY
        await msg.reply(response);

      } catch (error) {

        console.log(error);

        await msg.reply(
          'Terjadi kesalahan.'
        );
      }
    }
  );

  // START CLIENT
  client.initialize();
}

// ROOT
app.get('/', (req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      'public',
      'index.html'
    )
  );
});

// START BOT
app.post(
  '/api/bot/start',
  async (req, res) => {

    try {

      initializeClient();

      res.json({
        success: true,
        message: 'Bot dimulai'
      });

    } catch (error) {

      console.log(error);

      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// GET QR
app.get(
  '/api/bot/qr',
  (req, res) => {

    res.json({
      qr: qrCodeData
    });
  }
);

// STATUS
app.get(
  '/api/bot/status',
  (req, res) => {

    res.json({
      isReady,
      hasQRCode:
        qrCodeData ? true : false
    });
  }
);

// RUN SERVER
app.listen(PORT, () => {

  console.log(`
Server berjalan di:
http://localhost:${PORT}
  `);
});
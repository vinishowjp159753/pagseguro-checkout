// Servidor Express para criar o checkout no PagSeguro
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const xml2js = require('xml2js');

const app = express();
app.use(cors()); // Em produção você pode limitar: cors({ origin: 'https://seusite.com' })
app.use(bodyParser.json());

// Variáveis de ambiente definidas no Render
const PAGSEGURO_EMAIL = process.env.PAGSEGURO_EMAIL;
const PAGSEGURO_TOKEN = process.env.PAGSEGURO_TOKEN;
const REDIRECT_URL = process.env.REDIRECT_URL || 'https://seusite.com/checkout-success.html';
const IS_SANDBOX = process.env.PAGSEGURO_SANDBOX === '1';

const CHECKOUT_URL = IS_SANDBOX
  ? 'https://ws.sandbox.pagseguro.uol.com.br/v2/checkout'
  : 'https://ws.pagseguro.uol.com.br/v2/checkout';

const NOTIFY_URL = IS_SANDBOX
  ? 'https://ws.sandbox.pagseguro.uol.com.br/v3/transactions/notifications/'
  : 'https://ws.pagseguro.uol.com.br/v3/transactions/notifications/';

// Endpoint principal: cria checkout
app.post('/create-checkout', async (req, res) => {
  try {
    const { nome, email, referencia } = req.body;
    const params = new URLSearchParams({
      email: PAGSEGURO_EMAIL,
      token: PAGSEGURO_TOKEN,
      currency: 'BRL',
      itemId1: '001',
      itemDescription1: 'Mensalidade AprovaMaisPB',
      itemAmount1: '150.00',
      itemQuantity1: '1',
      reference: referencia || 'matricula',
      senderName: nome || 'Aluno',
      senderEmail: email || '',
      redirectURL: REDIRECT_URL
    });

    const response = await axios.post(CHECKOUT_URL, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    // Converte XML em JSON para extrair o code
    xml2js.parseString(response.data, (err, result) => {
      if (err) return res.status(500).json({ error: 'Erro ao ler XML' });
      const code = result?.checkout?.code?.[0];
      if (!code) return res.status(500).json({ error: 'Code não retornado pelo PagSeguro' });
      res.json({ code });
    });
  } catch (e) {
    console.error('Erro create-checkout:', e.response?.data || e.message);
    res.status(500).json({ error: 'Erro ao criar checkout' });
  }
});

// (Opcional) Webhook de notificação PagSeguro
app.post('/pagseguro-notification', async (req, res) => {
  try {
    const notificationCode = req.body.notificationCode || req.query.notificationCode;
    if (!notificationCode) return res.sendStatus(400);

    const url = `${NOTIFY_URL}${notificationCode}?email=${PAGSEGURO_EMAIL}&token=${PAGSEGURO_TOKEN}`;
    const resp = await axios.get(url);
    xml2js.parseString(resp.data, (err, result) => {
      if (err) return res.sendStatus(500);
      // Aqui você trataria o 'reference' e 'status' para atualizar sua base
      console.log('Notificação recebida:', JSON.stringify(result));
      res.sendStatus(200);
    });
  } catch (e) {
    console.error('Erro notification:', e.response?.data || e.message);
    res.sendStatus(500);
  }
});

app.get('/health', (_, res) => res.send('ok'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

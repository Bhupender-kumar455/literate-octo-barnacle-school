const parseIntEnv = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getProvider = () => {
  const value = String(process.env.WHATSAPP_PROVIDER || 'webhook').trim().toLowerCase();
  return ['meta', 'msg91', 'webhook'].includes(value) ? value : 'webhook';
};

const normalizeWhatsAppPhoneNumber = (phone) => {
  const raw = String(phone || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/[^\d]/g, '');
  return digits || raw;
};

const compactObject = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => compactObject(entry));
  }
  if (!value || typeof value !== 'object') return value;

  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) continue;
    out[key] = compactObject(entry);
  }
  return out;
};

const extractProviderMessageId = (response) => {
  if (!response || typeof response !== 'object') return null;
  if (response?.messages?.[0]?.id) return String(response.messages[0].id);
  if (response?.data?.messages?.[0]?.id) return String(response.data.messages[0].id);
  if (response?.data?.id) return String(response.data.id);
  if (response?.messageId) return String(response.messageId);
  if (response?.message_id) return String(response.message_id);
  if (response?.id) return String(response.id);
  return null;
};

const postJson = async (url, headers, payload, timeoutMs) => {
  if (!url) {
    throw new Error('WhatsApp provider endpoint is not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const bodyText = await response.text().catch(() => '');
    let data = null;
    if (bodyText) {
      try {
        data = JSON.parse(bodyText);
      } catch (_) {
        data = null;
      }
    }

    if (!response.ok) {
      throw new Error(`WhatsApp provider responded with ${response.status}${bodyText ? `: ${bodyText}` : ''}`);
    }

    return data;
  } catch (err) {
    throw err;
  } finally {
    clearTimeout(timeout);
  }
};

const renderStringTemplate = (input, variables) =>
  String(input).replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key) => {
    if (!Object.prototype.hasOwnProperty.call(variables, key)) return '';
    const value = variables[key];
    return value === undefined || value === null ? '' : String(value);
  });

const renderJsonTemplate = (value, variables) => {
  if (typeof value === 'string') return renderStringTemplate(value, variables);
  if (Array.isArray(value)) return value.map((entry) => renderJsonTemplate(entry, variables));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = renderJsonTemplate(entry, variables);
    }
    return out;
  }
  return value;
};

const buildMetaPayload = ({ to, message, metadata }) => {
  const templateName = metadata?.whatsapp_template_name || process.env.WHATSAPP_META_TEMPLATE_NAME || '';
  const languageCode = metadata?.whatsapp_template_language || process.env.WHATSAPP_META_TEMPLATE_LANGUAGE || 'en';
  const templateParams = Array.isArray(metadata?.whatsapp_template_params)
    ? metadata.whatsapp_template_params
    : [];

  if (!templateName) {
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        preview_url: false,
        body: String(message || ''),
      },
    };
  }

  const bodyParams = templateParams.length ? templateParams : [String(message || '')];
  const template = {
    name: templateName,
    language: { code: languageCode },
  };

  if (bodyParams.length) {
    template.components = [
      {
        type: 'body',
        parameters: bodyParams.map((entry) => ({ type: 'text', text: String(entry) })),
      },
    ];
  }

  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template,
  };
};

const sendViaMeta = async ({ to, message, metadata, timeoutMs }) => {
  const phoneNumberId = String(process.env.WHATSAPP_META_PHONE_NUMBER_ID || '').trim();
  const accessToken = String(process.env.WHATSAPP_META_ACCESS_TOKEN || '').trim();
  const apiVersion = String(process.env.WHATSAPP_META_API_VERSION || 'v21.0').trim();

  if (!phoneNumberId || !accessToken) {
    throw new Error('Meta WhatsApp config missing. Set WHATSAPP_META_PHONE_NUMBER_ID and WHATSAPP_META_ACCESS_TOKEN.');
  }

  const endpoint = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const payload = buildMetaPayload({ to, message, metadata });
  const response = await postJson(
    endpoint,
    { Authorization: `Bearer ${accessToken}` },
    payload,
    timeoutMs
  );

  return {
    provider: 'meta',
    providerMessageId: extractProviderMessageId(response),
    response,
  };
};

const buildMsg91Headers = () => {
  const authKey = String(process.env.WHATSAPP_MSG91_AUTH_KEY || '').trim();
  if (!authKey) {
    throw new Error('MSG91 config missing. Set WHATSAPP_MSG91_AUTH_KEY.');
  }

  const headerName = String(process.env.WHATSAPP_MSG91_AUTH_HEADER || 'authkey').trim();
  const authScheme = String(process.env.WHATSAPP_MSG91_AUTH_SCHEME || '').trim();

  if (headerName.toLowerCase() === 'authorization' && authScheme) {
    return { [headerName]: `${authScheme} ${authKey}` };
  }
  return { [headerName]: authKey };
};

const buildMsg91Payload = ({ to, title, message, notificationId, metadata }) => {
  const integratedNumber = String(process.env.WHATSAPP_MSG91_INTEGRATED_NUMBER || '').trim();
  const templateName = metadata?.whatsapp_template_name || process.env.WHATSAPP_MSG91_TEMPLATE_NAME || '';
  const languageCode = metadata?.whatsapp_template_language || process.env.WHATSAPP_MSG91_TEMPLATE_LANGUAGE || 'en';
  const templateParams = Array.isArray(metadata?.whatsapp_template_params)
    ? metadata.whatsapp_template_params
    : [];

  const payloadTemplateRaw = String(process.env.WHATSAPP_MSG91_PAYLOAD_TEMPLATE || '').trim();
  const variables = {
    to,
    title: title || '',
    message: message || '',
    notification_id: notificationId || '',
    integrated_number: integratedNumber,
    template_name: templateName,
    template_language: languageCode,
  };

  if (payloadTemplateRaw) {
    const parsedTemplate = JSON.parse(payloadTemplateRaw);
    return renderJsonTemplate(parsedTemplate, variables);
  }

  if (templateName) {
    const bodyParams = templateParams.length ? templateParams : [String(message || '')];
    return compactObject({
      integrated_number: integratedNumber || undefined,
      content_type: 'template',
      payload: {
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components: bodyParams.length
            ? [{
                type: 'body',
                parameters: bodyParams.map((entry) => ({ type: 'text', text: String(entry) })),
              }]
            : undefined,
        },
      },
      recipients: [{ mobile: to }],
    });
  }

  return compactObject({
    integrated_number: integratedNumber || undefined,
    content_type: 'text',
    payload: {
      type: 'text',
      text: String(message || ''),
    },
    recipients: [{ mobile: to }],
  });
};

const sendViaMsg91 = async ({ to, title, message, notificationId, metadata, timeoutMs }) => {
  const endpoint = String(process.env.WHATSAPP_MSG91_ENDPOINT || '').trim();
  if (!endpoint) {
    throw new Error('MSG91 endpoint missing. Set WHATSAPP_MSG91_ENDPOINT.');
  }

  const headers = buildMsg91Headers();
  const payload = buildMsg91Payload({ to, title, message, notificationId, metadata });
  const response = await postJson(endpoint, headers, payload, timeoutMs);

  return {
    provider: 'msg91',
    providerMessageId: extractProviderMessageId(response),
    response,
  };
};

const sendViaWebhook = async ({ to, title, message, notificationId, metadata, timeoutMs }) => {
  const endpoint = String(process.env.WHATSAPP_WEBHOOK_URL || '').trim();
  const token = String(process.env.WHATSAPP_WEBHOOK_TOKEN || '').trim();

  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const payload = {
    channel: 'whatsapp',
    to,
    title: title || null,
    message: String(message || ''),
    notification_id: notificationId || null,
    metadata: metadata || null,
  };
  const response = await postJson(endpoint, headers, payload, timeoutMs);

  return {
    provider: 'webhook',
    providerMessageId: extractProviderMessageId(response),
    response,
  };
};

const sendWhatsAppMessage = async ({
  to,
  title = null,
  message,
  notificationId = null,
  metadata = null,
  timeoutMs = null,
}) => {
  const normalizedPhone = normalizeWhatsAppPhoneNumber(to);
  if (!normalizedPhone) {
    throw new Error('WhatsApp recipient phone is missing');
  }
  const finalMessage = String(message || '').trim();
  if (!finalMessage) {
    throw new Error('WhatsApp message is required');
  }

  const timeout = parseIntEnv(timeoutMs, parseIntEnv(process.env.NOTIFICATION_PROVIDER_TIMEOUT_MS, 15000));
  const provider = getProvider();

  if (provider === 'meta') {
    return sendViaMeta({
      to: normalizedPhone,
      message: finalMessage,
      metadata,
      timeoutMs: timeout,
    });
  }

  if (provider === 'msg91') {
    return sendViaMsg91({
      to: normalizedPhone,
      title,
      message: finalMessage,
      notificationId,
      metadata,
      timeoutMs: timeout,
    });
  }

  return sendViaWebhook({
    to: normalizedPhone,
    title,
    message: finalMessage,
    notificationId,
    metadata,
    timeoutMs: timeout,
  });
};

module.exports = {
  sendWhatsAppMessage,
  normalizeWhatsAppPhoneNumber,
};

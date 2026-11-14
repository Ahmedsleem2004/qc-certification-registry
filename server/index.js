
import express from 'express';
import 'dotenv/config';
import crypto from 'node:crypto';
import { supabase } from './supabase.js';

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '40kb' }));

const password = process.env.ADMIN_PASSWORD;
const secret = process.env.SESSION_SECRET;

if (!password || !secret || secret.length < 24) {
  console.error(
    'Set ADMIN_PASSWORD and SESSION_SECRET (24+ chars) in .env'
  );
  process.exit(1);
}

const standards = {
  'ISO 9001:2015': 'Quality Management System',
  'ISO 14001:2015': 'Environmental Management System',
  'ISO 45001:2018':
    'Occupational Health and Safety Management System',
  'ISO 41001:2018': 'Facility Management System',
  HACCP: 'Hazard Analysis and Critical Control Points'
};

const fields =
  'id,company,address,number,standard,system,issued,expires,scope,visible';

function normalize(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function makeToken() {
  const payload = Buffer.from(
    JSON.stringify({
      exp: Date.now() + 8 * 60 * 60 * 1000,
      nonce: crypto.randomUUID()
    })
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');

  return `${payload}.${signature}`;
}

function verifyToken(token) {
  try {
    if (!token || typeof token !== 'string') {
      return false;
    }

    const parts = token.split('.');

    if (parts.length !== 2) {
      return false;
    }

    const [payload, signature] = parts;

    const expected = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest();

    const received = Buffer.from(
      signature,
      'base64url'
    );

    if (
      expected.length !== received.length ||
      !crypto.timingSafeEqual(expected, received)
    ) {
      return false;
    }

    const data = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    );

    return (
      Number.isFinite(data.exp) &&
      data.exp > Date.now()
    );
  } catch {
    return false;
  }
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';

  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : '';

  if (!verifyToken(token)) {
    return res.status(401).json({
      error: 'Unauthorized or session expired'
    });
  }

  next();
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(value + 'T00:00:00Z');

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function prepareRecord(body) {
  const b = body || {};

  const record = {
    company: normalize(b.company),
    address: String(b.address || '').trim(),
    number: normalize(b.number),
    standard: normalize(b.standard),
    issued: String(b.issued || '').trim(),
    expires: String(b.expires || '').trim(),
    scope: String(b.scope || '').trim(),
    visible: b.visible === true
  };

  if (
    !record.company ||
    !record.number ||
    !record.scope
  ) {
    throw new Error(
      'Company, certificate number and scope are required'
    );
  }

  if (!Object.hasOwn(standards, record.standard)) {
    throw new Error('Invalid certification standard');
  }

  if (
    !validDate(record.issued) ||
    !validDate(record.expires)
  ) {
    throw new Error('Invalid issue or expiry date');
  }

  if (record.expires < record.issued) {
    throw new Error(
      'Expiry date must not be before issue date'
    );
  }

  if (
    record.company.length > 300 ||
    record.address.length > 1000 ||
    record.number.length > 120 ||
    record.scope.length > 3000
  ) {
    throw new Error('One or more fields are too long');
  }

  return {
    ...record,
    system: standards[record.standard]
  };
}

function publicRecord(record) {
  return {
    company: record.company,
    address: record.address || '',
    number: record.number,
    standard: record.standard,
    system:
      record.system ||
      standards[record.standard] ||
      '',
    issued: record.issued,
    expires: record.expires,
    scope: record.scope
  };
}

function databaseError(res, error) {
  console.error('Supabase error:', error);

  return res.status(500).json({
    error: 'Database operation failed'
  });
}

function duplicateError(res) {
  return res.status(409).json({
    error: 'Certificate number already exists'
  });
}

// Admin login
app.post('/api/login', (req, res) => {
  const input = String(req.body?.password || '');

  const actual = crypto
    .createHash('sha256')
    .update(input)
    .digest();

  const expected = crypto
    .createHash('sha256')
    .update(password)
    .digest();

  if (!crypto.timingSafeEqual(actual, expected)) {
    return res.status(401).json({
      error: 'Invalid password'
    });
  }

  res.json({ token: makeToken() });
});

// Public certificate search
app.post('/api/search', async (req, res) => {
  try {
    const number = normalize(req.body?.number);
    const company = normalize(req.body?.company);

    if (!number || company.length < 3) {
      return res.status(400).json({
        error:
          'Enter certificate number and at least 3 company characters'
      });
    }

    const { data, error } = await supabase
      .from('certificates')
      .select(fields)
      .eq('visible', true)
      .ilike('number', number)
      .limit(10);

    if (error) {
      return databaseError(res, error);
    }

    const record = (data || []).find((r) =>
      normalize(r.number).toLowerCase() ===
        number.toLowerCase() &&
      normalize(r.company)
        .toLowerCase()
        .startsWith(company.toLowerCase())
    );

    if (!record) {
      return res.status(404).json({
        error: 'No matching certificate found'
      });
    }

    return res.json(publicRecord(record));
  } catch (error) {
    return databaseError(res, error);
  }
});

// Get certificates
app.get('/api/records', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('certificates')
      .select(fields)
      .order('created_at', { ascending: false });

    if (error) {
      return databaseError(res, error);
    }

    return res.json(data || []);
  } catch (error) {
    return databaseError(res, error);
  }
});

// Add certificate
app.post('/api/records', auth, async (req, res) => {
  let record;

  try {
    record = prepareRecord(req.body);
  } catch (error) {
    return res.status(400).json({
      error: error.message
    });
  }

  try {
    const { data: existing, error: checkError } =
      await supabase
        .from('certificates')
        .select('id')
        .ilike('number', record.number)
        .limit(1);

    if (checkError) {
      return databaseError(res, checkError);
    }

    if (existing?.length) {
      return duplicateError(res);
    }

    const { data, error } = await supabase
      .from('certificates')
      .insert({
        id: crypto.randomUUID(),
        ...record
      })
      .select(fields)
      .single();

    if (error) {
      if (error.code === '23505') {
        return duplicateError(res);
      }

      return databaseError(res, error);
    }

    return res.status(201).json(data);
  } catch (error) {
    return databaseError(res, error);
  }
});

// Update certificate
app.put('/api/records/:id', auth, async (req, res) => {
  let updated;

  try {
    updated = prepareRecord(req.body);
  } catch (error) {
    return res.status(400).json({
      error: error.message
    });
  }

  try {
    const { data: existing, error: checkError } =
      await supabase
        .from('certificates')
        .select('id')
        .ilike('number', updated.number)
        .limit(100);

    if (checkError) {
      return databaseError(res, checkError);
    }

    const duplicate = (existing || []).some(
      (r) => String(r.id) !== req.params.id
    );

    if (duplicate) {
      return duplicateError(res);
    }

    const { data, error } = await supabase
      .from('certificates')
      .update({
        ...updated,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select(fields)
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        return duplicateError(res);
      }

      return databaseError(res, error);
    }

    if (!data) {
      return res.status(404).json({
        error: 'Certificate not found'
      });
    }

    return res.json(data);
  } catch (error) {
    return databaseError(res, error);
  }
});

// Delete certificate
app.delete('/api/records/:id', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('certificates')
      .delete()
      .eq('id', req.params.id)
      .select('id')
      .maybeSingle();

    if (error) {
      return databaseError(res, error);
    }

    if (!data) {
      return res.status(404).json({
        error: 'Certificate not found'
      });
    }

    return res.status(204).end();
  } catch (error) {
    return databaseError(res, error);
  }
});

// Unknown API route
app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found'
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error(error);

  res.status(500).json({
    error: 'Internal server error'
  });
});

// Export Express app for future Vercel deployment
export default app;

// Start locally
if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT || 3001);

  app.listen(PORT, () => {
    console.log(
      `API running on http://localhost:${PORT}`
    );
  });
}

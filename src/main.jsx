
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const standards = [
  'ISO 9001:2015',
  'ISO 14001:2015',
  'ISO 45001:2018',
  'ISO 41001:2018',
  'HACCP'
];

const blank = {
  company: '',
  address: '',
  number: '',
  standard: standards[0],
  issued: '',
  expires: '',
  scope: '',
  visible: false
};

async function api(url, method = 'GET', body, token) {
  let response;

  try {
    response = await fetch('/api' + url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token
          ? { Authorization: 'Bearer ' + token }
          : {})
      },
      ...(body !== undefined && body !== null
        ? { body: JSON.stringify(body) }
        : {})
    });
  } catch {
    throw new Error('Cannot connect to the backend server.');
  }

  if (response.status === 204) return null;

  const text = await response.text();

  if (!text.trim()) {
    throw new Error(
      `Server returned an empty response (HTTP ${response.status}).`
    );
  }

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Server returned invalid JSON (HTTP ${response.status}).`
    );
  }

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

function App() {
  const [page, setPage] = useState(
    window.location.pathname.startsWith('/admin')
      ? 'admin'
      : 'search'
  );

  const [number, setNumber] = useState('');
  const [company, setCompany] = useState('');
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const [token, setToken] = useState('');
  const [pass, setPass] = useState('');
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ ...blank });
  const [editing, setEditing] = useState(null);

  const reload = async (t) => {
    setRows(await api('/records', 'GET', null, t));
  };

  async function search(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    setResult(null);

    try {
      const data = await api('/search', 'POST', {
        number,
        company
      });
      setResult(data);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function login(e) {
    e.preventDefault();
    setMessage('');

    try {
      const data = await api('/login', 'POST', {
        password: pass
      });

      setToken(data.token);
      setPass('');
      await reload(data.token);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function save(e) {
    e.preventDefault();
    setMessage('');

    try {
      if (editing) {
        await api(
          '/records/' + editing,
          'PUT',
          form,
          token
        );
      } else {
        await api('/records', 'POST', form, token);
      }

      await reload(token);
      setForm({ ...blank });
      setEditing(null);
      setMessage('Record saved successfully');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this record?')) return;

    try {
      await api('/records/' + id, 'DELETE', null, token);
      await reload(token);
      setMessage('Record deleted successfully');
    } catch (error) {
      setMessage(error.message);
    }
  }

  React.useEffect(() => {
    const onPop = () => {
      setPage(
        window.location.pathname.startsWith('/admin')
          ? 'admin'
          : 'search'
      );
    };

    window.addEventListener('popstate', onPop);

    return () => {
      window.removeEventListener('popstate', onPop);
    };
  }, []);

  const change = (key, value) => {
    setForm((previous) => ({
      ...previous,
      [key]: value
    }));
  };

  return (
    <>
      <header className="site-header">
        <div className="brand">
          <img
            src="/qc.png"
            alt="Quality Control Certification"
          />
          <img src="/uasl.jpg" alt="UASL" />
          <img src="/iaf.png" alt="IAF" />
          <img src="/eas.png" alt="EAS" />
        </div>

        <div className="header-right">
          <div className="payment">
            <img src="/ccavenue.png" alt="CCAvenue" />
            <img src="/payu.png" alt="PayU" />
          </div>

          <nav>
            {[
              'Home',
              'Services',
              'General Information',
              'Accreditation',
              'Join us',
              'Apply Online',
              'Clients List',
              'Download',
              'Blog',
              'Contact us'
            ].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </nav>
        </div>
      </header>

      <section className="heading">
        <div className="wrap">
          <h1>
            {page === 'search'
              ? 'Client List'
              : 'Admin Dashboard'}
          </h1>
        </div>
      </section>

      {page === 'search' ? (
        <main className="wrap content">
          <p>To Search Your Certificate</p>

          <form onSubmit={search} className="search-form">
            <label>
              Please Enter Your Certificate No.
              <input
                value={number}
                onChange={(e) =>
                  setNumber(e.target.value)
                }
                required
              />
            </label>

            <label>
              Please Enter Company Name (At Least First 3 Characters)
              <input
                value={company}
                onChange={(e) =>
                  setCompany(e.target.value)
                }
                minLength={3}
                required
              />
            </label>

            <div className="full">
              {!result && <h2>Certificate No Details</h2>}

              <button className="dark" disabled={busy}>
                {busy ? 'Searching...' : 'Search'}
              </button>
            </div>
          </form>

          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}

          {result && (
            <section className="certificate-result">
              <h2>
                Certificate No {result.number} Details
              </h2>

              <div className="certificate-table-wrap">
                <table className="certificate-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Address</th>
                      <th>Scope</th>
                      <th>Standard</th>
                    </tr>
                  </thead>

                  <tbody>
                    <tr>
                      <td>{result.company}</td>

                      <td>
                        {result.address || 'Not provided'}
                      </td>

                      <td>{result.scope}</td>

                      <td>
                        {result.standard}
                        <div className="certificate-status">
                          Registry Record
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              
            </section>
          )}

          <div className="links">
            <p>OR</p>

            <a
              href="https://uasl.uk.com/certifiedorganization/"
              target="_blank"
              rel="noreferrer"
            >
              Online Verification of Certificate at UASL Website
            </a>

            <a
              href="https://qccertification.com/Client.aspx"
              target="_blank"
              rel="noreferrer"
            >
              Suspend/Cancelled Certificates
            </a>

            <a
              href="https://qccertification.com/Client.aspx"
              target="_blank"
              rel="noreferrer"
            >
              Fake Certificates
            </a>
          </div>
        </main>
      ) : (
        <main className="wrap admin">
          {!token ? (
            <form className="login" onSubmit={login}>
              <h2>Administrator Login</h2>

              <label>
                Password
                <input
                  type="password"
                  value={pass}
                  onChange={(e) =>
                    setPass(e.target.value)
                  }
                  required
                />
              </label>

              <button className="dark">
                Login
              </button>

              {message && (
                <p role="alert">{message}</p>
              )}
            </form>
          ) : (
            <>
              <div className="admin-top">
                <h2>Manage Company Certificates</h2>

                <button
                  onClick={() => {
                    setToken('');
                    setRows([]);
                    setMessage('');
                  }}
                >
                  Logout
                </button>
              </div>

             

              <form
                className="edit-form"
                onSubmit={save}
              >
                <h3>
                  {editing
                    ? 'Edit certificate'
                    : 'Add a certificate'}
                </h3>

                <label>
                  Company Name
                  <input
                    value={form.company}
                    onChange={(e) =>
                      change('company', e.target.value)
                    }
                    required
                  />
                </label>

                <label className="wide">
                  Company Address
                  <textarea
                    value={form.address}
                    onChange={(e) =>
                      change('address', e.target.value)
                    }
                    placeholder="Enter full company address"
                    rows={3}
                  />
                </label>

                <label>
                  Certificate Number
                  <input
                    value={form.number}
                    onChange={(e) =>
                      change('number', e.target.value)
                    }
                    required
                  />
                </label>

                <label>
                  Certification Standard / Scheme
                  <select
                    value={form.standard}
                    onChange={(e) =>
                      change('standard', e.target.value)
                    }
                  >
                    {standards.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Issue Date
                  <input
                    type="date"
                    value={form.issued}
                    onChange={(e) =>
                      change('issued', e.target.value)
                    }
                    required
                  />
                </label>

                <label>
                  Expiry Date
                  <input
                    type="date"
                    value={form.expires}
                    onChange={(e) =>
                      change('expires', e.target.value)
                    }
                    required
                  />
                </label>

                <label className="wide">
                  Scope of Certification
                  <textarea
                    value={form.scope}
                    onChange={(e) =>
                      change('scope', e.target.value)
                    }
                    required
                  />
                </label>

                <label className="wide check">
                  <input
                    type="checkbox"
                    checked={form.visible}
                    onChange={(e) =>
                      change('visible', e.target.checked)
                    }
                  />
                  Show in public search
                </label>

                <div className="wide actions">
                  <button className="dark">
                    {editing
                      ? 'Update Certificate'
                      : 'Add Certificate'}
                  </button>

                  {editing && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(null);
                        setForm({ ...blank });
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              {message && (
                <p
                  role="status"
                  className="notice"
                >
                  {message}
                </p>
              )}

              <h3>
                Registered Certificates ({rows.length})
              </h3>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Address</th>
                      <th>Certificate</th>
                      <th>ISO / Scheme</th>
                      <th>Public</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td>{r.company}</td>
                        <td>{r.address || '—'}</td>
                        <td>{r.number}</td>
                        <td>{r.standard}</td>
                        <td>
                          {r.visible ? 'Yes' : 'No'}
                        </td>

                        <td>
                          <button
                            onClick={() => {
                              setEditing(r.id);

                              setForm({
                                company: r.company || '',
                                address: r.address || '',
                                number: r.number || '',
                                standard:
                                  r.standard || standards[0],
                                issued: r.issued || '',
                                expires: r.expires || '',
                                scope: r.scope || '',
                                visible: Boolean(r.visible)
                              });

                              window.scrollTo(0, 0);
                            }}
                          >
                            Edit
                          </button>

                          <button
                            className="danger"
                            onClick={() => remove(r.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!rows.length && (
                <p>
                  No certificates yet.
                  Add your first record above.
                </p>
              )}
            </>
          )}
        </main>
      )}
    </>
  );
}

createRoot(
  document.getElementById('root')
).render(<App />);

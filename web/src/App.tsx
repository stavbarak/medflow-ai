import { useCallback, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';
import type {
  Appointment,
  AuthResponse,
  Requirement,
  User,
} from './types';
import './App.css';

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('he-IL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function App() {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<User | null>(null);
  const [nextAppt, setNextAppt] = useState<Appointment | null>(null);
  const [list, setList] = useState<Appointment[]>([]);
  const [question, setQuestion] = useState('מתי התור הבא?');
  const [answer, setAnswer] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [userRes, nextRes, allRes] = await Promise.all([
        api<User>('/api/users/me'),
        api<Appointment | null>('/api/appointments/next'),
        api<Appointment[]>('/api/appointments'),
      ]);
      setMe(userRes);
      setNextAppt(nextRes);
      setList(allRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בטעינה');
      setToken(null);
      setTokenState(null);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      void loadDashboard();
    }
  }, [token, loadDashboard]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const path =
        tab === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body =
        tab === 'login'
          ? JSON.stringify({ phoneNumber: phone, password })
          : JSON.stringify({
              name: name || 'משתמש',
              phoneNumber: phone,
              password,
            });
      const res = await api<AuthResponse>(path, {
        method: 'POST',
        body,
      });
      setToken(res.access_token);
      setTokenState(res.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'התחברות נכשלה');
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    setToken(null);
    setTokenState(null);
    setMe(null);
    setNextAppt(null);
    setList([]);
    setAnswer(null);
  }

  async function ask() {
    setBusy(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await api<{ answer: string }>('/api/query/answer', {
        method: 'POST',
        body: JSON.stringify({ question }),
      });
      setAnswer(res.answer);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'לא ניתן לקבל תשובה');
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="shell">
        <header className="hero">
          <h1>MedFlow AI</h1>
          <p className="muted">ניהול תורים למשפחה — גישה מאובטחת</p>
        </header>

        <div className="card">
          <div className="tabs">
            <button
              type="button"
              className={tab === 'login' ? 'active' : ''}
              onClick={() => setTab('login')}
            >
              התחברות
            </button>
            <button
              type="button"
              className={tab === 'register' ? 'active' : ''}
              onClick={() => setTab('register')}
            >
              הרשמה
            </button>
          </div>

          <form className="form" onSubmit={handleAuth}>
            {tab === 'register' && (
              <label>
                שם
                <input
                  value={name}
                  onChange={(ev) => setName(ev.target.value)}
                  placeholder="למשל: יעל"
                  autoComplete="name"
                />
              </label>
            )}
            <label>
              טלפון
              <input
                value={phone}
                onChange={(ev) => setPhone(ev.target.value)}
                placeholder="972501234567"
                required
                autoComplete="tel"
              />
            </label>
            <label>
              סיסמה
              <input
                type="password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                required
                minLength={6}
                autoComplete={
                  tab === 'login' ? 'current-password' : 'new-password'
                }
              />
            </label>
            {error && <p className="err">{error}</p>}
            <button type="submit" disabled={busy} className="primary">
              {busy ? 'ממתין…' : tab === 'login' ? 'כניסה' : 'יצירת חשבון'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="shell wide">
      <header className="topbar">
        <div>
          <h1>MedFlow AI</h1>
          <p className="muted small">
            שלום{me ? `, ${me.name}` : ''}
            {me?.role ? ` · ${me.role}` : ''}
          </p>
        </div>
        <button type="button" className="ghost" onClick={logout}>
          יציאה
        </button>
      </header>

      {error && <p className="err banner">{error}</p>}

      <section className="grid">
        <div className="card">
          <h2>התור הבא</h2>
          {busy && !nextAppt ? (
            <p className="muted">טוען…</p>
          ) : nextAppt ? (
            <div className="highlight">
              <div className="title">{nextAppt.title}</div>
              <div>{formatWhen(nextAppt.dateTime)}</div>
              <div className="muted">{nextAppt.location}</div>
              {nextAppt.notes ? (
                <p className="notes">{nextAppt.notes}</p>
              ) : null}
              {nextAppt.requirements && nextAppt.requirements.length > 0 && (
                <ul className="req">
                  {nextAppt.requirements.map((r: Requirement) => (
                    <li key={r.id}>
                      {r.isDone ? '✓ ' : '○ '}
                      {r.description}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="muted">אין תורים עתידיים במערכת.</p>
          )}
        </div>

        <div className="card">
          <h2>שאלה למערכת (AI)</h2>
          <p className="muted small">
            התשובה מבוססת רק על הנתונים השמורים (תורים דומים לשאילתה).
          </p>
          <textarea
            rows={3}
            value={question}
            onChange={(ev) => setQuestion(ev.target.value)}
          />
          <button
            type="button"
            className="primary"
            disabled={busy || !question.trim()}
            onClick={() => void ask()}
          >
            {busy ? 'חושב…' : 'שאל'}
          </button>
          {answer && <p className="answer">{answer}</p>}
        </div>
      </section>

      <section className="card flat">
        <h2>כל התורים</h2>
        {list.length === 0 ? (
          <p className="muted">אין תורים להצגה.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>כותרת</th>
                  <th>מועד</th>
                  <th>מיקום</th>
                  <th>הערות</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id}>
                    <td>{a.title}</td>
                    <td>{formatWhen(a.dateTime)}</td>
                    <td>{a.location}</td>
                    <td className="ellipsis">{a.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

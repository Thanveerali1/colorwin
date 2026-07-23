import { useEffect, useState } from 'react';
import Shell from '../components/layout/Shell';
import { useAuthStore } from '../store/authStore';
import { getTransactions } from '../api/transactions.api';
import type { Transaction, HistoryFilter } from '../api/transactions.api';
import { getProfile, updateProfileRequest } from '../api/user.api';
import type { Profile, Gender, UpdateProfileInput } from '../api/user.api';

const TABS: { key: HistoryFilter; label: string }[] = [
  { key: 'bets', label: 'Bets' },
  { key: 'deposits', label: 'Deposits' },
  { key: 'withdrawals', label: 'Withdrawals' },
];

const COLOR_DOT: Record<string, string> = {
  RED: 'bg-red-500',
  GREEN: 'bg-emerald-500',
  BLUE: 'bg-blue-500',
};

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
  { value: 'UNSPECIFIED', label: 'Prefer not to say' },
];

// A short, common list rather than the full ISO-3166 set -- easy to extend later.
const COUNTRY_OPTIONS = [
  'India', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany',
  'France', 'Brazil', 'United Arab Emirates', 'Singapore', 'South Africa', 'Other',
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 100 }, (_, i) => CURRENT_YEAR - 13 - i); // 13+ years old minimum

function daysInMonth(month: number, year: number) {
  if (!month || !year) return 31;
  return new Date(year, month, 0).getDate();
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function TxRow({ tx }: { tx: Transaction }) {
  const isPositive = tx.type === 'DEPOSIT' || tx.type === 'WIN' || tx.type === 'BET_CANCELLED';
  const sign = isPositive ? '+' : '-';
  const color = isPositive ? 'text-emerald-400' : 'text-white';

  const labelMap: Record<string, string> = {
    DEPOSIT: 'Deposit',
    WITHDRAW: 'Withdrawal',
    BET: 'Bet placed',
    BET_CANCELLED: 'Bet cancelled',
    WIN: 'Round won',
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-800 last:border-0">
      <div className="flex items-center gap-2">
        {tx.bet && <span className={`w-2.5 h-2.5 rounded-full ${COLOR_DOT[tx.bet.color]}`} />}
        <div>
          <p className="text-sm font-medium">{labelMap[tx.type]}</p>
          <p className="text-xs text-slate-500">{formatTime(tx.createdAt)}</p>
        </div>
      </div>
      <span className={`font-mono text-sm font-semibold ${color}`}>
        {sign}
        {tx.amount.toLocaleString()}
      </span>
    </div>
  );
}

function fieldLabel(text: string) {
  return <p className="text-xs text-slate-500 mb-1">{text}</p>;
}

const inputClass =
  'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-slate-500 disabled:opacity-60';

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [tab, setTab] = useState<HistoryFilter>('bets');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveMessage, setSaveMessage] = useState('');

  const locked = profile?.profileCompleted ?? false;

  // Form fields
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');

  useEffect(() => {
    setTxLoading(true);
    getTransactions(tab)
      .then(setTransactions)
      .catch(() => setTransactions([]))
      .finally(() => setTxLoading(false));
  }, [tab]);

  useEffect(() => {
    setProfileLoading(true);
    getProfile()
      .then((p) => {
        setProfile(p);
        setName(p.name || '');
        setSurname(p.surname || '');
        setPhone(p.phone || '');
        setGender((p.gender as Gender) || '');
        setCountry(p.country || '');
        setCity(p.city || '');
        if (p.dateOfBirth) {
          const d = new Date(p.dateOfBirth);
          setDay(String(d.getDate()));
          setMonth(String(d.getMonth() + 1));
          setYear(String(d.getFullYear()));
        }
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, []);

  function copyUuid() {
    if (!profile) return;
    navigator.clipboard.writeText(profile.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  async function handleUpdate() {
    setErrors({});
    setSaveMessage('');
    setSaving(true);

    const payload: UpdateProfileInput = {
      name: name.trim(),
      surname: surname.trim(),
      phone: phone.trim(),
      country,
      city: city.trim(),
    };
    if (gender) payload.gender = gender;
    if (day && month && year) {
      const dd = day.padStart(2, '0');
      const mm = month.padStart(2, '0');
      payload.dateOfBirth = `${year}-${mm}-${dd}`;
    }

    try {
      const updated = await updateProfileRequest(payload);
      setProfile(updated);
      updateUser({ name: updated.name });
      setSaveMessage('Profile updated.');
      setTimeout(() => setSaveMessage(''), 2500);
    } catch (err: any) {
      const data = err.response?.data;
      if (data?.error === 'PROFILE_LOCKED') {
        // Race condition guard: locked between page load and this request.
        setProfile((p) => (p ? { ...p, profileCompleted: true } : p));
        setSaveMessage('Your details are already locked. Contact support to make changes.');
      } else if (data?.error === 'VALIDATION_ERROR' && data?.details?.fieldErrors) {
        const fieldErrors: Record<string, string> = {};
        for (const [field, msgs] of Object.entries<string[]>(data.details.fieldErrors)) {
          if (msgs?.[0]) fieldErrors[field] = msgs[0];
        }
        setErrors(fieldErrors);
      } else {
        setSaveMessage('Something went wrong. Try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-bold">{user?.name || 'Player'}</h1>
          <p className="text-slate-400 text-sm mt-1">Play-money profile — demo session only.</p>
        </div>

        {/* Main Info card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="font-bold mb-4">Main Info</h2>

          {profileLoading ? (
            <p className="text-slate-500 text-sm text-center py-6">Loading...</p>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                {fieldLabel('UUID')}
                <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5">
                  <span className="text-sm text-slate-300 font-mono truncate flex-1">{profile?.id}</span>
                  <button
                    type="button"
                    onClick={copyUuid}
                    className="text-xs text-slate-400 hover:text-white shrink-0"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div>
                {fieldLabel('Email')}
                <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5">
                  <span className="text-sm text-slate-400 truncate flex-1">{profile?.email}</span>
                  {profile?.emailVerified && <span className="text-emerald-400 text-xs shrink-0">✓ Verified</span>}
                </div>
              </div>

              <div>
                {fieldLabel('Name')}
                <input
                  className={inputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name"
                  disabled={locked}
                />
                {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
              </div>

              <div>
                {fieldLabel('Surname')}
                <input
                  className={inputClass}
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  placeholder="Surname"
                  disabled={locked}
                />
                {errors.surname && <p className="text-red-400 text-xs mt-1">{errors.surname}</p>}
              </div>

              <div>
                {fieldLabel('Phone number')}
                <input
                  className={inputClass}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="Phone number"
                  inputMode="numeric"
                  disabled={locked}
                />
                {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
              </div>

              <div>
                {fieldLabel('Date of birth')}
                <div className="grid grid-cols-3 gap-2">
                  <select className={inputClass} value={day} onChange={(e) => setDay(e.target.value)} disabled={locked}>
                    <option value="">Day</option>
                    {Array.from({ length: daysInMonth(Number(month), Number(year)) }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <select className={inputClass} value={month} onChange={(e) => setMonth(e.target.value)} disabled={locked}>
                    <option value="">Month</option>
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i + 1}>{m}</option>
                    ))}
                  </select>
                  <select className={inputClass} value={year} onChange={(e) => setYear(e.target.value)} disabled={locked}>
                    <option value="">Year</option>
                    {YEARS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                {errors.dateOfBirth && <p className="text-red-400 text-xs mt-1">{errors.dateOfBirth}</p>}
              </div>

              <div>
                {fieldLabel('Gender')}
                <select
                  className={inputClass}
                  value={gender}
                  onChange={(e) => setGender(e.target.value as Gender)}
                  disabled={locked}
                >
                  <option value="">Select gender</option>
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>

              <div>
                {fieldLabel('Country')}
                <select className={inputClass} value={country} onChange={(e) => setCountry(e.target.value)} disabled={locked}>
                  <option value="">Select country</option>
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                {fieldLabel('City')}
                <input
                  className={inputClass}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  disabled={locked}
                />
                {errors.city && <p className="text-red-400 text-xs mt-1">{errors.city}</p>}
              </div>

              {locked ? (
                <div className="bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-3 mt-1">
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Your profile details are locked after the first save. If you need to change
                    something in a field that isn't editable, please{' '}
                    <a href="mailto:support@colorwin.example" className="text-amber-400 underline">
                      contact support
                    </a>
                    .
                  </p>
                </div>
              ) : (
                <>
                  {saveMessage && (
                    <p className={`text-sm ${saveMessage.includes('updated') ? 'text-emerald-400' : 'text-red-400'}`}>
                      {saveMessage}
                    </p>
                  )}
                  <button
                    onClick={handleUpdate}
                    disabled={saving}
                    className="bg-amber-400 text-slate-900 font-bold py-2.5 rounded-lg mt-1 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Update Data'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* History */}
        <div className="flex bg-slate-800 rounded-xl p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold ${
                tab === t.key ? 'bg-slate-700' : 'text-slate-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 min-h-[200px]">
          {txLoading ? (
            <p className="text-slate-500 text-sm text-center py-8">Loading...</p>
          ) : transactions.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">Nothing here yet.</p>
          ) : (
            transactions.map((tx) => <TxRow key={tx.id} tx={tx} />)
          )}
        </div>
      </div>
    </Shell>
  );
}
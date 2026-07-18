import { Link } from 'react-router-dom';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-5">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <div>
          <Link to="/" className="text-amber-400 text-sm underline">
            ← Back to ColorWin
          </Link>
          <h1 className="text-2xl font-bold mt-3">Privacy Policy</h1>
          <p className="text-slate-500 text-xs mt-1">Last updated: July 2026</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-sm text-slate-300 leading-relaxed">
          <strong className="text-amber-400">Heads up:</strong> ColorWin is a personal, non-commercial
          demo project. This policy describes how it actually handles data today, in plain terms. It is
          not a substitute for legal advice, and if this project were ever operated at a larger scale it
          would need a formal legal review.
        </div>

        <Section title="1. What this app is">
          ColorWin is a play-money color-prediction demo game. All in-app currency ("Play Coins") is
          virtual, has no real-world monetary value, cannot be purchased with real money, and cannot be
          exchanged, withdrawn, or redeemed for real money or anything of value.
        </Section>

        <Section title="2. Information we collect">
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>
              <strong>Account information:</strong> your name and email address, and a securely hashed
              version of your password (we never store your actual password). If you sign in with
              Google, we receive your name, email address, and whether Google has verified that email,
              directly from Google — we never see your Google password.
            </li>
            <li>
              <strong>Gameplay and wallet data:</strong> your Play Coins balance, bets placed, round
              outcomes, and transaction history (deposits, withdrawals, bets, and winnings — all in
              virtual currency).
            </li>
            <li>
              <strong>Product usage data:</strong> we use PostHog, a product analytics tool, to
              understand how the app is used — for example, which pages are visited and actions like
              signing up, placing a bet, or making a deposit. These events are tied to an internal
              account identifier, not directly to your name or email inside the analytics tool. We do
              not use session recording or heatmap tracking.
            </li>
            <li>
              <strong>Technical data:</strong> standard information collected automatically by our
              hosting providers, such as IP address and browser type, for security and abuse
              prevention.
            </li>
          </ul>
        </Section>

        <Section title="3. How your session is kept signed in">
          When you log in, we store a login token in your browser's local storage so you don't have to
          log in again every time you visit. This token identifies your session — it is not a
          third-party tracking cookie, and we don't use it to track you across other websites.
        </Section>

        <Section title="4. Password reset codes">
          If you request a password reset, we email a 6-digit verification code to your registered
          email address using Gmail. That code expires after 10 minutes, can only be used a limited
          number of times before it's invalidated, and is never stored in plain text — only a hashed
          version is kept, and only until it's used or expires.
        </Section>

        <Section title="5. Third parties we rely on">
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li><strong>Google Sign-In</strong> — for optional authentication via your Google account.</li>
            <li><strong>Gmail</strong> — to deliver password reset and email verification codes/links.</li>
            <li><strong>PostHog</strong> — for product analytics (page views and in-app events), as described above.</li>
            <li>
              <strong>Infrastructure providers</strong> — our database, caching layer, backend server,
              and frontend hosting are provided by third-party cloud services that store and process
              data on our behalf, under their own security and privacy practices.
            </li>
          </ul>
          We do not sell your data, and we do not share it with advertisers.
        </Section>

        <Section title="6. Data retention">
          We keep your account and gameplay data for as long as your account exists. You can request
          deletion of your account and associated data at any time by contacting us (see below).
        </Section>

        <Section title="7. Your choices">
          You can log out at any time, which removes your session token from your browser and clears
          your analytics identity going forward. You can request access to, correction of, or deletion
          of your personal data by reaching out through the contact method below.
        </Section>

        <Section title="8. Children">
          This app is not directed at children, and we do not knowingly collect information from anyone
          under the age of 13 (or the relevant minimum age in your region).
        </Section>

        <Section title="9. Changes to this policy">
          Since this is an actively developed demo project, this policy may change as features change.
          Material changes will be reflected by updating the "Last updated" date above.
        </Section>

        <Section title="10. Contact">
          For any privacy questions or data requests, reach out via the GitHub repository for this
          project.
        </Section>

        <div className="pt-2">
          <Link to="/terms" className="text-amber-400 text-sm underline">
            Read our Terms of Service →
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <h2 className="font-semibold text-base mb-2">{title}</h2>
      <div className="text-sm text-slate-400 leading-relaxed">{children}</div>
    </div>
  );
}
import { Link } from 'react-router-dom';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-5">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <div>
          <Link to="/" className="text-amber-400 text-sm underline">
            ← Back to ColorWin
          </Link>
          <h1 className="text-2xl font-bold mt-3">Terms of Service</h1>
          <p className="text-slate-500 text-xs mt-1">Last updated: July 2026</p>
        </div>

        <div className="bg-slate-900 border-2 border-amber-400/40 rounded-2xl p-5 text-sm text-slate-200 leading-relaxed">
          <strong className="text-amber-400">This is a virtual-currency demo, not a gambling product.</strong>{' '}
          "Play Coins" have no real-world monetary value. You cannot purchase Play Coins with real money,
          and you cannot exchange, redeem, cash out, or withdraw Play Coins for real money, cryptocurrency,
          goods, or anything of value, under any circumstances. Nothing on this site constitutes real-money
          gambling.
        </div>

        <Section title="1. Acceptance of terms">
          By creating an account or using ColorWin, you agree to these Terms of Service and our{' '}
          <Link to="/privacy" className="text-amber-400 underline">Privacy Policy</Link>. If you don't
          agree, please don't use the service.
        </Section>

        <Section title="2. Eligibility">
          You must be at least 13 years old (or the minimum legal age for online services in your
          region) to create an account.
        </Section>

        <Section title="3. Your account">
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>You're responsible for keeping your login credentials secure.</li>
            <li>You may not share your account, or create multiple accounts to abuse the signup bonus or leaderboard.</li>
            <li>We may suspend or terminate accounts that violate these terms, attempt to exploit bugs, or interfere with the game's fairness.</li>
          </ul>
        </Section>

        <Section title="4. How the game works">
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>Each round, you may place one bet on one color (Red, Blue, or Green) using Play Coins.</li>
            <li>
              The outcome of each round is determined by an independent, weighted random process run on
              our server. It is never influenced by the total amount bet on any color by you or other
              players.
            </li>
            <li>All Play Coins balances, including the signup bonus, exist solely within this demo and have no value outside it.</li>
          </ul>
        </Section>

        <Section title="5. Service provided 'as is'">
          ColorWin is an actively developed demo project. It's provided "as is" and "as available"
          without warranties of any kind. We don't guarantee the service will be uninterrupted,
          error-free, or available at all times. Play Coins balances, account data, or game history may
          be reset, corrected, or lost during development — since no real value is at stake, this
          carries no financial risk to you.
        </Section>

        <Section title="6. Limitation of liability">
          To the fullest extent permitted by law, we are not liable for any damages arising from your
          use of, or inability to use, this service. Since no real money is ever collected, held, or
          paid out through this app, there is no monetary risk associated with using it as intended.
        </Section>

        <Section title="7. Prohibited conduct">
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>Attempting to reverse-engineer, exploit, or tamper with the round outcome logic.</li>
            <li>Using bots, scripts, or automated tools to interact with the game.</li>
            <li>Attempting to convert Play Coins into real currency or trade them outside the app.</li>
            <li>Any conduct intended to disrupt or degrade the service for other users.</li>
          </ul>
        </Section>

        <Section title="8. Changes to these terms">
          We may update these terms as the project develops. Continued use of the app after changes
          means you accept the updated terms.
        </Section>

        <Section title="9. Contact">
          Questions about these terms can be directed via the GitHub repository for this project.
        </Section>

        <div className="pt-2">
          <Link to="/privacy" className="text-amber-400 text-sm underline">
            ← Read our Privacy Policy
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
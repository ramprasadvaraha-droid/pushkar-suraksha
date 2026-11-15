"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { AccountSignIn } from "@/components/AccountSignIn";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";

interface FamilyLandingProps {
  onAuthenticated: (account: { name: string; email?: string }) => void;
  onShowFoundBoard: () => void;
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3.5 10h12m-5-5 5 5-5 5" />
    </svg>
  );
}

function SafetyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3Z" />
      <path d="m8.5 12 2.2 2.2 4.8-4.8" />
    </svg>
  );
}

function FamilyIllustration({ reduceMotion }: { reduceMotion: boolean | null }) {
  return (
    <div className="landing-art" aria-label="Illustration of the Godavari river and a family safety card" role="img">
      <div className="landing-art-glow" />
      <svg className="landing-river-scene" viewBox="0 0 640 560" aria-hidden="true">
        <defs>
          <linearGradient id="river" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#91d3c4" />
            <stop offset="1" stopColor="#3e9d91" />
          </linearGradient>
          <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#fff2d6" />
            <stop offset="1" stopColor="#f8dca9" />
          </linearGradient>
        </defs>
        <path d="M0 0h640v360c-77-19-127-10-207 6-84 17-149 17-232-10C116 330 58 337 0 355V0Z" fill="url(#sky)" />
        <circle cx="465" cy="135" r="52" fill="#efb95b" opacity=".8" />
        <circle cx="465" cy="135" r="73" fill="#efb95b" opacity=".12" />
        <path d="M0 273c72-17 105-1 159 3 54 3 78-14 123-17v101H0v-87Zm431-18c46-21 77-13 111-5 37 10 69-2 98-13v121H431V255Z" fill="#c59b67" opacity=".45" />
        <path d="m112 251 27-48 27 48h-13v32h-28v-32h-13Zm73 2 22-38 22 38h-11v30h-23v-30h-10Zm-105 8 19-33 19 33h-9v24H94v-24h-14Z" fill="#8f694c" opacity=".78" />
        <path d="M0 340c79-20 142-4 214 8 75 13 145-2 219-12 75-10 132-3 207 12v212H0V340Z" fill="url(#river)" />
        <path d="M0 391c87-19 147-6 226 8 77 13 147 1 224-8 75-9 128-4 190 6" fill="none" stroke="#d8f1e8" strokeWidth="3" opacity=".8" />
        <path d="M0 462c83-16 149-1 227 9 82 11 151-3 226-11 71-7 130-4 187 3" fill="none" stroke="#d8f1e8" strokeWidth="2" opacity=".5" />
        <path d="M0 318h640v31c-85-12-145-12-219-3-75 9-145 25-219 12-72-13-135-28-202-8v-32Z" fill="#d9b786" />
        <path d="M0 325h640M0 333h640" stroke="#b48b60" strokeWidth="2" opacity=".7" />
        <path d="M70 350v17m22-13v20m28-16v20m30-13v18m32-14v19m44-20v17m31-21v16m360-22v16m-28-10v18m-30-13v20m-30-16v19m-31-12v18" stroke="#e9d1ac" strokeWidth="3" strokeLinecap="round" />
        <path d="M286 365c-8 11-9 23 0 31 9-8 8-20 0-31Z" fill="#ffdf91" />
        <path d="M286 372v12" stroke="#f8f2d9" strokeWidth="1.5" />
        <path d="M396 383c-7 10-8 20 0 27 8-7 7-17 0-27Z" fill="#ffdf91" />
        <path d="M396 389v11" stroke="#f8f2d9" strokeWidth="1.5" />
      </svg>

      <motion.div
        className="landing-float-note"
        animate={reduceMotion ? undefined : { y: [0, -8, 0] }}
        transition={reduceMotion ? undefined : { duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <span className="landing-float-icon"><SafetyIcon /></span>
        <span><strong>Care, in every detail</strong><small>Private by design</small></span>
      </motion.div>

      <motion.div
        className="landing-safety-card"
        initial={reduceMotion ? false : { opacity: 0, y: 22, rotate: 2 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.7, delay: reduceMotion ? 0 : 0.25, ease: "easeOut" }}
      >
        <div className="landing-safety-card-head">
          <span className="landing-card-emblem">PS</span>
          <span><small>FAMILY SAFETY</small><strong>Everyone, together.</strong></span>
          <span className="landing-card-check" aria-label="Ready">✓</span>
        </div>
        <div className="landing-card-line" />
        <div className="landing-card-member">
          <span className="landing-member-avatar">01</span>
          <span><small>FAMILY MEMBER</small><strong>One number to remember</strong></span>
          <span className="landing-member-number">0842</span>
        </div>
        <div className="landing-card-member">
          <span className="landing-member-avatar landing-member-avatar-alt">02</span>
          <span><small>FAMILY MEMBER</small><strong>One number to share</strong></span>
          <span className="landing-member-number">0843</span>
        </div>
        <div className="landing-card-footer"><SafetyIcon /> Names and phone numbers stay private</div>
      </motion.div>
      <div className="landing-art-caption"><span /> A little more peace of mind by the river</div>
    </div>
  );
}

export function FamilyLanding({ onAuthenticated, onShowFoundBoard }: FamilyLandingProps) {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const enter = reduceMotion ? {} : { initial: { opacity: 0, y: 22 }, animate: { opacity: 1, y: 0 } };

  return (
    <div className="landing-page">
      <div className="landing-topline">
        <span><span className="landing-live-dot" />{t("Here for every family at Godavari Pushkaram")}</span>
        <span>{t("A community-powered safety initiative")}</span>
      </div>
      <header className="landing-nav">
        <Link className="landing-brand" href="/" aria-label={t("Pushkar Suraksha home")}>
          <span className="landing-brand-seal">PS</span>
          <span><strong>Pushkar Suraksha</strong><small>{t("Family safety, together")}</small></span>
        </Link>
        <nav className="landing-nav-links" aria-label={t("Main navigation")}>
          <a href="#how-it-works">{t("How it works")}</a>
          <button type="button" onClick={onShowFoundBoard}>{t("Found-person board")}</button>
          <Link className="landing-volunteer-link" href="/volunteer">{t("Volunteer portal")}<ArrowIcon /></Link>
          <LanguageSwitcher />
        </nav>
      </header>

      <main>
        <section className="landing-hero">
          <motion.div className="landing-hero-copy" {...enter} transition={{ duration: 0.65, ease: "easeOut" }}>
            <div className="landing-kicker"><span className="landing-kicker-icon"><SafetyIcon /></span>{t("FAMILY SAFETY FOR GODAVARI PUSHKARAM")}</div>
            <h1>{t("A little more peace of mind for your family's big journey.")}</h1>
            <p className="landing-hero-description">
              {t("Simple family registration, personal safety numbers, and a helping hand when you need one most.")}
            </p>
            <div className="landing-hero-actions">
              <motion.a
                className="landing-button landing-button-primary"
                href="#get-started"
                whileHover={reduceMotion ? undefined : { y: -2 }}
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
              >
                {t("Create your family safety record")}<ArrowIcon />
              </motion.a>
              <button className="landing-button landing-button-quiet" type="button" onClick={onShowFoundBoard}>
                {t("See safe reunions")}<span aria-hidden="true">↗</span>
              </button>
            </div>
            <div className="landing-hero-proof">
              <div className="landing-proof-avatars" aria-hidden="true"><span>F</span><span>+</span><span>V</span></div>
              <p><strong>{t("Families and volunteers, working together.")}</strong><span>{t("One simple plan. One community looking out for one another.")}</span></p>
            </div>
          </motion.div>
          <motion.div
            className="landing-hero-visual"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
          >
            <FamilyIllustration reduceMotion={reduceMotion} />
          </motion.div>
          <a className="landing-scroll-hint" href="#how-it-works"><span />{t("A safer visit starts with a few simple steps")}</a>
        </section>

        <section className="landing-value-strip" aria-label={t("Safety highlights")}>
          <div><span className="landing-value-icon"><SafetyIcon /></span><span><strong>{t("Your details stay private")}</strong><small>{t("Personal details are never shown on the public board.")}</small></span></div>
          <div><span className="landing-value-icon landing-value-icon-gold">01</span><span><strong>{t("A number for every member")}</strong><small>{t("Easy-to-carry slips help families stay connected.")}</small></span></div>
          <div><span className="landing-value-icon landing-value-icon-teal">♥</span><span><strong>{t("People-first support")}</strong><small>{t("Trained volunteers help families reunite safely.")}</small></span></div>
        </section>

        <section className="landing-place" aria-labelledby="landing-place-title">
          <figure className="landing-place-photo">
            <div className="landing-place-image">
              <Image
                src="/godavari-bridge-panorama.jpg"
                alt={t("The Godavari Bridge railway crossing over the river at Rajahmundry, Andhra Pradesh.")}
                width={1024}
                height={242}
                sizes="(max-width: 720px) 100vw, 56vw"
                loading="eager"
              />
              <div className="landing-place-photo-shade" />
              <span className="landing-place-location"><span aria-hidden="true">⌖</span>{t("RAJAHMUNDRY · ANDHRA PRADESH")}</span>
              <span className="landing-place-photo-title">{t("The Godavari Bridge")}</span>
            </div>
          </figure>
          <div className="landing-place-copy">
            <span className="landing-section-label">{t("A RIVER FESTIVAL, A SHARED JOURNEY")}</span>
            <h2 id="landing-place-title">{t("The Godavari brings us together.")}</h2>
            <p>{t("Godavari Pushkaralu is a sacred river festival dedicated to the Godavari. Every 12 years, devotees gather at the ghats in Rajahmundry to pray and take a holy dip, honoring the river and its traditions.")}</p>
            <div className="landing-place-fact"><span><SafetyIcon /></span>{t("A simple family plan can help everyone stay connected in a busy crowd.")}</div>
          </div>
        </section>

        <section className="landing-how" id="how-it-works">
          <div className="landing-section-heading">
            <span className="landing-section-label">{t("A SIMPLE PLAN FOR A BUSY DAY")}</span>
            <h2>{t("Prepared together. Safer together.")}</h2>
            <p>{t("A few small steps can make it easier to find one another in a busy crowd.")}</p>
          </div>
          <div className="landing-step-grid">
            <motion.article className="landing-step-card" whileHover={reduceMotion ? undefined : { y: -5 }}>
              <span className="landing-step-index">01</span>
              <span className="landing-step-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3" /><path d="M3 19c0-3.3 2.5-5 6-5s6 1.7 6 5M17 11a3 3 0 1 0-2-5.7M17 14c2.6.1 4 1.8 4 4.5" /></svg></span>
              <h3>{t("Create a family account")}</h3>
              <p>{t("Sign up with an email address, verify the code, then add your family details.")}</p>
            </motion.article>
            <motion.article className="landing-step-card" whileHover={reduceMotion ? undefined : { y: -5 }}>
              <span className="landing-step-index">02</span>
              <span className="landing-step-icon landing-step-icon-warm"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM8 9h8m-8 4h5" /><path d="m15 17 2 2 4-4" /></svg></span>
              <h3>{t("Keep your safety numbers close")}</h3>
              <p>{t("Get a unique number for each family member and keep the printable slips handy.")}</p>
            </motion.article>
            <motion.article className="landing-step-card" whileHover={reduceMotion ? undefined : { y: -5 }}>
              <span className="landing-step-index">03</span>
              <span className="landing-step-icon landing-step-icon-green"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.1V12a8 8 0 1 1-4.7-7.3M20 4l-8 8-3-3" /></svg></span>
              <h3>{t("Reach out when you need help")}</h3>
              <p>{t("Report a missing family member so approved volunteers can respond and help.")}</p>
            </motion.article>
          </div>
        </section>

        <section className="landing-privacy">
          <div className="landing-privacy-icon"><SafetyIcon /></div>
          <div>
            <span className="landing-section-label">{t("BUILT AROUND TRUST")}</span>
            <h2>{t("Your family's information belongs to your family.")}</h2>
            <p>{t("Names and phone numbers are kept private. The public found board shares only a member number, photo, and ghat. Face search is optional and requires your explicit consent.")}</p>
          </div>
          <button className="landing-privacy-link" type="button" onClick={onShowFoundBoard}>{t("View found-person board")}<ArrowIcon /></button>
        </section>

        <section className="landing-start" id="get-started">
          <motion.div className="landing-start-copy" {...(reduceMotion ? {} : { initial: { opacity: 0, y: 18 }, whileInView: { opacity: 1, y: 0 } })} viewport={{ once: true, amount: 0.25 }} transition={{ duration: 0.55 }}>
            <span className="landing-section-label">{t("START WITH YOUR FAMILY")}</span>
            <h2>{t("Let’s make your visit feel a little safer.")}</h2>
            <p>{t("Create an account to begin. You can add family details and photos after signing in.")}</p>
            <div className="landing-start-points">
              <span><SafetyIcon />{t("Secure sign-in with email verification")}</span>
              <span><SafetyIcon />{t("Your choice and consent matter")}</span>
              <span><SafetyIcon />{t("Printable member safety slips")}</span>
            </div>
          </motion.div>
          <motion.div className="landing-signup-card" {...(reduceMotion ? {} : { initial: { opacity: 0, y: 18 }, whileInView: { opacity: 1, y: 0 } })} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.55, delay: 0.08 }}>
            <div className="landing-signup-heading">
              <span className="landing-signup-icon"><SafetyIcon /></span>
              <span><strong>{t("Your family's safety starts here.")}</strong><small>{t("Create an account or sign in to continue.")}</small></span>
            </div>
            <AccountSignIn
              allowPassword
              allowSignUp
              onAuthenticated={onAuthenticated}
            />
            <p className="landing-signup-footnote">{t("By continuing, you can review all family details and consent choices before registration.")}</p>
          </motion.div>
        </section>
      </main>

      <footer className="landing-footer">
        <Link className="landing-brand" href="/">
          <span className="landing-brand-seal">PS</span>
          <span><strong>Pushkar Suraksha</strong><small>{t("Family safety, together")}</small></span>
        </Link>
        <p>{t("A community-powered safety initiative for Godavari Pushkaram.")}</p>
        <details className="landing-photo-credits">
          <summary>{t("Photo credits")}</summary>
          <p>
            <a href="https://commons.wikimedia.org/wiki/File:Godavari_bridge_panorama.jpg" target="_blank" rel="noreferrer">
              Godavari bridge panorama by Tatiraju.rishabh · Wikimedia Commons
            </a>
            {" · "}
            <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">CC BY-SA 3.0</a>
          </p>
        </details>
        <Link href="/volunteer">{t("Volunteer portal")}<ArrowIcon /></Link>
      </footer>
    </div>
  );
}
